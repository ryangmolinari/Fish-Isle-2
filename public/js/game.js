// Fish Isle — cliente: laço do jogo, rede, câmera, movimento, barco, viagens e interface.
import { WALK_SPEED, BOAT_MAX_SPEED, BOAT_ACCEL, BOAT_DRAG, BOAT_TURN, CLIENT_SEND_HZ, WORLD_W, WORLD_H, RARITIES } from '/shared/config.js';
import { getRegion, ISLANDS, ISLAND_ORDER } from '/shared/islands.js';
import { SPECIES_BY_ID, SPECIES } from '/shared/fish.js';
import { SHOPS } from '/shared/items.js';
import { Net } from './net.js';
import { Input } from './input.js';
import { sound } from './audio.js';
import { settings, onSettings, setSession, getSession } from './settings.js';
import { RegionView } from './world/regionView.js';
import { Particles } from './world/particles.js';
import { Avatar, dirFromVec } from './entities.js';
import { Fishing } from './fishing.js';
import { Menu } from './ui/menu.js';
import { Hud } from './ui/hud.js';
import { Panels } from './ui/panels.js';
import { $, el, esc, fmt } from './ui/dom.js';
import { fishDataURL, fishImage } from './art/fishArt.js';
import { drawCharFrame, CHARACTERS } from './art/charArt.js';
import { PALETTES } from './art/palettes.js';
import { roundRect, TAU, makeCanvas } from './art/util.js';
import { installDebug, autoStep } from './debug.js';

const KEEPERS = { tropical: [1, 'chapeu_palha'], mangue: [4, 'chapeu_explorador'], congelada: [5, 'gorro_la'], vulcanica: [3, 'bandana_brasa'], cristais: [2, 'tiara_cristal'] };
const QSCALE = { low: 0.6, medium: 0.8, high: 1 };

export class Game {
  constructor() {
    this.canvas = $('#game');
    this.ctx = this.canvas.getContext('2d', { alpha: false });
    this.input = new Input(this.canvas);
    this.net = new Net();
    this.particles = new Particles(900);
    this.particles.setQuality(settings.quality);
    this.fishing = new Fishing(this);
    this.panels = new Panels($('#modal-root'), this);
    this.hud = null;
    this.state = 'menu';
    this.flags = { water: 1, waves: 1, land: 1, objects: 1, light: 1, vig: 1, parts: 1 }; // camadas (perfilamento)
    this.time = 0;
    this.others = new Map();
    this.cam = { x: 1500, y: 1100 };
    this.destination = null;
    this.route = null;
    this.toastsEl = $('#toasts');
    this.perf = { frames: 0, fps: 0, frameMs: 0, acc: 0, worst: 0, samples: [] };
    window.__fishisle = this;
    installDebug(this);
    this._bindNet();
    this.menu = new Menu($('#menu'), { play: (o) => this.join(o), settings: () => this.panels.show('settings') });
    onSettings((s) => { this.particles.setQuality(s.quality); this.view?.setQuality(s.quality); this._resize(true); $('#fps').classList.toggle('hidden', !s.showFps); });
    $('#fps').classList.toggle('hidden', !settings.showFps);
    addEventListener('resize', () => this._resize(true));
    addEventListener('pointerdown', () => sound.init(), { once: true });
    addEventListener('keydown', () => sound.init(), { once: true });
    this._resize(true);
    this.last = performance.now();
    requestAnimationFrame((t) => this._frame(t));
  }
  get inGame() { return this.state === 'playing'; }
  get region() { return this.view?.region; }
  get uiHit() { return false; }

