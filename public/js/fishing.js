// Controle local da pesca: carregar força, lançar, esperar, fisgar e o minigame de tensão.
import { FISHING, RARITIES } from '/shared/config.js';
import { RODS } from '/shared/items.js';
import { createMinigame, stepMinigame, encodeInputs, MG_DT, BREAK_LINE } from '/shared/minigame.js';
import { sound } from './audio.js';
import { FLIGHT, dirFromVec } from './entities.js';
import { roundRect, TAU, rgba } from './art/util.js';

const CHARGE_TIME = 1.0;

export class Fishing {
  constructor(game) {
    this.g = game;
    this.reset();
  }
  reset() {
    this.state = 'idle';
    this.charge = 0; this.aim = 0;
    this.target = null; this.castT0 = 0;
    this.mg = null; this.bits = null; this.acc = 0; this.prev = null;
    this.biteUntil = 0;
    this.showT = 0;
    this.info = null;
  }
  get busy() { return this.state !== 'idle'; }
  get locksMovement() { return ['cast', 'wait', 'bite', 'hooking', 'fight', 'resolving', 'show'].includes(this.state); }

  cancel(notify = true) {
    if (this.state === 'idle') return;
    const wasLine = ['cast', 'wait', 'bite', 'hooking', 'fight'].includes(this.state);
    if (notify && wasLine) this.g.net.send({ t: 'fishCancel' });
    if (wasLine) this.g.me.fv.retract = 0.35;
    this.reset();
    this._sync();
  }

  landingPoint() {
    const me = this.g.me, rod = RODS[this.g.you.rod];
    const d = Math.max(40, this.charge * rod.range);
    return { x: me.x + Math.cos(this.aim) * d, y: me.y + Math.sin(this.aim) * d };
  }

  update(dt, t) {
    const g = this.g, inp = g.input, me = g.me;
    const canWorld = !inp.blocked && me.mode === 'walk';
    const wm = g.worldMouse();
    if (this.state === 'idle' || this.state === 'charge') this.aim = Math.atan2(wm.y - (me.y - 12), wm.x - me.x);
    // cancelar com o botão direito ou ao andar
    if (inp.mouse.right && this.state !== 'fight' && this.state !== 'resolving') this.cancel();
    switch (this.state) {
      case 'idle':
        if (canWorld && inp.mouse.clicked && !g.uiHit) {
          if (g.you.inventory.length >= g.you.capacity) { g.toast('Inventário cheio! Venda peixes na loja ou amplie a mochila.', 'warn'); sound.play('error'); break; }
          this.state = 'charge'; this.charge = 0;
        }
        break;
      case 'charge':
        if (!canWorld) { this.cancel(false); break; }
        this.charge = Math.min(1, this.charge + dt / CHARGE_TIME);
        me.dir = dirFromVec(Math.cos(this.aim), Math.sin(this.aim));
        if (!inp.mouse.down) {
          const L = this.landingPoint();
          if (this.charge < FISHING.minCastPower) { this.cancel(false); g.toast('Segure o botão para carregar a força do lançamento.'); break; }
          if (!g.region.fishable(L.x, L.y)) { this.cancel(false); g.toast('Mire em uma área de água livre — não dá para lançar em terra ou construções.', 'warn'); sound.play('error'); break; }
          this.target = L; this.castT0 = t; this.state = 'cast';
          g.net.send({ t: 'cast', x: Math.round(L.x), y: Math.round(L.y), power: +this.charge.toFixed(3) });
          sound.play('cast');
        }
        break;
      case 'cast':
        if (t - this.castT0 >= FLIGHT) {
          this.state = 'wait';
          g.particles.splash(this.target.x, this.target.y, 10, g.waterSplashColor());
          sound.play('splash');
        }
        break;
      case 'wait':
        if (canWorld && inp.mouse.clicked) { g.net.send({ t: 'hook' }); this.state = 'hooking'; }
        break;
      case 'bite':
        if (Math.random() < 0.3) g.particles.spawn('bubble', this.target.x + (Math.random() - 0.5) * 10, this.target.y, { vz: 14, life: 0.7, size: 1.3 + Math.random() });
        if (inp.mouse.clicked && !inp.blocked) { g.net.send({ t: 'hook' }); this.state = 'hooking'; sound.play('hook'); }
        break;
      case 'fight': this._fight(dt, t); break;
      case 'show':
        if (t > this.showT) { this.reset(); }
        break;
    }
    // andar cancela a pesca (exceto durante a luta)
    const [ax, ay] = inp.axis();
    if ((ax || ay) && ['charge', 'cast', 'wait', 'bite'].includes(this.state)) this.cancel();
    this._sync(t);
  }

