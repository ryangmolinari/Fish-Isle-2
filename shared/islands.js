// Geração determinística das cinco regiões. O mesmo código roda no servidor
// (colisão, validação de lançamento, cais, passagens) e no cliente (desenho).

import { TILE, MAP_W, MAP_H, WORLD_W, WORLD_H } from './config.js';
import { mulberry32, valueNoise, fbm, hashStr, clamp } from './rng.js';

// ───────────── Terrenos ─────────────
export const T = {
  WATER: 0, SAND: 1, GRASS: 2, PATH: 3, MUD: 4, SNOW: 5, ICE: 6, BLACKSAND: 7, BASALT: 8,
  LAVA: 9, CRYSTAL: 10, RUIN: 11, SPRING: 12, REEF: 13, DIRT: 14, JUNGLE: 15, ASH: 16, MOSS: 17,
};
const W = true, F = false;
//                       water walk  nav   fish
const PROPS = [];
PROPS[T.WATER]     = [W, F, W, W];
PROPS[T.SAND]      = [F, W, F, F];
PROPS[T.GRASS]     = [F, W, F, F];
PROPS[T.PATH]      = [F, W, F, F];
PROPS[T.MUD]       = [F, W, F, F];
PROPS[T.SNOW]      = [F, W, F, F];
PROPS[T.ICE]       = [F, W, F, F];
PROPS[T.BLACKSAND] = [F, W, F, F];
PROPS[T.BASALT]    = [F, W, F, F];
PROPS[T.LAVA]      = [F, F, F, F];
PROPS[T.CRYSTAL]   = [F, W, F, F];
PROPS[T.RUIN]      = [F, W, F, F];
PROPS[T.SPRING]    = [W, F, F, W];
PROPS[T.REEF]      = [W, F, F, W];
PROPS[T.DIRT]      = [F, W, F, F];
PROPS[T.JUNGLE]    = [F, W, F, F];
PROPS[T.ASH]       = [F, W, F, F];
PROPS[T.MOSS]      = [F, W, F, F];
export const isWaterT = (t) => PROPS[t][0];
export const isWalkT = (t) => PROPS[t][1];
export const isNavT = (t) => PROPS[t][2];
export const isFishT = (t) => PROPS[t][3];

// ───────────── Objetos ─────────────
// c: colisor — {r} círculo na base, ou {w,d} retângulo (largura × profundidade) com base em y
// h: altura aproximada do desenho (usada pelo cliente para oclusão)
export const OBJ = {
  // genéricos
  rock_small: { c: { r: 9 }, h: 18 }, crate: { c: { r: 10 }, h: 22 }, barrel: { c: { r: 9 }, h: 24 },
  signpost: { c: { r: 5 }, h: 34 }, lamp: { c: { r: 5 }, h: 46 },
  // tropical
  palm: { c: { r: 8 }, h: 110 }, bush_tropical: { c: { r: 12 }, h: 28 }, flowers: { c: null, h: 10 },
  house_wood: { c: { w: 92, d: 52 }, h: 104 }, shop_tropical: { c: { w: 120, d: 64 }, h: 120 },
  umbrella: { c: { r: 6 }, h: 54 }, torch: { c: { r: 4 }, h: 40 }, net_rack: { c: { w: 50, d: 12 }, h: 40 },
  lookout: { c: { w: 64, d: 44 }, h: 150 }, hammock: { c: { w: 70, d: 10 }, h: 40 },
  // mangue
  mangrove: { c: { r: 16 }, h: 120 }, mangrove_small: { c: { r: 10 }, h: 70 }, reeds: { c: null, h: 30 },
  stilt_hut: { c: { w: 96, d: 56 }, h: 112 }, shop_mangue: { c: { w: 124, d: 66 }, h: 126 },
  log: { c: { w: 56, d: 14 }, h: 16 }, lilypad: { c: null, h: 0, water: true }, lantern_post: { c: { r: 5 }, h: 52 },
  fern: { c: null, h: 26 },
  // congelada
  pine: { c: { r: 10 }, h: 112 }, pine_small: { c: { r: 7 }, h: 70 }, cabin: { c: { w: 96, d: 56 }, h: 108 },
  shop_congelada: { c: { w: 120, d: 60 }, h: 100 }, snowman: { c: { r: 11 }, h: 44 }, ice_rock: { c: { r: 15 }, h: 34 },
  campfire: { c: { r: 11 }, h: 20 }, sled: { c: { w: 40, d: 16 }, h: 18 }, fish_rack: { c: { w: 52, d: 12 }, h: 46 },
  ice_spike: { c: { r: 10 }, h: 52 },
  // vulcânica
  volcano: { c: { r: 250 }, h: 420 }, basalt: { c: { r: 22 }, h: 70 }, lava_rock: { c: { r: 13 }, h: 26 },
  shrub_dry: { c: null, h: 22 }, agave: { c: { r: 9 }, h: 30 }, dead_tree: { c: { r: 7 }, h: 86 },
  shop_vulcanica: { c: { w: 124, d: 64 }, h: 124 }, hut_stone: { c: { w: 88, d: 52 }, h: 96 }, steam_vent: { c: null, h: 0 },
  obsidian: { c: { r: 12 }, h: 40 },
  // cristais
  crystal_big: { c: { r: 18 }, h: 96 }, crystal_small: { c: { r: 9 }, h: 44 }, glow_mushroom: { c: null, h: 22 },
  glow_plant: { c: null, h: 34 }, column: { c: { r: 13 }, h: 104 }, column_broken: { c: { r: 13 }, h: 48 },
  arch: { c: null, h: 120 }, statue: { c: { r: 18 }, h: 92 }, temple: { c: { w: 220, d: 90 }, h: 190 },
  shop_cristais: { c: { w: 120, d: 64 }, h: 126 }, crystal_lamp: { c: { r: 5 }, h: 56 },
};

// ───────────── Metadados das regiões ─────────────
export const ISLANDS = {
  tropical:  { id: 'tropical',  name: 'Ilha Tropical',     short: 'Tropical',  subtitle: 'Praias claras e recifes turquesa', world: [0.5, 0.74],  seed: 1101, order: 0 },
  mangue:    { id: 'mangue',    name: 'Ilha do Mangue',    short: 'Mangue',    subtitle: 'Canais estreitos entre raízes',    world: [0.17, 0.48], seed: 2203, order: 1 },
  congelada: { id: 'congelada', name: 'Ilha Congelada',    short: 'Congelada', subtitle: 'Gelo, pinheiros e água profunda',  world: [0.4, 0.14],  seed: 3307, order: 2 },
  vulcanica: { id: 'vulcanica', name: 'Ilha Vulcânica',    short: 'Vulcânica', subtitle: 'Areia preta e fontes termais',     world: [0.84, 0.5],  seed: 4409, order: 3 },
  cristais:  { id: 'cristais',  name: 'Ilha dos Cristais', short: 'Cristais',  subtitle: 'Ruínas e luz que vem da água',     world: [0.74, 0.14], seed: 5501, order: 4 },
};
export const ISLAND_ORDER = ['tropical', 'mangue', 'congelada', 'vulcanica', 'cristais'];
export const START_ISLAND = 'tropical';

