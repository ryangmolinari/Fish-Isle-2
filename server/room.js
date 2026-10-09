// Sala de jogo: estado autoritativo de até 12 jogadores espalhados pelas 5 ilhas.
import { randomBytes, randomInt } from 'node:crypto';
import {
  MAX_PLAYERS_PER_ROOM, SERVER_TICK_HZ, RECONNECT_GRACE_MS, PROFILE_KEEP_MS, WALK_SPEED, BOAT_MAX_SPEED,
  START_COINS, START_CAPACITY, CAPACITY_STEP, CAPACITY_MAX, FISHING, ROOM_CODE_CHARS,
} from '../shared/config.js';
import { getRegion, ISLAND_ORDER, START_ISLAND, ISLANDS } from '../shared/islands.js';
import { SPECIES_BY_ID, rollSpecies, rollSize } from '../shared/fish.js';
import { RODS, BAITS, COSMETICS, SHOPS, shopSells, capacityUpgradePrice } from '../shared/items.js';
import { minigameParams, decodeInputs, replayMinigame, MG_DT, MG_MAX_TICKS } from '../shared/minigame.js';
import { mulberry32 } from '../shared/rng.js';

const FS = { none: 0, cast: 1, wait: 2, bite: 3, fight: 4, show: 5 };
const CHARS = 6;

export function makeCode(exists) {
  for (;;) {
    let c = '';
    for (let i = 0; i < 5; i++) c += ROOM_CODE_CHARS[randomInt(ROOM_CODE_CHARS.length)];
    if (!exists(c)) return c;
  }
}

function cleanName(n) {
  const s = String(n ?? '').replace(/[\u0000-\u001f<>]/g, '').replace(/\s+/g, ' ').trim().slice(0, 16);
  return s || 'Pescador';
}

export class Room {
  constructor(code, isPublic, log = () => {}) {
    this.code = code;
    this.isPublic = isPublic;
    this.profiles = new Map(); // token -> profile
    this.nextId = 1;
    this.log = log;
    this.created = Date.now();
    this.uidSeq = 1;
    this.timer = setInterval(() => this.tick(), 1000 / SERVER_TICK_HZ);
    this.timer.unref?.();
    this.lastActivity = Date.now();
  }
  destroy() { clearInterval(this.timer); }

  // Jogadores ocupando vaga: conectados + desconectados recentemente (reconexão)
  occupancy(now = Date.now()) {
    let n = 0;
    for (const p of this.profiles.values()) if (p.ws || now - p.leftAt < RECONNECT_GRACE_MS) n++;
    return n;
  }
  connectedCount() { let n = 0; for (const p of this.profiles.values()) if (p.ws) n++; return n; }
  isEmptyAndStale(now = Date.now()) {
    if (this.connectedCount() > 0) return false;
    for (const p of this.profiles.values()) if (now - p.leftAt < PROFILE_KEEP_MS) return false;
    return now - this.created > 10_000;
  }

  // ───────── Entrada / saída ─────────
  join(ws, msg) {
    const now = Date.now();
    let p = msg.token ? this.profiles.get(String(msg.token)) : null;
    if (!p) {
      if (this.occupancy(now) >= MAX_PLAYERS_PER_ROOM) return { error: 'full' };
      p = this.newProfile(msg);
      this.profiles.set(p.token, p);
    } else {
      // reconexão: recupera a vaga se o período de graça acabou e a sala lotou
      if (!p.ws && now - p.leftAt >= RECONNECT_GRACE_MS && this.occupancy(now) >= MAX_PLAYERS_PER_ROOM) return { error: 'full' };
      if (p.ws && p.ws !== ws) { // mesma conta em outra aba: derruba a antiga, nunca duplica
        const old = p.ws;
        p.ws = null;
        old.send(JSON.stringify({ t: 'kicked', msg: 'Sua sessão foi aberta em outra janela.' }));
        old.close(4000, 'replaced');
      }
      if (msg.name) p.name = cleanName(msg.name);
      if (Number.isInteger(msg.char) && msg.char >= 0 && msg.char < CHARS) p.char = msg.char;
      // estado seguro após reconectar: nunca preso pescando
      this.resetFishing(p, false);
    }
    p.ws = ws;
    p.leftAt = Infinity;
    p.lastMove = now;
    p.msgWindow = now; p.msgCount = 0;
    ws.profile = p;
    ws.room = this;
    this.lastActivity = now;
    this.send(p, { t: 'welcome', you: this.privateState(p), room: this.roomInfo(), players: this.regionPlayers(p.region, p.id), now });
    this.broadcastRegion(p.region, { t: 'pj', p: this.publicInfo(p), s: this.stateRow(p) }, p);
    this.broadcastRoomInfo();
    this.log(`[${this.code}] ${p.name} entrou (${this.connectedCount()}/${MAX_PLAYERS_PER_ROOM})`);
    return { ok: true };
  }

