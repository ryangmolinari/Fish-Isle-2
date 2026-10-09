// Terreno e água renderizados em blocos (chunks) cacheados.
// Cada bloco tem duas camadas: água (baixa resolução, gradientes suaves) e terra
// (resolução cheia, com costa orgânica, texturas e decalques).
import { MAP_W, MAP_H, TILE, WORLD_W, WORLD_H } from '/shared/config.js';
import { T, isWaterT } from '/shared/islands.js';
import { valueNoise, hash2 } from '/shared/rng.js';
import { hexToRgb, makeCanvas, shade, rgba, TAU } from './util.js';
import { PALETTES } from './palettes.js';

export const CS = 256; // tamanho do bloco em px do mundo
const STEP = 2;        // espaçamento da amostragem dos campos
const M = 8;           // margem de amostragem

// textura de ruído global (tileável) para variações de cor
const NT = 256;
let noiseTex = null;
function getNoiseTex() {
  if (noiseTex) return noiseTex;
  noiseTex = new Float32Array(NT * NT);
  for (let y = 0; y < NT; y++) for (let x = 0; x < NT; x++) {
    // ruído periódico: soma de oitavas com período NT
    let v = 0, a = 0.5, f = 8, n = 0;
    for (let o = 0; o < 4; o++) {
      const px = (x / NT) * f, py = (y / NT) * f;
      const xi = Math.floor(px), yi = Math.floor(py), xf = px - xi, yf = py - yi;
      const h = (i, j) => hash2(((i % f) + f) % f, ((j % f) + f) % f, 991 + o);
      const u = xf * xf * (3 - 2 * xf), w = yf * yf * (3 - 2 * yf);
      const val = h(xi, yi) * (1 - u) * (1 - w) + h(xi + 1, yi) * u * (1 - w) + h(xi, yi + 1) * (1 - u) * w + h(xi + 1, yi + 1) * u * w;
      v += val * a; n += a; a *= 0.5; f *= 2;
    }
    noiseTex[y * NT + x] = v / n;
  }
  return noiseTex;
}

// amostra bilinear da textura de ruído (evita degraus nas manchas grandes)
function ntb(nt, x, y) {
  const xi = Math.floor(x), yi = Math.floor(y), fx = x - xi, fy = y - yi;
  const x0 = xi & 255, y0 = yi & 255, x1 = (xi + 1) & 255, y1 = (yi + 1) & 255;
  const a = nt[y0 * NT + x0], b = nt[y0 * NT + x1], c = nt[y1 * NT + x0], d = nt[y1 * NT + x1];
  return a + (b - a) * fx + (c - a) * fy + (a - b - c + d) * fx * fy;
}

export class TerrainRenderer {
  constructor(region, res) {
    this.r = region;
    this.pal = PALETTES[region.id];
    this.res = res;
    this.chunks = new Map();
    this.maxChunks = 36;
    this.nt = getNoiseTex();
    this.groundRGB = {};
    for (const [k, v] of Object.entries(this.pal.ground)) this.groundRGB[k] = hexToRgb(v);
    this.wShallow = hexToRgb(this.pal.waterShallow);
    this.wDeep = hexToRgb(this.pal.waterDeep);
    this.wAbyss = hexToRgb(this.pal.waterAbyss);
    this.spring = hexToRgb(this.pal.spring || '#7fd8d0');
    this.reefCols = (this.pal.reef || []).map(hexToRgb);
    this._depthField();
    this.shore = this._shorePoints();
    this.genMs = 0; this.genCount = 0;
  }
  setRes(res) { if (res !== this.res) { this.res = res; this.dispose(); } }
  dispose() { for (const c of this.chunks.values()) c.img.width = c.img.height = 1; this.chunks.clear(); }

