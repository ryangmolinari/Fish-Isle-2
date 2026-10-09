// Avatares dos jogadores (local e remotos): personagem, vara, linha, boia, barco.
import { drawCharFrame, drawHoldArms, CHARACTERS, drawHat } from './art/charArt.js';
import { drawBoatHull } from './art/boatArt.js';
import { fishImage } from './art/fishArt.js';
import { RODS } from '/shared/items.js';
import { FISHING } from '/shared/config.js';
import { SPECIES_BY_ID } from '/shared/fish.js';
import { TAU, ellipse, rgba } from './art/util.js';

export const SWING = 0.2;
export const FLIGHT = FISHING.castFlightTime;
const ROD_LEN = 30;

const HAND = [[0, -13], [-6, -15], [6, -15], [0, -16]];

export function dirFromVec(dx, dy) {
  if (Math.abs(dx) > Math.abs(dy)) return dx > 0 ? 2 : 1;
  return dy > 0 ? 0 : 3;
}
const lerpAngle = (a, b, t) => { let d = b - a; while (d > Math.PI) d -= TAU; while (d < -Math.PI) d += TAU; return a + d * t; };

export class Avatar {
  constructor(info, local = false) {
    this.id = info.id;
    this.local = local;
    this.setInfo(info);
    this.x = 0; this.y = 0; this.dir = 0; this.moving = false; this.phase = 0;
    this.mode = 'walk';
    this.boat = { x: 0, y: 0, a: 0, v: 0 };
    this.fv = { fs: 0, tx: 0, ty: 0, el: 0, tension: 0, charge: 0, aim: 0, showSp: null, retract: 0 };
    this.buf = [];
    this.blinkT = Math.random() * 4;
    this.showUntil = 0;
    this.walkDist = 0;
    this.t = 0;
    // objeto reutilizado na lista ordenada (sem alocação por quadro)
    this.drawable = { y: 0, draw: (c) => (this.mode === 'boat' ? this.drawSitting(c, this.t) : this.drawWalking(c, this.t)) };
  }
  setInfo(info) { this.name = info.name; this.char = info.char; this.equip = info.equip || {}; this.rod = info.rod || 'vara_bambu'; }

  // ───── Remotos: buffer de snapshots e interpolação ─────
  push(serverT, row) {
    this.buf.push({ t: serverT, r: row });
    if (this.buf.length > 30) this.buf.splice(0, this.buf.length - 30);
  }
  snapTo(row) { this.buf.length = 0; this.push(0, row); this._apply(row, row, 0); }
  interpolate(renderT, dt) {
    const B = this.buf;
    if (!B.length) return;
    let i = B.length - 1;
    while (i > 0 && B[i - 1].t > renderT) i--;
    const b = B[i], a = B[Math.max(0, i - 1)];
    let u = 1;
    if (a !== b && b.t > a.t) u = Math.max(0, Math.min(1, (renderT - a.t) / (b.t - a.t)));
    if (renderT > B[B.length - 1].t) { u = 1; }
    const px = this.x, py = this.y;
    this._apply(a.r, b.r, u);
    const d = Math.hypot(this.x - px, this.y - py);
    this.moving = this.mode === 'walk' && d > 0.15 && b.r[4] === 1;
    if (this.moving) { this.walkDist += d; this.phase = Math.floor(this.walkDist / 7) % 4; }
  }
  _apply(a, b, u) {
    // [id, x, y, dir, anim, boat, fs, bx, by, ba, bv, tx, ty, el, tension, aim, charge]
    this.x = a[1] + (b[1] - a[1]) * u; this.y = a[2] + (b[2] - a[2]) * u;
    this.dir = b[3];
    this.mode = b[5] ? 'boat' : 'walk';
    if (b[5]) {
      this.boat.x = (a[5] ? a[7] : b[7]) + (b[7] - (a[5] ? a[7] : b[7])) * u;
      this.boat.y = (a[5] ? a[8] : b[8]) + (b[8] - (a[5] ? a[8] : b[8])) * u;
      this.boat.a = lerpAngle(a[5] ? a[9] : b[9], b[9], u);
      this.boat.v = b[10];
      this.x = this.boat.x; this.y = this.boat.y;
    }
    const f = this.fv;
    const prevFs = f.fs;
    f.fs = b[6]; f.tx = b[11]; f.ty = b[12];
    f.el = (a[13] + (b[13] - a[13]) * u) / 1000;
    f.tension = b[14]; f.aim = b[15]; f.charge = b[16];
    if (prevFs && !f.fs && prevFs !== 5) f.retract = 0.35;
  }