  _fight(dt, t) {
    const s = this.mg;
    if (!s || s.done) return;
    const auto = this.g.debug?.autoFight;
    const hold = auto ? (s.tension + s.tv * 0.18 < s.zc && s.tension < 0.86) : this.g.input.mouse.down;
    this.acc += Math.min(dt, 0.25);
    while (this.acc >= MG_DT && !s.done) {
      this.acc -= MG_DT;
      this.prev = { tension: s.tension, zc: s.zc, progress: s.progress };
      this.bits.push(hold ? 1 : 0);
      stepMinigame(s, hold);
      if (hold && this.bits.length % 3 === 0) sound.play('reel');
      if (s.surge > 0.95) this.g.particles.splash(this.target.x + (Math.random() - 0.5) * 16, this.target.y, 5, this.g.waterSplashColor());
    }
    if (s.done) {
      this.g.net.send({ t: 'fight', ...encodeInputs(this.bits) });
      this.state = 'resolving';
    }
  }

  // Mensagens do servidor
  onServer(m) {
    const g = this.g;
    switch (m.st) {
      case 'cast':
        if (m.baits) { g.you.baits = m.baits; g.you.bait = m.baitEq; g.hud.update(); }
        break;
      case 'castNo':
        this.reset(); g.toast(m.reason, 'warn'); sound.play('error');
        break;
      case 'bite':
        if (this.state === 'wait' || this.state === 'cast') {
          if (this.state === 'cast') { this.state = 'wait'; }
          this.state = 'bite'; this.biteUntil = performance.now() + FISHING.reactionWindow * 1000;
          this.info = { rarity: m.rarity };
          sound.play('bite');
          g.flashHint('Fisgou! Clique agora!', 1400);
        }
        break;
      case 'fight':
        this.state = 'fight';
        this.mg = createMinigame(m.params, m.seed);
        this.bits = []; this.acc = 0; this.prev = null;
        this.info = { rarity: m.rarity, cm: m.cm };
        break;
      case 'caught': {
        g.applyYou(m.you);
        this.state = 'show'; this.showT = g.time + 2.6;
        this.shown = m.fish.sp;
        g.onCatch(m.fish, m.isNew, m.record);
        break;
      }
      case 'lost':
        if (m.reason === 'snapped') sound.play('snap'); else sound.play('lost');
        g.toast(m.msg, 'warn');
        if (this.state !== 'idle') g.me.fv.retract = 0.35;
        this.reset();
        break;
      case 'idle':
        this.reset();
        break;
    }
    this._sync();
  }

  _sync(t = this.g.time) {
    const fv = this.g.me.fv;
    fv.aim = this.aim;
    fv.charge = this.state === 'charge' ? this.charge : 0;
    fv.tension = this.mg && (this.state === 'fight' || this.state === 'resolving') ? this.mg.tension : 0;
    fv.showSp = this.state === 'show' ? this.shown : null;
    switch (this.state) {
      case 'cast': fv.fs = 1; fv.el = t - this.castT0; fv.tx = this.target.x; fv.ty = this.target.y; break;
      case 'wait': case 'hooking': fv.fs = 2; break;
      case 'bite': fv.fs = 3; break;
      case 'fight': case 'resolving': fv.fs = 4; break;
      case 'show': fv.fs = 5; break;
      default: fv.fs = 0;
    }
  }

