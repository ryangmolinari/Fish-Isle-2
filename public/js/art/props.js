// Objetos do cenário (vegetação, construções, rochas, ruínas…) desenhados proceduralmente.
// Cada objeto é renderizado uma vez por variante em um atlas e reaproveitado.
import { shade, rgba, ellipse, roundRect, rng, TAU, makeCanvas, mix } from './util.js';
import { SHOPS } from '/shared/items.js';

const OL = (c) => shade(c, -0.55);
function fs(ctx, fill, lw = 1.3, outline) { ctx.fillStyle = fill; ctx.fill(); ctx.lineWidth = lw; ctx.strokeStyle = outline || OL(fill); ctx.stroke(); }
function circ(ctx, x, y, r) { ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); }
function poly(ctx, pts) { ctx.beginPath(); pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); ctx.closePath(); }

// Copa fofa feita de vários círculos com luz e sombra
function canopy(ctx, x, y, r, col, R, n = 7, squash = 0.85) {
  const pts = [];
  for (let i = 0; i < n; i++) { const a = (i / n) * TAU + R() * 0.4; pts.push([x + Math.cos(a) * r * 0.55, y + Math.sin(a) * r * 0.55 * squash, r * (0.5 + R() * 0.18)]); }
  ctx.save();
  // contorno
  for (const [px, py, pr] of pts) { circ(ctx, px, py, pr + 1.3); ctx.fillStyle = OL(col); ctx.fill(); }
  circ(ctx, x, y, r * 0.7 + 1.3); ctx.fill();
  for (const [px, py, pr] of pts) { circ(ctx, px, py, pr); ctx.fillStyle = col; ctx.fill(); }
  circ(ctx, x, y, r * 0.7); ctx.fill();
  // sombra inferior e brilho superior
  for (const [px, py, pr] of pts) if (py > y) { circ(ctx, px, py + pr * 0.25, pr * 0.75); ctx.fillStyle = rgba(shade(col, -0.35), 0.45); ctx.fill(); }
  for (const [px, py, pr] of pts) if (py < y) { circ(ctx, px - pr * 0.2, py - pr * 0.25, pr * 0.45); ctx.fillStyle = rgba(shade(col, 0.3), 0.6); ctx.fill(); }
  ctx.restore();
}

// Telhado em perspectiva (vista de cima com fachada)
function house(ctx, w, wallH, roofH, wall, roof, opt = {}) {
  const hw = w / 2;
  // parede frontal
  roundRect(ctx, -hw, -wallH, w, wallH, 3); fs(ctx, wall);
  // tábuas
  if (opt.planks) { ctx.strokeStyle = rgba(OL(wall), 0.35); ctx.lineWidth = 1; for (let y = -wallH + 7; y < -2; y += 7) { ctx.beginPath(); ctx.moveTo(-hw + 2, y); ctx.lineTo(hw - 2, y); ctx.stroke(); } }
  if (opt.logs) { for (let y = -wallH + 4; y < 0; y += 8) { roundRect(ctx, -hw - 2, y - 3, w + 4, 7, 3.5); fs(ctx, shade(wall, (y / wallH) * 0.15), 1); } }
  if (opt.stones) { ctx.fillStyle = rgba(OL(wall), 0.25); const R = rng(9); for (let i = 0; i < 18; i++) { ellipse(ctx, -hw + 4 + R() * (w - 8), -wallH + 4 + R() * (wallH - 8), 4 + R() * 3, 2.6 + R() * 2); ctx.fill(); } }
  // porta e janelas
  roundRect(ctx, -6, -18, 12, 18, 3); fs(ctx, opt.door || '#8a5a33');
  circ(ctx, 3, -9, 1); ctx.fillStyle = '#ffd36a'; ctx.fill();
  for (const sx of [-1, 1]) {
    roundRect(ctx, sx * (hw * 0.55) - 6, -wallH + 8, 12, 10, 2); fs(ctx, opt.window || '#bfe8ff');
    ctx.beginPath(); ctx.moveTo(sx * (hw * 0.55), -wallH + 8); ctx.lineTo(sx * (hw * 0.55), -wallH + 18); ctx.strokeStyle = OL(wall); ctx.lineWidth = 1; ctx.stroke();
    if (opt.flowerbox) { roundRect(ctx, sx * (hw * 0.55) - 7, -wallH + 18, 14, 4, 1); fs(ctx, '#8a5a33', 1); for (let k = 0; k < 3; k++) { circ(ctx, sx * (hw * 0.55) - 4 + k * 4, -wallH + 18, 1.8); ctx.fillStyle = ['#ff6f91', '#ffd23f', '#ffffff'][k]; ctx.fill(); } }
  }
  // telhado (visto de cima, com beiral)
  const ry = -wallH - roofH;
  poly(ctx, [[-hw - 6, -wallH + 2], [hw + 6, -wallH + 2], [hw + 2, ry], [-hw - 2, ry]]);
  fs(ctx, roof);
  ctx.save(); ctx.clip();
  ctx.strokeStyle = rgba(OL(roof), 0.35); ctx.lineWidth = 1.2;
  if (opt.thatch) { const R = rng(4); for (let i = 0; i < 40; i++) { const x = -hw - 6 + R() * (w + 12), y = ry + R() * roofH; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + 1, y + 6); ctx.stroke(); } }
  else for (let y = ry + 6; y < -wallH; y += 6) { ctx.beginPath(); ctx.moveTo(-hw - 8, y); ctx.lineTo(hw + 8, y); ctx.stroke(); }
  ctx.fillStyle = rgba('#ffffff', 0.18); ctx.fillRect(-hw - 6, ry, w + 12, roofH * 0.35);
  if (opt.snow) { ctx.fillStyle = '#f6fbff'; ctx.beginPath(); ctx.moveTo(-hw - 6, ry + roofH * 0.55); for (let x = -hw - 6; x <= hw + 6; x += 6) ctx.lineTo(x, ry + roofH * 0.55 + (x % 12 === 0 ? 4 : 1)); ctx.lineTo(hw + 6, ry); ctx.lineTo(-hw - 6, ry); ctx.closePath(); ctx.fill(); }
  ctx.restore();
  poly(ctx, [[-hw - 6, -wallH + 2], [hw + 6, -wallH + 2], [hw + 2, ry], [-hw - 2, ry]]); ctx.lineWidth = 1.4; ctx.strokeStyle = OL(roof); ctx.stroke();
  // cumeeira
  ctx.beginPath(); ctx.moveTo(-hw - 2, ry); ctx.lineTo(hw + 2, ry); ctx.lineWidth = 3; ctx.strokeStyle = shade(roof, -0.25); ctx.stroke();
}