  // distância (em tiles) até a terra, para a cor da água
  _depthField() {
    const d = new Float32Array(MAP_W * MAP_H).fill(99);
    const q = [];
    for (let y = 0; y < MAP_H; y++) for (let x = 0; x < MAP_W; x++)
      if (!isWaterT(this.r.tile(x, y))) { d[y * MAP_W + x] = 0; q.push(x, y); }
    for (let i = 0; i < q.length; i += 2) {
      const x = q[i], y = q[i + 1], v = d[y * MAP_W + x];
      for (const [dx, dy, c] of [[1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1], [1, 1, 1.41], [-1, 1, 1.41], [1, -1, 1.41], [-1, -1, 1.41]]) {
        const nx = x + dx, ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= MAP_W || ny >= MAP_H) continue;
        if (d[ny * MAP_W + nx] > v + c) { d[ny * MAP_W + nx] = v + c; q.push(nx, ny); }
      }
    }
    this.depth = d;
  }
  depthAt(x, y) {
    const gx = x / TILE - 0.5, gy = y / TILE - 0.5;
    const ix = Math.max(0, Math.min(MAP_W - 2, Math.floor(gx))), iy = Math.max(0, Math.min(MAP_H - 2, Math.floor(gy)));
    const fx = Math.max(0, Math.min(1, gx - ix)), fy = Math.max(0, Math.min(1, gy - iy));
    const D = this.depth;
    const a = D[iy * MAP_W + ix], b = D[iy * MAP_W + ix + 1], c = D[(iy + 1) * MAP_W + ix], e = D[(iy + 1) * MAP_W + ix + 1];
    return a + (b - a) * fx + (c - a) * fy + (a - b - c + e) * fx * fy;
  }

  // pontos da linha de costa para a espuma animada
  _shorePoints() {
    const pts = [];
    const r = this.r;
    for (let y = 2; y < WORLD_H - 2; y += 14) for (let x = 2; x < WORLD_W - 2; x += 14) {
      const L = r.landField(x, y);
      if (L > 0.5 || L < 0.3) continue;
      // gradiente para achar a normal
      const gx = r.landField(x + 4, y) - r.landField(x - 4, y), gy = r.landField(x, y + 4) - r.landField(x, y - 4);
      const gl = Math.hypot(gx, gy);
      if (gl < 0.02) continue;
      const nx = gx / gl, ny = gy / gl;
      const k = (0.5 - L) / (gl / 8);
      const px = x + nx * k, py = y + ny * k;
      if (r.inDock(px, py, 4)) continue;
      pts.push({ x: px, y: py, nx: -nx, ny: -ny, ph: hash2(x, y, 3) * TAU });
    }
    // indexa por bloco
    const grid = new Map();
    for (const p of pts) {
      const k = Math.floor(p.y / CS) * 100 + Math.floor(p.x / CS);
      if (!grid.has(k)) grid.set(k, []);
      grid.get(k).push(p);
    }
    return grid;
  }

  getChunk(cx, cy, allowGen) {
    const k = cy * 100 + cx;
    let c = this.chunks.get(k);
    if (!c && allowGen) {
      const t0 = performance.now();
      c = this._gen(cx, cy);
      this.genMs += performance.now() - t0; this.genCount++;
      this.chunks.set(k, c);
      if (this.chunks.size > this.maxChunks) this._evict();
    }
    if (c) c.used = performance.now();
    return c;
  }
  _evict() {
    let oldest = null, ot = Infinity;
    for (const [k, c] of this.chunks) if (c.used < ot) { ot = c.used; oldest = k; }
    if (oldest != null) { const c = this.chunks.get(oldest); c.img.width = c.img.height = 1; this.chunks.delete(oldest); }
  }

  _gen(cx, cy) {
    const r = this.r, pal = this.pal, nt = this.nt;
    const x0 = cx * CS, y0 = cy * CS;
    // 1) amostragem dos campos
    const SN = (CS + M * 2) / STEP + 1;
    const LF = new Float32Array(SN * SN), TY = new Uint8Array(SN * SN);
    const WX = new Float32Array(SN * SN), WY = new Float32Array(SN * SN);
    for (let j = 0; j < SN; j++) for (let i = 0; i < SN; i++) {
      const wx = x0 - M + i * STEP, wy = y0 - M + j * STEP;
      const L = r.landField(wx, wy);
      LF[j * SN + i] = L;
      WX[j * SN + i] = (valueNoise(wx / 23, wy / 23, r.seed + 11) - 0.5) * 18;
      WY[j * SN + i] = (valueNoise(wx / 23, wy / 23, r.seed + 12) - 0.5) * 18;
      let t = r.tileAt(wx, wy);
      if (L > 0.5 && isWaterT(t)) t = r._nearestLandType(wx, wy);
      else if (L <= 0.5 && !isWaterT(t)) t = r._nearestWaterType(wx, wy);
      TY[j * SN + i] = t;
    }
    const sampleL = (wx, wy) => {
      const sx = (wx - x0 + M) / STEP, sy = (wy - y0 + M) / STEP;
      const ix = sx | 0, iy = sy | 0, fx = sx - ix, fy = sy - iy;
      const i0 = iy * SN + ix;
      const a = LF[i0], b = LF[i0 + 1], c = LF[i0 + SN], d = LF[i0 + SN + 1];
      return a + (b - a) * fx + (c - a) * fy + (a - b - c + d) * fx * fy;
    };
    const sampleT = (wx, wy) => TY[Math.round((wy - y0 + M) / STEP) * SN + Math.round((wx - x0 + M) / STEP)];
    // tipo de terreno por pixel: deformação interpolada + consulta direta ao tile (bordas suaves)
    const tiles = r.tiles;
    const pixelT = (wx, wy, jx, jy) => {
      const sx = (wx - x0 + M) / STEP, sy = (wy - y0 + M) / STEP;
      const ix = sx | 0, iy = sy | 0, fx = sx - ix, fy = sy - iy, i0 = iy * SN + ix;
      const ox = WX[i0] + (WX[i0 + 1] - WX[i0]) * fx + (WX[i0 + SN] - WX[i0]) * fy;
      const oy = WY[i0] + (WY[i0 + 1] - WY[i0]) * fx + (WY[i0 + SN] - WY[i0]) * fy;
      const tx = Math.floor((wx + ox + jx) / TILE), ty = Math.floor((wy + oy + jy) / TILE);
      const t = tx < 0 || ty < 0 || tx >= MAP_W || ty >= MAP_H ? T.WATER : tiles[ty * MAP_W + tx];
      return isWaterT(t) ? TY[Math.round(sy) * SN + Math.round(sx)] : t;
    };

    // 2) camada de água (1 px por 2 px do mundo, suavizada ao desenhar)
    const WR = Math.max(0.5, Math.min(1, this.res / 2));
    const WP = Math.ceil(CS * WR);
    const water = makeCanvas(WP, WP);
    {
      const wctx = water.getContext('2d');
      const img = wctx.createImageData(WP, WP), D = img.data;
      const S = this.wShallow, Dp = this.wDeep, A = this.wAbyss;
      for (let py = 0; py < WP; py++) for (let px = 0; px < WP; px++) {
        const wx = x0 + (px + 0.5) / WR, wy = y0 + (py + 0.5) / WR;
        const dep = this.depthAt(wx, wy);
        const n1 = nt[((wy * 0.25) & 255) * NT + ((wx * 0.25) & 255)];
        let t = Math.min(1, Math.max(0, (dep - 0.6 + (n1 - 0.5) * 1.6) / 4.5));
        let rr, gg, bb;
        if (t < 0.5) { const u = t * 2; rr = S[0] + (Dp[0] - S[0]) * u; gg = S[1] + (Dp[1] - S[1]) * u; bb = S[2] + (Dp[2] - S[2]) * u; }
        else { const u = Math.min(1, (t - 0.5) * 1.6); rr = Dp[0] + (A[0] - Dp[0]) * u; gg = Dp[1] + (A[1] - Dp[1]) * u; bb = Dp[2] + (A[2] - Dp[2]) * u; }
        const ty = sampleT(Math.min(x0 + CS + M - 2, wx), Math.min(y0 + CS + M - 2, wy));
        if (ty === T.SPRING) { const k = 0.7; rr = rr * (1 - k) + this.spring[0] * k; gg = gg * (1 - k) + this.spring[1] * k; bb = bb * (1 - k) + this.spring[2] * k; }
        else if (ty === T.REEF) { rr = rr * 0.9 + 12; gg = gg * 0.96; bb *= 0.92; }
        // sombra da margem (luz vindo do noroeste)
        const Ls = sampleL(Math.max(x0 - M + 2, wx - 5), Math.max(y0 - M + 2, wy - 7));
        if (Ls > 0.5) { rr *= 0.78; gg *= 0.82; bb *= 0.86; }
        const v = 1 + (n1 - 0.5) * 0.12;
        const i = (py * WP + px) * 4;
        D[i] = rr * v; D[i + 1] = gg * v; D[i + 2] = bb * v; D[i + 3] = 255;
      }
      wctx.putImageData(img, 0, 0);
      if (this.reefCols.length) this._corals(wctx, x0, y0, WR, sampleT);
    }

    // 3) camada de terra
    const res = this.res;
    const P = Math.ceil(CS * res);
    const land = makeCanvas(P, P);
    const lctx = land.getContext('2d');
    const img = lctx.createImageData(P, P), D = img.data;
    const G = this.groundRGB;
    const foam = hexToRgb(pal.foam);
    const id = r.id;
    for (let py = 0; py < P; py++) {
      const wy = y0 + (py + 0.5) / res;
      for (let px = 0; px < P; px++) {
        const wx = x0 + (px + 0.5) / res;
        const L = sampleL(wx, wy);
        const i = (py * P + px) * 4;
        if (L < 0.5) {
          if (L > 0.41) { // franja de espuma na beira
            const a = (L - 0.41) / 0.09;
            D[i] = foam[0]; D[i + 1] = foam[1]; D[i + 2] = foam[2]; D[i + 3] = 150 * a * a;
          }
          continue;
        }
        const n1 = ntb(nt, wx * 0.35, wy * 0.35);
        const n2 = nt[((wy * 2.1) & 255) * NT + ((wx * 2.1) & 255)];
        const n3 = nt[((wx * 1.3 + 77) & 255) * NT + ((wy * 1.3 + 31) & 255)];
        // deformação extra em duas escalas: quebra as bordas retas herdadas dos tiles
        const big = ntb(nt, wx * 0.75 + 40, wy * 0.75 + 90) - 0.5, big2 = ntb(nt, wx * 0.75 + 140, wy * 0.75 + 10) - 0.5;
        let t = pixelT(wx, wy, big * 30 + (n2 - 0.5) * 6, big2 * 30 + (n3 - 0.5) * 6);
        if (isWaterT(t)) t = r._nearestLandType(wx, wy);
        const c = G[t] || G[T.SAND];
        let k = 1 + (n1 - 0.5) * 0.22 + (n2 - 0.5) * 0.1;
        let rr = c[0], gg = c[1], bb = c[2];
        switch (t) {
          case T.SAND: case T.BLACKSAND:
            if (L < 0.57) k *= 0.86 + (L - 0.5) * 2; // areia molhada
            if (t === T.BLACKSAND && n2 > 0.78) { rr += 60; gg += 50; bb += 50; }
            break;
          case T.GRASS: case T.JUNGLE: case T.MOSS: case T.CRYSTAL: {
            const s = Math.min(1, Math.max(0, (n1 - 0.56) * 12));
            rr += 14 * s; gg += 12 * s; bb -= 4 * s;
            if (n2 < 0.2) k *= 0.88;
            if (t === T.CRYSTAL && n2 > 0.86) { rr += 50; gg += 50; bb += 60; }
            break;
          }
          case T.SNOW: {
            const s = Math.min(1, Math.max(0, (0.46 - n1) * 10));
            rr -= 18 * s; gg -= 10 * s;
            if (hash2(px, py, cx * 31 + cy) > 0.9975) { rr = gg = bb = 255; k = 1.05; }
            break;
          }
          case T.ICE: {
            const s = ((wx + wy * 0.6) % 46 + 46) % 46;
            if (s < 2.5) { rr += 30; gg += 25; bb += 15; }
            if (n2 > 0.75) { rr += 10; gg += 10; }
            break;
          }
          case T.PATH: case T.DIRT:
            if (n2 > 0.8) { rr += 22; gg += 20; bb += 18; }
            if (n2 < 0.15) k *= 0.85;
            break;
          case T.RUIN: {
            const tx = Math.floor(wx / 22), ty2 = Math.floor((wy + (tx % 2) * 11) / 22);
            const mx = ((wx % 22) + 22) % 22, my = (((wy + (tx % 2) * 11) % 22) + 22) % 22;
            k *= 0.92 + hash2(tx, ty2, 5) * 0.16;
            if (mx < 1.4 || my < 1.4) k *= 0.72;
            if (n1 > 0.64) { gg += 16; rr -= 6; } // musgo
            break;
          }
          case T.BASALT: case T.ASH: {
            const e = Math.abs(n1 - 0.5);
            if (e < 0.012) k *= 0.62;
            if (n2 > 0.82) k *= 1.12;
            break;
          }
          case T.LAVA: {
            const cr = Math.min(1, Math.max(0, (n1 - 0.52) * 9));
            rr = 255 * (1 - cr) + (90 + n2 * 40) * cr; gg = (120 + n2 * 110) * (1 - cr) + (30 + n2 * 20) * cr; bb = (30 + n2 * 40) * (1 - cr) + 20 * cr;
            k = 1;
            break;
          }
        }
        // borda iluminada da costa
        if (L < 0.53 && t !== T.LAVA) k *= 1.08;
        D[i] = Math.min(255, rr * k); D[i + 1] = Math.min(255, gg * k); D[i + 2] = Math.min(255, bb * k); D[i + 3] = L < 0.515 ? 255 * ((L - 0.5) / 0.015) : 255;
      }
    }
    lctx.putImageData(img, 0, 0);
    this._decals(lctx, x0, y0, sampleL, sampleT, res);
    // funde água + terra num único bitmap: um só desenho por bloco a cada quadro
    const merged = makeCanvas(P, P), mctx = merged.getContext('2d');
    mctx.imageSmoothingEnabled = true;
    mctx.drawImage(water, 0, 0, P, P);
    mctx.drawImage(land, 0, 0);
    water.width = water.height = 1; land.width = land.height = 1;
    return { img: merged, x0, y0, used: performance.now() };
  }

  // Corais sob a água rasa (desenhados na camada de água)
  _corals(ctx, x0, y0, res, sampleT) {
    ctx.save(); ctx.scale(res, res); ctx.translate(-x0, -y0);
    for (let ty = y0; ty < y0 + CS; ty += 12) for (let tx = x0; tx < x0 + CS; tx += 12) {
      const x = tx + hash2(tx, ty, 61) * 12, y = ty + hash2(tx, ty, 62) * 12;
      if (sampleT(Math.min(x0 + CS + 6, x), Math.min(y0 + CS + 6, y)) !== T.REEF) continue;
      const h = hash2(tx, ty, 63);
      if (h > 0.62) continue;
      const col = this.reefCols[Math.floor(h * 1000) % this.reefCols.length];
      const css = `rgba(${col[0]},${col[1]},${col[2]},0.55)`;
      ctx.fillStyle = css; ctx.strokeStyle = css; ctx.lineCap = 'round';
      if (h < 0.25) { // coral ramificado
        ctx.lineWidth = 2;
        for (let k = 0; k < 4; k++) { const a = -Math.PI / 2 + (k - 1.5) * 0.5; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + Math.cos(a) * 6, y + Math.sin(a) * 6); ctx.stroke(); }
      } else if (h < 0.45) { // coral cérebro
        ctx.beginPath(); ctx.ellipse(x, y, 4.5, 3.5, 0, 0, TAU); ctx.fill();
      } else { // anêmona
        for (let k = 0; k < 5; k++) { ctx.beginPath(); ctx.arc(x + Math.cos(k * 1.25) * 2.5, y + Math.sin(k * 1.25) * 2, 1.8, 0, TAU); ctx.fill(); }
      }
    }
    ctx.restore();
  }

  // Pequenos detalhes do chão desenhados por cima da textura
  _decals(ctx, x0, y0, sampleL, sampleT, res) {
    const id = this.r.id;
    ctx.save();
    ctx.scale(res, res);
    ctx.translate(-x0, -y0);
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    const ok = (x, y) => x > x0 && y > y0 && x < x0 + CS && y < y0 + CS && sampleL(x, y) > 0.58 && !this.r.inDock(x, y, 6);
    for (let ty = y0; ty < y0 + CS; ty += 16) for (let tx = x0; tx < x0 + CS; tx += 16) {
      const h = hash2(tx, ty, 77 + this.r.seed);
      const x = tx + hash2(tx, ty, 1) * 16, y = ty + hash2(tx, ty, 2) * 16;
      if (!ok(x, y)) continue;
      const t = sampleT(x, y);
      switch (t) {
        case T.GRASS: case T.JUNGLE: case T.MOSS:
          if (h < 0.45) { // tufo de grama
            const c = shade(this.pal.ground[t], h < 0.2 ? -0.25 : 0.18);
            ctx.strokeStyle = c; ctx.lineWidth = 1.3;
            ctx.beginPath(); ctx.moveTo(x - 3, y); ctx.lineTo(x - 4, y - 5); ctx.moveTo(x, y); ctx.lineTo(x, y - 6); ctx.moveTo(x + 3, y); ctx.lineTo(x + 4.5, y - 4.5); ctx.stroke();
          } else if (h < 0.53 && t === T.GRASS && id === 'tropical') {
            const cols = ['#ffffff', '#ffe066', '#ff8fb1', '#b9a0ff'];
            ctx.fillStyle = cols[Math.floor(h * 1000) % 4];
            for (let k = 0; k < 3; k++) { ctx.beginPath(); ctx.arc(x + k * 3 - 3, y + (k % 2) * 2, 1.4, 0, TAU); ctx.fill(); }
          } else if (h < 0.6 && t === T.MOSS) {
            ctx.fillStyle = 'rgba(40,70,20,.35)'; ctx.beginPath(); ctx.ellipse(x, y, 6, 3.5, 0, 0, TAU); ctx.fill();
          }
          break;
        case T.SAND:
          if (id === 'tropical' && h < 0.08) { // concha
            ctx.fillStyle = h < 0.04 ? '#ffd6c9' : '#fff3e3'; ctx.strokeStyle = '#d9a48f'; ctx.lineWidth = 0.8;
            ctx.beginPath(); ctx.moveTo(x, y + 3); for (let k = 0; k <= 4; k++) { const a = Math.PI + (k / 4) * Math.PI; ctx.lineTo(x + Math.cos(a) * 3.5, y + Math.sin(a) * 3.5); } ctx.closePath(); ctx.fill(); ctx.stroke();
          } else if (id === 'tropical' && h < 0.1) { // estrela-do-mar
            ctx.fillStyle = '#ff8a5c'; ctx.beginPath(); for (let k = 0; k < 10; k++) { const a = (k / 10) * TAU - Math.PI / 2, rr = k % 2 ? 1.6 : 4.2; ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); } ctx.closePath(); ctx.fill();
          } else if (h < 0.2) { ctx.fillStyle = rgba(shade(this.pal.ground[t], -0.25), 0.6); ctx.beginPath(); ctx.ellipse(x, y, 1.8, 1.2, 0, 0, TAU); ctx.fill(); }
          else if (h < 0.3) { ctx.strokeStyle = rgba(shade(this.pal.ground[t], -0.12), 0.5); ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(x - 6, y); ctx.quadraticCurveTo(x, y - 2, x + 6, y); ctx.stroke(); }
          break;
        case T.MUD:
          if (h < 0.22) { ctx.fillStyle = 'rgba(60,45,25,.55)'; ctx.beginPath(); ctx.ellipse(x, y, 6 + h * 20, 3 + h * 8, 0, 0, TAU); ctx.fill(); ctx.fillStyle = 'rgba(255,255,255,.25)'; ctx.beginPath(); ctx.ellipse(x - 2, y - 1, 2, 0.8, 0, 0, TAU); ctx.fill(); }
          else if (h < 0.3) { ctx.strokeStyle = 'rgba(50,35,20,.5)'; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(x - 4, y); ctx.lineTo(x + 4, y + 2); ctx.stroke(); }
          break;
        case T.SNOW:
          if (h < 0.18) { ctx.fillStyle = 'rgba(150,190,230,.35)'; ctx.beginPath(); ctx.ellipse(x, y + 2, 8, 3, 0, 0, TAU); ctx.fill(); ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.ellipse(x, y, 8, 3, 0, 0, TAU); ctx.fill(); }
          break;
        case T.ICE:
          if (h < 0.3) { ctx.strokeStyle = 'rgba(255,255,255,.75)'; ctx.lineWidth = 0.9; ctx.beginPath(); let px = x, py = y; ctx.moveTo(px, py); for (let k = 0; k < 4; k++) { px += (hash2(tx, ty, k + 9) - 0.5) * 14; py += (hash2(tx, ty, k + 19) - 0.5) * 10; ctx.lineTo(px, py); } ctx.stroke(); ctx.strokeStyle = 'rgba(80,140,190,.35)'; ctx.stroke(); }
          break;
        case T.BASALT: case T.ASH: case T.BLACKSAND:
          if (h < 0.18) { ctx.fillStyle = shade(this.pal.ground[t], -0.3); ctx.beginPath(); ctx.ellipse(x, y, 2.5, 1.8, h * 6, 0, TAU); ctx.fill(); ctx.fillStyle = shade(this.pal.ground[t], 0.25); ctx.beginPath(); ctx.ellipse(x - 0.7, y - 0.7, 1, 0.6, 0, 0, TAU); ctx.fill(); }
          else if (h < 0.24 && t !== T.BLACKSAND) { ctx.fillStyle = 'rgba(255,120,40,.5)'; ctx.beginPath(); ctx.arc(x, y, 1.2, 0, TAU); ctx.fill(); }
          break;
        case T.CRYSTAL:
          if (h < 0.12) { ctx.fillStyle = h < 0.06 ? '#d7c4ff' : '#9ff0ff'; ctx.strokeStyle = '#5a3f9a'; ctx.lineWidth = 0.7; ctx.beginPath(); ctx.moveTo(x - 2, y); ctx.lineTo(x, y - 6); ctx.lineTo(x + 2, y); ctx.closePath(); ctx.fill(); ctx.stroke(); }
          else if (h < 0.3) { ctx.strokeStyle = shade(this.pal.ground[t], 0.2); ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(x - 3, y); ctx.lineTo(x - 4, y - 5); ctx.moveTo(x, y); ctx.lineTo(x, y - 6); ctx.moveTo(x + 3, y); ctx.lineTo(x + 4.5, y - 4.5); ctx.stroke(); }
          break;
        case T.PATH:
          if (h < 0.25) { ctx.fillStyle = shade(this.pal.ground[t], h < 0.12 ? -0.18 : 0.15); ctx.beginPath(); ctx.ellipse(x, y, 2.4, 1.6, h * 9, 0, TAU); ctx.fill(); }
          break;
        case T.RUIN:
          if (h < 0.1) { ctx.strokeStyle = 'rgba(60,50,90,.4)'; ctx.lineWidth = 0.9; ctx.beginPath(); ctx.moveTo(x - 5, y - 2); ctx.lineTo(x, y); ctx.lineTo(x + 3, y + 4); ctx.stroke(); }
          break;
      }
    }
    ctx.restore();
  }

  // Desenha as camadas visíveis. layer: 'water' | 'land'
  draw(ctx, view, layer, budgetMs = 6) {
    const cx0 = Math.max(0, Math.floor(view.x0 / CS)), cy0 = Math.max(0, Math.floor(view.y0 / CS));
    const cx1 = Math.min(Math.ceil(WORLD_W / CS) - 1, Math.floor(view.x1 / CS)), cy1 = Math.min(Math.ceil(WORLD_H / CS) - 1, Math.floor(view.y1 / CS));
    const t0 = performance.now();
    this.maxChunks = Math.max(36, Math.ceil((cx1 - cx0 + 1) * (cy1 - cy0 + 1) * 1.6));
    let missing = 0;
    for (let cy = cy0; cy <= cy1; cy++) for (let cx = cx0; cx <= cx1; cx++) {
      const allow = layer === 'water' && (budgetMs === Infinity || performance.now() - t0 < budgetMs);
      const c = this.getChunk(cx, cy, allow);
      if (!c) {
        missing++;
        if (layer === 'water') { ctx.fillStyle = this.pal.waterDeep; ctx.fillRect(cx * CS, cy * CS, CS + 1, CS + 1); }
        continue;
      }
      ctx.drawImage(c.img, c.x0, c.y0, CS + 0.5, CS + 0.5);
    }
    return missing;
  }
  // Pré-gera os blocos ao redor de um ponto (tela de carregamento)
  warm(x, y, radius) {
    const cx0 = Math.max(0, Math.floor((x - radius) / CS)), cy0 = Math.max(0, Math.floor((y - radius) / CS));
    const cx1 = Math.min(Math.ceil(WORLD_W / CS) - 1, Math.floor((x + radius) / CS)), cy1 = Math.min(Math.ceil(WORLD_H / CS) - 1, Math.floor((y + radius) / CS));
    for (let cy = cy0; cy <= cy1; cy++) for (let cx = cx0; cx <= cx1; cx++) this.getChunk(cx, cy, true);
  }
}
