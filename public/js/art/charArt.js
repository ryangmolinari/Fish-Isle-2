// Personagens jogáveis: 6 pescadores originais em estilo chibi visto de cima (3/4).
// Origem do desenho = centro dos pés. Direções: 0 baixo, 1 esquerda, 2 direita, 3 cima.
import { shade, makeCanvas, ellipse, TAU } from './util.js';

export const CHARACTERS = [
  { id: 0, name: 'Marina', desc: 'Surfista da vila, nunca esquece a flor no cabelo.', skin: '#e9b48a', hair: '#55301f', style: 'long', shirt: '#2fb5a3', shirt2: '#f7fff9', pants: '#f2dfb8', shoes: '#ef6a4f', acc: 'flower', accColor: '#ff6f91', outfit: 'tank' },
  { id: 1, name: 'Davi', desc: 'Lê o vento pelos óculos redondos.', skin: '#7a4a2e', hair: '#1c1411', style: 'curly', shirt: '#ffc93a', shirt2: '#ef8f1d', pants: '#3a62ad', shoes: '#f4f4f4', acc: 'glasses', outfit: 'stripes' },
  { id: 2, name: 'Iara', desc: 'Jardineira jeans e sardas de sol.', skin: '#f4cfac', hair: '#ff8fb3', style: 'bob', shirt: '#ffffff', shirt2: '#5b8bd6', pants: '#5b8bd6', shoes: '#ffcf3f', acc: 'freckles', accColor: '#ffd23f', outfit: 'overalls' },
  { id: 3, name: 'Kenji', desc: 'Cachecol amarelo em qualquer clima.', skin: '#f2d2b6', hair: '#262a38', style: 'spiky', shirt: '#e5484d', shirt2: '#ffd23f', pants: '#59606e', shoes: '#2f2f38', acc: 'scarf', outfit: 'jacket' },
  { id: 4, name: 'Bia', desc: 'Coques altos e argolas douradas.', skin: '#a7683f', hair: '#2b1a12', style: 'puffs', shirt: '#9b6be0', shirt2: '#4fbf86', pants: '#4fbf86', shoes: '#ffffff', acc: 'earrings', accColor: '#ffd23f', outfit: 'dress' },
  { id: 5, name: 'Vô Tom', desc: 'Pesca desde antes do farol existir.', skin: '#f3d3bf', hair: '#ecebf2', style: 'beard', shirt: '#6d93b8', shirt2: '#d8c08e', pants: '#5b4a39', shoes: '#3a2a20', acc: 'beard', outfit: 'vest' },
];

const LW = 1.15;
const ol = (c) => shade(c, -0.55);

function limb(ctx, x1, y1, x2, y2, w, color) {
  ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2);
  ctx.lineWidth = w + LW * 2; ctx.strokeStyle = ol(color); ctx.stroke();
  ctx.lineWidth = w; ctx.strokeStyle = color; ctx.stroke();
}
function blob(ctx, x, y, rx, ry, color, rot = 0) {
  ellipse(ctx, x, y, rx, ry, rot);
  ctx.fillStyle = color; ctx.fill(); ctx.lineWidth = LW; ctx.strokeStyle = ol(color); ctx.stroke();
}