  // ───────────── Conexão ─────────────
  async join(o) {
    sound.init();
    this.menu.setBusy(true); this.menu.clearError();
    const join = { mode: o.mode, code: o.code, token: o.token || (o.mode === 'code' && getSession()?.code === o.code ? getSession().token : undefined), name: settings.name || 'Pescador', char: settings.char | 0 };
    const res = await this.net.connect(join);
    this.menu.setBusy(false);
    if (res.t === 'err') {
      if (res.code === 'notfound' && o.token) setSession(null);
      this.menu.error(res.msg);
      return;
    }
    this._welcome(res);
  }
  _welcome(m) {
    this.you = m.you;
    this.room = m.room;
    setSession({ code: m.room.code, token: m.you.token });
    this.net.joinMsg = { mode: 'code', code: m.room.code, token: m.you.token, name: m.you.name, char: m.you.char };
    if (!this.me || this.me.id !== m.you.id) this.me = new Avatar({ id: m.you.id, name: m.you.name, char: m.you.char, equip: m.you.equip, rod: m.you.rod }, true);
    this.me.setInfo(m.you);
    this._enterRegion(m.you.region, m.players);
    this.me.mode = m.you.mode;
    this.me.x = m.you.x; this.me.y = m.you.y; this.me.dir = m.you.dir || 0;
    if (m.you.mode === 'boat' && m.you.boat) Object.assign(this.me.boat, m.you.boat);
    this.cam.x = this.me.x; this.cam.y = this.me.y;
    this.fishing.reset();
    this.state = 'playing';
    this.menu.hide();
    if (!this.hud) this.hud = new Hud($('#hud'), this);
    $('#hud').classList.remove('hidden');
    $('#reconnect').classList.add('hidden');
    this.hud.update();
    if (!this._welcomed) { this._welcomed = true; this.toast(`Bem-vindo à sala ${m.room.code}! Clique e segure na água para pescar.`, 'ok'); }
  }
  _enterRegion(id, players = []) {
    if (this.view && this.view.id !== id) { this.view.dispose(); this.view = null; }
    this.regionId = id;
    if (!this.view) this.view = new RegionView(id, this.renderScale, settings.quality, this.particles);
    this.others.clear();
    for (const o of players) this._addOther(o);
    sound.ambience(id);
    const keeper = KEEPERS[id];
    const shop = getRegion(id).shop;
    this.npc = { x: shop.x, y: shop.y, char: keeper[0], hat: keeper[1], name: SHOPS[id].keeper };
    this.route = null;
  }
  _addOther(o) {
    const a = new Avatar(o.p);
    a.snapTo(o.s);
    this.others.set(a.id, a);
  }
  _bindNet() {
    const n = this.net;
    n.on('s', (m) => { for (const r of m.r) if (r[0] !== this.me?.id) this.others.get(r[0])?.push(m.n, r); });
    n.on('pj', (m) => { if (m.p.id !== this.me?.id) this._addOther(m); });
    n.on('pl', (m) => this.others.delete(m.id));
    n.on('pi', (m) => this.others.get(m.p.id)?.setInfo(m.p));
    n.on('room', (m) => { this.room = m.room; this.hud?.update(); if (this.panels.kind === 'map') this.panels.refresh(); });
    n.on('me', (m) => this.applyYou(m.you));
    n.on('toast', (m) => { this.toast(m.msg, m.kind); this._travelPending = false; });
    n.on('pos', (m) => {
      this.corrections = (this.corrections || 0) + 1;
      if (m.mode === 'walk' && this.me.mode === 'walk') { this.me.x = m.x; this.me.y = m.y; }
      if (m.mode === 'boat' && this.me.mode === 'boat') { this.me.boat.x = m.x; this.me.boat.y = m.y; this.me.boat.a = m.a; this.me.boat.v = 0; this.me.x = m.x; this.me.y = m.y; }
    });
    n.on('mode', (m) => {
      this.me.mode = m.mode;
      if (m.mode === 'boat') {
        Object.assign(this.me.boat, m.boat); this.me.x = m.boat.x; this.me.y = m.boat.y;
        sound.play('board');
        this.toast(this.destination ? `Siga a rota pontilhada até a passagem para ${ISLANDS[this.destination].name}.` : 'No barco! Use WASD para navegar e M para escolher o destino.', 'ok');
      } else {
        this.me.x = m.x; this.me.y = m.y; this.me.boat.v = 0;
        sound.play('board'); sound.engine(0);
        if (this.destination === this.regionId) this.destination = null;
      }
      this.route = null;
    });
    n.on('region', (m) => this._onRegion(m));
    n.on('fish', (m) => this.fishing.onServer(m));
    n.on('shop', (m) => {
      if (m.you) this.applyYou(m.you);
      this.toast(m.msg, m.ok ? 'ok' : 'warn');
      sound.play(m.ok ? 'coin' : 'error');
      if (m.ok && m.total) for (let i = 0; i < Math.min(12, m.sold * 2); i++) this.particles.spawn('coin', this.me.x + (Math.random() - 0.5) * 20, this.me.y - 20, { z: 30, vz: 80 + Math.random() * 60, g: 260, vx: (Math.random() - 0.5) * 60, life: 1, size: 3 });
      this.panels.refresh();
    });
    n.on('fx', (m) => {
      const a = this.others.get(m.id);
      if (!a) return;
      a.fv.showSp = m.sp; a.showUntil = this.time + 2.6;
      const sp = SPECIES_BY_ID[m.sp];
      if (sp.rarity === 'rare' || sp.rarity === 'legendary') this.toast(`${a.name} pescou ${RARITIES[sp.rarity].symbol} ${sp.name}!`, 'ok', m.sp);
    });
    n.on('kicked', (m) => { this.quitToMenu(); this.menu.error(m.msg); });
    n.on('pong', () => this.hud?.ping(this.net.rtt));
    n.on('_disconnected', () => this._reconnect());
  }
  async _reconnect() {
    if (this.state !== 'playing') return;
    this.fishing.reset();
    $('#reconnect').classList.remove('hidden');
    for (let i = 0; i < 25; i++) {
      await new Promise((r) => setTimeout(r, i ? 1500 : 400));
      if (this.state !== 'playing') return;
      const res = await this.net.connect(this.net.joinMsg);
      if (res.t === 'welcome') { this._welcome(res); this.toast('Reconectado!', 'ok'); return; }
      if (res.t === 'err' && res.code !== 'offline') { $('#reconnect').classList.add('hidden'); this.quitToMenu(); this.menu.error(res.msg); return; }
    }
    $('#reconnect').classList.add('hidden');
    this.quitToMenu();
    this.menu.error('Não foi possível reconectar ao servidor.');
  }
  quitToMenu() {
    this.net.close();
    this.state = 'menu';
    this.panels.close();
    this.fishing.reset();
    this.view?.dispose(); this.view = null;
    this.others.clear();
    $('#hud').classList.add('hidden'); $('#prompt').classList.add('hidden');
    sound.engine(0);
    this.menu.show();
  }
  applyYou(you) {
    this.you = you;
    this.me?.setInfo(you);
    this.hud?.update();
    this.panels.refresh();
  }