// ───────────── Construtor de mapa ─────────────
class Builder {
  constructor(id) {
    this.id = id;
    this.seed = ISLANDS[id].seed;
    this.rand = mulberry32(this.seed);
    this.tiles = new Uint8Array(MAP_W * MAP_H);
    this.objects = [];
    this.docks = [];
    this.hotspots = [];
    this.decals = []; // decoração sem colisão desenhada no chão (client)
    this.moorings = [];
  }
  inb(x, y) { return x >= 0 && y >= 0 && x < MAP_W && y < MAP_H; }
  get(x, y) { return this.inb(x, y) ? this.tiles[y * MAP_W + x] : T.WATER; }
  set(x, y, t) { if (this.inb(x, y)) this.tiles[y * MAP_W + x] = t; }
  isLand(x, y) { return !isWaterT(this.get(x, y)); }

  blob(cx, cy, rx, ry, t, amp = 0.28, freq = 0.18, onlyIf = null) {
    const s = this.seed + Math.round(cx * 7 + cy * 13);
    for (let y = Math.floor(cy - ry - 4); y <= cy + ry + 4; y++)
      for (let x = Math.floor(cx - rx - 4); x <= cx + rx + 4; x++) {
        if (!this.inb(x, y)) continue;
        const dx = (x + 0.5 - cx) / rx, dy = (y + 0.5 - cy) / ry;
        const d = Math.sqrt(dx * dx + dy * dy);
        const n = (fbm(x * freq, y * freq, s) - 0.5) * 2 * amp;
        if (d + n < 1 && (!onlyIf || onlyIf(this.get(x, y), x, y))) this.set(x, y, t);
      }
  }
  rect(x0, y0, x1, y1, t, onlyIf = null) {
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++)
      if (!onlyIf || onlyIf(this.get(x, y), x, y)) this.set(x, y, t);
  }
  // Pinta um caminho grosso ao longo de uma polilinha (coordenadas em tiles)
  stroke(pts, width, t, onlyIf = null, wobble = 0.6) {
    for (let i = 0; i < pts.length - 1; i++) {
      const [ax, ay] = pts[i], [bx, by] = pts[i + 1];
      const len = Math.hypot(bx - ax, by - ay);
      const steps = Math.ceil(len * 3);
      for (let k = 0; k <= steps; k++) {
        const f = k / steps;
        const px = ax + (bx - ax) * f, py = ay + (by - ay) * f;
        const w = width / 2 + (valueNoise(px * 0.4, py * 0.4, this.seed + 99) - 0.5) * wobble;
        for (let y = Math.floor(py - w - 1); y <= py + w + 1; y++)
          for (let x = Math.floor(px - w - 1); x <= px + w + 1; x++) {
            if (Math.hypot(x + 0.5 - px, y + 0.5 - py) <= w && (!onlyIf || onlyIf(this.get(x, y), x, y))) this.set(x, y, t);
          }
      }
    }
  }
  distToWater() {
    const d = new Int16Array(MAP_W * MAP_H).fill(999);
    const q = [];
    for (let y = 0; y < MAP_H; y++) for (let x = 0; x < MAP_W; x++)
      if (!this.isLand(x, y)) { d[y * MAP_W + x] = 0; q.push(x, y); }
    for (let i = 0; i < q.length; i += 2) {
      const x = q[i], y = q[i + 1], v = d[y * MAP_W + x];
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = x + dx, ny = y + dy;
        if (this.inb(nx, ny) && d[ny * MAP_W + nx] > v + 1) { d[ny * MAP_W + nx] = v + 1; q.push(nx, ny); }
      }
    }
    return d;
  }
  // Caminha de (x,y) na direção (dx,dy) até achar água; devolve o último tile de terra
  coast(x, y, dx, dy) {
    let lx = x, ly = y;
    for (let i = 0; i < 200; i++) {
      const nx = Math.round(x + dx * i), ny = Math.round(y + dy * i);
      if (!this.isLand(nx, ny)) return [lx, ly];
      lx = nx; ly = ny;
    }
    return [lx, ly];
  }
  obj(type, tx, ty, extra = {}) { // tx,ty em tiles (pode ser fracionário); base do objeto
    const o = { type, x: Math.round(tx * TILE), y: Math.round(ty * TILE), v: Math.floor(this.rand() * 1000), ...extra };
    this.objects.push(o);
    return o;
  }
  objPx(type, x, y, extra = {}) {
    const o = { type, x: Math.round(x), y: Math.round(y), v: Math.floor(this.rand() * 1000), ...extra };
    this.objects.push(o);
    return o;
  }
  // Píer reto: começa no tile de terra (tx,ty) e avança 'len' tiles na direção dada
  pier(tx, ty, dir, len, width = 2, kind = 'pier') {
    const [dx, dy] = dir;
    let x0, y0, w, h;
    if (dx !== 0) {
      w = len * TILE; h = width * TILE;
      x0 = dx > 0 ? (tx + 0.5) * TILE : (tx + 0.5) * TILE - w;
      y0 = (ty + 0.5) * TILE - h / 2;
    } else {
      w = width * TILE; h = len * TILE;
      x0 = (tx + 0.5) * TILE - w / 2;
      y0 = dy > 0 ? (ty + 0.5) * TILE : (ty + 0.5) * TILE - h;
    }
    const d = { x: Math.round(x0), y: Math.round(y0), w: Math.round(w), h: Math.round(h), kind, dir };
    this.docks.push(d);
    return d;
  }
  // Ponto de embarque na ponta de um píer
  mooring(dock) {
    const [dx, dy] = dock.dir;
    let bx, by, sx, sy, ang;
    if (dx !== 0) {
      bx = dx > 0 ? dock.x + dock.w - 20 : dock.x + 20; by = dock.y + dock.h / 2;
      sx = dx > 0 ? dock.x + dock.w + 46 : dock.x - 46; sy = by; ang = dx > 0 ? 0 : Math.PI;
    } else {
      bx = dock.x + dock.w / 2; by = dy > 0 ? dock.y + dock.h - 20 : dock.y + 20;
      sx = bx; sy = dy > 0 ? dock.y + dock.h + 46 : dock.y - 46; ang = dy > 0 ? Math.PI / 2 : -Math.PI / 2;
    }
    const m = { board: { x: Math.round(bx), y: Math.round(by) }, boat: { x: Math.round(sx), y: Math.round(sy), a: ang }, dock };
    this.moorings.push(m);
    return m;
  }
  hot(tx, ty, r = 2.2) { this.hotspots.push({ x: Math.round(tx * TILE), y: Math.round(ty * TILE), r: Math.round(r * TILE) }); }
  // Espalha objetos em tiles que satisfazem o predicado, com distância mínima
  scatter(type, count, pred, minDist = 2, opts = {}) {
    const placed = [];
    let tries = 0;
    while (placed.length < count && tries < count * 60) {
      tries++;
      const tx = this.rand() * MAP_W, ty = this.rand() * MAP_H;
      const ix = Math.floor(tx), iy = Math.floor(ty);
      if (!pred(this.get(ix, iy), ix, iy, tx, ty)) continue;
      if (this._near(tx * TILE, ty * TILE, minDist * TILE, opts.avoidAll !== false ? null : type)) continue;
      if (this._inDockTiles(tx * TILE, ty * TILE, 40)) continue;
      placed.push(this.obj(type, tx, ty, opts.extra ? opts.extra(this.rand) : {}));
    }
    return placed;
  }
  _near(x, y, d, onlyType) {
    for (const o of this.objects) {
      if (onlyType && o.type !== onlyType) continue;
      const def = OBJ[o.type];
      const rr = def?.c?.r ?? (def?.c?.w ? Math.max(def.c.w, def.c.d) / 2 : 6);
      if (Math.hypot(o.x - x, o.y - y) < d + rr * 0.6) return true;
    }
    return false;
  }
  _inDockTiles(x, y, m) {
    return this.docks.some((d) => x > d.x - m && x < d.x + d.w + m && y > d.y - m && y < d.y + d.h + m);
  }
  clearAround(x, y, r) { // remove objetos sem colisão importante perto de um ponto (px)
    this.objects = this.objects.filter((o) => o.keep || Math.hypot(o.x - x, o.y - y) > r);
  }
}