// ───────── Cabelo ─────────
function hairBack(ctx, c, dir, hx, hy) {
  const h = c.hair;
  if (c.style === 'long') { ctx.beginPath(); ctx.moveTo(hx - 10, hy - 2); ctx.quadraticCurveTo(hx - 12, hy + 14, hx - 6, hy + 15); ctx.lineTo(hx + 6, hy + 15); ctx.quadraticCurveTo(hx + 12, hy + 14, hx + 10, hy - 2); ctx.closePath(); ctx.fillStyle = h; ctx.fill(); ctx.lineWidth = LW; ctx.strokeStyle = ol(h); ctx.stroke(); }
  if (c.style === 'puffs') { const dx = dir === 1 ? 3 : dir === 2 ? -3 : 0; blob(ctx, hx - 8 + dx, hy - 9, 5.5, 5.5, h); blob(ctx, hx + 8 + dx, hy - 9, 5.5, 5.5, h); }
  if (c.style === 'curly' && dir === 3) { for (let i = 0; i < 7; i++) blob(ctx, hx - 8 + i * 2.7, hy + 5, 3, 3, h); }
}
function hairFront(ctx, c, dir, hx, hy) {
  const h = c.hair, o = ol(h);
  const fs = () => { ctx.fillStyle = h; ctx.fill(); ctx.lineWidth = LW; ctx.strokeStyle = o; ctx.stroke(); };
  if (dir === 3) { // costas: cabelo cobre a nuca
    ctx.beginPath(); ctx.arc(hx, hy, 9.6, Math.PI * 0.95, Math.PI * 2.05); ctx.quadraticCurveTo(hx + 10, hy + 6, hx, hy + 7.5); ctx.quadraticCurveTo(hx - 10, hy + 6, hx - 9.6, hy + 1); fs();
    if (c.style === 'spiky') for (let i = 0; i < 5; i++) { ctx.beginPath(); ctx.moveTo(hx - 8 + i * 4, hy - 7); ctx.lineTo(hx - 6 + i * 4, hy - 13); ctx.lineTo(hx - 4 + i * 4, hy - 7); fs(); }
    if (c.style === 'bob') { ctx.beginPath(); ctx.moveTo(hx - 10, hy); ctx.lineTo(hx - 10, hy + 7); ctx.lineTo(hx + 10, hy + 7); ctx.lineTo(hx + 10, hy); fs(); }
    if (c.style === 'long') { ctx.beginPath(); ctx.moveTo(hx - 9, hy); ctx.quadraticCurveTo(hx - 10, hy + 14, hx, hy + 16); ctx.quadraticCurveTo(hx + 10, hy + 14, hx + 9, hy); fs(); }
    if (c.style === 'beard') { ctx.beginPath(); ctx.arc(hx, hy + 1, 9.2, Math.PI * 0.1, Math.PI * 0.9); fs(); }
    return;
  }
  const side = dir === 1 ? -1 : dir === 2 ? 1 : 0;
  switch (c.style) {
    case 'long': case 'bob':
      ctx.beginPath(); ctx.arc(hx, hy - 0.5, 10, Math.PI * 1.02, Math.PI * 1.98);
      ctx.quadraticCurveTo(hx + 6 - side * 4, hy - 6, hx + 1 - side * 3, hy - 3);
      ctx.quadraticCurveTo(hx - 4 - side * 3, hy - 7, hx - 10, hy - 1); fs();
      if (side === 0) { ctx.beginPath(); ctx.moveTo(hx - 10, hy - 1); ctx.quadraticCurveTo(hx - 11, hy + (c.style === 'bob' ? 7 : 10), hx - 7.5, hy + (c.style === 'bob' ? 7 : 12)); ctx.lineTo(hx - 8, hy - 1); fs(); ctx.beginPath(); ctx.moveTo(hx + 10, hy - 1); ctx.quadraticCurveTo(hx + 11, hy + (c.style === 'bob' ? 7 : 10), hx + 7.5, hy + (c.style === 'bob' ? 7 : 12)); ctx.lineTo(hx + 8, hy - 1); fs(); }
      else { ctx.beginPath(); ctx.moveTo(hx - side * 9, hy - 3); ctx.quadraticCurveTo(hx - side * 12, hy + 8, hx - side * 5, hy + (c.style === 'bob' ? 7 : 13)); ctx.lineTo(hx - side * 3, hy - 4); fs(); }
      break;
    case 'curly':
      for (let i = 0; i < 8; i++) { const a = Math.PI * (1.0 + i / 7); blob(ctx, hx + Math.cos(a) * 8.5 + side * 1.5, hy - 1 + Math.sin(a) * 8, 3.6, 3.6, h); }
      blob(ctx, hx + side * 2, hy - 8.5, 5, 3.6, h);
      break;
    case 'spiky':
      ctx.beginPath(); ctx.arc(hx, hy - 0.5, 9.8, Math.PI * 1.05, Math.PI * 1.95); ctx.lineTo(hx + 9, hy - 3);
      for (let i = 0; i < 5; i++) { ctx.lineTo(hx + 7 - i * 4 + side * 2, hy - 1 - (i % 2) * 3); ctx.lineTo(hx + 5 - i * 4 + side * 2, hy - 5); }
      ctx.closePath(); fs();
      for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.moveTo(hx - 7 + i * 4.5, hy - 8); ctx.lineTo(hx - 6 + i * 4.5 - side * 2, hy - 14); ctx.lineTo(hx - 3 + i * 4.5, hy - 8); fs(); }
      break;
    case 'puffs':
      ctx.beginPath(); ctx.arc(hx, hy - 0.5, 9.9, Math.PI * 1.05, Math.PI * 1.95); ctx.quadraticCurveTo(hx, hy - 5, hx - 9.6, hy - 2); fs();
      break;
    case 'beard':
      ctx.beginPath(); ctx.arc(hx, hy - 0.5, 9.9, Math.PI * 1.15, Math.PI * 1.85); ctx.quadraticCurveTo(hx, hy - 7, hx - 8.8, hy - 4.5); fs();
      // barba
      if (side === 0) { ctx.beginPath(); ctx.moveTo(hx - 7.5, hy + 1); ctx.quadraticCurveTo(hx - 7, hy + 11, hx, hy + 12); ctx.quadraticCurveTo(hx + 7, hy + 11, hx + 7.5, hy + 1); ctx.quadraticCurveTo(hx, hy + 5, hx - 7.5, hy + 1); fs(); }
      else { ctx.beginPath(); ctx.moveTo(hx + side * 2, hy + 2); ctx.quadraticCurveTo(hx + side * 8, hy + 10, hx + side * 1, hy + 11); ctx.quadraticCurveTo(hx - side * 5, hy + 9, hx - side * 4, hy + 2); fs(); }
      break;
  }
}

