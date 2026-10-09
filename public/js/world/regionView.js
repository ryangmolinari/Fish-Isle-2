// Renderização de uma região: água animada, terreno, cais, objetos ordenados por
// profundidade, efeitos ambientes, pontos de pesca, passagens marítimas e iluminação.
import { getRegion, OBJ, ISLANDS } from '/shared/islands.js';
import { WORLD_W, WORLD_H } from '/shared/config.js';
import { TerrainRenderer } from '../art/terrain.js';
import { SpriteAtlas, drawDock } from '../art/props.js';
import { PALETTES, LIGHTS } from '../art/palettes.js';
import { makeCanvas, rgba, TAU, ellipse, shade } from '../art/util.js';
import { drawBoatHull, drawMooringPost } from '../art/boatArt.js';
import { hash2 } from '/shared/rng.js';

const AMBIENT = {
  tropical: { mult: '#fff4e6', glints: 1, leaves: '#5cc06a' },
  mangue: { mult: '#cfe0c0', fireflies: 1, leaves: '#7a9a45' },
  congelada: { mult: '#e2edfb', snow: 1, glints: 0.6 },
  vulcanica: { mult: '#ecc4b0', embers: 1 },
  cristais: { mult: '#7d6cc4', sparkles: 1, glints: 1 },
};