  newProfile(msg) {
    const region = getRegion(START_ISLAND);
    const sp = region.findWalkable(region.spawn.x + randomInt(-30, 31), region.spawn.y + randomInt(-20, 21));
    return {
      token: randomBytes(16).toString('hex'),
      id: this.nextId++,
      name: cleanName(msg.name),
      char: Number.isInteger(msg.char) && msg.char >= 0 && msg.char < CHARS ? msg.char : 0,
      coins: START_COINS,
      capacity: START_CAPACITY,
      inventory: [],
      collection: {},
      rods: ['vara_bambu'], rod: 'vara_bambu',
      baits: { minhoca: 5 }, bait: null,
      cosmetics: [], equip: { hat: null, paint: null, flag: null },
      region: START_ISLAND,
      x: sp.x, y: sp.y, dir: 0, anim: 0, mode: 'walk',
      boat: null,
      fish: { st: 'none' },
      aim: 0, charge: 0, tension: 0,
      ws: null, leftAt: Infinity, lastMove: Date.now(), corrections: 0,
      stats: { caught: 0, sold: 0, earned: 0 },
    };
  }

  leave(ws) {
    const p = ws.profile;
    if (!p || p.ws !== ws) return;
    p.ws = null;
    p.leftAt = Date.now();
    this.resetFishing(p, false);
    this.broadcastRegion(p.region, { t: 'pl', id: p.id });
    this.broadcastRoomInfo();
    this.log(`[${this.code}] ${p.name} saiu (${this.connectedCount()}/${MAX_PLAYERS_PER_ROOM})`);
  }

  // ───────── Serialização ─────────
  roomInfo() { return { code: this.code, count: this.connectedCount(), max: MAX_PLAYERS_PER_ROOM, isPublic: this.isPublic, byIsland: this.byIsland() }; }
  byIsland() {
    const o = Object.fromEntries(ISLAND_ORDER.map((i) => [i, 0]));
    for (const p of this.profiles.values()) if (p.ws) o[p.region]++;
    return o;
  }
  publicInfo(p) { return { id: p.id, name: p.name, char: p.char, equip: p.equip, rod: p.rod }; }
  privateState(p) {
    return {
      id: p.id, token: p.token, name: p.name, char: p.char, coins: p.coins, capacity: p.capacity,
      inventory: p.inventory, collection: p.collection, rods: p.rods, rod: p.rod, baits: p.baits, bait: p.bait,
      cosmetics: p.cosmetics, equip: p.equip, region: p.region, x: p.x, y: p.y, dir: p.dir, mode: p.mode, boat: p.boat,
      stats: p.stats,
    };
  }
  // linha compacta do snapshot
  stateRow(p) {
    const f = p.fish;
    const fs = FS[f.st] ?? 0;
    const row = [p.id, Math.round(p.x), Math.round(p.y), p.dir, p.anim, p.mode === 'boat' ? 1 : 0, fs];
    if (p.mode === 'boat') row.push(Math.round(p.boat.x), Math.round(p.boat.y), +p.boat.a.toFixed(3), Math.round(p.boat.v));
    else row.push(0, 0, 0, 0);
    if (fs) row.push(Math.round(f.tx), Math.round(f.ty), Math.round((Date.now() - f.t0)), +p.tension.toFixed(2));
    else row.push(0, 0, 0, 0);
    row.push(+p.aim.toFixed(2), +p.charge.toFixed(2));
    return row;
  }
  regionPlayers(region, exceptId) {
    const out = [];
    for (const q of this.profiles.values()) if (q.ws && q.region === region && q.id !== exceptId) out.push({ p: this.publicInfo(q), s: this.stateRow(q) });
    return out;
  }

