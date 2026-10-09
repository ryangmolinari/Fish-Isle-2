// Sistema de partículas com pool fixo (sem alocação por quadro).
import { makeCanvas, TAU } from '../art/util.js';

const GROUND = new Set(['ring', 'foam', 'wake']);
const ADD = new Set(['ember', 'firefly', 'sparkle', 'glint']);

function softDot(color) {
  const c = makeCanvas(64, 64), g = c.getContext('2d');
  const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  gr.addColorStop(0, color); gr.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
  return c;
}

export class Particles {
  constructor(max = 900) {
    this.max = max;
    this.pool = Array.from({ length: max }, () => ({ on: false }));
    this.free = [];
    for (let i = max - 1; i >= 0; i--) this.free.push(i);
    this.active = [];
    this.limit = max; // ajustado pela qualidade gráfica
    this.sprites = {
      steam: softDot('rgba(255,255,255,0.55)'), smoke: softDot('rgba(90,85,90,0.5)'),
      ember: softDot('rgba(255,150,60,0.95)'), firefly: softDot('rgba(220,255,120,0.95)'),
      glint: softDot('rgba(255,255,255,0.9)'),
    };
  }
  setQuality(q) { this.limit = Math.round(this.max * (q === 'low' ? 0.35 : q === 'medium' ? 0.65 : 1)); }
  clear() { for (const i of this.active) { this.pool[i].on = false; this.free.push(i); } this.active.length = 0; }
  spawn(kind, x, y, o = {}) {
    if (this.active.length >= this.limit || !this.free.length) return null;
    const i = this.free.pop();
    const p = this.pool[i];
    p.on = true; p.kind = kind; p.x = x; p.y = y; p.z = o.z ?? 0;
    p.vx = o.vx ?? 0; p.vy = o.vy ?? 0; p.vz = o.vz ?? 0;
    p.life = 0; p.max = o.life ?? 1; p.size = o.size ?? 2; p.color = o.color ?? '#ffffff';
    p.g = o.g ?? 0; p.drag = o.drag ?? 0; p.ph = o.ph ?? Math.random() * TAU; p.grow = o.grow ?? 0;
    this.active.push(i);
    return p;
  }
  update(dt) {
    const A = this.active;
    for (let k = A.length - 1; k >= 0; k--) {
      const p = this.pool[A[k]];
      p.life += dt;
      if (p.life >= p.max) { p.on = false; this.free.push(A[k]); A[k] = A[A.length - 1]; A.pop(); continue; }
      p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
      p.vz -= p.g * dt;
      if (p.drag) { const d = Math.max(0, 1 - p.drag * dt); p.vx *= d; p.vy *= d; }
      if (p.kind === 'drop' && p.z < 0) p.life = p.max;
      if (p.kind === 'firefly') { p.vx += Math.sin(p.life * 2 + p.ph) * 12 * dt; p.vy += Math.cos(p.life * 1.7 + p.ph) * 12 * dt; }
      if (p.kind === 'snow') p.vx = Math.sin(p.life * 1.5 + p.ph) * 14;
      p.size += p.grow * dt;
    }
  }
  draw(ctx, layer, view) {
    const A = this.active;
    let additive = false;
    for (let k = 0; k < A.length; k++) {
      const p = this.pool[A[k]];
      if (GROUND.has(p.kind) !== (layer === 'ground')) continue;
      if (p.x < view.x0 - 40 || p.x > view.x1 + 40 || p.y < view.y0 - 60 || p.y > view.y1 + 60) continue;
      const t = p.life / p.max;
      const add = ADD.has(p.kind);
      if (add !== additive) { ctx.globalCompositeOperation = add ? 'lighter' : 'source-over'; additive = add; }
      switch (p.kind) {
        case 'ring':
          ctx.globalAlpha = (1 - t) * 0.7;
          ctx.beginPath(); ctx.ellipse(p.x, p.y, p.size * (0.3 + t), p.size * (0.3 + t) * 0.55, 0, 0, TAU);
          ctx.lineWidth = 1.4 * (1 - t) + 0.4; ctx.strokeStyle = p.color; ctx.stroke(); break;
        case 'foam': case 'wake':
          ctx.globalAlpha = (1 - t) * 0.55;
          ctx.fillStyle = p.color; ctx.beginPath(); ctx.ellipse(p.x, p.y, p.size * (0.6 + t), p.size * (0.4 + t * 0.6), 0, 0, TAU); ctx.fill(); break;
        case 'drop':
          ctx.globalAlpha = 0.9; ctx.fillStyle = p.color; ctx.beginPath(); ctx.arc(p.x, p.y - p.z, p.size, 0, TAU); ctx.fill(); break;
        case 'bubble':
          ctx.globalAlpha = (1 - t) * 0.9; ctx.beginPath(); ctx.arc(p.x + Math.sin(p.life * 9 + p.ph) * 1.5, p.y - p.z, p.size, 0, TAU); ctx.lineWidth = 1; ctx.strokeStyle = '#ffffff'; ctx.stroke(); break;
        case 'steam': case 'smoke': {
          const s = p.size; ctx.globalAlpha = Math.sin(t * Math.PI) * (p.kind === 'steam' ? 0.5 : 0.6);
          ctx.drawImage(this.sprites[p.kind], p.x - s, p.y - p.z - s, s * 2, s * 2); break;
        }
        case 'ember': case 'firefly': case 'glint': {
          const s = p.size * (p.kind === 'firefly' ? 0.8 + 0.4 * Math.sin(p.life * 6 + p.ph) : 1);
          ctx.globalAlpha = Math.sin(t * Math.PI);
          ctx.drawImage(this.sprites[p.kind], p.x - s * 3, p.y - p.z - s * 3, s * 6, s * 6); break;
        }
        case 'sparkle': {
          ctx.globalAlpha = Math.sin(t * Math.PI); ctx.fillStyle = p.color;
          const s = p.size * (0.6 + 0.6 * Math.sin(t * Math.PI));
          ctx.beginPath(); ctx.moveTo(p.x, p.y - p.z - s * 2); ctx.lineTo(p.x + s * 0.4, p.y - p.z); ctx.lineTo(p.x, p.y - p.z + s * 2); ctx.lineTo(p.x - s * 0.4, p.y - p.z); ctx.closePath(); ctx.fill();
          ctx.beginPath(); ctx.moveTo(p.x - s * 2, p.y - p.z); ctx.lineTo(p.x, p.y - p.z + s * 0.4); ctx.lineTo(p.x + s * 2, p.y - p.z); ctx.lineTo(p.x, p.y - p.z - s * 0.4); ctx.closePath(); ctx.fill(); break;
        }
        case 'snow':
          ctx.globalAlpha = Math.min(1, (1 - t) * 3) * 0.9; ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.arc(p.x, p.y - p.z, p.size, 0, TAU); ctx.fill(); break;
        case 'leaf':
          ctx.globalAlpha = Math.min(1, (1 - t) * 3); ctx.fillStyle = p.color; ctx.save(); ctx.translate(p.x, p.y - p.z); ctx.rotate(p.life * 3 + p.ph); ctx.beginPath(); ctx.ellipse(0, 0, p.size * 1.6, p.size * 0.7, 0, 0, TAU); ctx.fill(); ctx.restore(); break;
        case 'coin':
          ctx.globalAlpha = 1 - t * t; ctx.fillStyle = '#ffd23f'; ctx.strokeStyle = '#a8740a'; ctx.lineWidth = 1; ctx.beginPath(); ctx.ellipse(p.x, p.y - p.z, p.size * Math.abs(Math.cos(p.life * 8)) + 0.5, p.size, 0, 0, TAU); ctx.fill(); ctx.stroke(); break;
      }
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
  }
  // utilidades comuns
  splash(x, y, n = 10, color = '#ffffff') {
    for (let i = 0; i < n; i++) { const a = Math.random() * TAU, s = 20 + Math.random() * 50; this.spawn('drop', x, y, { vx: Math.cos(a) * s, vy: Math.sin(a) * s * 0.5, vz: 60 + Math.random() * 80, g: 320, life: 0.8, size: 1.2 + Math.random() * 1.3, color }); }
    this.spawn('ring', x, y, { size: 16, life: 0.9, color: '#ffffff' });
    this.spawn('ring', x, y, { size: 10, life: 1.2, color: '#ffffff' });
  }
}