function face(ctx, c, dir, hx, hy, blink) {
  if (dir === 3) return;
  const side = dir === 1 ? -1 : dir === 2 ? 1 : 0;
  const eyeY = hy + 1.5;
  const eyes = side === 0 ? [hx - 3.6, hx + 3.6] : [hx + side * 4.5];
  for (const ex of eyes) {
    if (blink) { ctx.beginPath(); ctx.moveTo(ex - 1.6, eyeY); ctx.lineTo(ex + 1.6, eyeY); ctx.lineWidth = 1.1; ctx.strokeStyle = '#2a1d1a'; ctx.stroke(); continue; }
    ellipse(ctx, ex, eyeY, 1.55, 2.1); ctx.fillStyle = '#2a1d1a'; ctx.fill();
    ellipse(ctx, ex + 0.5, eyeY - 0.8, 0.6, 0.6); ctx.fillStyle = '#ffffff'; ctx.fill();
  }
  // bochechas
  ctx.fillStyle = 'rgba(255,110,110,0.28)';
  if (side === 0) { ellipse(ctx, hx - 6, hy + 4.5, 2, 1.3); ctx.fill(); ellipse(ctx, hx + 6, hy + 4.5, 2, 1.3); ctx.fill(); }
  else { ellipse(ctx, hx + side * 2.5, hy + 4.5, 2, 1.3); ctx.fill(); }
  // boca
  ctx.beginPath();
  if (side === 0) ctx.arc(hx, hy + 4.6, 1.6, 0.15 * Math.PI, 0.85 * Math.PI);
  else ctx.arc(hx + side * 6, hy + 4.8, 1.3, side > 0 ? 0.1 * Math.PI : 0.4 * Math.PI, side > 0 ? 0.6 * Math.PI : 0.9 * Math.PI);
  ctx.lineWidth = 1; ctx.strokeStyle = '#7a3a2a'; ctx.stroke();
  if (c.acc === 'freckles') { ctx.fillStyle = 'rgba(160,90,50,0.6)'; for (const dx of side === 0 ? [-6.5, -5, 5, 6.5] : [side * 2, side * 3.5]) { ctx.beginPath(); ctx.arc(hx + dx, hy + 3, 0.45, 0, TAU); ctx.fill(); } }
  if (c.style === 'beard') { ctx.beginPath(); for (const ex of eyes) { ctx.moveTo(ex - 2.2, eyeY - 3.4); ctx.lineTo(ex + 2.2, eyeY - 3); } ctx.lineWidth = 1.6; ctx.strokeStyle = '#d8d8e2'; ctx.stroke(); }
}