  send(p, obj) { if (p.ws) p.ws.send(JSON.stringify(obj)); }
  broadcastRegion(region, obj, except = null) {
    const s = JSON.stringify(obj);
    for (const q of this.profiles.values()) if (q.ws && q.region === region && q !== except) q.ws.send(s);
  }
  broadcastRoomInfo() {
    const s = JSON.stringify({ t: 'room', room: this.roomInfo() });
    for (const q of this.profiles.values()) if (q.ws) q.ws.send(s);
  }
  syncMe(p, extra = {}) { this.send(p, { t: 'me', you: this.privateState(p), ...extra }); }
  toast(p, msg, kind = 'info') { this.send(p, { t: 'toast', msg, kind }); }

  // ───────── Laço do servidor ─────────
  tick() {
    const now = Date.now();
    const byRegion = new Map();
    for (const p of this.profiles.values()) {
      if (!p.ws) continue;
      this.updateFishing(p, now);
      if (!byRegion.has(p.region)) byRegion.set(p.region, []);
      byRegion.get(p.region).push(this.stateRow(p));
    }
    // snapshot enviado apenas aos jogadores da mesma região
    for (const [region, rows] of byRegion) this.broadcastRegion(region, { t: 's', n: now, r: rows });
  }

  // ───────── Mensagens ─────────
  handle(ws, m) {
    const p = ws.profile;
    if (!p || p.ws !== ws) return;
    const now = Date.now();
    // limite simples de taxa
    if (now - p.msgWindow > 1000) { p.msgWindow = now; p.msgCount = 0; }
    if (++p.msgCount > 80) return;
    switch (m.t) {
      case 'st': return this.onState(p, m, now);
      case 'cast': return this.onCast(p, m, now);
      case 'hook': return this.onHook(p, now);
      case 'fight': return this.onFightResult(p, m, now);
      case 'fishCancel': return this.resetFishing(p, true);
      case 'board': return this.onBoard(p);
      case 'unboard': return this.onUnboard(p);
      case 'travel': return this.onTravel(p, m);
      case 'buy': return this.onBuy(p, m);
      case 'sell': return this.onSell(p, m);
      case 'equip': return this.onEquip(p, m);
      case 'ping': return this.send(p, { t: 'pong', c: m.c, n: now });
      case 'chat': return; // reservado
    }
  }

  onState(p, m, now) {
    // ignora atualizações atrasadas de outra região/modo (mensagens em trânsito durante transições)
    if (m.rg !== p.region || (m.m === 1) !== (p.mode === 'boat')) return;
    const x = +m.x, y = +m.y;
    if (!Number.isFinite(x) || !Number.isFinite(y)) return;
    const region = getRegion(p.region);
    const dt = Math.min(1, Math.max(0.02, (now - p.lastMove) / 1000));
    p.aim = Number.isFinite(+m.aa) ? +m.aa : p.aim;
    p.charge = Math.max(0, Math.min(1, +m.ch || 0));
    p.tension = Math.max(0, Math.min(1, +m.tn || 0));
    if (p.mode === 'walk') {
      p.dir = (m.d | 0) & 3;
      p.anim = Math.max(0, Math.min(3, m.an | 0));
      const d = Math.hypot(x - p.x, y - p.y);
      if (d < 0.5) { p.lastMove = now; return; }
      const maxD = WALK_SPEED * dt * 1.4 + 14;
      if (d > maxD || !region.walkable(x, y)) return this.correct(p);
      if (p.fish.st !== 'none' && p.fish.st !== 'show' && d > 0) {
        p.fishDrift = (p.fishDrift || 0) + d;
        if (p.fishDrift > 24) this.resetFishing(p, true);
      }
      p.x = x; p.y = y; p.lastMove = now;
    } else if (p.boat) {
      const a = +m.a, v = +m.v;
      const d = Math.hypot(x - p.boat.x, y - p.boat.y);
      const maxD = BOAT_MAX_SPEED * dt * 1.35 + 18;
      if (d > maxD || !region.navigable(x, y)) return this.correct(p);
      p.boat.x = x; p.boat.y = y;
      if (Number.isFinite(a)) p.boat.a = a;
      if (Number.isFinite(v)) p.boat.v = Math.max(-BOAT_MAX_SPEED, Math.min(BOAT_MAX_SPEED, v));
      p.x = x; p.y = y; p.lastMove = now;
    }
  }
  correct(p) {
    p.lastMove = Date.now();
    p.corrections++;
    if (p.mode === 'walk') this.send(p, { t: 'pos', x: p.x, y: p.y, mode: 'walk' });
    else this.send(p, { t: 'pos', x: p.boat.x, y: p.boat.y, a: p.boat.a, mode: 'boat' });
  }