function shopSign(ctx, y, isl) {
  const th = SHOPS[isl].theme;
  roundRect(ctx, -24, y - 11, 48, 16, 5); fs(ctx, th.banner);
  // peixinho + moeda
  ctx.save(); ctx.translate(-12, y - 3);
  ellipse(ctx, 0, 0, 6, 3.6); fs(ctx, '#ffffff', 1, OL(th.banner));
  poly(ctx, [[-5, 0], [-10, -4], [-10, 4]]); fs(ctx, '#ffffff', 1, OL(th.banner));
  ctx.restore();
  circ(ctx, 10, y - 3, 5); fs(ctx, '#ffd23f', 1.1, '#a8740a');
  ctx.fillStyle = '#a8740a'; ctx.font = 'bold 7px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('$', 10, y - 2.6);
}

function awning(ctx, w, y, c1, c2) {
  const n = 8, sw = w / n;
  for (let i = 0; i < n; i++) {
    poly(ctx, [[-w / 2 + i * sw, y], [-w / 2 + (i + 1) * sw, y], [-w / 2 + (i + 1) * sw, y + 10], [-w / 2 + (i + 0.5) * sw, y + 13], [-w / 2 + i * sw, y + 10]]);
    fs(ctx, i % 2 ? c1 : c2, 1);
  }
}

function crystal(ctx, x, y, w, h, col, lean = 0) {
  poly(ctx, [[x - w / 2, y], [x - w / 2 + lean * 0.3, y - h * 0.75], [x + lean, y - h], [x + w / 2 + lean * 0.3, y - h * 0.75], [x + w / 2, y]]);
  const g = ctx.createLinearGradient(x - w / 2, 0, x + w / 2, 0);
  g.addColorStop(0, shade(col, 0.35)); g.addColorStop(0.5, col); g.addColorStop(1, shade(col, -0.25));
  ctx.fillStyle = g; ctx.fill(); ctx.lineWidth = 1.2; ctx.strokeStyle = shade(col, -0.6); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(x + lean, y - h); ctx.lineTo(x + lean * 0.2, y - 2); ctx.lineWidth = 0.9; ctx.strokeStyle = rgba('#ffffff', 0.7); ctx.stroke();
  poly(ctx, [[x - w / 2 + lean * 0.3, y - h * 0.75], [x + lean, y - h], [x + lean * 0.5, y - h * 0.62]]); ctx.fillStyle = rgba('#ffffff', 0.45); ctx.fill();
}