export class RegionView {
  constructor(id, scale, quality, particles) {
    this.id = id;
    this.region = getRegion(id);
    this.pal = PALETTES[id];
    this.amb = AMBIENT[id];
    this.quality = quality;
    this.particles = particles;
    this.scale = scale;
    this.terrain = new TerrainRenderer(this.region, this._chunkRes(scale));
    this.atlas = new SpriteAtlas(this._atlasScale(scale));
    this.objects = this.region.objects;
    this.waterObjs = this.objects.filter((o) => OBJ[o.type]?.water);
    this.landObjs = this.objects.filter((o) => !OBJ[o.type]?.water);
    this.lights = this.objects.filter((o) => LIGHTS[o.type]).map((o) => ({ x: o.x, y: o.y - (OBJ[o.type].h || 20) * 0.55, col: LIGHTS[o.type][0], r: LIGHTS[o.type][1], ph: hash2(o.x, o.y, 1) * TAU }));
    if (id === 'vulcanica') this._lavaLights();
    this.vents = this.objects.filter((o) => o.type === 'steam_vent' || o.type === 'campfire');
    this.volcano = this.objects.find((o) => o.type === 'volcano');
    this.crystals = this.objects.filter((o) => o.type.startsWith('crystal') || o.type === 'glow_mushroom');
    this._wavePattern();
    this._dockCanvas();
    this.lightSprites = new Map();
    this.drawList = [];
    this.spawnAcc = 0;
  }
  _chunkRes(s) { return Math.max(0.75, Math.min(2.5, Math.round(s * 4) / 4)); }
  _atlasScale(s) { return Math.max(1, Math.min(3, Math.round(s * 2) / 2)); }
  setScale(s) {
    if (Math.abs(s - this.scale) < 0.01) return;
    this.scale = s;
    this.terrain.setRes(this._chunkRes(s));
    const as = this._atlasScale(s);
    if (as !== this.atlas.scale) { this.atlas.dispose(); this.atlas = new SpriteAtlas(as); }
  }
  setQuality(q) { this.quality = q; }
  dispose() {
    this.terrain.dispose();
    this.atlas.dispose();
    this.dockCanvas = null;
    this.particles.clear();
  }
  _lavaLights() {
    for (let y = 0; y < WORLD_H; y += 96) for (let x = 0; x < WORLD_W; x += 96) {
      if (this.region.isLand(x, y) && this.region.terrainAt(x, y) === 9) this.lights.push({ x, y, col: '#ff6a1a', r: 120, ph: hash2(x, y, 2) * TAU, lava: true });
    }
  }
  // Ondinhas animadas: pequenos sprites espalhados só sobre a água (bem mais leve que textura em tela cheia)
  _wavePattern() {
    this.waveSprites = [0, 1, 2].map((k) => {
      const w = 18 + k * 8, c = makeCanvas(w * 2 + 8, 16), g = c.getContext('2d');
      g.scale(2, 2); g.strokeStyle = rgba(this.pal.waveTint, 0.95); g.lineCap = 'round'; g.lineWidth = 1.3;
      g.beginPath(); g.moveTo(2, 5); g.quadraticCurveTo(w / 2 + 2, 0.5, w + 2, 5); g.stroke();
      if (k > 0) { g.globalAlpha = 0.6; g.beginPath(); g.moveTo(w * 0.3, 7); g.quadraticCurveTo(w * 0.6, 4.5, w * 0.85, 7); g.stroke(); }
      return { c, w: w + 4, h: 8 };
    });
    const pts = [], r = this.region, C = 72;
    for (let cy = 0; cy < WORLD_H; cy += C) for (let cx = 0; cx < WORLD_W; cx += C) for (let k = 0; k < 2; k++) {
      const x = cx + hash2(cx, cy, 31 + k) * C, y = cy + hash2(cx, cy, 47 + k) * C;
      if (r.landField(x, y) > 0.3 || r.inDock(x, y, 30)) continue;
      const t = r.terrainAt(x, y);
      if (t !== 0) continue;
      pts.push({ x, y, ph: hash2(cx, cy, 5 + k) * TAU, s: Math.floor(hash2(cx, cy, 9 + k) * 3), sp: 0.5 + hash2(cx, cy, 13 + k) * 0.6 });
    }
    // índice por faixas de 256 px para culling rápido
    this.waveGrid = new Map();
    for (const p of pts) { const k = Math.floor(p.y / 256) * 100 + Math.floor(p.x / 256); if (!this.waveGrid.has(k)) this.waveGrid.set(k, []); this.waveGrid.get(k).push(p); }
  }
  _dockCanvas() {
    // pré-renderiza todos os cais da região num único canvas por cais
    this.docks = this.region.docks.map((d) => {
      const pad = 10, S = 2;
      const c = makeCanvas((d.w + pad * 2) * S, (d.h + pad * 2) * S);
      const g = c.getContext('2d');
      g.scale(S, S); g.translate(pad - d.x, pad - d.y);
      drawDock(g, d, this.id, 0);
      return { d, c, x: d.x - pad, y: d.y - pad, w: d.w + pad * 2, h: d.h + pad * 2 };
    });
  }
  lightSprite(col) {
    let s = this.lightSprites.get(col);
    if (!s) {
      s = makeCanvas(128, 128);
      const g = s.getContext('2d');
      const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
      gr.addColorStop(0, rgba(col, 0.9)); gr.addColorStop(0.4, rgba(col, 0.35)); gr.addColorStop(1, rgba(col, 0));
      g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
      this.lightSprites.set(col, s);
    }
    return s;
  }