  // ───────── Pesca ─────────
  resetFishing(p, notify) {
    const was = p.fish.st;
    p.fish = { st: 'none' };
    p.fishDrift = 0;
    p.tension = 0;
    if (notify && was !== 'none') this.send(p, { t: 'fish', st: 'idle' });
  }
  onCast(p, m, now) {
    const no = (reason) => this.send(p, { t: 'fish', st: 'castNo', reason });
    if (p.mode !== 'walk') return no('Desça do barco para pescar.');
    if (p.fish.st !== 'none' && p.fish.st !== 'show') return no('Você já está pescando.');
    if (p.inventory.length >= p.capacity) return no('Inventário cheio! Venda peixes ou amplie a mochila.');
    const tx = +m.x, ty = +m.y, power = Math.max(0, Math.min(1, +m.power || 0));
    if (!Number.isFinite(tx) || !Number.isFinite(ty)) return no('Lançamento inválido.');
    const region = getRegion(p.region);
    const rod = RODS[p.rod];
    const d = Math.hypot(tx - p.x, ty - p.y);
    if (power < FISHING.minCastPower) return no('Segure um pouco mais para dar força.');
    if (d > rod.range * power + 32 || d > rod.range + 20) return no('Longe demais para esta vara.');
    if (d < 28) return no('Perto demais.');
    if (!region.fishable(tx, ty)) return no('Mire em uma área de água livre.');
    // consome isca no servidor
    let bait = null;
    if (p.bait && (p.baits[p.bait] | 0) > 0) {
      bait = BAITS[p.bait];
      p.baits[p.bait]--;
      if (p.baits[p.bait] <= 0) { delete p.baits[p.bait]; p.bait = null; }
    }
    const hot = region.hotspotAt(tx, ty);
    const rnd = Math.random;
    let wait = FISHING.biteWaitMin + (FISHING.biteWaitMax - FISHING.biteWaitMin) * rnd();
    if (bait) wait *= bait.waitMult;
    if (hot) wait *= FISHING.hotspotWaitMult;
    p.fish = {
      st: 'cast', tx, ty, t0: now, power,
      landAt: now + FISHING.castFlightTime * 1000,
      biteAt: now + FISHING.castFlightTime * 1000 + wait * 1000,
      bait: bait?.id || null, hot: !!hot,
    };
    p.fishDrift = 0;
    p.dir = this.dirFromAngle(Math.atan2(ty - p.y, tx - p.x));
    this.send(p, { t: 'fish', st: 'cast', x: tx, y: ty, t0: now, hot: !!hot, bait: bait?.id || null, baits: p.baits, baitEq: p.bait });
  }
  dirFromAngle(a) { // 0 baixo, 1 esquerda, 2 direita, 3 cima
    const c = Math.cos(a), s = Math.sin(a);
    if (Math.abs(c) > Math.abs(s)) return c > 0 ? 2 : 1;
    return s > 0 ? 0 : 3;
  }
  updateFishing(p, now) {
    const f = p.fish;
    switch (f.st) {
      case 'cast':
        if (now >= f.landAt) { f.st = 'wait'; }
        break;
      case 'wait':
        if (now >= f.biteAt) {
          // o servidor sorteia o peixe no momento da mordida
          const mult = {};
          const bait = f.bait ? BAITS[f.bait] : null;
          if (bait) Object.assign(mult, bait.rarity);
          if (f.hot) { mult.uncommon = (mult.uncommon ?? 1) * (1 + FISHING.hotspotRareBonus); mult.rare = (mult.rare ?? 1) * (1 + FISHING.hotspotRareBonus); }
          const sp = rollSpecies(p.region, Math.random, mult);
          f.sp = sp.id;
          f.size = rollSize(sp, Math.random);
          f.st = 'bite';
          f.biteUntil = now + FISHING.reactionWindow * 1000;
          this.send(p, { t: 'fish', st: 'bite', until: f.biteUntil, rarity: sp.rarity });
        } else if (now - f.t0 > FISHING.maxFishingIdleSeconds * 1000) this.resetFishing(p, true);
        break;
      case 'bite':
        if (now > f.biteUntil + 350) {
          this.send(p, { t: 'fish', st: 'lost', reason: 'late', msg: 'O peixe soltou a isca. Clique mais rápido quando a boia afundar!' });
          p.fish = { st: 'none' };
        }
        break;
      case 'fight':
        if (now - f.fightStart > FISHING.fightTimeoutSeconds * 1000) {
          this.send(p, { t: 'fish', st: 'lost', reason: 'timeout', msg: 'A luta demorou demais e o peixe escapou.' });
          p.fish = { st: 'none' };
        }
        break;
      case 'show':
        if (now > f.showUntil) p.fish = { st: 'none' };
        break;
    }
  }
  onHook(p, now) {
    const f = p.fish;
    if (f.st !== 'bite') {
      if (f.st === 'wait' || f.st === 'cast') { // puxou cedo: a isca sai d'água
        this.send(p, { t: 'fish', st: 'lost', reason: 'early', msg: 'Cedo demais! Espere a boia afundar.' });
        p.fish = { st: 'none' };
      }
      return;
    }
    if (now > f.biteUntil + 350) return; // tratado no tick
    const sp = SPECIES_BY_ID[f.sp];
    f.st = 'fight';
    f.seed = randomInt(1, 2 ** 31 - 1);
    f.params = minigameParams(sp, RODS[p.rod]);
    f.fightStart = now;
    this.send(p, { t: 'fish', st: 'fight', seed: f.seed, params: f.params, rarity: sp.rarity, cm: f.size.cm });
  }
  onFightResult(p, m, now) {
    const f = p.fish;
    if (f.st !== 'fight') return;
    let bits;
    try { bits = decodeInputs({ n: Math.min(MG_MAX_TICKS, m.n | 0), b64: String(m.b64 || '') }); } catch { bits = []; }
    const sim = replayMinigame(f.params, f.seed, bits);
    const elapsed = (now - f.fightStart) / 1000;
    const minElapsed = sim.tick * MG_DT * 0.8 - 0.4;
    const valid = sim.done && sim.tick === bits.length && elapsed >= minElapsed;
    if (!valid || sim.result !== 'caught') {
      const msg = !valid ? 'A captura não pôde ser confirmada.' : sim.result === 'snapped' ? 'A linha arrebentou! Solte o botão quando a tensão estiver alta.' : 'O peixe escapou…';
      this.send(p, { t: 'fish', st: 'lost', reason: valid ? sim.result : 'invalid', msg });
      p.fish = { st: 'none' };
      return;
    }
    if (p.inventory.length >= p.capacity) {
      this.send(p, { t: 'fish', st: 'lost', reason: 'full', msg: 'Inventário cheio — o peixe voltou para a água.' });
      p.fish = { st: 'none' };
      return;
    }
    const sp = SPECIES_BY_ID[f.sp];
    const fish = { uid: `${p.id}-${this.uidSeq++}`, sp: sp.id, cm: f.size.cm, kg: f.size.kg, value: f.size.value, isl: sp.island, t: now };
    p.inventory.push(fish);
    const c = p.collection[sp.id] || { n: 0, max: 0, first: now };
    const isNew = c.n === 0;
    c.n++; c.max = Math.max(c.max, fish.cm);
    const record = !isNew && fish.cm >= c.max;
    p.collection[sp.id] = c;
    p.stats.caught++;
    p.fish = { st: 'show', tx: f.tx, ty: f.ty, t0: f.t0, showUntil: now + 2600 };
    this.send(p, { t: 'fish', st: 'caught', fish, isNew, record, you: this.privateState(p) });
    this.broadcastRegion(p.region, { t: 'fx', k: 'catch', id: p.id, sp: sp.id, cm: fish.cm, isNew }, p);
    this.log(`[${this.code}] ${p.name} pescou ${sp.name} (${sp.rarity}) ${fish.cm}cm`);
  }