// ───────────── Definições: [largura, altura, desenho] ─────────────
export const PROPS = {
  rock_small: [26, 22, (ctx, R) => { ellipse(ctx, 0, -6, 10 + R() * 2, 7); fs(ctx, '#a39e97'); ellipse(ctx, -3, -9, 4, 2.4); ctx.fillStyle = '#c9c4bd'; ctx.fill(); }],
  crate: [26, 28, (ctx) => { roundRect(ctx, -10, -20, 20, 20, 2); fs(ctx, '#c08a4e'); ctx.strokeStyle = '#7a5229'; ctx.lineWidth = 1.4; ctx.beginPath(); ctx.moveTo(-10, -20); ctx.lineTo(10, 0); ctx.moveTo(10, -20); ctx.lineTo(-10, 0); ctx.stroke(); roundRect(ctx, -10, -24, 20, 5, 1.5); fs(ctx, '#d9a467'); }],
  barrel: [24, 30, (ctx) => { ellipse(ctx, 0, -12, 9, 12); fs(ctx, '#a8693a'); for (const y of [-19, -6]) { ctx.beginPath(); ctx.moveTo(-9, y); ctx.lineTo(9, y); ctx.lineWidth = 2; ctx.strokeStyle = '#5c5c66'; ctx.stroke(); } ellipse(ctx, 0, -22, 7.5, 3); fs(ctx, '#c9894f', 1); }],
  signpost: [40, 40, (ctx) => { roundRect(ctx, -2, -28, 4, 28, 1); fs(ctx, '#8a5a33'); poly(ctx, [[-14, -34], [12, -34], [17, -29], [12, -24], [-14, -24]]); fs(ctx, '#d9a467'); ctx.strokeStyle = '#8a5a33'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(-11, -29); ctx.lineTo(9, -29); ctx.stroke(); }],
  lamp: [16, 52, (ctx) => { roundRect(ctx, -1.5, -44, 3, 44, 1); fs(ctx, '#3a3f4a'); roundRect(ctx, -5, -52, 10, 9, 2); fs(ctx, '#ffe9a8'); }],
  // ── Tropical ──
  palm: [96, 118, (ctx, R) => {
    const lean = (R() - 0.5) * 22;
    ctx.beginPath(); ctx.moveTo(-4, 0); ctx.quadraticCurveTo(lean * 0.3 - 3, -50, lean - 2, -86); ctx.lineTo(lean + 3, -86); ctx.quadraticCurveTo(lean * 0.3 + 5, -50, 4, 0); ctx.closePath(); fs(ctx, '#b07a45');
    ctx.strokeStyle = rgba('#6e4524', 0.6); ctx.lineWidth = 1; for (let i = 1; i < 9; i++) { const t = i / 9, x = lean * t * t - 3.5 + (1 - t), y = -86 * t; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + 7 - (1 - t) * 2, y - 1.5); ctx.stroke(); }
    const tx = lean, ty = -88;
    for (let i = 0; i < 7; i++) {
      const a = (i / 7) * TAU + R() * 0.3, L = 30 + R() * 10;
      const ex = tx + Math.cos(a) * L, ey = ty + Math.sin(a) * L * 0.6 + 8;
      ctx.beginPath(); ctx.moveTo(tx, ty); ctx.quadraticCurveTo(tx + Math.cos(a) * L * 0.5, ty + Math.sin(a) * L * 0.3 - 10, ex, ey);
      ctx.quadraticCurveTo(tx + Math.cos(a) * L * 0.45, ty + Math.sin(a) * L * 0.3 - 2, tx, ty + 2);
      fs(ctx, i % 2 ? '#3fae4f' : '#57c35e', 1.2, '#1f6b2e');
      ctx.beginPath(); ctx.moveTo(tx, ty); ctx.quadraticCurveTo(tx + Math.cos(a) * L * 0.5, ty + Math.sin(a) * L * 0.3 - 7, ex, ey); ctx.lineWidth = 0.8; ctx.strokeStyle = '#2a7d39'; ctx.stroke();
    }
    for (let i = 0; i < 3; i++) { circ(ctx, tx - 3 + i * 3, ty + 5 + (i % 2) * 2, 3.2); fs(ctx, '#7a4a22', 1); }
  }, { sway: 1 }],
  bush_tropical: [40, 32, (ctx, R) => { canopy(ctx, 0, -12, 14, R() < 0.5 ? '#4fb35a' : '#5cc06a', R, 6); if (R() < 0.6) for (let i = 0; i < 4; i++) { circ(ctx, -8 + R() * 16, -18 + R() * 10, 2); ctx.fillStyle = R() < 0.5 ? '#ff6f91' : '#ffd23f'; ctx.fill(); } }, { sway: 0.4 }],
  flowers: [24, 16, (ctx, R) => { const cols = ['#ff6f91', '#ffd23f', '#ffffff', '#b79bff']; for (let i = 0; i < 5; i++) { const x = -8 + R() * 16, y = -3 - R() * 8; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, 0); ctx.strokeStyle = '#3f9a42'; ctx.lineWidth = 1; ctx.stroke(); circ(ctx, x, y, 2.2); fs(ctx, cols[(i + Math.floor(R() * 4)) % 4], 0.8); circ(ctx, x, y, 0.8); ctx.fillStyle = '#ffb84a'; ctx.fill(); } }, { sway: 0.6 }],
  house_wood: [110, 112, (ctx) => { house(ctx, 84, 40, 50, '#d9a467', '#e0634f', { planks: true, flowerbox: true }); // palafitas
    for (const x of [-38, 38]) { roundRect(ctx, x - 2, -3, 4, 6, 1); fs(ctx, '#8a5a33'); } }],
  shop_tropical: [140, 130, (ctx) => {
    house(ctx, 110, 44, 56, '#f2c48a', '#2fc4b2', { planks: true, thatch: true, door: '#6e4524' });
    awning(ctx, 100, -46, '#ff8a3d', '#fff3d6');
    shopSign(ctx, -104, 'tropical');
    roundRect(ctx, -46, -14, 26, 14, 2); fs(ctx, '#a8693a'); // balcão de frutas
    for (let i = 0; i < 4; i++) { circ(ctx, -42 + i * 6, -15, 3); fs(ctx, ['#ffd23f', '#ff6f4a', '#7dd65a', '#ffb347'][i], 0.8); }
  }],
  umbrella: [64, 62, (ctx, R) => { roundRect(ctx, -1.2, -52, 2.4, 52, 1); fs(ctx, '#f4f4f4'); const cols = [['#ff6f61', '#ffffff'], ['#2fc4b2', '#fff3d6'], ['#ffd23f', '#ff8a3d']][Math.floor(R() * 3)];
    for (let i = 0; i < 8; i++) { const a0 = (i / 8) * TAU, a1 = ((i + 1) / 8) * TAU; ctx.beginPath(); ctx.moveTo(0, -54); ctx.lineTo(Math.cos(a0) * 28, -54 + Math.sin(a0) * 12); ctx.lineTo(Math.cos(a1) * 28, -54 + Math.sin(a1) * 12); ctx.closePath(); fs(ctx, cols[i % 2], 1); }
    ellipse(ctx, 14, -2, 12, 4); ctx.fillStyle = '#4fa3e0'; ctx.fill(); }, { sway: 0.2 }],
  torch: [20, 48, (ctx) => { poly(ctx, [[-2, 0], [2, 0], [3, -30], [-3, -30]]); fs(ctx, '#8a5a33'); roundRect(ctx, -5, -36, 10, 8, 2); fs(ctx, '#c9a35b'); ctx.beginPath(); ctx.moveTo(-4, -36); ctx.quadraticCurveTo(-5, -44, 0, -48); ctx.quadraticCurveTo(5, -44, 4, -36); ctx.closePath(); fs(ctx, '#ffb347', 1, '#e86a1a'); ellipse(ctx, 0, -39, 1.8, 3); ctx.fillStyle = '#fff3b0'; ctx.fill(); }],
  net_rack: [64, 48, (ctx) => { for (const x of [-24, 24]) { roundRect(ctx, x - 2, -38, 4, 38, 1); fs(ctx, '#8a5a33'); } ctx.beginPath(); ctx.moveTo(-24, -34); ctx.quadraticCurveTo(0, -18, 24, -34); ctx.lineTo(24, -12); ctx.quadraticCurveTo(0, -4, -24, -12); ctx.closePath(); ctx.fillStyle = 'rgba(240,230,200,.35)'; ctx.fill(); ctx.strokeStyle = '#e9dcb8'; ctx.lineWidth = 0.8; for (let i = 0; i < 9; i++) { ctx.beginPath(); ctx.moveTo(-24 + i * 6, -33 + Math.abs(i - 4) * 0.5); ctx.lineTo(-24 + i * 6, -10); ctx.stroke(); } for (let j = 0; j < 4; j++) { ctx.beginPath(); ctx.moveTo(-24, -30 + j * 5); ctx.quadraticCurveTo(0, -16 + j * 3, 24, -30 + j * 5); ctx.stroke(); } circ(ctx, -10, -18, 3); fs(ctx, '#ffffff', 1); circ(ctx, 8, -17, 3); fs(ctx, '#ff8a3d', 1); }],
  lookout: [90, 160, (ctx) => {
    for (const x of [-26, 26]) { poly(ctx, [[x - 3, 0], [x + 3, 0], [x * 0.75 + 3, -96], [x * 0.75 - 3, -96]]); fs(ctx, '#8a5a33'); }
    ctx.strokeStyle = '#6e4524'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(-24, -20); ctx.lineTo(20, -60); ctx.moveTo(24, -20); ctx.lineTo(-20, -60); ctx.stroke();
    roundRect(ctx, -34, -104, 68, 12, 2); fs(ctx, '#c08a4e');
    for (let x = -30; x <= 30; x += 10) { roundRect(ctx, x - 1.5, -120, 3, 16, 1); fs(ctx, '#a8693a', 1); }
    ctx.beginPath(); ctx.moveTo(-34, -118); ctx.lineTo(34, -118); ctx.lineWidth = 3; ctx.strokeStyle = '#8a5a33'; ctx.stroke();
    poly(ctx, [[-40, -122], [40, -122], [0, -152]]); fs(ctx, '#e0634f');
    // bandeirinha
    ctx.beginPath(); ctx.moveTo(0, -152); ctx.lineTo(0, -160); ctx.strokeStyle = '#6e4524'; ctx.lineWidth = 1.4; ctx.stroke(); poly(ctx, [[0, -160], [10, -157], [0, -154]]); fs(ctx, '#ffd23f', 1);
  }],
  hammock: [92, 48, (ctx) => { for (const x of [-38, 38]) { roundRect(ctx, x - 2, -38, 4, 38, 1); fs(ctx, '#8a5a33'); } ctx.beginPath(); ctx.moveTo(-36, -30); ctx.quadraticCurveTo(0, -4, 36, -30); ctx.quadraticCurveTo(0, -12, -36, -30); fs(ctx, '#ff8a80', 1.2); ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(-30, -26); ctx.quadraticCurveTo(0, -6, 30, -26); ctx.stroke(); }],
  // ── Mangue ──
  mangrove: [120, 130, (ctx, R) => {
    // raízes aéreas
    for (let i = 0; i < 9; i++) { const x = -34 + i * 8.5 + (R() - 0.5) * 3; ctx.beginPath(); ctx.moveTo(x * 0.25, -34); ctx.quadraticCurveTo(x * 0.9, -26 + R() * 6, x * 1.25, 0); ctx.lineWidth = 3.4; ctx.strokeStyle = '#4a3a26'; ctx.stroke(); ctx.lineWidth = 2; ctx.strokeStyle = '#7a6142'; ctx.stroke(); }
    poly(ctx, [[-6, -30], [6, -30], [4, -64], [-4, -64]]); fs(ctx, '#6b5236');
    canopy(ctx, 0, -82, 38, R() < 0.5 ? '#3f7d3a' : '#4a8a3e', R, 9, 0.75);
    for (let i = 0; i < 6; i++) { ellipse(ctx, -26 + R() * 52, -92 + R() * 26, 5, 2.4, R() * 3); ctx.fillStyle = rgba('#a7d36a', 0.65); ctx.fill(); }
  }, { sway: 0.5 }],
  mangrove_small: [70, 78, (ctx, R) => { for (let i = 0; i < 5; i++) { const x = -18 + i * 9; ctx.beginPath(); ctx.moveTo(x * 0.2, -20); ctx.quadraticCurveTo(x * 0.8, -12, x * 1.1, 0); ctx.lineWidth = 2.6; ctx.strokeStyle = '#5b4730'; ctx.stroke(); } poly(ctx, [[-3, -18], [3, -18], [2, -36], [-2, -36]]); fs(ctx, '#6b5236'); canopy(ctx, 0, -48, 24, '#4f9142', R, 7, 0.8); }, { sway: 0.6 }],
  reeds: [30, 36, (ctx, R) => { for (let i = 0; i < 7; i++) { const x = -10 + i * 3.3, h = 18 + R() * 14; ctx.beginPath(); ctx.moveTo(x, 0); ctx.quadraticCurveTo(x + 2, -h * 0.6, x + (R() - 0.5) * 6, -h); ctx.lineWidth = 1.6; ctx.strokeStyle = i % 2 ? '#6d9a3a' : '#88b04a'; ctx.stroke(); if (i % 3 === 0) { ellipse(ctx, x + 1, -h + 2, 1.8, 5); fs(ctx, '#7a4a22', 0.8); } } }, { sway: 1.2 }],
  stilt_hut: [116, 120, (ctx) => {
    for (const x of [-36, -12, 12, 36]) { roundRect(ctx, x - 2.5, -14, 5, 16, 1); fs(ctx, '#5b4730'); }
    ctx.translate(0, -12);
    house(ctx, 86, 38, 46, '#a08055', '#7a8a3a', { planks: true, thatch: true, door: '#4a3a26', window: '#ffe39a' });
  }],
  shop_mangue: [148, 140, (ctx) => {
    for (const x of [-50, -18, 18, 50]) { roundRect(ctx, x - 3, -14, 6, 16, 1); fs(ctx, '#5b4730'); }
    ctx.translate(0, -12);
    house(ctx, 112, 44, 52, '#b08d5c', '#8a6b3a', { planks: true, thatch: true, door: '#4a3a26', window: '#ffe39a' });
    awning(ctx, 100, -46, '#5f8a3a', '#e9efd9');
    shopSign(ctx, -100, 'mangue');
    // potes e redes
    for (let i = 0; i < 3; i++) { ellipse(ctx, 38 + i * 9, -6, 4, 6); fs(ctx, ['#c96a3a', '#d9a467', '#8a6b3a'][i]); }
  }],
  log: [64, 22, (ctx) => { roundRect(ctx, -28, -14, 56, 13, 6.5); fs(ctx, '#7a5a3a'); ellipse(ctx, 27, -7.5, 4, 6.2); fs(ctx, '#c9a06a'); ctx.strokeStyle = '#8a6b3a'; ctx.lineWidth = 0.8; ctx.beginPath(); ctx.arc(27, -7.5, 2.4, 0, TAU); ctx.stroke(); for (let i = 0; i < 4; i++) { ellipse(ctx, -18 + i * 10, -14, 3, 1.4); ctx.fillStyle = '#7fb53a'; ctx.fill(); } }],
  lilypad: [36, 22, (ctx, R) => { for (let i = 0; i < 2; i++) { const x = (i - 0.5) * 14, y = -6 + i * 2, r = 7 + R() * 3; ctx.beginPath(); ctx.moveTo(x, y); ctx.arc(x, y, r, 0.35, TAU - 0.05); ctx.closePath(); ctx.save(); ctx.scale(1, 0.62); ctx.restore(); fs(ctx, i ? '#5fa84a' : '#6dbb52', 1); } if (R() < 0.4) { for (let k = 0; k < 6; k++) { const a = (k / 6) * TAU; ellipse(ctx, 4 + Math.cos(a) * 2.6, -9 + Math.sin(a) * 2, 2.4, 1.3, a); fs(ctx, '#ffd6ea', 0.6); } circ(ctx, 4, -9, 1.3); ctx.fillStyle = '#ffd23f'; ctx.fill(); } }],
  lantern_post: [24, 58, (ctx) => { roundRect(ctx, -2, -46, 4, 46, 1); fs(ctx, '#5b4730'); ctx.beginPath(); ctx.moveTo(0, -46); ctx.lineTo(8, -48); ctx.strokeStyle = '#5b4730'; ctx.lineWidth = 2; ctx.stroke(); roundRect(ctx, 4, -48, 9, 11, 3); fs(ctx, '#ffe28a', 1.2, '#7a5a2a'); }],
  fern: [34, 28, (ctx, R) => { for (let i = 0; i < 6; i++) { const a = -Math.PI / 2 + (i - 2.5) * 0.45; const L = 14 + R() * 6; ctx.beginPath(); ctx.moveTo(0, 0); ctx.quadraticCurveTo(Math.cos(a) * L * 0.6, Math.sin(a) * L * 0.8 - 4, Math.cos(a) * L, Math.sin(a) * L * 0.85); ctx.lineWidth = 3.2; ctx.strokeStyle = i % 2 ? '#3f7d3a' : '#5a9a45'; ctx.stroke(); } }, { sway: 0.9 }],
  // ── Congelada ──
  pine: [76, 120, (ctx, R) => {
    roundRect(ctx, -4, -20, 8, 20, 2); fs(ctx, '#6b4a2e');
    const col = R() < 0.5 ? '#2f6b5a' : '#357a62';
    for (let i = 0; i < 4; i++) { const y = -20 - i * 22, w = 34 - i * 7; poly(ctx, [[-w, y], [w, y], [0, y - 38]]); fs(ctx, shade(col, i * 0.04)); ctx.fillStyle = '#f6fbff'; poly(ctx, [[-w * 0.7, y - 10], [-w * 0.25, y - 12], [0, y - 36], [w * 0.3, y - 14], [w * 0.75, y - 9], [w * 0.4, y - 18], [0, y - 38], [-w * 0.35, y - 19]]); ctx.fill(); }
  }, { sway: 0.25 }],
  pine_small: [50, 76, (ctx, R) => { roundRect(ctx, -3, -12, 6, 12, 2); fs(ctx, '#6b4a2e'); for (let i = 0; i < 3; i++) { const y = -12 - i * 15, w = 22 - i * 5; poly(ctx, [[-w, y], [w, y], [0, y - 26]]); fs(ctx, '#3a7f66'); ctx.fillStyle = '#f6fbff'; poly(ctx, [[-w * 0.5, y - 9], [0, y - 26], [w * 0.5, y - 9], [0, y - 15]]); ctx.fill(); } }, { sway: 0.3 }],
  cabin: [116, 116, (ctx) => { house(ctx, 86, 40, 48, '#8a5a33', '#7a4a2e', { logs: true, snow: true, door: '#5a3a20', window: '#ffe39a' }); roundRect(ctx, 22, -100, 10, 18, 1); fs(ctx, '#8c8d96'); }],
  shop_congelada: [146, 110, (ctx) => {
    // iglu com placa
    ctx.beginPath(); ctx.ellipse(0, -2, 58, 52, 0, Math.PI, TAU); ctx.closePath(); fs(ctx, '#f2f8fd', 1.6, '#8fb3cf');
    ctx.save(); ctx.clip(); ctx.strokeStyle = 'rgba(120,160,200,.45)'; ctx.lineWidth = 1;
    for (let r = 0; r < 5; r++) { const y = -8 - r * 10; ctx.beginPath(); ctx.moveTo(-60, y); ctx.lineTo(60, y); ctx.stroke(); for (let x = -56 + (r % 2) * 9; x < 60; x += 18) { ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, y + 10); ctx.stroke(); } }
    ctx.fillStyle = 'rgba(160,200,235,.35)'; ctx.fillRect(10, -60, 60, 60); ctx.restore();
    ctx.beginPath(); ctx.ellipse(0, -2, 16, 26, 0, Math.PI, TAU); ctx.closePath(); fs(ctx, '#2c4a6a');
    ctx.beginPath(); ctx.ellipse(0, -2, 22, 30, 0, Math.PI, TAU); ctx.lineWidth = 5; ctx.strokeStyle = '#e6f2fb'; ctx.stroke();
    shopSign(ctx, -62, 'congelada');
    // trenó com caixas
    roundRect(ctx, 34, -10, 26, 8, 2); fs(ctx, '#d6455a'); roundRect(ctx, 38, -20, 10, 10, 1); fs(ctx, '#c08a4e');
  }],
  snowman: [36, 52, (ctx) => { circ(ctx, 0, -12, 12); fs(ctx, '#ffffff', 1.3, '#9cbad6'); circ(ctx, 0, -30, 8.5); fs(ctx, '#ffffff', 1.3, '#9cbad6'); circ(ctx, -3, -32, 1.2); circ(ctx, 3, -32, 1.2); ctx.fillStyle = '#222'; ctx.fill(); poly(ctx, [[0, -30], [7, -28.5], [0, -27.5]]); fs(ctx, '#ff8a3d', 0.8); roundRect(ctx, -9, -26, 18, 3.6, 1.5); fs(ctx, '#d6455a', 1); roundRect(ctx, -6, -46, 12, 9, 1); fs(ctx, '#2b2f3a', 1); roundRect(ctx, -9, -38, 18, 2.5, 1); fs(ctx, '#2b2f3a', 1); }],
  ice_rock: [40, 38, (ctx, R) => { poly(ctx, [[-16, 0], [-14, -16], [-4, -26], [8, -22], [16, -10], [14, 0]]); fs(ctx, '#9aa7b4'); poly(ctx, [[-14, -16], [-4, -26], [8, -22], [2, -16]]); ctx.fillStyle = '#f6fbff'; ctx.fill(); ctx.strokeStyle = '#6f7d8b'; ctx.lineWidth = 1; ctx.stroke(); }],
  campfire: [40, 30, (ctx) => { for (let i = 0; i < 7; i++) { const a = (i / 7) * TAU; circ(ctx, Math.cos(a) * 11, -4 + Math.sin(a) * 5, 3.2); fs(ctx, '#8c8d96', 1); } for (const r of [-0.5, 0.5]) { ctx.save(); ctx.translate(0, -5); ctx.rotate(r); roundRect(ctx, -10, -2, 20, 4, 2); fs(ctx, '#7a4a22', 1); ctx.restore(); } ctx.beginPath(); ctx.moveTo(-6, -5); ctx.quadraticCurveTo(-7, -16, 0, -22); ctx.quadraticCurveTo(7, -16, 6, -5); ctx.closePath(); fs(ctx, '#ff9a3a', 1, '#e8581a'); ctx.beginPath(); ctx.moveTo(-3, -5); ctx.quadraticCurveTo(-3, -11, 0, -15); ctx.quadraticCurveTo(3, -11, 3, -5); ctx.closePath(); ctx.fillStyle = '#ffe28a'; ctx.fill(); }],
  sled: [52, 26, (ctx) => { ctx.beginPath(); ctx.moveTo(-22, -2); ctx.lineTo(20, -2); ctx.quadraticCurveTo(26, -2, 24, -8); ctx.lineWidth = 2; ctx.strokeStyle = '#6b4a2e'; ctx.stroke(); roundRect(ctx, -20, -12, 38, 7, 2); fs(ctx, '#d6455a'); roundRect(ctx, -14, -20, 12, 8, 1); fs(ctx, '#c08a4e', 1); }],
  fish_rack: [64, 54, (ctx) => { for (const x of [-26, 26]) { roundRect(ctx, x - 2, -44, 4, 44, 1); fs(ctx, '#6b4a2e'); } ctx.beginPath(); ctx.moveTo(-28, -40); ctx.lineTo(28, -40); ctx.lineWidth = 2.4; ctx.strokeStyle = '#6b4a2e'; ctx.stroke(); for (let i = 0; i < 5; i++) { const x = -20 + i * 10; ctx.beginPath(); ctx.moveTo(x, -40); ctx.lineTo(x, -34); ctx.lineWidth = 0.8; ctx.strokeStyle = '#ddd'; ctx.stroke(); ellipse(ctx, x, -26, 3, 8); fs(ctx, ['#9fb6d6', '#8c8d77', '#c4d0e0'][i % 3], 1); poly(ctx, [[x, -17], [x - 3, -13], [x + 3, -13]]); fs(ctx, '#8ca0b8', 0.8); } }],
  ice_spike: [32, 58, (ctx, R) => { crystal(ctx, -4, 0, 12, 46, '#bfe9ff', -3); crystal(ctx, 7, 0, 9, 30, '#d6f3ff', 4); }],
  // ── Vulcânica ──
  volcano: [620, 470, (ctx) => {
    const g = ctx.createLinearGradient(0, -440, 0, 0); g.addColorStop(0, '#5a4f52'); g.addColorStop(1, '#3a3336');
    ctx.beginPath(); ctx.moveTo(-300, 0); ctx.quadraticCurveTo(-170, -140, -70, -400); ctx.lineTo(70, -400); ctx.quadraticCurveTo(170, -140, 300, 0); ctx.closePath(); ctx.fillStyle = g; ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = '#1f1a1c'; ctx.stroke();
    // estrias
    ctx.strokeStyle = 'rgba(20,15,15,.4)'; ctx.lineWidth = 2;
    for (let i = -5; i <= 5; i++) { ctx.beginPath(); ctx.moveTo(i * 13, -398); ctx.quadraticCurveTo(i * 30, -200, i * 52, 0); ctx.stroke(); }
    ctx.fillStyle = 'rgba(255,255,255,.08)'; ctx.beginPath(); ctx.moveTo(-70, -400); ctx.quadraticCurveTo(-170, -140, -300, 0); ctx.lineTo(-200, 0); ctx.quadraticCurveTo(-100, -160, -40, -400); ctx.closePath(); ctx.fill();
    // cratera e lava escorrendo
    ellipse(ctx, 0, -400, 70, 16); fs(ctx, '#2a2224', 2, '#1a1416');
    ellipse(ctx, 0, -398, 52, 10); ctx.fillStyle = '#ff6a1a'; ctx.fill();
    ellipse(ctx, 0, -399, 30, 5); ctx.fillStyle = '#ffd36a'; ctx.fill();
    for (const [x0, x1, w] of [[18, 60, 9], [-24, -50, 6], [34, 120, 7]]) { ctx.beginPath(); ctx.moveTo(x0, -394); ctx.quadraticCurveTo((x0 + x1) / 2 + 10, -300, x1, -200 + Math.abs(x1)); ctx.lineWidth = w; ctx.strokeStyle = '#ff6a1a'; ctx.stroke(); ctx.lineWidth = w * 0.4; ctx.strokeStyle = '#ffd36a'; ctx.stroke(); }
  }],
  basalt: [64, 84, (ctx, R) => {
    const cols = [[-14, 54], [0, 70], [14, 46], [-24, 34], [24, 30]];
    for (const [x, h] of cols.sort((a, b) => a[1] - b[1] < 0 ? -1 : 1)) {
      const hh = h * (0.8 + R() * 0.3);
      poly(ctx, [[x - 8, 0], [x - 8, -hh], [x - 4, -hh - 4], [x + 4, -hh - 4], [x + 8, -hh], [x + 8, 0]]); fs(ctx, '#4f494e', 1.3, '#221e21');
      poly(ctx, [[x - 8, -hh], [x - 4, -hh - 4], [x + 4, -hh - 4], [x + 8, -hh], [x + 4, -hh + 4], [x - 4, -hh + 4]]); fs(ctx, '#7a7378', 1, '#221e21');
      ctx.fillStyle = 'rgba(255,255,255,.08)'; ctx.fillRect(x - 8, -hh, 4, hh);
    }
  }],
  lava_rock: [32, 28, (ctx, R) => { poly(ctx, [[-12, 0], [-11, -11], [-3, -17], [8, -14], [12, -4], [10, 0]]); fs(ctx, '#3d3638'); ctx.strokeStyle = '#ff7a1a'; ctx.lineWidth = 1.4; ctx.beginPath(); ctx.moveTo(-8, -8); ctx.lineTo(-2, -12); ctx.lineTo(4, -7); ctx.moveTo(-2, -12); ctx.lineTo(1, -16); ctx.stroke(); }],
  shrub_dry: [30, 24, (ctx, R) => { for (let i = 0; i < 9; i++) { const a = -Math.PI / 2 + (i - 4) * 0.3; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(Math.cos(a) * (12 + R() * 6), Math.sin(a) * (12 + R() * 6)); ctx.lineWidth = 1.3; ctx.strokeStyle = i % 2 ? '#a08455' : '#c4a46a'; ctx.stroke(); } }, { sway: 0.7 }],
  agave: [40, 34, (ctx, R) => { for (let i = 0; i < 9; i++) { const a = -Math.PI / 2 + (i - 4) * 0.36; const L = 16 + (4 - Math.abs(i - 4)) * 2.5; poly(ctx, [[-2.5, 0], [Math.cos(a) * L, Math.sin(a) * L - 2], [2.5, 0]]); fs(ctx, i % 2 ? '#6a9a6a' : '#7fb07a', 1); } }],
  dead_tree: [60, 92, (ctx, R) => { ctx.lineCap = 'round'; const br = (x, y, a, L, w) => { if (w < 1.2) return; const ex = x + Math.cos(a) * L, ey = y + Math.sin(a) * L; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(ex, ey); ctx.lineWidth = w + 2; ctx.strokeStyle = '#2a2224'; ctx.stroke(); ctx.lineWidth = w; ctx.strokeStyle = '#6a5a52'; ctx.stroke(); br(ex, ey, a - 0.45 - R() * 0.2, L * 0.7, w * 0.62); br(ex, ey, a + 0.4 + R() * 0.2, L * 0.65, w * 0.58); }; br(0, 0, -Math.PI / 2, 34, 6); }],
  shop_vulcanica: [148, 136, (ctx) => {
    house(ctx, 112, 46, 52, '#6a5f60', '#b8432a', { stones: true, door: '#3a2a20', window: '#ffb35a' });
    awning(ctx, 100, -48, '#ff7a2a', '#2b2220');
    shopSign(ctx, -106, 'vulcanica');
    // chaminé com brasa e bigorna
    roundRect(ctx, 30, -116, 14, 22, 2); fs(ctx, '#4f494e'); ellipse(ctx, 37, -116, 6, 2.5); ctx.fillStyle = '#ff7a2a'; ctx.fill();
    poly(ctx, [[-56, -2], [-36, -2], [-38, -10], [-30, -14], [-62, -14], [-54, -10]]); fs(ctx, '#3a3f4a');
  }],
  hut_stone: [104, 104, (ctx) => { house(ctx, 80, 38, 44, '#7a7072', '#5a4a44', { stones: true, door: '#3a2a20', window: '#ffb35a' }); }],
  steam_vent: [24, 10, (ctx) => { ellipse(ctx, 0, -2, 8, 3.5); fs(ctx, '#2a2224', 1); ellipse(ctx, 0, -2, 4, 1.6); ctx.fillStyle = '#ff7a2a'; ctx.fill(); }],
  obsidian: [34, 46, (ctx) => { crystal(ctx, -4, 0, 12, 34, '#2a2236', -2); crystal(ctx, 8, 0, 10, 22, '#3a3046', 3); }],
  // ── Cristais ──
  crystal_big: [64, 104, (ctx, R) => { const col = R() < 0.5 ? '#b48cff' : '#8fdcff'; crystal(ctx, -14, 0, 16, 52, shade(col, -0.1), -6); crystal(ctx, 13, 0, 15, 60, shade(col, 0.05), 7); crystal(ctx, 0, 0, 22, 92, col, 2); ellipse(ctx, 0, -1, 26, 6); ctx.fillStyle = rgba('#3a2a6a', 0.35); ctx.fill(); }],
  crystal_small: [32, 50, (ctx, R) => { const col = R() < 0.5 ? '#9ff0ff' : '#d0b8ff'; crystal(ctx, -5, 0, 9, 26, col, -3); crystal(ctx, 5, 0, 10, 40, shade(col, 0.1), 2); }],
  glow_mushroom: [30, 26, (ctx, R) => { for (let i = 0; i < 3; i++) { const x = -8 + i * 8, h = 8 + R() * 8; roundRect(ctx, x - 1.5, -h, 3, h, 1); fs(ctx, '#e8e0ff', 1); ctx.beginPath(); ctx.ellipse(x, -h, 6 - i, 4, 0, Math.PI, TAU); ctx.closePath(); fs(ctx, i % 2 ? '#7ff6ff' : '#a6fff2', 1, '#2a8f9a'); circ(ctx, x - 1.5, -h - 1.5, 0.9); ctx.fillStyle = '#ffffff'; ctx.fill(); } }],
  glow_plant: [34, 38, (ctx, R) => { for (let i = 0; i < 5; i++) { const a = -Math.PI / 2 + (i - 2) * 0.35, L = 18 + R() * 12; ctx.beginPath(); ctx.moveTo(0, 0); ctx.quadraticCurveTo(Math.cos(a) * L * 0.4, -L * 0.6, Math.cos(a) * L, Math.sin(a) * L); ctx.lineWidth = 1.6; ctx.strokeStyle = '#4fbf86'; ctx.stroke(); circ(ctx, Math.cos(a) * L, Math.sin(a) * L, 2.6); fs(ctx, '#c4ff9a', 0.8, '#4fbf86'); } }, { sway: 0.8 }],
  column: [36, 112, (ctx) => { roundRect(ctx, -14, -8, 28, 8, 2); fs(ctx, '#b4aecb'); roundRect(ctx, -10, -96, 20, 88, 2); fs(ctx, '#cbc6dc'); ctx.strokeStyle = 'rgba(80,70,110,.35)'; ctx.lineWidth = 1; for (const x of [-5, 0, 5]) { ctx.beginPath(); ctx.moveTo(x, -94); ctx.lineTo(x, -10); ctx.stroke(); } roundRect(ctx, -14, -104, 28, 9, 2); fs(ctx, '#b4aecb'); for (let i = 0; i < 4; i++) { ellipse(ctx, -8 + i * 5, -50 + i * 9, 3, 1.5); ctx.fillStyle = '#7fb57a'; ctx.fill(); } }],
  column_broken: [40, 56, (ctx) => { roundRect(ctx, -14, -8, 28, 8, 2); fs(ctx, '#b4aecb'); poly(ctx, [[-10, -8], [10, -8], [10, -34], [4, -40], [-2, -36], [-10, -44]]); fs(ctx, '#cbc6dc'); poly(ctx, [[16, 0], [30, -2], [30, -12], [14, -10]]); fs(ctx, '#bdb7d2'); }],
  arch: [110, 130, (ctx) => {
    for (const x of [-34, 34]) { roundRect(ctx, x - 11, -8, 22, 8, 2); fs(ctx, '#b4aecb'); roundRect(ctx, x - 8, -92, 16, 84, 2); fs(ctx, '#cbc6dc'); }
    ctx.beginPath(); ctx.moveTo(-44, -92); ctx.lineTo(44, -92); ctx.lineTo(44, -110); ctx.quadraticCurveTo(0, -126, -44, -110); ctx.closePath(); fs(ctx, '#bdb7d2');
    ctx.beginPath(); ctx.moveTo(-26, -92); ctx.quadraticCurveTo(0, -116, 26, -92); ctx.lineWidth = 2; ctx.strokeStyle = 'rgba(80,70,110,.4)'; ctx.stroke();
    crystal(ctx, 0, -108, 10, 16, '#e2c4ff', 0);
    for (let i = 0; i < 8; i++) { ellipse(ctx, -40 + i * 11, -92 + (i % 3) * 2, 3, 2); ctx.fillStyle = '#7fb57a'; ctx.fill(); }
  }],
  statue: [56, 100, (ctx) => { roundRect(ctx, -20, -18, 40, 18, 3); fs(ctx, '#a9a3c4'); // peixe em pedra sobre pedestal
    ctx.save(); ctx.translate(0, -52); ctx.rotate(-0.5); ellipse(ctx, 0, 0, 12, 24); fs(ctx, '#cbc6dc'); poly(ctx, [[0, 22], [-10, 36], [10, 36]]); fs(ctx, '#bdb7d2'); circ(ctx, -4, -12, 2.5); ctx.fillStyle = '#7ff6ff'; ctx.fill(); ctx.restore(); }],
  temple: [260, 200, (ctx) => {
    roundRect(ctx, -120, -20, 240, 20, 3); fs(ctx, '#a9a3c4'); roundRect(ctx, -112, -30, 224, 12, 3); fs(ctx, '#b4aecb');
    for (let x = -96; x <= 96; x += 32) { roundRect(ctx, x - 7, -128, 14, 98, 2); fs(ctx, '#cbc6dc'); }
    poly(ctx, [[-120, -128], [120, -128], [100, -150], [-100, -150]]); fs(ctx, '#bdb7d2');
    poly(ctx, [[-90, -150], [90, -150], [0, -192]]); fs(ctx, '#cbc6dc');
    crystal(ctx, 0, -158, 18, 30, '#e2c4ff', 0);
    roundRect(ctx, -22, -100, 44, 70, 22); ctx.fillStyle = '#3a2f6f'; ctx.fill();
    ctx.fillStyle = 'rgba(200,170,255,.5)'; ctx.beginPath(); ctx.arc(0, -62, 14, 0, TAU); ctx.fill();
    for (let i = 0; i < 14; i++) { ellipse(ctx, -110 + i * 17, -128 + (i % 3) * 3, 4, 2.4); ctx.fillStyle = '#7fb57a'; ctx.fill(); }
  }],
  shop_cristais: [148, 140, (ctx) => {
    house(ctx, 110, 46, 50, '#cbc6dc', '#5b3fa3', { stones: true, door: '#2a2050', window: '#c9f6ff' });
    awning(ctx, 100, -48, '#b48cff', '#241a3d');
    shopSign(ctx, -104, 'cristais');
    crystal(ctx, -52, 0, 12, 30, '#9ff0ff', -3); crystal(ctx, 52, 0, 12, 34, '#d0b8ff', 3);
  }],
  crystal_lamp: [24, 64, (ctx) => { roundRect(ctx, -2, -44, 4, 44, 1); fs(ctx, '#8a84a8'); crystal(ctx, 0, -42, 10, 18, '#e2c4ff', 0); }],
};