  // Partículas ambientes perto da câmera
  update(dt, t, view) {
    const P = this.particles, amb = this.amb;
    const q = this.quality === 'low' ? 0.35 : this.quality === 'medium' ? 0.7 : 1;
    const w = view.x1 - view.x0, h = view.y1 - view.y0;
    const rx = () => view.x0 + Math.random() * w, ry = () => view.y0 + Math.random() * h;
    const chance = (rate) => Math.random() < rate * dt * q;
    if (amb.glints && chance(10 * amb.glints)) { const x = rx(), y = ry(); if (!this.region.isLand(x, y)) P.spawn('glint', x, y, { size: 1.2 + Math.random(), life: 0.6 + Math.random() * 0.5 }); }
    if (amb.snow) for (let i = 0; i < 2; i++) if (chance(25)) P.spawn('snow', rx(), view.y0 - 10 + Math.random() * h * 0.3, { vy: 30 + Math.random() * 20, life: 6, size: 1 + Math.random() * 1.6 });
    if (amb.fireflies && chance(4)) { const x = rx(), y = ry(); if (this.region.isLand(x, y)) P.spawn('firefly', x, y, { z: 10 + Math.random() * 30, life: 4 + Math.random() * 3, size: 1.6, vx: (Math.random() - 0.5) * 10, vy: (Math.random() - 0.5) * 10 }); }
    if (amb.leaves && chance(1.2)) P.spawn('leaf', rx(), ry(), { z: 60, vz: -12, vx: 20 + Math.random() * 15, life: 5, size: 2.4, color: amb.leaves });
    if (amb.sparkles) for (const c of this.crystals) if (c.x > view.x0 && c.x < view.x1 && c.y > view.y0 && c.y < view.y1 + 80 && chance(0.6)) P.spawn('sparkle', c.x + (Math.random() - 0.5) * 30, c.y - Math.random() * (OBJ[c.type].h || 20), { size: 1.6 + Math.random() * 1.4, life: 0.9, color: Math.random() < 0.5 ? '#ffffff' : '#c9b4ff' });
    if (amb.embers) {
      if (chance(10)) { const L = this.lights[Math.floor(Math.random() * this.lights.length)]; if (L && L.x > view.x0 - 100 && L.x < view.x1 + 100 && L.y > view.y0 - 100 && L.y < view.y1 + 100) P.spawn('ember', L.x + (Math.random() - 0.5) * 40, L.y, { vz: 25 + Math.random() * 30, vx: (Math.random() - 0.5) * 18, life: 2 + Math.random(), size: 1 + Math.random() }); }
      if (this.volcano && chance(5)) { const v = this.volcano; P.spawn('smoke', v.x + (Math.random() - 0.5) * 50, v.y - 400, { vz: 30 + Math.random() * 20, vx: 12 + Math.random() * 10, life: 6, size: 30, grow: 14 }); }
    }
    for (const v of this.vents) {
      if (v.x < view.x0 - 60 || v.x > view.x1 + 60 || v.y < view.y0 - 60 || v.y > view.y1 + 100) continue;
      if (chance(v.type === 'campfire' ? 4 : 3)) P.spawn(v.type === 'campfire' ? 'smoke' : 'steam', v.x + (Math.random() - 0.5) * 10, v.y, { z: 10, vz: 18 + Math.random() * 10, vx: (Math.random() - 0.5) * 6, life: 2.4, size: 8, grow: 9 });
      if (v.type === 'campfire' && chance(5)) P.spawn('ember', v.x, v.y, { z: 12, vz: 30, vx: (Math.random() - 0.5) * 20, life: 1.2, size: 1 });
    }
  }

  drawWater(ctx, view, t, budget) {
    const F = this.flags || {};
    if (F.water === 0) { ctx.fillStyle = this.pal.waterDeep; ctx.fillRect(view.x0, view.y0, view.x1 - view.x0, view.y1 - view.y0); this.terrain.draw(ctx, { x0: 1e9, y0: 1e9, x1: -1, y1: -1 }, 'water', budget); }
    else this.terrain.draw(ctx, view, 'water', budget);
    if (F.waves !== 0) {
      const cx0 = Math.floor((view.x0 - 40) / 256), cy0 = Math.floor((view.y0 - 20) / 256), cx1 = Math.floor((view.x1 + 40) / 256), cy1 = Math.floor((view.y1 + 20) / 256);
      const every = this.quality === 'low' ? 2 : 1;
      let n = 0;
      for (let cy = cy0; cy <= cy1; cy++) for (let cx = cx0; cx <= cx1; cx++) {
        const list = this.waveGrid.get(cy * 100 + cx);
        if (!list) continue;
        for (const p of list) {
          if ((n++ % every) !== 0) continue;
          const ph = t * p.sp + p.ph, a = Math.sin(ph);
          if (a <= 0.05) continue;
          const spr = this.waveSprites[p.s];
          ctx.globalAlpha = a * a * 0.55;
          ctx.drawImage(spr.c, p.x + Math.sin(ph * 0.5) * 8 - spr.w / 2, p.y - Math.cos(ph) * 2, spr.w, spr.h);
        }
      }
      ctx.globalAlpha = 1;
    }
    // vitórias-régias e outros objetos na água
    for (const o of this.waterObjs) this._drawObj(ctx, o, view, t, 1);
  }