  // ───────── Barco e viagem ─────────
  onBoard(p) {
    if (p.mode !== 'walk') return;
    if (p.fish.st !== 'none' && p.fish.st !== 'show') this.resetFishing(p, true);
    const region = getRegion(p.region);
    const m = region.moorings.find((mm) => Math.hypot(mm.board.x - p.x, mm.board.y - p.y) < 90);
    if (!m) return this.toast(p, 'Vá até a ponta do cais para pegar um barco.');
    // cada jogador recebe o próprio barco: procura uma vaga livre ao lado do cais
    const taken = [...this.profiles.values()].filter((q) => q !== p && q.ws && q.region === p.region && q.mode === 'boat').map((q) => q.boat);
    let spot = null;
    const [dx, dy] = m.dock.dir;
    const px = -dy, py = dx; // perpendicular
    for (let k = 0; k < 24 && !spot; k++) {
      const side = k % 2 ? -1 : 1, step = Math.ceil(k / 2);
      const cx = m.boat.x + px * side * step * 52 + dx * Math.floor(step / 3) * 40, cy = m.boat.y + py * side * step * 52 + dy * Math.floor(step / 3) * 40;
      if (region.boatFits(cx, cy, m.boat.a) && taken.every((b) => Math.hypot(b.x - cx, b.y - cy) > 46)) spot = { x: cx, y: cy };
    }
    if (!spot) spot = region.findNavigable(m.boat.x, m.boat.y, m.boat.a);
    p.mode = 'boat';
    p.boat = { x: spot.x, y: spot.y, a: m.boat.a, v: 0 };
    p.x = spot.x; p.y = spot.y; p.lastMove = Date.now();
    this.send(p, { t: 'mode', mode: 'boat', boat: p.boat });
  }
  onUnboard(p) {
    if (p.mode !== 'boat') return;
    const region = getRegion(p.region);
    let best = null, bd = Infinity;
    for (const m of region.moorings) {
      const d = Math.hypot(m.boat.x - p.boat.x, m.boat.y - p.boat.y);
      if (d < bd) { bd = d; best = m; }
    }
    if (!best || bd > 200) return this.toast(p, 'Aproxime-se de um cais para desembarcar.');
    const pos = region.findWalkable(best.board.x, best.board.y);
    p.mode = 'walk';
    p.boat = null;
    p.x = pos.x; p.y = pos.y; p.lastMove = Date.now();
    this.send(p, { t: 'mode', mode: 'walk', x: p.x, y: p.y });
  }
  onTravel(p, m) {
    const to = String(m.to);
    if (p.mode !== 'boat' || !ISLANDS[to] || to === p.region) return;
    const region = getRegion(p.region);
    const g = region.gates[to];
    if (Math.hypot(g.x - p.boat.x, g.y - p.boat.y) > g.r + 50) return this.toast(p, 'Siga a rota até a passagem marcada no mar.');
    const from = p.region;
    this.resetFishing(p, false);
    this.broadcastRegion(from, { t: 'pl', id: p.id }, p);
    const dest = getRegion(to);
    const arr = dest.arrivalFrom(from);
    p.region = to;
    p.boat = { x: arr.x, y: arr.y, a: arr.a, v: 60 };
    p.x = arr.x; p.y = arr.y; p.lastMove = Date.now();
    this.send(p, { t: 'region', region: to, from, boat: p.boat, players: this.regionPlayers(to, p.id), you: this.privateState(p) });
    this.broadcastRegion(to, { t: 'pj', p: this.publicInfo(p), s: this.stateRow(p) }, p);
    this.broadcastRoomInfo();
    this.log(`[${this.code}] ${p.name} viajou ${from} → ${to}`);
  }