function accessory(ctx, c, dir, hx, hy) {
  const side = dir === 1 ? -1 : dir === 2 ? 1 : 0;
  if (c.acc === 'glasses' && dir !== 3) {
    ctx.lineWidth = 1; ctx.strokeStyle = '#2b2b33';
    const eyes = side === 0 ? [hx - 3.6, hx + 3.6] : [hx + side * 4.5];
    for (const ex of eyes) { ctx.beginPath(); ctx.arc(ex, hy + 1.5, 2.6, 0, TAU); ctx.stroke(); ctx.fillStyle = 'rgba(200,240,255,.25)'; ctx.fill(); }
    if (side === 0) { ctx.beginPath(); ctx.moveTo(hx - 1, hy + 1.2); ctx.lineTo(hx + 1, hy + 1.2); ctx.stroke(); }
  }
  if (c.acc === 'flower') { const fx = dir === 3 ? hx + 6 : side === 0 ? hx + 7 : hx - side * 5, fy = hy - 5; for (let i = 0; i < 5; i++) { const a = (i / 5) * TAU; blob(ctx, fx + Math.cos(a) * 2, fy + Math.sin(a) * 2, 1.7, 1.7, c.accColor); } blob(ctx, fx, fy, 1.2, 1.2, '#ffe066'); }
  if (c.acc === 'freckles' && dir !== 3) { const fx = side === 0 ? hx - 7 : hx - side * 6; blob(ctx, fx, hy - 5, 1.8, 1.8, c.accColor); }
  if (c.acc === 'earrings' && dir !== 3) { ctx.lineWidth = 1.1; ctx.strokeStyle = c.accColor; const xs = side === 0 ? [hx - 9.4, hx + 9.4] : [hx - side * 1]; for (const x of xs) { ctx.beginPath(); ctx.arc(x, hy + 6, 2, 0, TAU); ctx.stroke(); } }
}

// ───────── Chapéus cosméticos ─────────
export function drawHat(ctx, hat, dir, hx, hy) {
  if (!hat) return;
  const side = dir === 1 ? -1 : dir === 2 ? 1 : 0;
  const fsx = (col) => { ctx.fillStyle = col; ctx.fill(); ctx.lineWidth = LW; ctx.strokeStyle = ol(col); ctx.stroke(); };
  switch (hat) {
    case 'chapeu_palha':
      ellipse(ctx, hx, hy - 6, 15, 5.5); fsx('#ecc96e');
      ctx.beginPath(); ctx.arc(hx, hy - 7, 8, Math.PI, TAU); ctx.closePath(); fsx('#f1d27d');
      ctx.fillStyle = '#d6455a'; ctx.fillRect(hx - 8, hy - 9, 16, 2.4);
      break;
    case 'chapeu_explorador':
      ellipse(ctx, hx, hy - 6, 13, 4.6); fsx('#b49c68');
      ctx.beginPath(); ctx.ellipse(hx, hy - 8, 9, 7.5, 0, Math.PI, TAU); ctx.closePath(); fsx('#c8b07b');
      ctx.fillStyle = '#6b5a3a'; ctx.fillRect(hx - 9, hy - 8.5, 18, 1.8);
      break;
    case 'gorro_la':
      ctx.beginPath(); ctx.arc(hx, hy - 4, 10, Math.PI * 1.02, Math.PI * 1.98); ctx.lineTo(hx + 10, hy - 2); ctx.lineTo(hx - 10, hy - 2); ctx.closePath(); fsx('#d6455a');
      ctx.fillStyle = '#f4f4f4'; ctx.fillRect(hx - 10.5, hy - 4.5, 21, 3.5); ctx.strokeStyle = '#b9b9c4'; ctx.lineWidth = LW; ctx.strokeRect(hx - 10.5, hy - 4.5, 21, 3.5);
      ellipse(ctx, hx, hy - 15, 3.4, 3.4); fsx('#ffffff');
      break;
    case 'bandana_brasa':
      ctx.beginPath(); ctx.arc(hx, hy - 1, 10.2, Math.PI * 1.05, Math.PI * 1.95); ctx.quadraticCurveTo(hx, hy - 5, hx - 9.8, hy - 4); fsx('#ff6a2a');
      ctx.fillStyle = '#fff1d6'; for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.arc(hx - 5 + i * 3.4, hy - 6.5, 0.8, 0, TAU); ctx.fill(); }
      if (dir !== 0) { const tx = side === 0 ? hx : hx - side * 9; ctx.beginPath(); ctx.moveTo(tx, hy - 4); ctx.lineTo(tx - side * 5 - 2, hy + 1); ctx.lineTo(tx - side * 2 + 2, hy + 2); ctx.closePath(); fsx('#ff6a2a'); }
      break;
    case 'tiara_cristal':
      ctx.beginPath(); ctx.arc(hx, hy - 2, 9.6, Math.PI * 1.15, Math.PI * 1.85); ctx.lineWidth = 2; ctx.strokeStyle = '#c9b4ff'; ctx.stroke();
      for (const [dx, hh] of [[-5, 4], [0, 6.5], [5, 4]]) { ctx.beginPath(); ctx.moveTo(hx + dx - 2, hy - 9); ctx.lineTo(hx + dx, hy - 9 - hh); ctx.lineTo(hx + dx + 2, hy - 9); ctx.closePath(); fsx('#b79bff'); ctx.fillStyle = 'rgba(255,255,255,.7)'; ctx.fillRect(hx + dx - 0.4, hy - 9 - hh * 0.7, 0.8, hh * 0.5); }
      break;
    case 'bone_capitao':
      ctx.beginPath(); ctx.ellipse(hx, hy - 8, 10.5, 5.5, 0, 0, TAU); fsx('#f6f6f6');
      ctx.fillStyle = '#2b2f3a'; ctx.fillRect(hx - 10, hy - 6.5, 20, 2.6);
      if (dir !== 3) { ctx.beginPath(); ctx.ellipse(hx + side * 4, hy - 3.5, 7, 2.6, 0, 0, Math.PI); fsx('#2b2f3a'); ctx.beginPath(); ctx.arc(hx + side * 2, hy - 9, 1.8, 0, TAU); ctx.fillStyle = '#ffd23f'; ctx.fill(); }
      break;
  }
}