// ───────────── As cinco ilhas ─────────────
const near = (b, d, tx, ty) => d[ty * MAP_W + tx];

function buildTropical() {
  const b = new Builder('tropical');
  // Ilha principal em forma de feijão + ilhota a nordeste + enseada ao norte
  b.blob(44, 36, 27, 19, T.GRASS, 0.22, 0.12);
  b.blob(64, 30, 12, 11, T.GRASS, 0.2, 0.15);
  b.blob(80, 17, 6, 5, T.SAND, 0.25, 0.3);
  b.blob(50, 17, 6, 5, T.WATER, 0.2, 0.3); // enseada
  b.blob(22, 44, 5, 4, T.WATER, 0.25, 0.3); // lagoa interna (conectada pelo oeste)
  b.stroke([[22, 44], [14, 47]], 3, T.WATER);
  const dw = b.distToWater();
  for (let y = 0; y < MAP_H; y++) for (let x = 0; x < MAP_W; x++) {
    const t = b.get(x, y);
    if (t === T.GRASS) {
      const dd = near(b, dw, x, y);
      if (dd <= 2 + (valueNoise(x * 0.3, y * 0.3, 7) > 0.55 ? 1 : 0)) b.set(x, y, T.SAND);
      else if (dd >= 7 && fbm(x * 0.12, y * 0.12, 31) > 0.55) b.set(x, y, T.JUNGLE);
    }
  }
  // Recifes em faixas de água rasa (leste, sul-oeste e ao redor da ilhota)
  const dl = landDistance(b);
  for (let y = 0; y < MAP_H; y++) for (let x = 0; x < MAP_W; x++) {
    if (b.get(x, y) !== T.WATER) continue;
    const dd = dl[y * MAP_W + x];
    const n = fbm(x * 0.25, y * 0.25, 77);
    if (dd >= 3 && dd <= 5 && n > 0.58 && !(x > 40 && x < 54 && y > 50)) b.set(x, y, T.REEF);
  }
  // Píer principal ao sul
  const [px, py] = b.coast(46, 40, 0, 1);
  const pier = b.pier(px, py, [0, 1], 11, 2);
  b.mooring(pier);
  // Pequeno píer de pesca no oeste
  const [wx, wy] = b.coast(30, 30, -1, 0);
  b.pier(wx, wy, [-1, 0], 6, 2, 'pier');
  // Caminhos de areia batida
  const village = [44, 33];
  b.stroke([[px, py], [46, 46], [45, 40], village], 2.2, T.PATH, (t) => !isWaterT(t));
  b.stroke([village, [36, 30], [wx + 1, wy]], 1.8, T.PATH, (t) => !isWaterT(t));
  b.stroke([village, [56, 30], [64, 28], [70, 26]], 1.8, T.PATH, (t) => !isWaterT(t));
  b.stroke([[46, 46], [55, 47]], 2, T.PATH, (t) => !isWaterT(t));
  b.stroke([village, [42, 24], [40, 20]], 1.6, T.PATH, (t) => !isWaterT(t));
  // Construções
  b.obj('shop_tropical', 56, 46.2, { keep: true, shop: true });
  b.obj('house_wood', 36, 28.5, { keep: true });
  b.obj('house_wood', 51, 28, { keep: true });
  b.obj('house_wood', 62, 34, { keep: true });
  b.obj('house_wood', 30, 37, { keep: true });
  b.obj('lookout', 40, 19.5, { keep: true });
  b.obj('net_rack', 42, 47, { keep: true });
  b.obj('hammock', 66, 24, { keep: true });
  b.obj('signpost', 48.5, 47.6, { keep: true, text: 'Píer' });
  b.obj('signpost', 46.5, 34.5, { keep: true, text: 'Vila' });
  for (const [x, y] of [[44, 45.5], [48.5, 45.5], [44, 50.3], [49, 50.3]]) b.obj('torch', x, y, { keep: true });
  for (const [x, y] of [[59, 44], [36, 45], [70, 37]]) b.obj('umbrella', x, y, { keep: true });
  b.obj('crate', 53.4, 48.8, { keep: true }); b.obj('barrel', 52.6, 49.6, { keep: true });
  b.obj('barrel', 37.6, 31, { keep: true });
  // Vegetação
  b.scatter('palm', 70, (t) => t === T.SAND, 2.2);
  b.scatter('palm', 26, (t) => t === T.GRASS || t === T.JUNGLE, 3);
  b.scatter('bush_tropical', 60, (t) => t === T.GRASS || t === T.JUNGLE, 1.6);
  b.scatter('flowers', 90, (t) => t === T.GRASS, 1.1);
  b.scatter('rock_small', 20, (t) => t === T.SAND, 3);
  // Pontos de pesca (hotspots)
  b.hot(px + 3, py + 8); b.hot(wx - 7, wy + 1.5); b.hot(50, 16.5, 2); b.hot(74, 44, 2.4); b.hot(18, 47, 1.8); b.hot(80, 24.5, 2);
  b.spawn = { x: (px + 0.5) * TILE, y: (py - 1) * TILE };
  return b;
}