  // ───────────── Viagem entre regiões ─────────────
  _startTravel(to) {
    if (this._travelPending) return;
    this._travelPending = true;
    this._travelT = performance.now();
    this.net.send({ t: 'travel', to });
    this._fade(true, ISLANDS[to].name, ISLANDS[to].subtitle);
    sound.play('travel');
    setTimeout(() => { if (this._travelPending && this.state === 'playing') { this._travelPending = false; this._fade(false); } }, 4000);
  }
  _onRegion(m) {
    const wait = Math.max(0, 650 - (performance.now() - (this._travelT || 0)));
    this._fade(true, ISLANDS[m.region].name, ISLANDS[m.region].subtitle);
    setTimeout(() => {
      this.fishing.reset();
      this.applyYou(m.you);
      this._enterRegion(m.region, m.players);
      this.me.mode = 'boat';
      Object.assign(this.me.boat, m.boat);
      this.me.x = m.boat.x; this.me.y = m.boat.y;
      this.cam.x = this.me.x; this.cam.y = this.me.y;
      this.view.terrain.warm(this.me.x, this.me.y, 900);
      this._travelPending = false;
      if (this.destination === m.region) this.toast(`Chegou à ${ISLANDS[m.region].name}! Siga a rota até o cais para desembarcar.`, 'ok');
      setTimeout(() => this._fade(false), 250);
      this.hud.update();
    }, wait);
  }
  _fade(on, title = '', sub = '') {
    const f = $('#fade');
    if (on) { $('.fade-title', f).textContent = title; $('.fade-sub', f).textContent = sub; }
    f.classList.toggle('on', on);
  }
  setDestination(id) {
    this.destination = id;
    this.route = null;
    this.toast(this.me.mode === 'boat' ? `Destino: ${ISLANDS[id].name}. Siga a rota pontilhada no mar.` : `Destino: ${ISLANDS[id].name}. Pegue um barco no cais (E).`, 'ok');
  }
  // alvo atual da navegação (passagem ou cais)
  navTarget() {
    const r = this.region;
    if (!r) return null;
    if (this.destination && this.destination !== this.regionId) {
      if (this.me.mode === 'boat') { const g = r.gates[this.destination]; return { x: g.x, y: g.y, label: 'Rumo a', name: ISLANDS[this.destination].name, kind: 'gate' }; }
      const m = r.moorings[0]; return { x: m.board.x, y: m.board.y, label: 'Vá até o', name: 'cais', kind: 'dock' };
    }
    if (this.me.mode === 'boat' && this.destination === this.regionId) { const m = r.moorings[0]; return { x: m.boat.x, y: m.boat.y, label: 'Desembarque no', name: `cais — ${ISLANDS[this.regionId].short}`, kind: 'moor' }; }
    return null;
  }