  // ───── Interface em tela ─────
  drawWorld(ctx, t) {
    const g = this.g, me = g.me;
    if (me.mode !== 'walk') return;
    if (this.state === 'charge') {
      const L = this.landingPoint();
      const ok = g.region.fishable(L.x, L.y);
      // arco tracejado de mira
      ctx.save();
      ctx.setLineDash([4, 5]); ctx.lineDashOffset = -t * 20;
      ctx.beginPath(); ctx.moveTo(me.x, me.y - 14);
      ctx.quadraticCurveTo((me.x + L.x) / 2, Math.min(me.y, L.y) - 50 * this.charge - 10, L.x, L.y);
      ctx.lineWidth = 1.6; ctx.strokeStyle = ok ? 'rgba(255,255,255,0.85)' : 'rgba(255,110,90,0.9)'; ctx.stroke();
      ctx.restore();
      this._reticle(ctx, L.x, L.y, ok, t, 1);
    } else if (this.state === 'idle' && !g.input.blocked && !g.uiHit) {
      const wm = g.worldMouse();
      const d = Math.hypot(wm.x - me.x, wm.y - me.y);
      const rod = RODS[g.you.rod];
      if (d < rod.range + 60 && g.region.fishable(wm.x, wm.y)) this._reticle(ctx, wm.x, wm.y, d <= rod.range, t, 0.6);
    }
  }
  _reticle(ctx, x, y, ok, t, a) {
    ctx.save(); ctx.globalAlpha = a;
    const r = 9 + Math.sin(t * 6) * 1.2;
    ctx.beginPath(); ctx.ellipse(x, y, r, r * 0.6, 0, 0, TAU);
    ctx.lineWidth = 2; ctx.strokeStyle = ok ? '#ffffff' : '#ff6a5a'; ctx.stroke();
    ctx.beginPath(); ctx.ellipse(x, y, r * 0.35, r * 0.2, 0, 0, TAU); ctx.fillStyle = ok ? '#7dffb0' : '#ff6a5a'; ctx.fill();
    if (!ok) { ctx.beginPath(); ctx.moveTo(x - 5, y - 3); ctx.lineTo(x + 5, y + 3); ctx.moveTo(x + 5, y - 3); ctx.lineTo(x - 5, y + 3); ctx.strokeStyle = '#ff6a5a'; ctx.stroke(); }
    ctx.restore();
  }