// ───────── Corpo ─────────
function torso(ctx, c, dir, bob) {
  const y0 = -21 + bob, y1 = -8 + bob;
  const side = dir === 1 || dir === 2;
  const w = side ? 6 : 7.5;
  const shirt = c.shirt;
  ctx.beginPath();
  ctx.moveTo(-w + 1, y0); ctx.lineTo(w - 1, y0); ctx.quadraticCurveTo(w + 1, y0 + 2, w + 0.5, y1);
  ctx.lineTo(-w - 0.5, y1); ctx.quadraticCurveTo(-w - 1, y0 + 2, -w + 1, y0); ctx.closePath();
  ctx.fillStyle = shirt; ctx.fill();
  ctx.save(); ctx.clip();
  switch (c.outfit) {
    case 'stripes': ctx.fillStyle = c.shirt2; for (let y = y0 + 2; y < y1; y += 4) ctx.fillRect(-w - 2, y, w * 2 + 4, 1.8); break;
    case 'overalls': ctx.fillStyle = c.shirt2; ctx.fillRect(-w + 1.5, y0 + 5, w * 2 - 3, y1 - y0); if (dir !== 3) { ctx.fillRect(-w + 1.5, y0, 2, 6); ctx.fillRect(w - 3.5, y0, 2, 6); ctx.fillStyle = '#ffd23f'; ctx.fillRect(-w + 2, y0 + 5, 1.2, 1.2); ctx.fillRect(w - 3, y0 + 5, 1.2, 1.2); } break;
    case 'jacket': if (dir !== 3) { ctx.fillStyle = shade(shirt, -0.12); ctx.fillRect(-0.8, y0, 1.6, y1 - y0); ctx.fillStyle = '#ffffff'; ctx.fillRect(-2.5, y0, 5, 3); } break;
    case 'dress': ctx.fillStyle = c.shirt2; ctx.fillRect(-w - 2, y0 + 8, w * 2 + 4, 6); break;
    case 'vest': ctx.fillStyle = c.shirt2; if (dir !== 3) { ctx.fillRect(-w - 2, y0, w - 0.5, y1 - y0); ctx.fillRect(1.5, y0, w + 1, y1 - y0); ctx.fillStyle = shade(c.shirt2, -0.25); ctx.fillRect(-w + 1, y0 + 6, 3, 2.5); ctx.fillRect(w - 4, y0 + 6, 3, 2.5); } else ctx.fillRect(-w - 2, y0, w * 2 + 4, y1 - y0); break;
    case 'tank': ctx.fillStyle = c.shirt2; ctx.fillRect(-w - 2, y0 + 7, w * 2 + 4, 1.5); break;
  }
  ctx.restore();
  ctx.lineWidth = LW; ctx.strokeStyle = ol(shirt); ctx.stroke();
  if (c.acc === 'scarf') {
    ctx.beginPath(); ctx.ellipse(0, y0 + 0.5, w + 0.5, 2.6, 0, 0, TAU); ctx.fillStyle = c.shirt2; ctx.fill(); ctx.lineWidth = LW; ctx.strokeStyle = ol(c.shirt2); ctx.stroke();
    if (dir !== 0) { const sx = dir === 1 ? 4 : dir === 2 ? -4 : 2; ctx.beginPath(); ctx.moveTo(sx, y0 + 1); ctx.lineTo(sx + (dir === 1 ? 4 : dir === 2 ? -4 : 1), y0 + 8); ctx.lineTo(sx + (dir === 1 ? 1 : dir === 2 ? -1 : 4), y0 + 8); ctx.closePath(); ctx.fill(); ctx.stroke(); }
  }
}