  // ───────────── Avisos ─────────────
  toast(msg, kind = 'info', fishId) {
    const t = el(`<div class="toast ${kind}">${fishId ? `<img alt="" src="${fishDataURL(fishId, 'icon', 96)}">` : ''}<span>${esc(msg)}</span></div>`);
    this.toastsEl.appendChild(t);
    while (this.toastsEl.children.length > 5) this.toastsEl.firstChild.remove();
    setTimeout(() => { t.classList.add('out'); setTimeout(() => t.remove(), 350); }, 3800);
  }
  flashHint(text, ms) {
    const h = $('#hint'); h.textContent = text; h.classList.remove('hidden');
    h.style.animation = 'none'; void h.offsetWidth; h.style.animation = '';
    clearTimeout(this._hintT); this._hintT = setTimeout(() => h.classList.add('hidden'), ms);
  }
  onCatch(fish, isNew, record) {
    const sp = SPECIES_BY_ID[fish.sp], rar = RARITIES[sp.rarity];
    sound.play(sp.rarity === 'legendary' ? 'legendary' : 'catch');
    if (isNew) sound.play('newSpecies');
    for (let i = 0; i < (sp.rarity === 'legendary' ? 40 : 14); i++) this.particles.spawn('sparkle', this.me.x + (Math.random() - 0.5) * 50, this.me.y - 40 - Math.random() * 30, { size: 2 + Math.random() * 2, life: 0.8 + Math.random() * 0.6, color: sp.rarity === 'legendary' ? '#ffd23f' : '#ffffff', vz: 20 });
    const total = Object.values(this.you.collection).filter((c) => c.n > 0).length;
    const card = el(`<div class="catch-card ${sp.rarity}">${isNew ? '<span class="new">NOVA ESPÉCIE!</span>' : record ? '<span class="new" style="background:#3aa6c4">NOVO RECORDE!</span>' : ''}
      <img alt="${esc(sp.name)}" src="${fishDataURL(sp.id, 'card', 520)}"><h3>${esc(sp.name)}</h3>
      <div class="meta"><span class="rar ${sp.rarity}">${rar.symbol} ${rar.label}</span><span>${String(fish.cm).replace('.', ',')} cm</span><span>${fish.kg < 1 ? Math.round(fish.kg * 1000) + ' g' : String(fish.kg.toFixed(2)).replace('.', ',') + ' kg'}</span><span>${fmt(fish.value)} 🪙</span></div>
      <div class="muted" style="margin-top:6px">${isNew ? `Coleção: ${total}/50 espécies` : `Mochila: ${this.you.inventory.length}/${this.you.capacity}`}</div></div>`);
    $('#ui').querySelector('.catch-card')?.remove();
    $('#ui').appendChild(card);
    setTimeout(() => { card.style.transition = 'opacity .4s'; card.style.opacity = '0'; setTimeout(() => card.remove(), 450); }, 3200);
    this.hud.update();
  }
  onPanelChange() {
    this.input.releaseAll();
    if (this.panels.open) { $('#ui').querySelector('.catch-card')?.remove(); if (this.fishing.state === 'charge') this.fishing.cancel(false); }
  }
  waterSplashColor() { return '#ffffff'; }

  // ───────────── Câmera e escala ─────────────
  _resize(force) {
    const w = innerWidth, h = innerHeight;
    const dpr = Math.min(2, devicePixelRatio || 1) * QSCALE[settings.quality] * (settings.dynRes !== false ? this.dyn || 1 : 1);
    if (!force && this.cssW === w && this.cssH === h && this.dpr === dpr) return;
    this.cssW = w; this.cssH = h; this.dpr = dpr;
    this.canvas.width = Math.round(w * dpr); this.canvas.height = Math.round(h * dpr);
    this.zoom = Math.max(1.05, Math.min(2.6, Math.min(w / 820, h / 520)));
    this.view?.setScale(this.renderScale);
  }
  get renderScale() { return this.zoom * this.dpr; }
  // Resolução dinâmica: reduz a resolução interna quando o FPS cai e volta quando há folga
  _adaptResolution(fps) {
    if (settings.dynRes === false || this.state !== 'playing' || document.hidden) return;
    this.dyn = this.dyn || 1;
    if (fps < 50) { this._low = (this._low || 0) + 1; this._high = 0; }
    else if (fps > 58.5) { this._high = (this._high || 0) + 1; this._low = 0; }
    else { this._low = 0; this._high = 0; }
    if (this._low >= 3 && this.dyn > 0.6) { this.dyn = Math.max(0.6, this.dyn - 0.1); this._low = 0; this._resize(true); }
    if (this._high >= 12 && this.dyn < 1) { this.dyn = Math.min(1, this.dyn + 0.05); this._high = 0; this._resize(true); }
  }
  viewRect() {
    const w = this.cssW / this.zoom, h = this.cssH / this.zoom;
    return { x0: this.cam.x - w / 2, y0: this.cam.y - h / 2, x1: this.cam.x + w / 2, y1: this.cam.y + h / 2 };
  }
  worldMouse() {
    const v = this.viewRect();
    return { x: v.x0 + this.input.mouse.x / this.zoom, y: v.y0 + this.input.mouse.y / this.zoom };
  }
  toScreen(x, y) { const v = this.viewRect(); return [(x - v.x0) * this.zoom, (y - v.y0) * this.zoom]; }

  // ───────────── Laço principal ─────────────
  _frame(now) {
    requestAnimationFrame((t) => this._frame(t));
    const rawDt = (now - this.last) / 1000;
    this.last = now;
    const dt = Math.min(0.05, Math.max(0, rawDt));
    this.time += dt;
    const t0 = performance.now();
    if (this.state === 'playing' && this.view) { this._update(dt); this._render(dt); }
    else this._renderMenu(dt);
    this.input.endFrame();
    // estatísticas de desempenho
    const p = this.perf;
    p.frames++; p.acc += rawDt;
    p.samples.push(performance.now() - t0);
    if (p.samples.length > 240) p.samples.shift();
    if (p.acc >= 0.5) {
      p.fps = p.frames / p.acc; p.frames = 0; p.acc = 0;
      p.frameMs = p.samples.reduce((a, b) => a + b, 0) / p.samples.length;
      if (settings.showFps) $('#fps').textContent = `${p.fps.toFixed(0)} FPS · ${p.frameMs.toFixed(1)} ms · ${this.others.size + 1} na ilha${this.dyn < 1 ? ` · resolução ${Math.round(this.dyn * 100)}%` : ''}`;
      this._adaptResolution(p.fps);
    }
  }