  // ───── Geometria da vara ─────
  handPos() { const h = HAND[this.dir]; return { x: this.x + h[0], y: this.y + h[1] }; }
  rodPitch(t) {
    const f = this.fv;
    switch (f.fs) {
      case 0: return f.charge > 0 ? 1.2 + f.charge * 1.4 : null;
      case 1: { if (f.el < SWING) { const k = f.el / SWING; return 2.6 - (2.6 - 0.35) * (1 - (1 - k) * (1 - k)); } return 0.35; }
      case 2: return 0.42 + Math.sin(t * 1.5) * 0.03;
      case 3: return 0.3 + Math.sin(t * 30) * 0.08;
      case 4: return 0.95 + f.tension * 0.35 + Math.sin(t * 18) * 0.04 * (0.3 + f.tension);
      default: return null;
    }
  }
  rodTip(t) {
    const p = this.rodPitch(t);
    if (p == null) return null;
    const h = this.handPos(), a = this.fv.aim;
    const hor = Math.cos(p) * ROD_LEN, ver = Math.sin(p) * ROD_LEN;
    return { x: h.x + Math.cos(a) * hor, y: h.y + Math.sin(a) * hor * 0.75 - ver * 0.9, hx: h.x, hy: h.y };
  }
  bobberPos(t) {
    const f = this.fv;
    if (f.fs === 1) {
      const tip = this.rodTip(t);
      if (f.el < SWING) return tip ? { x: tip.x, y: tip.y, z: 0, air: true } : null;
      const u = Math.min(1, (f.el - SWING) / (FLIGHT - SWING));
      const sx = tip.hx + Math.cos(f.aim) * 20, sy = tip.hy + Math.sin(f.aim) * 15;
      const x = sx + (f.tx - sx) * u, y = sy + (f.ty - sy) * u;
      const z = Math.sin(u * Math.PI) * 70 + (1 - u) * 22;
      return { x, y: y - z, z, air: u < 1 };
    }
    if (f.fs === 2) return { x: f.tx, y: f.ty + Math.sin(t * 2.6 + this.id) * 0.9, z: 0 };
    if (f.fs === 3) return { x: f.tx + Math.sin(t * 40) * 0.8, y: f.ty + 2.5, z: 0, bite: true };
    if (f.fs === 4) { const k = 0.5 + f.tension; return { x: f.tx + Math.sin(t * 2.3 + 1) * 14 * k, y: f.ty + Math.cos(t * 1.7) * 7 * k, z: 0, fish: true }; }
    return null;
  }