function buildMangue() {
  const b = new Builder('mangue');
  // Ilha larga e baixa, recortada por canais sinuosos
  b.blob(47, 36, 33, 23, T.DIRT, 0.3, 0.1);
  b.blob(75, 20, 9, 8, T.DIRT, 0.3, 0.15);
  const canal = (pts, w) => b.stroke(pts, w, T.WATER, null, 1.0);
  canal([[10, 30], [20, 31], [28, 36], [38, 35], [47, 38], [56, 36], [66, 39], [76, 37], [88, 40]], 3);
  canal([[44, 10], [45, 18], [41, 26], [47, 38]], 2.6);
  canal([[47, 38], [52, 46], [49, 54], [53, 63]], 2.6);
  canal([[28, 36], [26, 46], [30, 55]], 2.2);
  canal([[66, 39], [68, 28], [75, 22]], 2.2);
  b.blob(60, 50, 5, 3.5, T.WATER, 0.3, 0.3); // lagoa
  const dw = b.distToWater();
  for (let y = 0; y < MAP_H; y++) for (let x = 0; x < MAP_W; x++) {
    if (b.get(x, y) !== T.DIRT) continue;
    const dd = near(b, dw, x, y);
    const n = fbm(x * 0.2, y * 0.2, 41);
    if (dd <= 2) b.set(x, y, T.MUD);
    else if (n > 0.52) b.set(x, y, T.MOSS);
    else if (n > 0.42) b.set(x, y, T.JUNGLE);
  }
  // Passarelas sobre os canais (rede de tábuas)
  const walk = (x0, y0, x1, y1) => {
    if (y0 === y1) b.docks.push({ x: x0 * TILE, y: y0 * TILE, w: (x1 - x0) * TILE, h: 2 * TILE, kind: 'boardwalk', dir: [1, 0] });
    else b.docks.push({ x: x0 * TILE, y: y0 * TILE, w: 2 * TILE, h: (y1 - y0) * TILE, kind: 'boardwalk', dir: [0, 1] });
  };
  walk(35, 29, 35, 41); // atravessa o canal principal (oeste)
  walk(54, 31, 54, 43); // atravessa o canal principal (centro)
  walk(39, 23, 49, 23); // canal norte
  walk(44, 44, 56, 44); // canal sul
  walk(22, 44, 32, 44); // canal oeste
  walk(62, 30, 73, 30); // canal nordeste
  walk(71, 36, 71, 44); // canal leste
  // Píer de embarque a oeste
  const [px, py] = b.coast(19, 40, -1, 0);
  const pier = b.pier(px, py, [-1, 0], 8, 2);
  b.mooring(pier);
  // Caminhos de terra batida
  const onLand = (t) => !isWaterT(t);
  b.stroke([[px, py], [20, 40], [22, 43]], 1.8, T.PATH, onLand);
  b.stroke([[32, 43], [34, 41]], 1.6, T.PATH, onLand);
  b.stroke([[36, 29], [40, 25]], 1.6, T.PATH, onLand);
  b.stroke([[36, 42], [40, 45], [44, 45]], 1.6, T.PATH, onLand);
  b.stroke([[57, 45], [62, 46], [66, 48]], 1.6, T.PATH, onLand);
  b.stroke([[55, 30], [60, 31]], 1.6, T.PATH, onLand);
  // Construções
  b.obj('shop_mangue', 66.5, 46.8, { keep: true, shop: true });
  b.obj('stilt_hut', 31, 26.5, { keep: true });
  b.obj('stilt_hut', 46, 30, { keep: true });
  b.obj('stilt_hut', 64, 27, { keep: true });
  b.obj('stilt_hut', 39, 51, { keep: true });
  b.obj('log', 33, 47, { keep: true }); b.obj('log', 58, 33.5, { keep: true });
  for (const [x, y] of [[33.8, 39], [53.8, 33], [53.8, 41], [45, 43.7], [62.5, 29.6], [20.5, 38.6]]) b.obj('lantern_post', x, y, { keep: true });
  b.obj('signpost', 21.5, 42, { keep: true, text: 'Cais' });
  b.obj('crate', 63.6, 48.6, { keep: true });
  // Mangue fechado: árvores com raízes nas margens, samambaias no interior
  b.scatter('mangrove', 75, (t, x, y) => t === T.MUD, 2.4);
  b.scatter('mangrove_small', 70, (t) => t === T.MUD || t === T.JUNGLE, 1.8);
  b.scatter('mangrove', 30, (t) => t === T.JUNGLE || t === T.MOSS, 3);
  b.scatter('fern', 110, (t) => t === T.MOSS || t === T.JUNGLE || t === T.DIRT, 1.1);
  b.scatter('reeds', 70, (t, x, y) => t === T.MUD, 1.2);
  b.scatter('lilypad', 70, (t, x, y) => t === T.WATER && landDistAt(b, x, y) <= 2, 1.4);
  // Pontos de pesca nos canais e na lagoa
  b.hot(36, 37, 1.6); b.hot(55, 36.8, 1.6); b.hot(44.5, 22, 1.4); b.hot(60, 50, 2); b.hot(px - 7, py + 2.5, 2); b.hot(72, 38.5, 1.5);
  b.spawn = { x: (px - 2) * TILE, y: (py + 0.5) * TILE };
  return b;
}

function buildCongelada() {
  const b = new Builder('congelada');
  // Massa recortada com fiordes
  b.blob(48, 32, 29, 20, T.SNOW, 0.36, 0.11);
  b.blob(24, 22, 9, 8, T.SNOW, 0.3, 0.2);
  b.stroke([[45, 6], [46, 14], [43, 21], [45, 25]], 4, T.WATER, null, 1.4); // fiorde norte
  b.stroke([[92, 30], [80, 31], [72, 28], [67, 30]], 3.6, T.WATER, null, 1.4); // fiorde leste
  b.blob(37, 30, 3.5, 2.6, T.WATER, 0.2, 0.4); // lago congelado (furos)
  // Campo de gelo ao sul com buracos de pesca
  b.blob(52, 58, 20, 8, T.ICE, 0.3, 0.18);
  b.blob(30, 54, 7, 5, T.ICE, 0.3, 0.25);
  b.stroke([[48, 50], [50, 56]], 5, T.ICE);
  const holes = [[42, 58], [50, 61], [58, 57], [64, 60], [55, 63], [31, 55], [45, 63]];
  for (const [x, y] of holes) b.blob(x, y, 1.9, 1.5, T.WATER, 0.12, 0.6);
  b.blob(37, 30, 2, 1.4, T.ICE, 0.1, 0.5); // ilhota de gelo no meio do lago
  const dw = b.distToWater();
  for (let y = 0; y < MAP_H; y++) for (let x = 0; x < MAP_W; x++) {
    if (b.get(x, y) !== T.SNOW) continue;
    const dd = near(b, dw, x, y);
    if (dd <= 1 && fbm(x * 0.3, y * 0.3, 11) > 0.45) b.set(x, y, T.ICE);
    else if (fbm(x * 0.14, y * 0.14, 23) > 0.62) b.set(x, y, T.DIRT); // pedra exposta
  }
  // Píer a oeste
  const [px, py] = b.coast(30, 36, -1, 0);
  const pier = b.pier(px, py, [-1, 0], 9, 2);
  b.mooring(pier);
  const onLand = (t) => !isWaterT(t) && t !== T.ICE;
  b.stroke([[px, py], [36, 37], [44, 37], [50, 40], [50, 48]], 2, T.PATH, onLand);
  b.stroke([[44, 37], [48, 32], [56, 30]], 1.8, T.PATH, onLand);
  b.stroke([[50, 40], [60, 40], [66, 36]], 1.8, T.PATH, onLand);
  b.stroke([[38, 36], [30, 26], [24, 22]], 1.6, T.PATH, onLand);
  // Construções
  b.obj('shop_congelada', 44.5, 42, { keep: true, shop: true });
  b.obj('cabin', 55.5, 28.5, { keep: true });
  b.obj('cabin', 62, 44, { keep: true });
  b.obj('cabin', 26, 20.5, { keep: true });
  b.obj('campfire', 52, 36, { keep: true });
  b.obj('sled', 48.5, 35.5, { keep: true });
  b.obj('fish_rack', 39.5, 40.5, { keep: true });
  b.obj('fish_rack', 59, 47.6, { keep: true });
  b.obj('snowman', 58, 36, { keep: true }); b.obj('snowman', 33, 41, { keep: true });
  b.obj('signpost', 49, 49.5, { keep: true, text: 'Gelo' });
  b.obj('signpost', 34.8, 38.7, { keep: true, text: 'Cais' });
  b.scatter('pine', 85, (t) => t === T.SNOW, 2.3);
  b.scatter('pine_small', 50, (t) => t === T.SNOW || t === T.DIRT, 1.8);
  b.scatter('ice_rock', 22, (t) => t === T.SNOW || t === T.ICE || t === T.DIRT, 3);
  b.scatter('ice_spike', 12, (t, x, y) => t === T.ICE && landDistAt(b, x, y) === 0, 3);
  // Pontos de pesca: buracos no gelo, fiordes e píer
  for (const [x, y] of holes.slice(0, 5)) b.hot(x + 0.5, y + 0.5, 1.2);
  b.hot(45.5, 18, 1.8); b.hot(78, 31, 1.8); b.hot(px - 6, py - 2, 2);
  b.spawn = { x: (px - 1) * TILE, y: (py + 0.5) * TILE };
  return b;
}