  // Painel do minigame e barra de força (coordenadas de tela, px CSS)
  drawUI(ctx, W, H, t) {
    if (this.state === 'charge') {
      const w = 160, x = W / 2 - w / 2, y = H - 150;
      roundRect(ctx, x - 6, y - 22, w + 12, 40, 12); ctx.fillStyle = 'rgba(22,52,60,0.82)'; ctx.fill();
      ctx.fillStyle = '#fff7e8'; ctx.font = '600 12px Nunito, system-ui, sans-serif'; ctx.textAlign = 'center'; ctx.fillText('Força do lançamento', W / 2, y - 8);
      roundRect(ctx, x, y, w, 10, 5); ctx.fillStyle = 'rgba(255,255,255,0.18)'; ctx.fill();
      const gr = ctx.createLinearGradient(x, 0, x + w, 0); gr.addColorStop(0, '#7dffb0'); gr.addColorStop(0.7, '#ffd23f'); gr.addColorStop(1, '#ff7a59');
      roundRect(ctx, x, y, Math.max(10, w * this.charge), 10, 5); ctx.fillStyle = gr; ctx.fill();
    }
    if (this.state === 'bite') {
      const left = Math.max(0, (this.biteUntil - performance.now()) / (FISHING.reactionWindow * 1000));
      const x = W / 2, y = H - 150;
      ctx.beginPath(); ctx.arc(x, y, 26, 0, TAU); ctx.fillStyle = 'rgba(22,52,60,0.85)'; ctx.fill();
      ctx.beginPath(); ctx.arc(x, y, 22, -Math.PI / 2, -Math.PI / 2 + TAU * left); ctx.lineWidth = 5; ctx.strokeStyle = '#ffd23f'; ctx.stroke();
      ctx.fillStyle = '#fff7e8'; ctx.font = '800 20px "Baloo 2", system-ui, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('!', x, y + 1);
      ctx.textBaseline = 'alphabetic';
    }
    if ((this.state === 'fight' || this.state === 'resolving') && this.mg) this._drawMinigame(ctx, W, H, t);
  }
  _drawMinigame(ctx, W, H, t) {
    const s = this.mg, p = s.p;
    const k = this.prev ? Math.min(1, this.acc / MG_DT) : 1;
    const lerp = (a, b) => a + (b - a) * k;
    const ten = this.prev ? lerp(this.prev.tension, s.tension) : s.tension;
    const zc = this.prev ? lerp(this.prev.zc, s.zc) : s.zc;
    const prog = this.prev ? lerp(this.prev.progress, s.progress) : s.progress;
    const w = Math.min(460, W - 40), h = 132, x = W / 2 - w / 2, y = H - h - 70;
    const rar = RARITIES[this.info?.rarity || 'common'];
    // painel
    roundRect(ctx, x, y, w, h, 18); ctx.fillStyle = 'rgba(255,247,232,0.96)'; ctx.fill();
    ctx.lineWidth = 3; ctx.strokeStyle = '#16424a'; ctx.stroke();
    ctx.textAlign = 'left'; ctx.fillStyle = '#16424a'; ctx.font = '800 17px "Baloo 2", system-ui, sans-serif';
    ctx.fillText('Puxe com cuidado!', x + 18, y + 26);
    // etiqueta de raridade (texto + símbolo + cor)
    ctx.font = '700 12px Nunito, system-ui, sans-serif';
    const label = `${rar.symbol} ${rar.label}`;
    const lw = ctx.measureText(label).width + 16;
    roundRect(ctx, x + w - lw - 16, y + 12, lw, 20, 10); ctx.fillStyle = rar.color; ctx.fill();
    ctx.fillStyle = '#ffffff'; ctx.fillText(label, x + w - lw - 8, y + 26);
    // barra de tensão
    const bx = x + 18, by = y + 42, bw = w - 36, bh = 26;
    roundRect(ctx, bx, by, bw, bh, 13); ctx.fillStyle = '#d9e6e3'; ctx.fill();
    // zona de perigo
    ctx.save(); roundRect(ctx, bx, by, bw, bh, 13); ctx.clip();
    ctx.fillStyle = '#ff7a6a'; ctx.fillRect(bx + bw * BREAK_LINE, by, bw * (1 - BREAK_LINE), bh);
    ctx.strokeStyle = 'rgba(255,255,255,0.55)'; ctx.lineWidth = 3;
    for (let i = 0; i < 6; i++) { const sx = bx + bw * BREAK_LINE + i * 9 - ((t * 20) % 9); ctx.beginPath(); ctx.moveTo(sx, by + bh); ctx.lineTo(sx + 9, by); ctx.stroke(); }
    // zona de sucesso
    const zx = bx + bw * (zc - p.zoneHalf), zw = bw * p.zoneHalf * 2;
    const inside = Math.abs(ten - zc) <= p.zoneHalf;
    ctx.fillStyle = inside ? '#5fd38a' : '#8fe0ad';
    roundRect(ctx, zx, by + 2, zw, bh - 4, 10); ctx.fill();
    if (inside) { ctx.fillStyle = 'rgba(255,255,255,0.35)'; roundRect(ctx, zx + 3, by + 4, zw - 6, 6, 3); ctx.fill(); }
    ctx.restore();
    roundRect(ctx, bx, by, bw, bh, 13); ctx.lineWidth = 2; ctx.strokeStyle = '#16424a'; ctx.stroke();
    // ponteiro (anzol)
    const nx = bx + bw * ten;
    const shake = s.surge > 0 ? Math.sin(t * 60) * 2 * s.surge : 0;
    ctx.beginPath(); ctx.moveTo(nx + shake, by - 6); ctx.lineTo(nx + shake, by + bh + 6); ctx.lineWidth = 4; ctx.strokeStyle = '#16424a'; ctx.stroke();
    ctx.beginPath(); ctx.arc(nx + shake, by - 8, 6, 0, TAU); ctx.fillStyle = s.strain > 0 ? '#ff4a3d' : '#ffd23f'; ctx.fill(); ctx.lineWidth = 2; ctx.stroke();
    // progresso da captura
    const py = by + bh + 16;
    roundRect(ctx, bx, py, bw, 12, 6); ctx.fillStyle = '#d9e6e3'; ctx.fill();
    const gr = ctx.createLinearGradient(bx, 0, bx + bw, 0); gr.addColorStop(0, '#3aa6c4'); gr.addColorStop(1, '#5fd38a');
    roundRect(ctx, bx, py, Math.max(12, bw * prog), 12, 6); ctx.fillStyle = gr; ctx.fill();
    roundRect(ctx, bx, py, bw, 12, 6); ctx.lineWidth = 2; ctx.strokeStyle = '#16424a'; ctx.stroke();
    // peixinho que avança na barra
    const fx = bx + bw * prog;
    ctx.fillStyle = '#16424a';
    ctx.beginPath(); ctx.ellipse(fx, py + 6, 8, 5, 0, 0, TAU); ctx.fill();
    ctx.beginPath(); ctx.moveTo(fx - 7, py + 6); ctx.lineTo(fx - 13, py + 1); ctx.lineTo(fx - 13, py + 11); ctx.closePath(); ctx.fill();
    // dicas
    ctx.font = '600 12px Nunito, system-ui, sans-serif'; ctx.fillStyle = '#3d6670'; ctx.textAlign = 'center';
    const warn = s.strain > 0 ? 'Cuidado! Solte o botão — a linha vai arrebentar!' : 'Segure o botão do mouse para recolher · solte para afrouxar';
    if (s.strain > 0) ctx.fillStyle = '#d6322a';
    ctx.fillText(warn, W / 2, y + h - 12);
    ctx.textAlign = 'left';
  }
}