// ───────────── Atlas de sprites ─────────────
// Empacota as variantes em páginas 2048×2048 (estantes). Uma instância por região.
export class SpriteAtlas {
  constructor(scale) {
    this.scale = scale;
    this.pages = [];
    this.map = new Map();
    this._newPage();
  }
  _newPage() {
    const c = makeCanvas(2048, 2048);
    this.pages.push({ c, ctx: c.getContext('2d'), x: 0, y: 0, rowH: 0 });
  }
  get(type, variant) {
    const def = PROPS[type];
    if (!def) return null;
    const v = variant % 4;
    const key = type + '|' + v;
    let s = this.map.get(key);
    if (s) return s;
    const [w, h, draw, opt] = def;
    const pad = 6;
    const W = Math.ceil((w + pad * 2) * this.scale), H = Math.ceil((h + pad * 2) * this.scale);
    let pg = this.pages[this.pages.length - 1];
    if (pg.x + W > 2048) { pg.x = 0; pg.y += pg.rowH + 2; pg.rowH = 0; }
    if (pg.y + H > 2048 || W > 2048) { this._newPage(); pg = this.pages[this.pages.length - 1]; }
    const ctx = pg.ctx;
    ctx.save();
    ctx.beginPath(); ctx.rect(pg.x, pg.y, W, H); ctx.clip();
    ctx.translate(pg.x, pg.y);
    ctx.scale(this.scale, this.scale);
    ctx.translate(pad + w / 2, pad + h);
    ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    draw(ctx, rng(v * 7919 + type.length * 131 + 1), v);
    ctx.restore();
    s = { c: pg.c, sx: pg.x, sy: pg.y, sw: W, sh: H, w: w + pad * 2, h: h + pad * 2, ax: pad + w / 2, ay: pad + h, sway: opt?.sway || 0, dw: w, dh: h };
    pg.x += W + 2; pg.rowH = Math.max(pg.rowH, H);
    this.map.set(key, s);
    return s;
  }
  dispose() { for (const p of this.pages) { p.c.width = 1; p.c.height = 1; } this.pages = []; this.map.clear(); }
}