function buildVulcanica() {
  const b = new Builder('vulcanica');
  b.blob(48, 34, 30, 23, T.BASALT, 0.24, 0.12);
  b.blob(22, 48, 8, 6, T.BLACKSAND, 0.3, 0.2);
  const dw = b.distToWater();
  for (let y = 0; y < MAP_H; y++) for (let x = 0; x < MAP_W; x++) {
    if (b.get(x, y) !== T.BASALT) continue;
    const dd = near(b, dw, x, y);
    const n = fbm(x * 0.16, y * 0.16, 61);
    if (dd <= 3) b.set(x, y, T.BLACKSAND);
    else if (n > 0.58) b.set(x, y, T.ASH);
    else if (n < 0.36) b.set(x, y, T.DIRT);
  }
  // Rio de lava descendo o flanco leste até o mar
  b.stroke([[55, 22], [60, 27], [66, 30], [70, 36], [77, 40], [84, 41]], 2.4, T.LAVA, (t) => !isWaterT(t), 0.9);
  // Fontes termais
  b.blob(29, 37, 3.4, 2.6, T.SPRING, 0.15, 0.4);
  b.blob(36, 45, 2.6, 2.1, T.SPRING, 0.15, 0.4);
  b.blob(62, 47, 3, 2.2, T.SPRING, 0.15, 0.4);
  // Vulcão ao fundo (norte)
  b.obj('volcano', 47, 19.5, { keep: true });
  // Píer ao sul
  const [px, py] = b.coast(48, 44, 0, 1);
  const pier = b.pier(px, py, [0, 1], 10, 2);
  b.mooring(pier);
  const onLand = (t) => !isWaterT(t) && t !== T.LAVA;
  b.stroke([[px, py], [48, 48], [44, 42], [38, 38], [31, 35]], 2, T.PATH, onLand);
  b.stroke([[48, 48], [56, 46], [61, 44]], 1.8, T.PATH, onLand);
  b.stroke([[44, 42], [50, 34], [56, 33]], 1.6, T.PATH, onLand);
  b.stroke([[38, 38], [30, 44], [24, 48]], 1.6, T.PATH, onLand);
  // Ponte de pedra sobre o rio de lava (passarela de basalto)
  b.docks.push({ x: 65 * TILE, y: 33 * TILE, w: 7 * TILE, h: 2 * TILE, kind: 'bridge', dir: [1, 0] });
  b.stroke([[61, 44], [64, 38], [65.5, 34]], 1.4, T.PATH, onLand);
  b.stroke([[71.5, 34], [72, 29], [73, 26.5]], 1.4, T.PATH, onLand);
  // Construções
  b.obj('shop_vulcanica', 54.5, 51.5, { keep: true, shop: true });
  b.obj('hut_stone', 40, 49.5, { keep: true });
  b.obj('hut_stone', 57, 37, { keep: true });
  b.obj('hut_stone', 73, 25, { keep: true });
  for (const [x, y] of [[29, 36.5], [36, 45], [62, 47], [58, 31], [42, 30], [70, 32]]) b.obj('steam_vent', x, y, { keep: true });
  b.obj('signpost', 49.4, 50.6, { keep: true, text: 'Fontes' });
  b.obj('barrel', 51.5, 52.8, { keep: true }); b.obj('crate', 57.5, 52.6, { keep: true });
  b.scatter('basalt', 26, (t) => t === T.BASALT || t === T.ASH, 3.4);
  b.scatter('lava_rock', 26, (t) => t === T.BASALT || t === T.BLACKSAND, 2.5);
  b.scatter('obsidian', 12, (t) => t === T.ASH || t === T.BASALT, 4);
  b.scatter('agave', 40, (t) => t === T.DIRT || t === T.BLACKSAND, 2);
  b.scatter('shrub_dry', 70, (t) => t === T.DIRT || t === T.ASH, 1.4);
  b.scatter('dead_tree', 18, (t) => t === T.DIRT || t === T.ASH, 4);
  b.hot(29, 37, 1.6); b.hot(36, 45, 1.2); b.hot(62, 47, 1.3); b.hot(px + 3, py + 7, 2); b.hot(16, 52, 2);
  { const [ex, ey] = b.coast(64, 44, 1, 0.35); b.hot(ex + 3, ey + 1, 1.8); }
  b.spawn = { x: (px + 0.5) * TILE, y: (py - 1) * TILE };
  return b;
}