function legs(ctx, c, dir, phase, moving) {
  const pants = c.outfit === 'dress' ? c.skin : c.pants;
  const s = moving ? Math.sin(phase * Math.PI / 2) : 0;
  if (dir === 1 || dir === 2) {
    const k = dir === 2 ? 1 : -1;
    limb(ctx, 0, -10, s * 4 * k, -2, 4.6, pants);
    limb(ctx, 0, -10, -s * 4 * k, -2, 4.6, shade(pants, -0.08));
    blob(ctx, s * 4 * k + k * 1.2, -1.2, 3, 1.8, c.shoes);
    blob(ctx, -s * 4 * k + k * 1.2, -1.2, 3, 1.8, shade(c.shoes, -0.1));
  } else {
    const l = moving ? s * 2 : 0;
    limb(ctx, -3, -10, -3, -2.5 - l, 4.6, pants);
    limb(ctx, 3, -10, 3, -2.5 + l, 4.6, pants);
    blob(ctx, -3, -1.6 - l, 2.8, 1.9, c.shoes);
    blob(ctx, 3, -1.6 + l, 2.8, 1.9, c.shoes);
  }
  if (c.outfit === 'dress') { ctx.beginPath(); ctx.moveTo(-7.5, -12); ctx.lineTo(7.5, -12); ctx.lineTo(9, -6); ctx.lineTo(-9, -6); ctx.closePath(); ctx.fillStyle = c.shirt2; ctx.fill(); ctx.lineWidth = LW; ctx.strokeStyle = ol(c.shirt2); ctx.stroke(); }
}

export function shoulders(dir, bob = 0) {
  if (dir === 1) return [[2, -19 + bob], [-1, -19 + bob]];
  if (dir === 2) return [[-2, -19 + bob], [1, -19 + bob]];
  return [[-7.6, -19 + bob], [7.6, -19 + bob]];
}

function swingArms(ctx, c, dir, phase, moving, bob, which) {
  const s = moving ? Math.sin(phase * Math.PI / 2) : 0;
  const [L, R] = shoulders(dir, bob);
  const sleeve = c.outfit === 'tank' ? c.skin : c.outfit === 'vest' ? c.shirt : c.shirt;
  const arm = (sx, sy, hx, hy) => { limb(ctx, sx, sy, hx, hy, 3.6, sleeve); blob(ctx, hx, hy, 2.1, 2.1, c.skin); };
  if (dir === 1 || dir === 2) {
    const k = dir === 2 ? 1 : -1;
    if (which === 'back') arm(R[0], R[1], R[0] - s * 4 * k, R[1] + 8);
    else arm(L[0], L[1], L[0] + s * 4 * k, L[1] + 8);
  } else if (which === 'front') {
    arm(L[0], L[1], L[0] - 1.5, L[1] + 8 + s * 1.5);
    arm(R[0], R[1], R[0] + 1.5, R[1] + 8 - s * 1.5);
  }
}

// Braços segurando a vara: do ombro até o ponto da mão (coordenadas locais)
export function drawHoldArms(ctx, c, dir, hand, bob = 0) {
  const [L, R] = shoulders(dir, bob);
  const sleeve = c.outfit === 'tank' ? c.skin : c.shirt;
  const arms = dir === 1 || dir === 2 ? [L] : [L, R];
  for (const [sx, sy] of arms) {
    const mx = (sx + hand.x) / 2, my = (sy + hand.y) / 2 + 2;
    ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(sx, sy); ctx.quadraticCurveTo(mx, my, hand.x, hand.y);
    ctx.lineWidth = 3.6 + LW * 2; ctx.strokeStyle = ol(sleeve); ctx.stroke();
    ctx.lineWidth = 3.6; ctx.strokeStyle = sleeve; ctx.stroke();
  }
  blob(ctx, hand.x, hand.y, 2.4, 2.4, c.skin);
}