  _update(dt) {
    const inp = this.input, me = this.me;
    inp.blocked = this.panels.open || this._travelPending || $('#fade').classList.contains('on');
    // teclas de interface
    if (inp.hit('Escape')) {
      if (!this.panels.escape()) {
        if (this.fishing.busy && !['fight', 'resolving', 'show'].includes(this.fishing.state)) this.fishing.cancel();
        else this.panels.show('settings');
      }
    }
    if (!this._travelPending) {
      if (inp.hit('i')) { if (this.panels.kind === 'inventory') this.panels.close(); else if (!['fight', 'resolving'].includes(this.fishing.state)) this.panels.show('inventory', { tab: 'inv' }); }
      if (inp.hit('m')) { if (this.panels.kind === 'map') this.panels.close(); else if (!['fight', 'resolving'].includes(this.fishing.state)) this.panels.show('map'); }
      if (inp.hit('e')) { if (this.panels.kind === 'shop') this.panels.close(); else if (!inp.blocked) this._interact(); }
    }
    // movimento
    if (me.mode === 'walk') this._walk(dt); else this._sail(dt);
    this.fishing.update(dt, this.time);
    // interpolação dos remotos
    const rt = this.net.serverNow() - 120;
    for (const a of this.others.values()) a.interpolate(rt, dt);
    // câmera
    const look = me.mode === 'boat' ? 0.45 : 0;
    const tx = me.x + Math.cos(me.boat.a) * me.boat.v * look, ty = me.y + Math.sin(me.boat.a) * me.boat.v * look - (me.mode === 'walk' ? 16 : 0);
    const k = 1 - Math.exp(-dt * 7);
    this.cam.x += (tx - this.cam.x) * k; this.cam.y += (ty - this.cam.y) * k;
    const v = this.viewRect(), hw = (v.x1 - v.x0) / 2, hh = (v.y1 - v.y0) / 2;
    this.cam.x = Math.max(hw, Math.min(WORLD_W - hw, this.cam.x)); this.cam.y = Math.max(hh, Math.min(WORLD_H - hh, this.cam.y));
    this.view.update(dt, this.time, this.viewRect());
    this.particles.update(dt);
    this._sendState();
    this._prompts();
    this._navigation(dt);
  }