function buildCristais() {
  const b = new Builder('cristais');
  // Arquipélago: ilha do templo no centro e quatro ilhotas ligadas por pontes antigas
  b.blob(48, 34, 15, 11, T.CRYSTAL, 0.18, 0.15);
  const isles = [[24, 22, 9, 7], [73, 21, 9, 7], [23, 50, 8, 6.5], [72, 51, 9, 7], [48, 57, 7, 5]];
  for (const [x, y, rx, ry] of isles) b.blob(x, y, rx, ry, T.CRYSTAL, 0.24, 0.2);
  const dw = b.distToWater();
  for (let y = 0; y < MAP_H; y++) for (let x = 0; x < MAP_W; x++) {
    if (b.get(x, y) !== T.CRYSTAL) continue;
    if (near(b, dw, x, y) <= 1 && fbm(x * 0.3, y * 0.3, 5) > 0.42) b.set(x, y, T.SAND);
  }
  // Praça de ruínas no centro
  b.blob(48, 33, 7, 5, T.RUIN, 0.12, 0.3, (t) => !isWaterT(t));
  const onLand = (t) => !isWaterT(t);
  // Pontes (passarelas de pedra sobre a água)
  const bridge = (x0, y0, x1, y1) => {
    if (y0 === y1) b.docks.push({ x: x0 * TILE, y: y0 * TILE, w: (x1 - x0) * TILE, h: 2 * TILE, kind: 'bridge', dir: [1, 0] });
    else b.docks.push({ x: x0 * TILE, y: y0 * TILE, w: 2 * TILE, h: (y1 - y0) * TILE, kind: 'bridge', dir: [0, 1] });
  };
  const bridgeBetween = (ax, ay, bx, by, horiz) => {
    if (horiz) {
      const y = Math.round(ay);
      const [sx] = b.coast(ax, y, Math.sign(bx - ax), 0);
      const [ex] = b.coast(bx, y, Math.sign(ax - bx), 0);
      const x0 = Math.min(sx, ex), x1 = Math.max(sx, ex);
      bridge(x0, y - 1, x1 + 1, y - 1);
      b.stroke([[ax, y], [sx, y]], 1.6, T.RUIN, onLand); b.stroke([[bx, y], [ex, y]], 1.6, T.RUIN, onLand);
    } else {
      const x = Math.round(ax);
      const [, sy] = b.coast(x, ay, 0, Math.sign(by - ay));
      const [, ey] = b.coast(x, by, 0, Math.sign(ay - by));
      const y0 = Math.min(sy, ey), y1 = Math.max(sy, ey);
      bridge(x - 1, y0, x - 1, y1 + 1);
      b.stroke([[x, ay], [x, sy]], 1.6, T.RUIN, onLand); b.stroke([[x, by], [x, ey]], 1.6, T.RUIN, onLand);
    }
  };
  bridgeBetween(42, 28, 26, 28, true);   // centro → noroeste (horizontal a y=28)
  bridgeBetween(55, 27, 72, 27, true);   // centro → nordeste
  bridgeBetween(40, 41, 25, 41, true);   // centro → sudoeste
  bridgeBetween(56, 42, 70, 42, true);   // centro → sudeste
  bridgeBetween(48, 40, 48, 56, false);  // centro → sul
  // Corrige ilhotas para alcançarem as pontes (pequenas cabeceiras de terra)
  for (const [x, y] of [[26, 28], [72, 27], [25, 41], [70, 42]]) b.blob(x, y, 2.2, 2, T.CRYSTAL, 0.1, 0.4, (t) => true);
  // Píer de embarque na ilhota sul
  const [px, py] = b.coast(48, 58, 0, 1);
  const pier = b.pier(px, py, [0, 1], 7, 2);
  b.mooring(pier);
  // Templo, loja e ruínas
  b.obj('temple', 48, 30.6, { keep: true });
  b.obj('shop_cristais', 52.5, 57.6, { keep: true, shop: true });
  for (const [x, y] of [[43, 35.5], [53, 35.5], [43, 38.5], [53, 38.5]]) b.obj('column', x, y, { keep: true });
  b.obj('arch', 48, 39.6, { keep: true });
  b.obj('statue', 23, 19.5, { keep: true }); b.obj('statue', 74, 18.5, { keep: true });
  for (const [x, y] of [[20, 50], [76, 53], [28, 18], [70, 24]]) b.obj('column_broken', x, y, { keep: true });
  for (const [x, y] of [[46, 41.2], [50.6, 41.2], [46, 55], [50.6, 55], [44.6, 60.3]]) b.obj('crystal_lamp', x, y, { keep: true });
  b.obj('signpost', 49.6, 59.5, { keep: true, text: 'Cais' });
  b.scatter('crystal_big', 34, (t) => t === T.CRYSTAL, 3);
  b.scatter('crystal_small', 50, (t) => t === T.CRYSTAL || t === T.SAND, 1.8);
  b.scatter('glow_mushroom', 70, (t) => t === T.CRYSTAL, 1.2);
  b.scatter('glow_plant', 70, (t) => t === T.CRYSTAL, 1.3);
  b.hot(36, 22, 2); b.hot(62, 21, 2); b.hot(36, 46, 2); b.hot(62, 47, 2); b.hot(px - 4, py + 4, 2);
  { const [wx, wy] = b.coast(22, 50, -1, 0); b.hot(wx - 3.5, wy, 2); }
  b.spawn = { x: (px + 0.5) * TILE, y: (py - 1.5) * TILE };
  return b;
}

function landDistance(b) {
  const d = new Int16Array(MAP_W * MAP_H).fill(999);
  const q = [];
  for (let y = 0; y < MAP_H; y++) for (let x = 0; x < MAP_W; x++)
    if (b.isLand(x, y)) { d[y * MAP_W + x] = 0; q.push(x, y); }
  for (let i = 0; i < q.length; i += 2) {
    const x = q[i], y = q[i + 1], v = d[y * MAP_W + x];
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx, ny = y + dy;
      if (b.inb(nx, ny) && d[ny * MAP_W + nx] > v + 1) { d[ny * MAP_W + nx] = v + 1; q.push(nx, ny); }
    }
  }
  return d;
}
function landDistAt(b, x, y) {
  if (!b._ld) b._ld = landDistance(b);
  return b._ld[y * MAP_W + x];
}

const BUILDERS = { tropical: buildTropical, mangue: buildMangue, congelada: buildCongelada, vulcanica: buildVulcanica, cristais: buildCristais };

// ───────────── Região pronta para consulta ─────────────
export class Region {
  constructor(id) {
    const b = BUILDERS[id]();
    this.id = id;
    this.meta = ISLANDS[id];
    this.seed = b.seed;
    this.tiles = b.tiles;
    this.docks = b.docks;
    this.moorings = b.moorings;
    this.hotspots = b.hotspots;
    // remove objetos que caíram na água ou sobre passarelas/caminhos de spawn
    this.objects = b.objects.filter((o) => {
      const def = OBJ[o.type];
      if (def.water) return true;
      if (o.keep) return true;
      const t = this.tileAt(o.x, o.y);
      return !isWaterT(t) && t !== T.LAVA && t !== T.PATH && !this.inDock(o.x, o.y, 24);
    });
    this.objects.sort((a, b2) => a.y - b2.y);
    const shopObj = this.objects.find((o) => o.shop);
    this.shop = { x: shopObj.x, y: shopObj.y + 26, building: shopObj };
    // Afasta objetos do vendedor, do spawn e dos pontos de embarque
    const clear = [[this.shop.x, this.shop.y, 40], [b.spawn.x, b.spawn.y, 50], ...this.moorings.map((m) => [m.board.x, m.board.y, 40])];
    this.objects = this.objects.filter((o) => o.keep || clear.every(([x, y, r]) => Math.hypot(o.x - x, o.y - y) > r));
    this._buildColliders();
    this.spawn = this.findWalkable(b.spawn.x, b.spawn.y);
    // garante que cada ponto de pesca esteja na água
    for (const h of this.hotspots) if (!this.fishable(h.x, h.y)) {
      search: for (let r = 8; r < 160; r += 8) for (let k = 0; k < 16; k++) {
        const x = h.x + Math.cos(k / 16 * Math.PI * 2) * r, y = h.y + Math.sin(k / 16 * Math.PI * 2) * r;
        if (this.fishable(x, y)) { h.x = Math.round(x); h.y = Math.round(y); break search; }
      }
    }
    this.gates = {};
    for (const other of ISLAND_ORDER) if (other !== id) this.gates[other] = this._gateTo(other);
    this._nav = null;
  }

