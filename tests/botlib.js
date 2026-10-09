// Cliente "robô" que fala o protocolo real do jogo. Usado nos testes e na carga de 12 jogadores.
// Requer Node 22+ (WebSocket nativo).
import { getRegion } from '../shared/islands.js';
import { RODS } from '../shared/items.js';
import { createMinigame, stepMinigame, encodeInputs, MG_DT } from '../shared/minigame.js';
import { WALK_SPEED } from '../shared/config.js';
import { botHold } from './bot-brain.js';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export class Bot {
  constructor(url, name, opts = {}) {
    this.url = url; this.name = name; this.opts = opts;
    this.msgs = []; this.waiters = [];
    this.me = null; this.room = null; this.others = new Map();
    this.snapshots = 0;
  }
  connect(join) {
    return new Promise((resolve, reject) => {
      const ws = new WebSocket(this.url);
      this.ws = ws;
      ws.onopen = () => ws.send(JSON.stringify({ t: 'join', name: this.name, char: this.opts.char ?? 0, ...join }));
      ws.onerror = (e) => reject(e);
      ws.onclose = (e) => { this.closed = { code: e.code, reason: e.reason }; this._emit({ t: '_closed', code: e.code }); };
      ws.onmessage = (ev) => {
        const m = JSON.parse(ev.data);
        this._handle(m);
        if (m.t === 'welcome') resolve(m);
        if (m.t === 'err') resolve(m);
      };
    });
  }
  _handle(m) {
    switch (m.t) {
      case 'welcome': this.me = m.you; this.room = m.room; for (const o of m.players) this.others.set(o.p.id, o); break;
      case 'room': this.room = m.room; break;
      case 'me': case 'shop': if (m.you) this.me = m.you; break;
      case 'fish': if (m.you) this.me = m.you; if (m.baits) { this.me.baits = m.baits; this.me.bait = m.baitEq; } break;
      case 'pos': if (m.mode === 'walk') { this.me.x = m.x; this.me.y = m.y; } else if (this.me.boat) { Object.assign(this.me.boat, { x: m.x, y: m.y, a: m.a }); } this.corrections = (this.corrections || 0) + 1; break;
      case 'mode': this.me.mode = m.mode; if (m.mode === 'boat') { this.me.boat = { ...m.boat }; this.me.x = m.boat.x; this.me.y = m.boat.y; } else { this.me.boat = null; this.me.x = m.x; this.me.y = m.y; } break;
      case 'region': this.me = m.you; this.others.clear(); for (const o of m.players) this.others.set(o.p.id, o); break;
      case 'pj': this.others.set(m.p.id, m); break;
      case 'pl': this.others.delete(m.id); break;
      case 's': this.snapshots++; break;
    }
    this._emit(m);
  }
  _emit(m) {
    this.msgs.push(m);
    if (this.msgs.length > 400) this.msgs.splice(0, 200);
    for (const w of [...this.waiters]) if (w.pred(m)) { this.waiters.splice(this.waiters.indexOf(w), 1); clearTimeout(w.to); w.res(m); }
  }
  waitFor(pred, ms = 15000, label = '') {
    return new Promise((res, rej) => {
      const w = { pred, res, to: setTimeout(() => { this.waiters.splice(this.waiters.indexOf(w), 1); rej(new Error(`timeout esperando ${label} (${this.name})`)); }, ms) };
      this.waiters.push(w);
    });
  }
  send(o) { if (this.ws.readyState === 1) this.ws.send(JSON.stringify(o)); }
  close() { try { this.ws.close(); } catch {} }
  get region() { return getRegion(this.me.region); }

  // ── Caminhada por BFS numa grade de 16 px ──
  pathTo(tx, ty) {
    const r = this.region, S = 8, W = 384, H = 288;
    const sx = Math.floor(this.me.x / S), sy = Math.floor(this.me.y / S);
    let best = null, bd = Infinity;
    const prev = new Int32Array(W * H).fill(-1), seen = new Uint8Array(W * H);
    const q = [sy * W + sx]; seen[q[0]] = 1;
    for (let i = 0; i < q.length; i++) {
      const c = q[i], x = c % W, y = (c / W) | 0;
      const d = Math.hypot(x * S + S / 2 - tx, y * S + S / 2 - ty);
      if (d < bd) { bd = d; best = c; }
      if (d < 12) break;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = x + dx, ny = y + dy, n = ny * W + nx;
        if (nx < 0 || ny < 0 || nx >= W || ny >= H || seen[n]) continue;
        if (!r.walkable(nx * S + S / 2, ny * S + S / 2) || !r.walkable(x * S + S / 2 + dx * S / 2, y * S + S / 2 + dy * S / 2)) continue;
        seen[n] = 1; prev[n] = c; q.push(n);
      }
    }
    const pts = [];
    for (let c = best; c !== -1; c = prev[c]) pts.push({ x: (c % W) * S + S / 2, y: ((c / W) | 0) * S + S / 2 });
    return pts.reverse();
  }
  async walkTo(tx, ty, speedMul = 1) {
    const pts = this.pathTo(tx, ty);
    const step = (WALK_SPEED * speedMul) / 15;
    for (const p of pts) {
      let guard = Math.ceil(Math.hypot(p.x - this.me.x, p.y - this.me.y) / step) * 2 + 6;
      while (Math.hypot(p.x - this.me.x, p.y - this.me.y) > 1 && guard-- > 0) {
        const dx = p.x - this.me.x, dy = p.y - this.me.y, d = Math.hypot(dx, dy);
        const k = Math.min(1, step / d);
        let nx = this.me.x + dx * k, ny = this.me.y + dy * k;
        if (!this.region.walkable(nx, ny)) { // desliza ao longo do obstáculo, como o cliente
          if (this.region.walkable(nx, this.me.y)) ny = this.me.y;
          else if (this.region.walkable(this.me.x, ny)) nx = this.me.x;
          else break;
        }
        this.me.x = nx; this.me.y = ny;
        const dir = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 2 : 1) : (dy > 0 ? 0 : 3);
        this.send({ t: 'st', rg: this.me.region, m: 0, x: nx, y: ny, d: dir, an: 1 });
        await sleep(1000 / 15);
      }
    }
    this.send({ t: 'st', rg: this.me.region, m: 0, x: this.me.x, y: this.me.y, d: 0, an: 0 });
    await sleep(80);
    return Math.hypot(tx - this.me.x, ty - this.me.y);
  }
  async sailTo(tx, ty, stopDist = 30) {
    const route = this.region.findRoute(this.me.boat.x, this.me.boat.y, tx, ty);
    const step = 200 / 15;
    for (const p of route.slice(1)) {
      let guard = 0;
      while (Math.hypot(p.x - this.me.boat.x, p.y - this.me.boat.y) > 8 && guard++ < 2000) {
        const b = this.me.boat;
        const dx = p.x - b.x, dy = p.y - b.y, d = Math.hypot(dx, dy);
        const k = Math.min(1, step / d);
        const nx = b.x + dx * k, ny = b.y + dy * k;
        b.a = Math.atan2(dy, dx);
        if (!this.region.navigable(nx, ny)) break; // não força a passagem por terra
        b.x = nx; b.y = ny;
        this.send({ t: 'st', rg: this.me.region, m: 1, x: b.x, y: b.y, a: b.a, v: 200 });
        await sleep(1000 / 15);
        if (Math.hypot(tx - b.x, ty - b.y) < stopDist) return;
      }
    }
  }
  // Ponto de água mais próximo dentro do alcance da vara
  findCastTarget() {
    const r = this.region, range = RODS[this.me.rod].range * 0.9;
    let best = null;
    for (let d = 50; d < range && !best; d += 12)
      for (let k = 0; k < 32; k++) {
        const a = (k / 32) * Math.PI * 2;
        const x = this.me.x + Math.cos(a) * d, y = this.me.y + Math.sin(a) * d;
        if (r.fishable(x, y) && r.fishable(x + 10, y) && r.fishable(x, y + 10)) { best = { x, y, power: Math.min(1, (d + 10) / RODS[this.me.rod].range) }; break; }
      }
    return best;
  }
  // Ciclo completo: lançar → esperar → fisgar → minigame → resultado
  async fishOnce(skill = 0.85) {
    const tgt = this.findCastTarget();
    if (!tgt) throw new Error('sem água ao alcance');
    this.send({ t: 'cast', x: tgt.x, y: tgt.y, power: tgt.power });
    const c = await this.waitFor((m) => m.t === 'fish' && (m.st === 'cast' || m.st === 'castNo'), 5000, 'cast');
    if (c.st === 'castNo') return { result: 'castNo', reason: c.reason };
    await this.waitFor((m) => m.t === 'fish' && m.st === 'bite', 20000, 'mordida');
    await sleep(200 + Math.random() * 300);
    this.send({ t: 'hook' });
    const f = await this.waitFor((m) => m.t === 'fish' && (m.st === 'fight' || m.st === 'lost'), 5000, 'luta');
    if (f.st === 'lost') return { result: 'lost', reason: f.reason };
    const s = createMinigame(f.params, f.seed);
    const bits = [];
    while (!s.done) { const h = botHold(s, skill); bits.push(h ? 1 : 0); stepMinigame(s, h); }
    await sleep(bits.length * MG_DT * 1000); // joga em tempo real
    this.send({ t: 'fight', ...encodeInputs(bits) });
    const r = await this.waitFor((m) => m.t === 'fish' && (m.st === 'caught' || m.st === 'lost'), 5000, 'resultado');
    return r.st === 'caught' ? { result: 'caught', fish: r.fish, isNew: r.isNew } : { result: 'lost', reason: r.reason };
  }
}
export { sleep };