  _walk(dt) {
    const me = this.me, r = this.region;
    let [ax, ay] = this.input.axis();
    if (!ax && !ay && !this.input.blocked) { const a = autoStep(this, dt); if (a) [ax, ay] = a; }
    if (this.fishing.locksMovement) { ax = 0; ay = 0; }
    const L = Math.hypot(ax, ay);
    me.moving = false;
    if (L > 0) {
      const sp = WALK_SPEED * dt / L;
      const nx = me.x + ax * sp, ny = me.y + ay * sp;
      let moved = false;
      if (r.walkable(nx, ny)) { me.x = nx; me.y = ny; moved = true; }
      else if (ax && r.walkable(nx, me.y)) { me.x = nx; moved = true; }
      else if (ay && r.walkable(me.x, ny)) { me.y = ny; moved = true; }
      if (moved) { me.moving = true; me.walkDist += WALK_SPEED * dt; me.phase = Math.floor(me.walkDist / 7) % 4; }
      me.dir = dirFromVec(ax, ay);
    }
  }
  _sail(dt) {
    const me = this.me, b = me.boat, r = this.region;
    let [ax, ay] = this.input.axis();
    if (!ax && !ay && !this.input.blocked) { const a = autoStep(this, dt); if (a) [ax, ay] = a; }
    const thrust = -ay; // W acelera, S dá ré/freia
    const target = thrust > 0 ? BOAT_MAX_SPEED : thrust < 0 ? -BOAT_MAX_SPEED * 0.35 : 0;
    if (thrust) b.v += Math.sign(target - b.v) * Math.min(Math.abs(target - b.v), BOAT_ACCEL * dt * (Math.sign(thrust) !== Math.sign(b.v) && b.v ? 1.8 : 1));
    else b.v -= b.v * Math.min(1, BOAT_DRAG * dt);
    if (Math.abs(b.v) < 2 && !thrust) b.v = 0;
    const turn = ax * BOAT_TURN * dt * (0.35 + 0.65 * Math.min(1, Math.abs(b.v) / 90)) * (b.v < 0 ? -1 : 1);
    if (r.boatFits(b.x, b.y, b.a + turn) || this._looseFit(b.x, b.y, b.a + turn)) b.a += turn;
    // encostado na margem: empurra suavemente para a água livre (nunca fica preso)
    if (!r.boatFits(b.x, b.y, b.a)) {
      let px = 0, py = 0;
      for (let k = 0; k < 12; k++) { const a = (k / 12) * TAU; if (!r.navigable(b.x + Math.cos(a) * 28, b.y + Math.sin(a) * 28)) { px -= Math.cos(a); py -= Math.sin(a); } }
      const L = Math.hypot(px, py);
      if (L > 0) { const nx2 = b.x + (px / L) * 45 * dt, ny2 = b.y + (py / L) * 45 * dt; if (r.navigable(nx2, ny2)) { b.x = nx2; b.y = ny2; } }
    }
    const nx = b.x + Math.cos(b.a) * b.v * dt, ny = b.y + Math.sin(b.a) * b.v * dt;
    if (r.boatFits(nx, ny, b.a) || (this._looseFit(nx, ny, b.a) && !r.boatFits(b.x, b.y, b.a) && this._freer(nx, ny, b.x, b.y))) { b.x = nx; b.y = ny; }
    else {
      // desliza ao longo da costa: tenta escapar de lado antes de parar
      const px = -Math.sin(b.a), py = Math.cos(b.a);
      let slid = false;
      for (const off of [4, -4, 8, -8]) {
        if (r.boatFits(nx + px * off, ny + py * off, b.a)) { b.x = nx + px * off; b.y = ny + py * off; slid = true; break; }
      }
      if (!slid) { if (r.boatFits(nx, b.y, b.a)) b.x = nx; else if (r.boatFits(b.x, ny, b.a)) b.y = ny; }
      b.v *= 0.6;
      if (Math.abs(b.v) > 60 && !this._bumpT) { this._bumpT = 0.4; sound.play('splash'); }
    }
    if (this._bumpT) this._bumpT = Math.max(0, this._bumpT - dt);
    me.x = b.x; me.y = b.y;
    sound.engine(Math.abs(b.v) / BOAT_MAX_SPEED);
    // rastro na água
    this._wakeAcc = (this._wakeAcc || 0) + dt;
    if (Math.abs(b.v) > 25 && this._wakeAcc > 0.045) {
      this._wakeAcc = 0;
      const bx = b.x - Math.cos(b.a) * 30, by = b.y - Math.sin(b.a) * 30;
      for (const s of [-1, 1]) this.particles.spawn('wake', bx - Math.sin(b.a) * s * 7, by + Math.cos(b.a) * s * 7, { vx: -Math.sin(b.a) * s * 18, vy: Math.cos(b.a) * s * 18, life: 1.3, size: 3 + Math.abs(b.v) / 70, color: '#ffffff', drag: 1.5 });
      if (Math.random() < 0.3) this.particles.spawn('ring', bx, by, { size: 12, life: 1, color: '#ffffff' });
    }
    // passagens: entrar numa zona de passagem leva à outra ilha
    // com destino escolhido, só a passagem dele leva à viagem (evita viagens acidentais); sem destino, qualquer passagem serve
    if (!this._travelPending) for (const g of Object.values(r.gates)) {
      if (this.destination && g.to !== this.destination) continue;
      if (Math.hypot(g.x - b.x, g.y - b.y) < g.r * 0.85) { this._startTravel(g.to); break; }
    }
  }

  _looseFit(x, y, a) {
    const r = this.region, c = Math.cos(a), s = Math.sin(a);
    return r.navigable(x, y) && r.navigable(x + c * 14, y + s * 14) && r.navigable(x - c * 14, y - s * 14);
  }
  // o novo ponto está mais longe da terra que o atual?
  _freer(x, y, ox, oy) {
    const r = this.region;
    let n1 = 0, n0 = 0;
    for (let k = 0; k < 8; k++) { const a = (k / 8) * TAU; if (r.navigable(x + Math.cos(a) * 26, y + Math.sin(a) * 26)) n1++; if (r.navigable(ox + Math.cos(a) * 26, oy + Math.sin(a) * 26)) n0++; }
    return n1 >= n0;
  }
  _sendState() {
    const me = this.me, now = performance.now();
    if (now - (this._lastSend || 0) < 1000 / CLIENT_SEND_HZ) return;
    const fv = me.fv;
    const key = me.mode === 'boat'
      ? `b${me.boat.x.toFixed(0)},${me.boat.y.toFixed(0)},${me.boat.a.toFixed(2)},${me.boat.v.toFixed(0)}`
      : `w${me.x.toFixed(0)},${me.y.toFixed(0)},${me.dir},${me.moving},${fv.charge.toFixed(2)},${fv.aim.toFixed(1)},${fv.tension.toFixed(2)}`;
    if (key === this._lastKey && now - this._lastSend < 600) return;
    this._lastKey = key; this._lastSend = now;
    if (me.mode === 'boat') this.net.send({ t: 'st', rg: this.regionId, m: 1, x: +me.boat.x.toFixed(1), y: +me.boat.y.toFixed(1), a: +me.boat.a.toFixed(3), v: Math.round(me.boat.v) });
    else this.net.send({ t: 'st', rg: this.regionId, m: 0, x: +me.x.toFixed(1), y: +me.y.toFixed(1), d: me.dir, an: me.moving ? 1 : 0, aa: +fv.aim.toFixed(2), ch: +fv.charge.toFixed(2), tn: +fv.tension.toFixed(2) });
  }

