// Barquinho com motor de popa, visto de cima. Proa aponta para +x antes da rotação.
import { shade, roundRect, ellipse, TAU } from './util.js';
import { COSMETICS } from '/shared/items.js';

const PAINT_DEFAULT = { hull: '#f2ead6', stripe: '#3aa6c4' };
export function boatColors(paintId) {
  if (!paintId) return PAINT_DEFAULT;
  const c = COSMETICS[paintId]?.color || PAINT_DEFAULT.hull;
  return { hull: c, stripe: paintId === 'pintura_basalto' ? '#ff7a2a' : shade(c, 0.55) };
}

function hullPath(ctx, L, W) {
  ctx.beginPath();
  ctx.moveTo(L * 0.52, 0);
  ctx.quadraticCurveTo(L * 0.36, -W * 0.52, 0, -W * 0.5);
  ctx.lineTo(-L * 0.44, -W * 0.44);
  ctx.quadraticCurveTo(-L * 0.5, 0, -L * 0.44, W * 0.44);
  ctx.lineTo(0, W * 0.5);
  ctx.quadraticCurveTo(L * 0.36, W * 0.52, L * 0.52, 0);
  ctx.closePath();
}

// Desenha só o casco (a pessoa sentada é desenhada à parte, de pé na tela)
export function drawBoatHull(ctx, x, y, a, paintId, flagId, t, speed = 0) {
  const L = 58, W = 26;
  const { hull, stripe } = boatColors(paintId);
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(a);
  // sombra/reflexo
  ctx.save(); ctx.translate(3, 5); hullPath(ctx, L, W); ctx.fillStyle = 'rgba(0,30,50,0.25)'; ctx.fill(); ctx.restore();
  hullPath(ctx, L, W);
  ctx.fillStyle = hull; ctx.fill();
  ctx.lineWidth = 1.6; ctx.strokeStyle = shade(hull, -0.6); ctx.stroke();
  // faixa
  ctx.save(); hullPath(ctx, L, W); ctx.clip();
  ctx.lineWidth = 4; ctx.strokeStyle = stripe; hullPath(ctx, L - 2, W - 2); ctx.stroke();
  ctx.restore();
  // interior (madeira)
  ctx.beginPath();
  ctx.moveTo(L * 0.42, 0);
  ctx.quadraticCurveTo(L * 0.3, -W * 0.38, 0, -W * 0.36);
  ctx.lineTo(-L * 0.38, -W * 0.32);
  ctx.quadraticCurveTo(-L * 0.42, 0, -L * 0.38, W * 0.32);
  ctx.lineTo(0, W * 0.36);
  ctx.quadraticCurveTo(L * 0.3, W * 0.38, L * 0.42, 0);
  ctx.closePath();
  ctx.fillStyle = '#b5814a'; ctx.fill();
  ctx.strokeStyle = 'rgba(80,45,15,.45)'; ctx.lineWidth = 0.9;
  for (let k = -2; k <= 2; k++) { ctx.beginPath(); ctx.moveTo(-L * 0.38, k * 4); ctx.lineTo(L * 0.38, k * 4 * 0.7); ctx.stroke(); }
  // bancos
  for (const bx of [-8, 12]) { roundRect(ctx, bx - 3, -W * 0.36, 6, W * 0.72, 1.5); ctx.fillStyle = '#d9a467'; ctx.fill(); ctx.strokeStyle = '#7a4a22'; ctx.lineWidth = 1; ctx.stroke(); }
  // motor de popa
  roundRect(ctx, -L * 0.56, -5, 9, 10, 2.5); ctx.fillStyle = '#3a3f4a'; ctx.fill(); ctx.strokeStyle = '#15171c'; ctx.lineWidth = 1.2; ctx.stroke();
  ctx.fillStyle = '#ff7a59'; ctx.fillRect(-L * 0.56 + 2, -2, 5, 4);
  if (speed > 20) { // hélice girando
    const s = Math.sin(t * 40) * 4;
    ctx.beginPath(); ctx.moveTo(-L * 0.6, -s); ctx.lineTo(-L * 0.6, s); ctx.lineWidth = 2; ctx.strokeStyle = 'rgba(255,255,255,.7)'; ctx.stroke();
  }
  // mastro e bandeira
  if (flagId) {
    const fx = -L * 0.3, fy = -W * 0.28;
    ctx.beginPath(); ctx.arc(fx, fy, 1.8, 0, TAU); ctx.fillStyle = '#6e4524'; ctx.fill();
    const wave = Math.sin(t * 6) * 2;
    ctx.beginPath(); ctx.moveTo(fx, fy); ctx.quadraticCurveTo(fx - 6, fy - 4 + wave, fx - 13, fy - 3 + wave * 1.4); ctx.lineTo(fx - 12, fy + 4 + wave); ctx.quadraticCurveTo(fx - 6, fy + 3 + wave * 0.6, fx, fy + 3); ctx.closePath();
    ctx.fillStyle = COSMETICS[flagId]?.color || '#ffd23f'; ctx.fill(); ctx.strokeStyle = shade(ctx.fillStyle, -0.5); ctx.lineWidth = 0.9; ctx.stroke();
    if (flagId === 'bandeira_peixe') { ellipse(ctx, fx - 6.5, fy + 0.5 + wave * 0.8, 2.4, 1.4); ctx.fillStyle = '#ff6f4a'; ctx.fill(); }
    if (flagId === 'bandeira_estrela') { ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.arc(fx - 6.5, fy + 0.5 + wave * 0.8, 1.5, 0, TAU); ctx.fill(); }
  }
  ctx.restore();
}

// Boia de amarração (decoração do cais)
export function drawMooringPost(ctx, x, y, t) {
  const b = Math.sin(t * 2) * 0.8;
  ellipse(ctx, x, y + 2 + b, 5, 3); ctx.fillStyle = 'rgba(255,255,255,.35)'; ctx.fill();
  ctx.beginPath(); ctx.arc(x, y + b, 4, 0, TAU); ctx.fillStyle = '#ff6f4a'; ctx.fill(); ctx.strokeStyle = '#8a2a1a'; ctx.lineWidth = 1; ctx.stroke();
  ctx.fillStyle = '#ffffff'; ctx.fillRect(x - 4, y + b - 1, 8, 2);
}