  drawHotspots(ctx, view, t) {
    for (const h of this.region.hotspots) {
      if (h.x < view.x0 - h.r || h.x > view.x1 + h.r || h.y < view.y0 - h.r || h.y > view.y1 + h.r) continue;
      // sombras de peixes circulando
      for (let k = 0; k < 3; k++) {
        const a = t * (0.5 + k * 0.17) + k * 2.1, rr = h.r * (0.25 + k * 0.18);
        const x = h.x + Math.cos(a) * rr, y = h.y + Math.sin(a) * rr * 0.6;
        ctx.save(); ctx.translate(x, y); ctx.rotate(a + Math.PI / 2);
        ctx.fillStyle = 'rgba(10,30,50,0.28)';
        ellipse(ctx, 0, 0, 9 - k, 3.6 - k * 0.5); ctx.fill();
        ctx.beginPath(); ctx.moveTo(-8 + k, 0); ctx.lineTo(-14 + k, -3.5); ctx.lineTo(-14 + k, 3.5); ctx.closePath(); ctx.fill();
        ctx.restore();
      }
      // anéis
      for (let k = 0; k < 2; k++) {
        const ph = ((t * 0.5 + k * 0.5) % 1);
        ctx.globalAlpha = (1 - ph) * 0.5;
        ctx.beginPath(); ctx.ellipse(h.x, h.y, h.r * 0.35 * (0.4 + ph), h.r * 0.2 * (0.4 + ph), 0, 0, TAU);
        ctx.lineWidth = 1.5; ctx.strokeStyle = '#ffffff'; ctx.stroke();
      }
      ctx.globalAlpha = 1;
      // bolhas
      if (Math.random() < 0.08) this.particles.spawn('bubble', h.x + (Math.random() - 0.5) * h.r * 0.6, h.y + (Math.random() - 0.5) * h.r * 0.3, { vz: 12, life: 0.9, size: 1.4 + Math.random() });
    }
  }