// opts: dir, phase (0..3), moving, pose: 'swing' | 'hold' | 'up' | 'sit', hat, blink
export function drawCharacter(ctx, c, opts) {
  const dir = opts.dir ?? 0;
  const phase = opts.phase ?? 0;
  const moving = !!opts.moving;
  const bob = moving ? -Math.abs(Math.sin(phase * Math.PI / 2)) * 1.2 : (opts.breath ? -0.6 : 0);
  const sit = opts.pose === 'sit';
  const hx = 0, hy = -31 + bob + (sit ? 4 : 0);
  ctx.save();
  ctx.lineJoin = 'round';
  if (sit) ctx.translate(0, 4);
  // cabelo de trás (fica atrás do corpo quando olhando para baixo/lados)
  if (dir !== 3) hairBack(ctx, c, dir, hx, hy - (sit ? 4 : 0));
  if (!sit) legs(ctx, c, dir, phase, moving);
  const armsOut = opts.pose === 'swing' || opts.pose === 'sit';
  if (armsOut && (dir === 1 || dir === 2)) swingArms(ctx, c, dir, phase, moving, bob, 'back');
  torso(ctx, c, dir, bob);
  if (armsOut) swingArms(ctx, c, dir, phase, moving, bob, 'front');
  if (opts.pose === 'up') { // segurando algo acima da cabeça
    const [L, R] = shoulders(dir, bob);
    const arms = dir === 1 || dir === 2 ? [L] : [L, R];
    for (const [sx, sy] of arms) { limb(ctx, sx, sy, sx * 0.6, sy - 13, 3.6, c.outfit === 'tank' ? c.skin : c.shirt); blob(ctx, sx * 0.6, sy - 13, 2.2, 2.2, c.skin); }
  }
  // cabeça
  const hy2 = hy - (sit ? 4 : 0);
  if (dir === 3) hairBack(ctx, c, dir, hx, hy2);
  blob(ctx, hx, hy2, 10, 9.6, c.skin);
  if (dir === 1 || dir === 2) { // orelha
    blob(ctx, hx - (dir === 2 ? 3 : -3), hy2 + 1.5, 1.8, 2.3, shade(c.skin, -0.05));
  }
  face(ctx, c, dir, hx, hy2, opts.blink);
  hairFront(ctx, c, dir, hx, hy2);
  accessory(ctx, c, dir, hx, hy2);
  drawHat(ctx, opts.hat, dir, hx, hy2);
  ctx.restore();
}

// ───────── Cache de quadros (atlas por personagem) ─────────
const SCALE = 2.5;
const FW = 46, FH = 62, AX = 23, AY = 54; // tamanho do quadro e âncora (pés)
const MAX_FRAMES = 500; // limite do cache (LRU) — evita crescimento contínuo de memória
const frameCache = new Map();
export function charFrame(charId, opts) {
  // normaliza estados que não mudam o desenho para reaproveitar quadros
  const moving = opts.moving && opts.pose === 'swing';
  const phase = moving ? opts.phase | 0 : 0;
  const breath = !moving && opts.pose === 'swing' && opts.breath;
  const blink = opts.dir !== 3 && opts.blink;
  const key = `${charId}|${opts.dir}|${phase}|${moving ? 1 : 0}|${opts.pose}|${opts.hat || ''}|${blink ? 1 : 0}|${breath ? 1 : 0}`;
  let f = frameCache.get(key);
  if (f) { frameCache.delete(key); frameCache.set(key, f); return f; }
  opts = { ...opts, moving, phase, breath, blink };
  if (!f) {
    const cv = makeCanvas(FW * SCALE, FH * SCALE);
    const ctx = cv.getContext('2d');
    ctx.scale(SCALE, SCALE);
    ctx.translate(AX, AY);
    drawCharacter(ctx, CHARACTERS[charId], opts);
    f = cv;
    frameCache.set(key, f);
    if (frameCache.size > MAX_FRAMES) { const k0 = frameCache.keys().next().value; const c0 = frameCache.get(k0); c0.width = c0.height = 1; frameCache.delete(k0); }
  }
  return f;
}
export function charCacheSize() { return frameCache.size; }
export function drawCharFrame(ctx, charId, x, y, opts) {
  const f = charFrame(charId, opts);
  ctx.drawImage(f, x - AX, y - AY, FW, FH);
}
export function clearCharCache() { frameCache.clear(); }