  // ───────── Loja ─────────
  nearShop(p) {
    const region = getRegion(p.region);
    return p.mode === 'walk' && Math.hypot(region.shop.x - p.x, region.shop.y - p.y) < 110;
  }
  onBuy(p, m) {
    const fail = (msg) => this.send(p, { t: 'shop', ok: false, msg });
    if (!this.nearShop(p)) return fail('Você precisa estar na loja.');
    const kind = String(m.kind), id = String(m.id ?? '');
    if (!shopSells(p.region, kind, id)) return fail('Esta loja não vende esse item.');
    let price, apply, label;
    if (kind === 'rod') {
      const r = RODS[id];
      if (!r) return fail('Item inválido.');
      if (p.rods.includes(id)) return fail('Você já tem essa vara.');
      price = r.price; label = r.name;
      apply = () => { p.rods.push(id); p.rod = id; };
    } else if (kind === 'bait') {
      const b = BAITS[id];
      if (!b) return fail('Item inválido.');
      if ((p.baits[id] | 0) + b.pack > 200) return fail('Você não consegue carregar mais dessa isca.');
      price = b.price; label = `${b.name} ×${b.pack}`;
      apply = () => { p.baits[id] = (p.baits[id] | 0) + b.pack; if (!p.bait) p.bait = id; };
    } else if (kind === 'capacity') {
      price = capacityUpgradePrice(p.capacity);
      if (price == null) return fail('A mochila já está no tamanho máximo.');
      label = `Mochila +${CAPACITY_STEP}`;
      apply = () => { p.capacity = Math.min(CAPACITY_MAX, p.capacity + CAPACITY_STEP); };
    } else if (kind === 'cosmetic') {
      const c = COSMETICS[id];
      if (!c) return fail('Item inválido.');
      if (p.cosmetics.includes(id)) return fail('Você já tem esse item.');
      price = c.price; label = c.name;
      apply = () => { p.cosmetics.push(id); p.equip[c.slot] = id; };
    } else return fail('Item inválido.');
    if (!Number.isInteger(price) || price < 0) return fail('Preço inválido.');
    if (p.coins < price) return fail('Moedas insuficientes.');
    p.coins -= price;
    apply();
    this.send(p, { t: 'shop', ok: true, msg: `Comprou ${label} por ${price} moedas.`, you: this.privateState(p) });
    if (kind === 'cosmetic' || kind === 'rod') this.broadcastRegion(p.region, { t: 'pi', p: this.publicInfo(p) }, p);
  }
  onSell(p, m) {
    const fail = (msg) => this.send(p, { t: 'shop', ok: false, msg });
    if (!this.nearShop(p)) return fail('Você precisa estar na loja.');
    if (!Array.isArray(m.uids) || m.uids.length === 0 || m.uids.length > 200) return fail('Nada selecionado.');
    const want = new Set(m.uids.map(String));
    const sold = p.inventory.filter((f) => want.has(f.uid));
    if (sold.length !== want.size) return fail('Alguns peixes não estão mais no inventário.');
    const total = sold.reduce((a, f) => a + f.value, 0);
    if (Number.isFinite(+m.expect) && +m.expect !== total) return fail('Os valores mudaram. Confira de novo.');
    p.inventory = p.inventory.filter((f) => !want.has(f.uid));
    p.coins += total;
    p.stats.sold += sold.length; p.stats.earned += total;
    this.send(p, { t: 'shop', ok: true, sold: sold.length, total, msg: `Vendeu ${sold.length} peixe${sold.length > 1 ? 's' : ''} por ${total} moedas.`, you: this.privateState(p) });
  }
  onEquip(p, m) {
    const kind = String(m.kind), id = m.id == null ? null : String(m.id);
    if (kind === 'rod') {
      if (!p.rods.includes(id)) return;
      if (p.fish.st !== 'none' && p.fish.st !== 'show') return this.toast(p, 'Recolha a linha antes de trocar de vara.');
      p.rod = id;
    } else if (kind === 'bait') {
      if (id !== null && !(p.baits[id] > 0)) return;
      p.bait = id;
    } else if (kind === 'cosmetic') {
      const slot = String(m.slot);
      if (!['hat', 'paint', 'flag'].includes(slot)) return;
      if (id !== null && (!p.cosmetics.includes(id) || COSMETICS[id].slot !== slot)) return;
      p.equip[slot] = id;
    } else if (kind === 'char') {
      const c = m.id | 0;
      if (c < 0 || c >= CHARS) return;
      p.char = c;
    } else return;
    this.syncMe(p);
    this.broadcastRegion(p.region, { t: 'pi', p: this.publicInfo(p) }, p);
  }
}