  // ── Consultas de terreno ──
  tile(tx, ty) { return tx < 0 || ty < 0 || tx >= MAP_W || ty >= MAP_H ? T.WATER : this.tiles[ty * MAP_W + tx]; }
  landRaw(tx, ty) { return isWaterT(this.tile(tx, ty)) ? 0 : 1; }
  // Campo suave terra/água em px (organiza a costa de forma orgânica)
  landField(x, y) {
    const gx = x / TILE - 0.5, gy = y / TILE - 0.5;
    const ix = Math.floor(gx), iy = Math.floor(gy);
    const fx = gx - ix, fy = gy - iy;
    const a = this.landRaw(ix, iy), b = this.landRaw(ix + 1, iy), c = this.landRaw(ix, iy + 1), d = this.landRaw(ix + 1, iy + 1);
    const bil = a + (b - a) * fx + (c - a) * fy + (a - b - c + d) * fx * fy;
    const n = (valueNoise(x / 37, y / 37, this.seed) - 0.5) * 0.34 + (valueNoise(x / 11, y / 11, this.seed + 5) - 0.5) * 0.12;
    return bil + n;
  }
  isLand(x, y) { return this.landField(x, y) > 0.5; }
  // Tipo de terreno com bordas deformadas por ruído
  tileAt(x, y) {
    const wx = (valueNoise(x / 23, y / 23, this.seed + 11) - 0.5) * 18;
    const wy = (valueNoise(x / 23, y / 23, this.seed + 12) - 0.5) * 18;
    return this.tile(Math.floor((x + wx) / TILE), Math.floor((y + wy) / TILE));
  }
  terrainAt(x, y) { // terreno coerente com o campo de terra
    const land = this.isLand(x, y);
    let t = this.tileAt(x, y);
    if (land && isWaterT(t)) t = this._nearestLandType(x, y);
    if (!land && !isWaterT(t)) t = this._nearestWaterType(x, y);
    return t;
  }
  _nearestLandType(x, y) {
    const tx = Math.floor(x / TILE), ty = Math.floor(y / TILE);
    for (let r = 0; r <= 2; r++) for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
      const t = this.tile(tx + dx, ty + dy);
      if (!isWaterT(t)) return t;
    }
    return T.SAND;
  }
  _nearestWaterType(x, y) {
    const tx = Math.floor(x / TILE), ty = Math.floor(y / TILE);
    for (let r = 0; r <= 2; r++) for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
      const t = this.tile(tx + dx, ty + dy);
      if (isWaterT(t)) return t;
    }
    return T.WATER;
  }
  inDock(x, y, m = 0) {
    for (const d of this.docks) if (x >= d.x - m && x <= d.x + d.w + m && y >= d.y - m && y <= d.y + d.h + m) return d;
    return null;
  }

  // ── Colisores de objetos (hash espacial de 128px) ──
  _buildColliders() {
    this.colliders = [];
    this.cgrid = new Map();
    for (const o of this.objects) {
      const def = OBJ[o.type];
      if (!def?.c) continue;
      let c;
      if (def.c.r) c = { kind: 'c', x: o.x, y: o.y, r: def.c.r };
      else c = { kind: 'r', x: o.x - def.c.w / 2, y: o.y - def.c.d, w: def.c.w, h: def.c.d };
      if (o.type === 'arch') continue;
      this.colliders.push(c);
      const x0 = Math.floor(((c.kind === 'c' ? c.x - c.r : c.x) - 16) / 128), x1 = Math.floor(((c.kind === 'c' ? c.x + c.r : c.x + c.w) + 16) / 128);
      const y0 = Math.floor(((c.kind === 'c' ? c.y - c.r : c.y) - 16) / 128), y1 = Math.floor(((c.kind === 'c' ? c.y + c.r : c.y + c.h) + 16) / 128);
      for (let gy = y0; gy <= y1; gy++) for (let gx = x0; gx <= x1; gx++) {
        const k = gy * 1000 + gx;
        if (!this.cgrid.has(k)) this.cgrid.set(k, []);
        this.cgrid.get(k).push(c);
      }
    }
    // arcos: dois pilares
    for (const o of this.objects.filter((q) => q.type === 'arch')) {
      for (const dx of [-34, 34]) {
        const c = { kind: 'c', x: o.x + dx, y: o.y, r: 11 };
        this.colliders.push(c);
        const k = Math.floor(c.y / 128) * 1000 + Math.floor(c.x / 128);
        if (!this.cgrid.has(k)) this.cgrid.set(k, []);
        this.cgrid.get(k).push(c);
      }
    }
  }
  hitsObject(x, y, rad = 7) {
    const list = this.cgrid.get(Math.floor(y / 128) * 1000 + Math.floor(x / 128));
    if (!list) return false;
    for (const c of list) {
      if (c.kind === 'c') { if (Math.hypot(x - c.x, y - c.y) < c.r + rad) return true; }
      else if (x > c.x - rad && x < c.x + c.w + rad && y > c.y - rad && y < c.y + c.h + rad) return true;
    }
    return false;
  }

  // ── Regras de movimento e pesca ──
  walkable(x, y) {
    if (x < 8 || y < 8 || x > WORLD_W - 8 || y > WORLD_H - 8) return false;
    if (this.hitsObject(x, y, 7)) return false;
    if (this.inDock(x, y, -3)) return true;
    if (!this.isLand(x, y)) return false;
    return isWalkT(this.terrainAt(x, y));
  }
  fishable(x, y) {
    if (x < 0 || y < 0 || x > WORLD_W || y > WORLD_H) return false;
    if (this.inDock(x, y, 4)) return false;
    if (this.isLand(x, y)) return false;
    return isFishT(this.terrainAt(x, y));
  }
  navigable(x, y) {
    if (x < 24 || y < 24 || x > WORLD_W - 24 || y > WORLD_H - 24) return false;
    if (this.inDock(x, y, 6)) return false;
    if (this.landField(x, y) > 0.42) return false;
    return isNavT(this.terrainAt(x, y));
  }
  boatFits(x, y, a) {
    const c = Math.cos(a), s = Math.sin(a);
    return this.navigable(x, y) && this.navigable(x + c * 22, y + s * 22) && this.navigable(x - c * 20, y - s * 20)
      && this.navigable(x - s * 10, y + c * 10) && this.navigable(x + s * 10, y - c * 10);
  }
  hotspotAt(x, y) { return this.hotspots.find((h) => Math.hypot(h.x - x, h.y - y) <= h.r) || null; }
  findWalkable(x, y) {
    if (this.walkable(x, y)) return { x, y };
    for (let r = 8; r < 400; r += 8)
      for (let a = 0; a < 16; a++) {
        const px = x + Math.cos((a / 16) * Math.PI * 2) * r, py = y + Math.sin((a / 16) * Math.PI * 2) * r;
        if (this.walkable(px, py)) return { x: Math.round(px), y: Math.round(py) };
      }
    return { x, y };
  }
  findNavigable(x, y, a = 0) {
    if (this.boatFits(x, y, a)) return { x, y };
    for (let r = 12; r < 700; r += 12)
      for (let k = 0; k < 24; k++) {
        const px = x + Math.cos((k / 24) * Math.PI * 2) * r, py = y + Math.sin((k / 24) * Math.PI * 2) * r;
        if (this.boatFits(px, py, a)) return { x: Math.round(px), y: Math.round(py) };
      }
    return { x, y };
  }

  // ── Passagens marítimas para as outras ilhas ──
  _gateTo(other) {
    const [ax, ay] = this.meta.world, [bx, by] = ISLANDS[other].world;
    let dx = bx - ax, dy = by - ay;
    const L = Math.hypot(dx, dy); dx /= L; dy /= L;
    const inset = 3 * TILE;
    const cx = WORLD_W / 2, cy = WORLD_H / 2;
    const tx = dx > 0 ? (WORLD_W - inset - cx) / dx : dx < 0 ? (inset - cx) / dx : Infinity;
    const ty = dy > 0 ? (WORLD_H - inset - cy) / dy : dy < 0 ? (inset - cy) / dy : Infinity;
    const t = Math.min(tx, ty);
    const x = clamp(cx + dx * t, inset, WORLD_W - inset), y = clamp(cy + dy * t, inset, WORLD_H - inset);
    return { to: other, x: Math.round(x), y: Math.round(y), r: 110, dir: [dx, dy] };
  }
  // Ponto de chegada ao vir de 'from'
  // Busca em largura pela água conectada à passagem: a chegada nunca cai num lago isolado
  arrivalFrom(from) {
    if (this._arrivals?.[from]) return this._arrivals[from];
    const g = this.gates[from];
    const cx = WORLD_W / 2, cy = WORLD_H / 2;
    const L = Math.hypot(cx - g.x, cy - g.y);
    const ideal = { x: g.x + ((cx - g.x) / L) * 240, y: g.y + ((cy - g.y) / L) * 240 };
    const nav = this.navGrid();
    const st = Math.floor(g.y / TILE) * MAP_W + Math.floor(g.x / TILE);
    const seen = new Uint8Array(MAP_W * MAP_H);
    const q = [st]; seen[st] = 1;
    let best = null, bd = Infinity;
    for (let i = 0; i < q.length; i++) {
      const c = q[i], x = c % MAP_W, y = (c / MAP_W) | 0;
      const px = (x + 0.5) * TILE, py = (y + 0.5) * TILE;
      const dg = Math.hypot(px - g.x, py - g.y);
      if (dg > g.r + 70 && dg < 330) {
        const a = Math.atan2(cy - py, cx - px);
        const d = Math.hypot(px - ideal.x, py - ideal.y);
        if (d < bd && this.boatFits(px, py, a)) { bd = d; best = { x: px, y: py, a }; }
      }
      if (dg > 360) continue;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = x + dx, ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= MAP_W || ny >= MAP_H) continue;
        const n = ny * MAP_W + nx;
        if (seen[n] || !nav[n]) continue;
        seen[n] = 1; q.push(n);
      }
    }
    if (!best) { const a = Math.atan2(cy - g.y, cx - g.x); const p = this.findNavigable(ideal.x, ideal.y, a); best = { x: p.x, y: p.y, a }; }
    (this._arrivals ||= {})[from] = best;
    return best;
  }

  // ── Grade de navegação (rota pontilhada) ──
  navGrid() {
    if (this._nav) return this._nav;
    const g = new Uint8Array(MAP_W * MAP_H);
    for (let ty = 0; ty < MAP_H; ty++) for (let tx = 0; tx < MAP_W; tx++) {
      const x = (tx + 0.5) * TILE, y = (ty + 0.5) * TILE;
      let ok = this.navigable(x, y);
      if (ok) for (const [ox, oy] of [[-26, 0], [26, 0], [0, -26], [0, 26], [-18, -18], [18, 18], [-18, 18], [18, -18]]) if (!this.navigable(x + ox, y + oy)) { ok = false; break; }
      g[ty * MAP_W + tx] = ok ? 1 : 0;
    }
    this._nav = g;
    return g;
  }
  // A* em tiles; devolve pontos em px (suavizados por visibilidade)
  // avoid: círculos {x,y,r} a contornar (ex.: passagens para outras ilhas)
  findRoute(sx, sy, ex, ey, avoid = null) {
    const g = this.navGrid();
    const blocked = (x2, y2) => {
      if (!avoid) return false;
      const px = (x2 + 0.5) * TILE, py = (y2 + 0.5) * TILE;
      for (const c of avoid) if (Math.hypot(px - c.x, py - c.y) < c.r) return true;
      return false;
    };
    const s = [clamp(Math.floor(sx / TILE), 0, MAP_W - 1), clamp(Math.floor(sy / TILE), 0, MAP_H - 1)];
    const e = [clamp(Math.floor(ex / TILE), 0, MAP_W - 1), clamp(Math.floor(ey / TILE), 0, MAP_H - 1)];
    const N = MAP_W * MAP_H;
    const gs = new Float32Array(N).fill(Infinity), came = new Int32Array(N).fill(-1), closed = new Uint8Array(N);
    const si = s[1] * MAP_W + s[0], ei = e[1] * MAP_W + e[0];
    const open = [si]; gs[si] = 0;
    const h = (i) => Math.hypot((i % MAP_W) - e[0], Math.floor(i / MAP_W) - e[1]);
    const f = new Float32Array(N).fill(Infinity); f[si] = h(si);
    const dirs = [[1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1], [1, 1, 1.414], [1, -1, 1.414], [-1, 1, 1.414], [-1, -1, 1.414]];
    let iter = 0;
    while (open.length && iter++ < 20000) {
      let bi = 0;
      for (let i = 1; i < open.length; i++) if (f[open[i]] < f[open[bi]]) bi = i;
      const cur = open[bi]; open[bi] = open[open.length - 1]; open.pop();
      if (cur === ei) break;
      if (closed[cur]) continue;
      closed[cur] = 1;
      const cx = cur % MAP_W, cy = Math.floor(cur / MAP_W);
      for (const [dx, dy, c] of dirs) {
        const nx = cx + dx, ny = cy + dy;
        if (nx < 0 || ny < 0 || nx >= MAP_W || ny >= MAP_H) continue;
        const ni = ny * MAP_W + nx;
        const nearStart = Math.abs(nx - s[0]) <= 3 && Math.abs(ny - s[1]) <= 3;
        const nearEnd = Math.abs(nx - e[0]) <= 2 && Math.abs(ny - e[1]) <= 2;
        const free = (i, x2, y2) => g[i] || ((nearStart || nearEnd) && this.navigable((x2 + 0.5) * TILE, (y2 + 0.5) * TILE));
        if ((!free(ni, nx, ny) || blocked(nx, ny)) && ni !== ei) continue;
        if (dx && dy && (!free(cy * MAP_W + nx, nx, cy) || !free(ny * MAP_W + cx, cx, ny))) continue;
        const ng = gs[cur] + c;
        if (ng < gs[ni]) { gs[ni] = ng; f[ni] = ng + h(ni); came[ni] = cur; open.push(ni); }
      }
    }
    if (came[ei] === -1 && ei !== si) return [{ x: sx, y: sy }, { x: ex, y: ey }];
    const path = [];
    for (let i = ei; i !== -1; i = came[i]) path.push({ x: ((i % MAP_W) + 0.5) * TILE, y: (Math.floor(i / MAP_W) + 0.5) * TILE });
    path.reverse();
    path[0] = { x: sx, y: sy };
    path[path.length - 1] = { x: ex, y: ey };
    // suavização por linha de visada
    const out = [path[0]];
    let k = 0;
    const clear = (a, b) => {
      if (!this._lineNav(a, b)) return false;
      if (!avoid) return true;
      const L = Math.hypot(b.x - a.x, b.y - a.y), n = Math.ceil(L / 24);
      for (let i = 1; i < n; i++) { const x = a.x + ((b.x - a.x) * i) / n, y = a.y + ((b.y - a.y) * i) / n; for (const c of avoid) if (Math.hypot(x - c.x, y - c.y) < c.r) return false; }
      return true;
    };
    while (k < path.length - 1) {
      let j = path.length - 1;
      while (j > k + 1 && !clear(path[k], path[j])) j--;
      out.push(path[j]);
      k = j;
    }
    return out;
  }
  _lineNav(a, b) {
    const L = Math.hypot(b.x - a.x, b.y - a.y), n = Math.ceil(L / 12);
    const g = this.navGrid();
    for (let i = 1; i < n; i++) {
      const x = a.x + ((b.x - a.x) * i) / n, y = a.y + ((b.y - a.y) * i) / n;
      if (!g[Math.floor(y / TILE) * MAP_W + Math.floor(x / TILE)] && !(this.navigable(x, y) && (Math.hypot(x - a.x, y - a.y) < 110 || Math.hypot(x - b.x, y - b.y) < 80))) return false;
    }
    return true;
  }
}

const cache = {};
export function getRegion(id) {
  if (!cache[id]) cache[id] = new Region(id);
  return cache[id];
}
export function releaseRegion(id) { delete cache[id]; }