  drawLand(ctx, view, t) {
    // espuma animada na costa
    const sh = this.terrain.shore;
    const cx0 = Math.floor(view.x0 / 256), cy0 = Math.floor(view.y0 / 256), cx1 = Math.floor(view.x1 / 256), cy1 = Math.floor(view.y1 / 256);
    ctx.strokeStyle = rgba(this.pal.foam, 0.75); ctx.lineCap = 'round';
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let cy = cy0; cy <= cy1; cy++) for (let cx = cx0; cx <= cx1; cx++) {
      const list = sh.get(cy * 100 + cx);
      if (!list) continue;
      for (const p of list) {
        const w = Math.sin(t * 1.6 + p.ph);
        const off = 3 + w * 3;
        const x = p.x + p.nx * off, y = p.y + p.ny * off;
        const tx = -p.ny * 5, ty = p.nx * 5;
        ctx.moveTo(x - tx, y - ty); ctx.quadraticCurveTo(x + p.nx * 1.5, y + p.ny * 1.5, x + tx, y + ty);
      }
    }
    ctx.stroke();
    // cais
    for (const k of this.docks) {
      if (k.x > view.x1 || k.x + k.w < view.x0 || k.y > view.y1 || k.y + k.h < view.y0) continue;
      ctx.drawImage(k.c, k.x, k.y, k.w, k.h);
    }
    // brilho pulsante da lava
    if (this.id === 'vulcanica') {
      ctx.globalCompositeOperation = 'lighter';
      for (const L of this.lights) if (L.lava && L.x > view.x0 - 120 && L.x < view.x1 + 120 && L.y > view.y0 - 120 && L.y < view.y1 + 120) {
        ctx.globalAlpha = 0.18 + 0.1 * Math.sin(t * 2 + L.ph);
        ctx.drawImage(this.lightSprite('#ff7a1a'), L.x - 70, L.y - 70, 140, 140);
      }
      ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
    }
  }

  drawMoorings(ctx, view, t, boats) {
    for (const m of this.region.moorings) {
      if (m.boat.x < view.x0 - 80 || m.boat.x > view.x1 + 80 || m.boat.y < view.y0 - 80 || m.boat.y > view.y1 + 80) continue;
      const busy = boats.some((b) => Math.hypot(b.x - m.boat.x, b.y - m.boat.y) < 44);
      // corda até o cais
      if (!busy) {
        const bob = Math.sin(t * 1.4) * 1.2;
        ctx.beginPath(); ctx.moveTo(m.board.x, m.board.y); ctx.quadraticCurveTo((m.board.x + m.boat.x) / 2, (m.board.y + m.boat.y) / 2 + 8, m.boat.x - Math.cos(m.boat.a) * 24, m.boat.y - Math.sin(m.boat.a) * 24 + bob);
        ctx.lineWidth = 1.2; ctx.strokeStyle = '#e9dcb8'; ctx.stroke();
        drawBoatHull(ctx, m.boat.x, m.boat.y + bob, m.boat.a + Math.sin(t * 0.8) * 0.03, null, null, t, 0);
      }
      drawMooringPost(ctx, m.boat.x + Math.sin(m.boat.a) * 40, m.boat.y - Math.cos(m.boat.a) * 40, t);
    }
  }

  drawGates(ctx, view, t, selected) {
    for (const g of Object.values(this.region.gates)) {
      if (g.x < view.x0 - 200 || g.x > view.x1 + 200 || g.y < view.y0 - 200 || g.y > view.y1 + 200) continue;
      const sel = selected === g.to;
      // anel de boias
      for (let i = 0; i < 12; i++) {
        const a = (i / 12) * TAU + t * 0.05;
        const x = g.x + Math.cos(a) * g.r, y = g.y + Math.sin(a) * g.r * 0.75, b = Math.sin(t * 2 + i) * 1.5;
        ellipse(ctx, x, y + 3, 6, 3); ctx.fillStyle = 'rgba(255,255,255,.3)'; ctx.fill();
        ctx.beginPath(); ctx.arc(x, y + b, 4.5, 0, TAU); ctx.fillStyle = i % 2 ? '#ffffff' : sel ? '#ffd23f' : '#ff6f4a'; ctx.fill(); ctx.lineWidth = 1; ctx.strokeStyle = '#5a2a1a'; ctx.stroke();
      }
      // correnteza (setas para fora)
      ctx.save(); ctx.translate(g.x, g.y);
      ctx.rotate(Math.atan2(g.dir[1], g.dir[0]));
      for (let k = 0; k < 3; k++) {
        const ph = ((t * 0.6 + k / 3) % 1);
        ctx.globalAlpha = Math.sin(ph * Math.PI) * (sel ? 0.9 : 0.5);
        const x = -50 + ph * 100;
        ctx.beginPath(); ctx.moveTo(x - 10, -12); ctx.lineTo(x + 6, 0); ctx.lineTo(x - 10, 12);
        ctx.lineWidth = 4; ctx.strokeStyle = sel ? '#ffd23f' : '#ffffff'; ctx.lineCap = 'round'; ctx.stroke();
      }
      ctx.restore(); ctx.globalAlpha = 1;
    }
  }

  // Lista ordenada por y: objetos visíveis + entidades
  drawSorted(ctx, view, t, entities, focus) {
    const list = this.drawList;
    list.length = 0;
    for (const o of this.landObjs) {
      const h = OBJ[o.type].h || 30;
      if (o.x < view.x0 - 340 || o.x > view.x1 + 340 || o.y < view.y0 - 10 || o.y - h > view.y1 + 10) continue;
      list.push(o);
    }
    for (const e of entities) list.push(e);
    list.sort((a, b) => a.y - b.y);
    // sombras dos objetos: um único preenchimento
    ctx.fillStyle = 'rgba(0,0,0,0.16)';
    ctx.beginPath();
    for (const o of list) {
      if (o.draw) continue;
      const def = OBJ[o.type];
      if (o.type === 'volcano' || o.type === 'steam_vent' || o.type === 'flowers') continue;
      const r = def.c?.r ? def.c.r * 1.3 : def.c?.w ? def.c.w * 0.55 : 8;
      ctx.moveTo(o.x + 3 + r, o.y - 1);
      ctx.ellipse(o.x + 3, o.y - 1, r, r * 0.38, 0, 0, TAU);
    }
    ctx.fill();
    for (const o of list) {
      if (o.draw) { o.draw(ctx); continue; }
      let alpha = 1;
      if (focus) {
        const def = OBJ[o.type];
        const h = def.h || 0;
        const hw = (def.c?.w ? def.c.w / 2 : def.c?.r ? def.c.r * 2.4 : 14) + 4;
        if (h > 48 && focus.y < o.y - 4 && focus.y > o.y - h * 0.95 && Math.abs(focus.x - o.x) < hw) alpha = 0.45;
      }
      this._drawObj(ctx, o, view, t, alpha);
    }
  }

  _drawObj(ctx, o, view, t, alpha) {
    const s = this.atlas.get(o.type, o.v);
    if (!s) return;
    ctx.globalAlpha = alpha;
    if (s.sway && this.quality !== 'low') {
      const k = Math.sin(t * 1.3 + o.x * 0.013 + o.y * 0.007) * 0.035 * s.sway;
      ctx.save();
      ctx.translate(o.x, o.y);
      ctx.transform(1, 0, k, 1, 0, 0);
      ctx.drawImage(s.c, s.sx, s.sy, s.sw, s.sh, -s.ax, -s.ay, s.w, s.h);
      ctx.restore();
    } else {
      ctx.drawImage(s.c, s.sx, s.sy, s.sw, s.sh, o.x - s.ax, o.y - s.ay, s.w, s.h);
    }
    ctx.globalAlpha = 1;
  }

  // Iluminação: tom da região (multiply) + luzes aditivas
  _overlay(w, h) {
    // tom da região + vinheta pré-combinados (multiplicação), em baixa resolução
    const key = `${Math.round(w)}x${Math.round(h)}|${this.quality}`;
    if (this._ov?.key === key) return this._ov.c;
    const W = Math.max(16, Math.round(w / 4)), H = Math.max(16, Math.round(h / 4));
    const c = makeCanvas(W, H), g = c.getContext('2d');
    g.fillStyle = this.amb.mult; g.fillRect(0, 0, W, H);
    if (this.quality !== 'low') {
      const v = PALETTES[this.id].vignette;
      const gr = g.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.35, W / 2, H / 2, Math.max(W, H) * 0.75);
      gr.addColorStop(0, 'rgba(255,255,255,0)'); gr.addColorStop(1, `rgba(20,30,45,${v})`);
      g.globalCompositeOperation = 'source-over'; g.fillStyle = gr; g.fillRect(0, 0, W, H);
    }
    this._ov = { key, c };
    return c;
  }
  drawLighting(ctx, view, t) {
    if (this.quality === 'low' && this.id === 'tropical') return;
    ctx.globalCompositeOperation = 'multiply';
    ctx.drawImage(this._overlay(view.x1 - view.x0, view.y1 - view.y0), view.x0, view.y0, view.x1 - view.x0, view.y1 - view.y0);
    ctx.globalCompositeOperation = 'lighter';
    const strong = this.id === 'cristais' ? 0.75 : this.id === 'vulcanica' ? 0.9 : this.id === 'mangue' ? 0.75 : 0.45;
    for (const L of this.lights) {
      if (L.lava) continue;
      if (L.x < view.x0 - L.r || L.x > view.x1 + L.r || L.y < view.y0 - L.r || L.y > view.y1 + L.r) continue;
      const f = 0.85 + 0.15 * Math.sin(t * 3 + L.ph) * Math.sin(t * 5.3 + L.ph * 2);
      ctx.globalAlpha = 0.55 * strong * f;
      ctx.drawImage(this.lightSprite(L.col), L.x - L.r, L.y - L.r, L.r * 2, L.r * 2);
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
  }
}