  // ───── Desenho ─────
  drawWalking(ctx, t) {
    const f = this.fv;
    const fishing = f.fs > 0 && f.fs < 5 || f.charge > 0;
    const showing = f.fs === 5 || this.showUntil > t;
    const hat = this.equip.hat;
    // sombra
    ctx.fillStyle = 'rgba(0,0,0,0.2)';
    ellipse(ctx, this.x, this.y, 9, 3.6); ctx.fill();
    const blink = ((t + this.id * 1.7) % 4.2) < 0.12;
    const tip = fishing ? this.rodTip(t) : null;
    const bob = fishing ? this.bobberPos(t) : null;
    if (tip && this.dir === 3) this._drawRod(ctx, tip, bob, t);
    const pose = showing ? 'up' : fishing ? 'hold' : 'swing';
    drawCharFrame(ctx, this.char, this.x, this.y, { dir: showing ? 0 : this.dir, phase: this.phase, moving: this.moving && !fishing, pose, hat, blink, breath: !this.moving && ((t * 0.8 + this.id) % 2) < 1 });
    if (fishing) {
      ctx.save(); ctx.translate(this.x, this.y);
      const h = HAND[this.dir];
      drawHoldArms(ctx, CHARACTERS[this.char], this.dir, { x: h[0], y: h[1] });
      ctx.restore();
      if (tip && this.dir !== 3) this._drawRod(ctx, tip, bob, t);
    } else if (f.retract > 0) {
      f.retract -= 1 / 60;
    }
    if (showing) this._drawShownFish(ctx, t);
    if (f.fs === 3) this._alert(ctx, t);
  }
  _drawRod(ctx, tip, bob, t) {
    const f = this.fv;
    const rod = RODS[this.rod] || RODS.vara_bambu;
    // linha
    if (bob) {
      ctx.beginPath(); ctx.moveTo(tip.x, tip.y);
      if (bob.air) ctx.lineTo(bob.x, bob.y);
      else {
        const sag = f.fs === 4 ? 2 : f.fs === 3 ? 4 : 10;
        ctx.quadraticCurveTo((tip.x + bob.x) / 2, (tip.y + bob.y) / 2 + sag, bob.x, bob.y);
      }
      ctx.lineWidth = 0.8; ctx.strokeStyle = 'rgba(255,255,255,0.9)'; ctx.stroke();
    }
    // vara (curva quando há tensão)
    const bend = f.fs === 4 ? 4 + f.tension * 8 : f.fs === 3 ? 3 : 0;
    const bx = bob ? Math.sign(bob.x - tip.x) * bend * 0.4 : 0, by = bend;
    ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(tip.hx, tip.hy);
    ctx.quadraticCurveTo((tip.hx + tip.x) / 2 + bx, (tip.hy + tip.y) / 2 - 2 + by * 0.6, tip.x, tip.y);
    ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(30,20,10,0.75)'; ctx.stroke();
    ctx.lineWidth = 1.8; ctx.strokeStyle = rod.color; ctx.stroke();
    // carretilha
    ctx.beginPath(); ctx.arc(tip.hx + Math.cos(f.aim) * 4, tip.hy + 2, 2.4, 0, TAU); ctx.fillStyle = '#d6d9e0'; ctx.fill(); ctx.lineWidth = 0.8; ctx.strokeStyle = '#4a4f5a'; ctx.stroke();
    // boia
    if (bob && !bob.fish) {
      const r = 3.4;
      if (!bob.air) { ctx.beginPath(); ctx.ellipse(bob.x, bob.y + 1.5, r + 2, 1.6, 0, 0, TAU); ctx.fillStyle = 'rgba(255,255,255,0.4)'; ctx.fill(); }
      ctx.save();
      if (bob.bite) { ctx.beginPath(); ctx.rect(bob.x - 6, bob.y - 8, 12, 8); ctx.clip(); }
      ctx.beginPath(); ctx.arc(bob.x, bob.y - (bob.air ? 0 : 1.5), r, 0, TAU); ctx.fillStyle = '#ffffff'; ctx.fill();
      ctx.beginPath(); ctx.arc(bob.x, bob.y - (bob.air ? 0 : 1.5), r, Math.PI, TAU); ctx.fillStyle = '#ff4a3d'; ctx.fill();
      ctx.beginPath(); ctx.arc(bob.x, bob.y - (bob.air ? 0 : 1.5), r, 0, TAU); ctx.lineWidth = 0.9; ctx.strokeStyle = '#5a1a12'; ctx.stroke();
      ctx.beginPath(); ctx.arc(bob.x - 1.1, bob.y - 2.8, 0.9, 0, TAU); ctx.fillStyle = 'rgba(255,255,255,0.9)'; ctx.fill();
      ctx.restore();
    } else if (bob && bob.fish) {
      // peixe se debatendo: sombra e respingos
      ctx.save(); ctx.translate(bob.x, bob.y); ctx.rotate(Math.sin(t * 9) * 0.6);
      ctx.fillStyle = 'rgba(10,25,40,0.45)'; ellipse(ctx, 0, 2, 11, 4); ctx.fill();
      ctx.beginPath(); ctx.moveTo(-10, 2); ctx.lineTo(-16, -2); ctx.lineTo(-16, 6); ctx.closePath(); ctx.fill();
      ctx.restore();
      ctx.strokeStyle = 'rgba(255,255,255,0.7)'; ctx.lineWidth = 1.2;
      const k = (t * 3) % 1;
      ctx.beginPath(); ctx.ellipse(bob.x, bob.y + 2, 6 + k * 12, 3 + k * 5, 0, 0, TAU); ctx.globalAlpha = 1 - k; ctx.stroke(); ctx.globalAlpha = 1;
    }
  }
  _alert(ctx, t) {
    const y = this.y - 58 - Math.abs(Math.sin(t * 10)) * 3;
    ctx.beginPath(); ctx.arc(this.x, y, 8, 0, TAU); ctx.fillStyle = '#ffd23f'; ctx.fill(); ctx.lineWidth = 1.5; ctx.strokeStyle = '#8a5a00'; ctx.stroke();
    ctx.fillStyle = '#5a3a00'; ctx.font = 'bold 12px "Baloo 2", system-ui, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('!', this.x, y + 0.5);
  }
  _drawShownFish(ctx, t) {
    const sp = this.fv.showSp;
    if (!sp) return;
    const img = fishImage(sp, 'sprite', 128);
    const w = 46, h = w * img.height / img.width;
    const y = this.y - 56 + Math.sin(t * 4) * 1.5;
    const s = SPECIES_BY_ID[sp];
    if (s.rarity === 'legendary' || s.rarity === 'rare') {
      ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 0.35 + Math.sin(t * 5) * 0.1;
      const gr = ctx.createRadialGradient(this.x, y, 2, this.x, y, 34);
      gr.addColorStop(0, s.art.glow || '#ffffff'); gr.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = gr; ctx.fillRect(this.x - 40, y - 40, 80, 80); ctx.restore();
    }
    ctx.drawImage(img, this.x - w / 2, y - h / 2, w, h);
  }
  drawHull(ctx, t) {
    drawBoatHull(ctx, this.boat.x, this.boat.y + Math.sin(t * 1.6 + this.id) * 0.8, this.boat.a + Math.sin(t * 1.1 + this.id) * 0.02, this.equip.paint, this.equip.flag, t, Math.abs(this.boat.v));
  }
  drawSitting(ctx, t) {
    const a = this.boat.a;
    const dir = dirFromVec(Math.cos(a), Math.sin(a));
    const bx = this.boat.x - Math.cos(a) * 6, by = this.boat.y - Math.sin(a) * 6 + Math.sin(t * 1.6 + this.id) * 0.8;
    drawCharFrame(ctx, this.char, bx, by + 6, { dir, phase: 0, moving: false, pose: 'sit', hat: this.equip.hat, blink: ((t + this.id) % 4.2) < 0.12 });
  }
}