// ───────────── Píeres, passarelas e pontes ─────────────
export function drawDock(ctx, d, regionId, t) {
  const style = d.kind === 'bridge' ? (regionId === 'cristais' ? 'stone' : 'basalt') : regionId === 'mangue' ? 'mangrove' : regionId === 'congelada' ? 'frost' : 'wood';
  const wood = { wood: '#c99659', mangrove: '#9c7a4f', frost: '#a9845a' }[style] || '#b4aecb';
  const horiz = d.w > d.h;
  // sombra na água
  ctx.fillStyle = 'rgba(0,30,50,0.22)';
  ctx.fillRect(d.x + 4, d.y + 6, d.w, d.h);
  // pilares
  const posts = [];
  if (horiz) for (let x = d.x + 8; x < d.x + d.w; x += 40) posts.push([x, d.y - 1], [x, d.y + d.h + 1]);
  else for (let y = d.y + 8; y < d.y + d.h; y += 40) posts.push([d.x - 1, y], [d.x + d.w + 1, y]);
  for (const [x, y] of posts) { ellipse(ctx, x, y + 3, 5, 3); ctx.fillStyle = 'rgba(255,255,255,0.35)'; ctx.fill(); circ(ctx, x, y, 3.6); fs(ctx, style === 'stone' || style === 'basalt' ? '#8f89a6' : '#6e4524', 1); }
  if (style === 'stone' || style === 'basalt') {
    const col = style === 'stone' ? '#b9b3c9' : '#6a6266';
    ctx.fillStyle = col; ctx.fillRect(d.x, d.y, d.w, d.h);
    ctx.strokeStyle = shade(col, -0.3); ctx.lineWidth = 1;
    if (horiz) for (let x = d.x; x < d.x + d.w; x += 20) { ctx.beginPath(); ctx.moveTo(x, d.y); ctx.lineTo(x, d.y + d.h); ctx.stroke(); }
    else for (let y = d.y; y < d.y + d.h; y += 20) { ctx.beginPath(); ctx.moveTo(d.x, y); ctx.lineTo(d.x + d.w, y); ctx.stroke(); }
    ctx.fillStyle = shade(col, -0.2);
    if (horiz) { ctx.fillRect(d.x, d.y - 3, d.w, 4); ctx.fillRect(d.x, d.y + d.h - 1, d.w, 4); }
    else { ctx.fillRect(d.x - 3, d.y, 4, d.h); ctx.fillRect(d.x + d.w - 1, d.y, 4, d.h); }
    ctx.strokeStyle = shade(col, -0.5); ctx.lineWidth = 1.2; ctx.strokeRect(d.x, d.y, d.w, d.h);
    return;
  }
  // tábuas
  const n = horiz ? Math.ceil(d.w / 9) : Math.ceil(d.h / 9);
  for (let i = 0; i < n; i++) {
    const k = (Math.sin(i * 12.9898) * 43758.5453) % 1;
    ctx.fillStyle = shade(wood, (Math.abs(k) - 0.5) * 0.18);
    if (horiz) ctx.fillRect(d.x + i * 9, d.y, 8, d.h); else ctx.fillRect(d.x, d.y + i * 9, d.w, 8);
  }
  ctx.fillStyle = 'rgba(70,40,15,.55)';
  for (let i = 0; i < n; i++) {
    if (horiz) { ctx.fillRect(d.x + i * 9 + 8, d.y, 1, d.h); ctx.fillRect(d.x + i * 9 + 3, d.y + 4, 1.3, 1.3); ctx.fillRect(d.x + i * 9 + 3, d.y + d.h - 5, 1.3, 1.3); }
    else { ctx.fillRect(d.x, d.y + i * 9 + 8, d.w, 1); ctx.fillRect(d.x + 4, d.y + i * 9 + 3, 1.3, 1.3); ctx.fillRect(d.x + d.w - 5, d.y + i * 9 + 3, 1.3, 1.3); }
  }
  if (style === 'frost') { ctx.fillStyle = 'rgba(240,250,255,.55)'; for (let i = 0; i < n; i += 2) { if (horiz) ctx.fillRect(d.x + i * 9, d.y, 8, 3); else ctx.fillRect(d.x, d.y + i * 9, 3, 8); } }
  ctx.strokeStyle = shade(wood, -0.55); ctx.lineWidth = 1.2; ctx.strokeRect(d.x, d.y, d.w, d.h);
}