  // ───────────── Interação (E) ─────────────
  _nearby() {
    const me = this.me, r = this.region;
    if (me.mode === 'walk') {
      const m = r.moorings.find((mm) => Math.hypot(mm.board.x - me.x, mm.board.y - me.y) < 72);
      if (m) return { kind: 'board', text: 'Entrar no barco' };
      if (Math.hypot(r.shop.x - me.x, r.shop.y - me.y) < 90) return { kind: 'shop', text: `Falar com ${SHOPS[this.regionId].keeper} (loja)` };
    } else {
      const m = r.moorings.find((mm) => Math.hypot(mm.boat.x - me.boat.x, mm.boat.y - me.boat.y) < 170);
      if (m) return { kind: 'unboard', text: 'Desembarcar' };
    }
    return null;
  }
  _interact() {
    const n = this._nearby();
    if (!n) { if (this.me.mode === 'boat') this.toast('Aproxime-se de um cais para desembarcar.'); return; }
    if (this.fishing.busy) this.fishing.cancel();
    if (n.kind === 'board') this.net.send({ t: 'board' });
    if (n.kind === 'unboard') this.net.send({ t: 'unboard' });
    if (n.kind === 'shop') { this.panels.state.shopTab = this.you.inventory.length ? 'sell' : 'rods'; this.panels.show('shop'); }
  }
  _prompts() {
    const p = $('#prompt');
    const n = this.input.blocked || this.fishing.locksMovement ? null : this._nearby();
    const html = n ? `<span class="kbd">E</span> — ${esc(n.text)}` : '';
    if (p._html !== html) { p._html = html; p.innerHTML = html; p.classList.toggle('hidden', !n); }
  }
  _navigation(dt) {
    const tgt = this.navTarget();
    if (!tgt) { this.route = null; this.hud.dest(null); return; }
    const me = this.me;
    this._routeT = (this._routeT || 0) - dt;
    if (me.mode === 'boat' && (!this.route || this._routeT <= 0 || this._routeFor !== tgt.kind + tgt.name)) {
      const avoid = Object.values(this.region.gates).filter((g) => g.to !== this.destination).map((g) => ({ x: g.x, y: g.y, r: g.r + 40 }));
      this.route = this.region.findRoute(me.boat.x, me.boat.y, tgt.x, tgt.y, avoid);
      this._routeFor = tgt.kind + tgt.name; this._routeT = 0.6;
    }
    if (me.mode !== 'boat') this.route = null;
    const dx = tgt.x - me.x, dy = tgt.y - me.y;
    const next = this.route && this.route.length > 1 ? this.route[1] : tgt;
    this.hud.dest({ label: tgt.label, name: tgt.name, dist: Math.round(Math.hypot(dx, dy) / 16), angle: Math.atan2(next.y - me.y, next.x - me.x) });
  }

