// Gera mapas de depuração (colisão, cais, pontos de pesca, passagens) das 5 ilhas.
// Uso: node tests/map-preview.js [pasta]   → PNGs em tests/out/
import { writeFileSync, mkdirSync } from 'node:fs';
import { getRegion, ISLAND_ORDER, T, isWaterT, OBJ } from '../shared/islands.js';
import { WORLD_W, WORLD_H } from '../shared/config.js';
import { encodePNG } from './png.js';

const out = process.argv[2] || new URL('./out/', import.meta.url).pathname;
mkdirSync(out, { recursive: true });
const S = 4; // 1 px = 4 px do mundo
const COL = {
  [T.SAND]: [236, 214, 160], [T.GRASS]: [110, 180, 90], [T.PATH]: [200, 170, 120], [T.MUD]: [110, 95, 70],
  [T.SNOW]: [235, 242, 248], [T.ICE]: [180, 220, 240], [T.BLACKSAND]: [60, 58, 60], [T.BASALT]: [90, 84, 86],
  [T.LAVA]: [255, 100, 20], [T.CRYSTAL]: [150, 120, 200], [T.RUIN]: [170, 165, 185], [T.DIRT]: [130, 110, 80],
  [T.JUNGLE]: [60, 140, 70], [T.ASH]: [120, 115, 115], [T.MOSS]: [80, 120, 60],
};
for (const id of ISLAND_ORDER) {
  const t0 = performance.now();
  const r = getRegion(id);
  const w = WORLD_W / S, h = WORLD_H / S;
  const px = new Uint8ClampedArray(w * h * 4);
  const put = (x, y, c, a = 255) => {
    x = Math.round(x); y = Math.round(y);
    if (x < 0 || y < 0 || x >= w || y >= h) return;
    const i = (y * w + x) * 4; px[i] = c[0]; px[i + 1] = c[1]; px[i + 2] = c[2]; px[i + 3] = a;
  };
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const wx = x * S + 2, wy = y * S + 2;
    let c;
    if (r.inDock(wx, wy)) c = [150, 100, 60];
    else if (r.isLand(wx, wy)) c = COL[r.terrainAt(wx, wy)] || [255, 0, 255];
    else {
      const t = r.terrainAt(wx, wy);
      c = t === T.REEF ? [60, 200, 200] : t === T.SPRING ? [120, 220, 220] : r.navigable(wx, wy) ? [40, 110, 170] : [70, 140, 190];
    }
    if (!r.walkable(wx, wy) && r.isLand(wx, wy) && r.hitsObject(wx, wy, 0)) c = [20, 20, 20];
    put(x, y, c);
  }
  const circle = (cx, cy, rad, c) => { for (let a = 0; a < 64; a++) put((cx + Math.cos(a / 10) * rad) / S, (cy + Math.sin(a / 10) * rad) / S, c); };
  for (const hs of r.hotspots) circle(hs.x, hs.y, hs.r, [255, 255, 0]);
  for (const g of Object.values(r.gates)) circle(g.x, g.y, g.r, [255, 0, 200]);
  for (const m of r.moorings) { circle(m.board.x, m.board.y, 10, [255, 255, 255]); circle(m.boat.x, m.boat.y, 14, [255, 120, 0]); }
  circle(r.spawn.x, r.spawn.y, 12, [255, 0, 0]);
  circle(r.shop.x, r.shop.y, 12, [0, 255, 0]);
  writeFileSync(`${out}/map-${id}.png`, encodePNG(w, h, new Uint8Array(px.buffer)));
  console.log(id, 'objetos:', r.objects.length, 'cais:', r.docks.length, 'hotspots:', r.hotspots.length, `${(performance.now() - t0).toFixed(0)}ms`);
}