  // ───────────── Renderização ─────────────
  _render(dt) {
    const ctx = this.ctx, v = this.viewRect(), t = this.time, S = this.renderScale;
    ctx.setTransform(S, 0, 0, S, -v.x0 * S, -v.y0 * S);
    ctx.imageSmoothingEnabled = true;
    const view = this.view, F = this.flags;
    view.flags = F;
    view.drawWater(ctx, v, t, 5);
    view.drawHotspots(ctx, v, t);
    if (F.parts) this.particles.draw(ctx, 'ground', v);
    if (F.land) view.drawLand(ctx, v, t);
    // barcos
    const boats = [];
    if (this.me.mode === 'boat') boats.push(this.me.boat);
    for (const a of this.others.values()) if (a.mode === 'boat') boats.push(a.boat);
    view.drawMoorings(ctx, v, t, boats);
    for (const a of this.others.values()) if (a.mode === 'boat') a.drawHull(ctx, t);
    if (this.me.mode === 'boat') this.me.drawHull(ctx, t);
    this._drawRoute(ctx, t);
    view.drawGates(ctx, v, t, this.destination);
    this.fishing.drawWorld(ctx, t);
    // lista ordenada por profundidade
    const ents = this._ents || (this._ents = []);
    ents.length = 0;
    const push = (a) => { a.t = t; a.drawable.y = a.mode === 'boat' ? a.boat.y + 2 : a.y; ents.push(a.drawable); };
    for (const a of this.others.values()) if (a.x > v.x0 - 100 && a.x < v.x1 + 100 && a.y > v.y0 - 50 && a.y < v.y1 + 120) push(a);
    push(this.me);
    const npc = this.npc;
    if (!npc.drawable) npc.drawable = { y: npc.y, draw: (c) => { const tt = this.time; c.fillStyle = 'rgba(0,0,0,.2)'; c.beginPath(); c.ellipse(npc.x, npc.y, 9, 3.6, 0, 0, TAU); c.fill(); drawCharFrame(c, npc.char, npc.x, npc.y, { dir: 0, pose: 'swing', hat: npc.hat, breath: (tt % 2) < 1, blink: (tt % 3.7) < 0.12 }); } };
    ents.push(npc.drawable);
    if (F.objects) view.drawSorted(ctx, v, t, ents, this.me.mode === 'walk' ? this.me : null);
    if (F.parts) this.particles.draw(ctx, 'air', v);
    if (F.light) view.drawLighting(ctx, v, t);
    // camada de interface em coordenadas de tela
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    this._drawNames(ctx, v);
    this.fishing.drawUI(ctx, this.cssW, this.cssH, t);
  }
  _drawRoute(ctx, t) {
    const R = this.route;
    if (!R || R.length < 2) return;
    ctx.save();
    ctx.fillStyle = '#ffffff'; ctx.strokeStyle = 'rgba(22,66,74,0.55)'; ctx.lineWidth = 1.2;
    let off = (t * 26) % 18;
    for (let i = 0; i < R.length - 1; i++) {
      const a = R[i], b = R[i + 1], L = Math.hypot(b.x - a.x, b.y - a.y);
      for (let d = off; d < L; d += 18) {
        const x = a.x + (b.x - a.x) * d / L, y = a.y + (b.y - a.y) * d / L;
        ctx.beginPath(); ctx.arc(x, y, 3, 0, TAU); ctx.fill(); ctx.stroke();
      }
      off = (off - L % 18 + 18) % 18;
    }
    const end = R[R.length - 1];
    ctx.beginPath(); ctx.arc(end.x, end.y, 9 + Math.sin(t * 4) * 2, 0, TAU); ctx.lineWidth = 3; ctx.strokeStyle = '#ffd23f'; ctx.stroke();
    ctx.restore();
  }
  _drawNames(ctx, v) {
    ctx.font = '800 13px Nunito, system-ui, sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    const tag = (x, y, text, col) => {
      const [sx, sy] = this.toScreen(x, y);
      if (sx < -80 || sx > this.cssW + 80 || sy < -40 || sy > this.cssH + 40) return;
      const w = ctx.measureText(text).width + 14;
      roundRect(ctx, sx - w / 2, sy - 10, w, 20, 10);
      ctx.fillStyle = 'rgba(22,52,60,0.78)'; ctx.fill();
      ctx.fillStyle = col; ctx.fillText(text, sx, sy + 0.5);
    };
    for (const a of this.others.values()) {
      const y = a.mode === 'boat' ? a.boat.y - 44 : a.y - (a.fv.fs === 5 || a.showUntil > this.time ? 82 : 52);
      tag(a.x, y, a.name, '#fff7e8');
    }
    const me = this.me;
    tag(me.x, me.mode === 'boat' ? me.boat.y - 44 : me.y - (me.fv.fs === 5 ? 82 : 52), me.name, '#ffd23f');
    tag(this.npc.x, this.npc.y - 52, `${this.npc.name} · Loja`, '#9ff0d8');
    ctx.textBaseline = 'alphabetic';
  }
  // Fundo animado do menu: mar com peixes nadando
  _renderMenu(dt) {
    const ctx = this.ctx, W = this.cssW, H = this.cssH, t = this.time;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    if (!this._menuBg) {
      this._menuBg = { fish: Array.from({ length: 14 }, (_, i) => ({ id: SPECIES[(i * 7 + 3) % 50].id, x: Math.random() * W, y: 60 + Math.random() * (H - 120), s: 40 + Math.random() * 50, v: 18 + Math.random() * 30, ph: Math.random() * 6 })) };
      const pc = makeCanvas(256, 256), g = pc.getContext('2d');
      g.strokeStyle = 'rgba(255,255,255,.5)'; g.lineWidth = 2;
      for (let i = 0; i < 26; i++) { const x = (i * 97) % 256, y = (i * 61) % 256; g.beginPath(); g.moveTo(x - 10, y); g.quadraticCurveTo(x, y - 4, x + 10, y); g.stroke(); }
      this._menuBg.pat = ctx.createPattern(pc, 'repeat');
    }
    const gr = ctx.createLinearGradient(0, 0, 0, H);
    gr.addColorStop(0, '#54d6d0'); gr.addColorStop(0.5, '#2aa3c4'); gr.addColorStop(1, '#16648f');
    ctx.fillStyle = gr; ctx.fillRect(0, 0, W, H);
    const m = this._menuBg;
    for (const f of m.fish) {
      f.x += f.v * dt; if (f.x > W + 120) { f.x = -120; f.y = 60 + Math.random() * (H - 120); }
      const img = fishImage(f.id, 'sprite', 128);
      const w = f.s, h = w * img.height / img.width;
      ctx.globalAlpha = 0.85;
      ctx.drawImage(img, f.x - w / 2, f.y + Math.sin(t * 1.5 + f.ph) * 6 - h / 2, w, h);
    }
    ctx.globalAlpha = 0.25; ctx.fillStyle = m.pat;
    ctx.save(); ctx.translate((t * 12) % 256, (t * 5) % 256); ctx.fillRect(-256, -256, W + 512, H + 512); ctx.restore();
    ctx.globalAlpha = 1;
  }
}
