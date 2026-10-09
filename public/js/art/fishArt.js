// Arte procedural dos 50 peixes. Uma única função desenha cada espécie a partir de
// `species.art`; o sprite do mundo, o ícone e a imagem da coleção usam a mesma
// geometria, só mudando o tamanho e a espessura do contorno — por isso são consistentes.

import { SPECIES_BY_ID } from '/shared/fish.js';
import { shade, mix, rgba, makeCanvas, rng, TAU } from './util.js';

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

// ───────────── Geometria do corpo ─────────────
function buildGeom(art) {
  const [aspect, hump, headBlunt, stalk, bellyR] = art.shape;
  const Hh = 0.5 / aspect;
  const longBody = aspect >= 6;
  const waveA = longBody ? Math.min(0.11, 0.025 * (aspect - 5)) : 0;
  const waves = longBody ? 1.15 : 0;
  const tm = clamp(1 - hump, 0.2, 0.85);
  const p = 1.4 + headBlunt * 2.8;
  const f = (t) => {
    if (t <= tm) {
      const u = t / tm;
      return stalk + (1 - stalk) * Math.pow(Math.sin((Math.PI / 2) * u), 1.25);
    }
    const u = (t - tm) / (1 - tm);
    return Math.pow(Math.max(0, 1 - Math.pow(u, p)), 0.55 + (1 - headBlunt) * 0.35);
  };
  const P = (t) => ({ x: t - 0.5, y: waveA * Math.sin(TAU * waves * t + 0.6) });
  const T = (t) => {
    const a = P(t - 0.002), b = P(t + 0.002);
    const dx = b.x - a.x, dy = b.y - a.y, L = Math.hypot(dx, dy) || 1;
    return { x: dx / L, y: dy / L };
  };
  const N = (t) => { const tt = T(t); return { x: tt.y, y: -tt.x }; }; // aponta para "cima" (dorso)
  const up = (t) => Hh * f(t);
  const lo = (t) => Hh * bellyR * f(t);
  // ponto no sistema do corpo: v=+1 dorso, v=-1 ventre
  const at = (t, v) => {
    const c = P(t), n = N(t);
    const h = v >= 0 ? up(t) * v : lo(t) * v;
    return { x: c.x + n.x * h, y: c.y + n.y * h };
  };
  const out = (t, side, d) => { // ponto fora do corpo, d unidades além da borda
    const e = at(t, side), n = N(t);
    return { x: e.x + n.x * d * side, y: e.y + n.y * d * side };
  };
  return { aspect, Hh, bellyR, headBlunt, stalk, P, T, N, up, lo, at, out, longBody };
}

function bodyPath(ctx, g, n = 56) {
  ctx.beginPath();
  for (let i = 0; i <= n; i++) { const p = g.at(i / n, 1); i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y); }
  for (let i = n; i >= 0; i--) { const p = g.at(i / n, -1); ctx.lineTo(p.x, p.y); }
  ctx.closePath();
}

// Nadadeira ao longo do dorso (side=1) ou ventre (side=-1)
function edgeFin(ctx, g, side, t0, t1, h, style = 'round', opt = {}) {
  const n = 18;
  const pts = [];
  for (let i = 0; i <= n; i++) pts.push(g.at(t0 + ((t1 - t0) * i) / n, side * 0.92));
  const outer = [];
  for (let i = n; i >= 0; i--) {
    const u = i / n; // 0 = traseira, 1 = frente
    let k;
    switch (style) {
      case 'tri': k = u < 0.7 ? u / 0.7 : (1 - u) / 0.3 * 0.9 + 0.1; k = Math.pow(clamp(k, 0, 1), 0.8); break;
      case 'triBack': k = u < 0.3 ? u / 0.3 : 1 - (u - 0.3) / 0.7; break;
      case 'flat': k = Math.min(1, u * 6, (1 - u) * 6); break;
      case 'wave': k = Math.min(1, u * 5, (1 - u) * 5) * (0.75 + 0.25 * Math.sin(u * 14)); break;
      case 'spikes': { const s = (u * (opt.spikes || 7)) % 1; k = Math.min(1, u * 4, (1 - u) * 3) * (s < 0.5 ? 0.55 + s * 0.9 : 1 - (s - 0.5) * 0.9); break; }
      case 'flame': k = Math.min(1, u * 3, (1 - u) * 2.5) * (0.6 + 0.4 * Math.abs(Math.sin(u * 9.5 + 0.4))); break;
      case 'shark': k = u < 0.75 ? Math.pow(u / 0.75, 0.7) : (1 - u) / 0.25; break;
      case 'sail': k = Math.pow(Math.sin(Math.PI * Math.min(1, u * 1.05)), 0.6); break;
      default: k = Math.sin(Math.PI * u);
    }
    const t = t0 + (t1 - t0) * u;
    const lean = (opt.lean ?? 0.35) * h * k;
    const e = g.at(t, side * 0.92), nn = g.N(t), tt = g.T(t);
    outer.push({ x: e.x + nn.x * h * k * side - tt.x * lean, y: e.y + nn.y * h * k * side - tt.y * lean });
  }
  ctx.beginPath();
  pts.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
  outer.forEach((p) => ctx.lineTo(p.x, p.y));
  ctx.closePath();
  return { pts, outer };
}

function finRays(ctx, base, outer, color, lw) {
  ctx.save();
  ctx.strokeStyle = color; ctx.lineWidth = lw; ctx.globalAlpha *= 0.55;
  const n = Math.min(base.length, outer.length);
  for (let i = 2; i < n - 1; i += 2) {
    const b = base[i], o = outer[n - 1 - i];
    ctx.beginPath(); ctx.moveTo(b.x, b.y); ctx.lineTo(b.x + (o.x - b.x) * 0.9, b.y + (o.y - b.y) * 0.9); ctx.stroke();
  }
  ctx.restore();
}

// Desenha uma forma em coordenadas locais (base, eixo para trás d, eixo para cima n)
function localPoly(ctx, base, d, n, pts) {
  ctx.beginPath();
  pts.forEach(([a, b], i) => {
    const x = base.x + d.x * a + n.x * b, y = base.y + d.y * a + n.y * b;
    i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
  });
  ctx.closePath();
}
function localCurve(ctx, base, d, n, cmds) {
  const L = ([a, b]) => [base.x + d.x * a + n.x * b, base.y + d.y * a + n.y * b];
  ctx.beginPath();
  for (const c of cmds) {
    if (c[0] === 'M') ctx.moveTo(...L(c[1]));
    else if (c[0] === 'L') ctx.lineTo(...L(c[1]));
    else if (c[0] === 'Q') ctx.quadraticCurveTo(...L(c[1]), ...L(c[2]));
    else if (c[0] === 'C') ctx.bezierCurveTo(...L(c[1]), ...L(c[2]), ...L(c[3]));
  }
  ctx.closePath();
}

// ───────────── Cauda ─────────────
function drawTail(ctx, g, art, C, lw, R) {
  const base = g.P(0), tt = g.T(0);
  const d = { x: -tt.x, y: -tt.y }, n = { x: tt.y, y: -tt.x };
  const s = g.stalk * g.Hh;
  const tl = clamp(g.Hh * 1.7, 0.1, 0.26);
  const fin = C.fin, ol = C.finOl;
  const draw = (alpha = 0.95) => {
    ctx.globalAlpha = alpha; ctx.fillStyle = fin; ctx.fill(); ctx.globalAlpha = 1;
    ctx.lineWidth = lw; ctx.strokeStyle = ol; ctx.stroke();
    // raios da nadadeira, recortados pelo contorno da cauda
    ctx.save(); ctx.clip(); ctx.strokeStyle = rgba(ol, 0.35); ctx.lineWidth = lw * 0.55;
    for (let i = -3; i <= 3; i++) { const a = i * 0.22; ctx.beginPath(); ctx.moveTo(base.x, base.y); ctx.lineTo(base.x + (d.x * Math.cos(a) + n.x * Math.sin(a)) * tl * 1.6, base.y + (d.y * Math.cos(a) + n.y * Math.sin(a)) * tl * 1.6); ctx.stroke(); }
    ctx.restore();
    ctx.beginPath();
  };
  switch (art.tail) {
    case 'fork': localCurve(ctx, base, d, n, [['M', [-0.01, s]], ['Q', [tl * 0.5, s + tl * 0.2], [tl, tl * 0.85]], ['Q', [tl * 0.7, tl * 0.3], [tl * 0.55, 0]], ['Q', [tl * 0.7, -tl * 0.3], [tl, -tl * 0.85]], ['Q', [tl * 0.5, -s - tl * 0.2], [-0.01, -s]]]); draw(); break;
    case 'deepFork': localCurve(ctx, base, d, n, [['M', [-0.01, s]], ['Q', [tl * 0.6, s + tl * 0.3], [tl * 1.25, tl * 1.0]], ['Q', [tl * 0.6, tl * 0.25], [tl * 0.3, 0]], ['Q', [tl * 0.6, -tl * 0.25], [tl * 1.25, -tl * 1.0]], ['Q', [tl * 0.6, -s - tl * 0.3], [-0.01, -s]]]); draw(); break;
    case 'lunate': localCurve(ctx, base, d, n, [['M', [-0.01, s]], ['Q', [tl * 0.4, s], [tl * 1.1, tl * 1.15]], ['Q', [tl * 0.55, tl * 0.4], [tl * 0.45, 0]], ['Q', [tl * 0.55, -tl * 0.4], [tl * 1.1, -tl * 1.15]], ['Q', [tl * 0.4, -s], [-0.01, -s]]]); draw(); break;
    case 'round': localCurve(ctx, base, d, n, [['M', [-0.01, s]], ['C', [tl * 0.35, s + tl * 0.25], [tl * 0.85, tl * 0.75], [tl * 1.0, 0]], ['C', [tl * 0.85, -tl * 0.75], [tl * 0.35, -s - tl * 0.25], [-0.01, -s]]]); draw(); break;
    case 'fan': case 'frilly': {
      const k = 14, pts = [[-0.01, s]];
      for (let i = 0; i <= k; i++) { const a = -0.9 + (1.8 * i) / k; const r = tl * (art.tail === 'frilly' ? 1.0 + 0.15 * Math.sin(i * 2.2) : 0.95 + (i % 2) * 0.08); pts.push([Math.cos(a) * r * 0.95 + 0.02, Math.sin(a) * r * 0.9 * -1]); }
      pts.push([-0.01, -s]);
      localPoly(ctx, base, d, n, pts); draw(); break;
    }
    case 'square': localPoly(ctx, base, d, n, [[-0.01, s], [tl * 0.85, tl * 0.75], [tl * 0.95, 0], [tl * 0.85, -tl * 0.75], [-0.01, -s]]); draw(); break;
    case 'pointed': localPoly(ctx, base, d, n, [[-0.01, s], [tl * 1.6, 0], [-0.01, -s]]); draw(); break;
    case 'eel': localCurve(ctx, base, d, n, [['M', [-0.01, s * 1.2]], ['Q', [tl * 0.5, s * 0.8], [tl * 0.7, 0]], ['Q', [tl * 0.5, -s * 0.8], [-0.01, -s * 1.2]]]); draw(); break;
    case 'clear': localCurve(ctx, base, d, n, [['M', [-0.01, s]], ['C', [tl * 0.6, tl * 0.75], [tl, tl * 0.4], [tl, 0]], ['C', [tl, -tl * 0.4], [tl * 0.6, -tl * 0.75], [-0.01, -s]]]); draw(0.25); break;
    case 'veil': {
      const w = tl * 1.6;
      localCurve(ctx, base, d, n, [['M', [-0.01, s]], ['C', [w * 0.4, tl * 0.9], [w * 0.9, tl * 1.5], [w * 1.25, tl * 0.9]], ['Q', [w * 0.85, tl * 0.5], [w * 1.05, 0.0]], ['Q', [w * 0.9, -tl * 0.5], [w * 1.3, -tl * 0.95]], ['C', [w * 0.9, -tl * 1.5], [w * 0.4, -tl * 0.9], [-0.01, -s]]]);
      draw(0.85); break;
    }
    case 'shark': localCurve(ctx, base, d, n, [['M', [-0.01, s]], ['Q', [tl * 0.5, s + tl * 0.35], [tl * 1.05, tl * 1.25]], ['Q', [tl * 0.6, tl * 0.2], [tl * 0.5, -0.0]], ['Q', [tl * 0.55, -tl * 0.25], [tl * 0.7, -tl * 0.6]], ['Q', [tl * 0.3, -s - 0.01], [-0.01, -s]]]); draw(); break;
    case 'crystal': case 'crystalBig': {
      const k = art.tail === 'crystalBig' ? 1.35 : 1;
      localPoly(ctx, base, d, n, [[-0.01, s], [tl * 0.55 * k, tl * 0.65 * k], [tl * 1.05 * k, tl * 0.95 * k], [tl * 0.75 * k, tl * 0.2], [tl * 1.1 * k, 0], [tl * 0.75 * k, -tl * 0.2], [tl * 1.05 * k, -tl * 0.95 * k], [tl * 0.55 * k, -tl * 0.65 * k], [-0.01, -s]]);
      draw(0.9);
      ctx.save(); ctx.globalAlpha = 0.5; ctx.strokeStyle = '#ffffff'; ctx.lineWidth = lw * 0.6;
      localPoly(ctx, base, d, n, [[0.0, 0], [tl * 0.95 * k, tl * 0.85 * k], [tl * 0.6 * k, 0], [tl * 0.95 * k, -tl * 0.85 * k]]); ctx.stroke(); ctx.restore();
      break;
    }
    case 'iceFork': {
      const pts = [[-0.01, s]];
      for (let i = 0; i <= 6; i++) pts.push([tl * (0.3 + i * 0.13), tl * (0.35 + i * 0.12) + (i % 2 ? 0.03 : -0.01)]);
      pts.push([tl * 0.5, 0]);
      for (let i = 6; i >= 0; i--) pts.push([tl * (0.3 + i * 0.13), -tl * (0.35 + i * 0.12) - (i % 2 ? 0.03 : -0.01)]);
      pts.push([-0.01, -s]);
      localPoly(ctx, base, d, n, pts); draw(0.9); break;
    }
    case 'flame': {
      const pts = [[-0.01, s]];
      for (let i = 0; i <= 10; i++) { const a = -1.1 + 2.2 * (i / 10); const r = tl * (1.1 + 0.45 * Math.abs(Math.sin(i * 1.7))); pts.push([Math.cos(a) * r, -Math.sin(a) * r * 0.95]); if (i < 10) pts.push([Math.cos(a + 0.11) * r * 0.62, -Math.sin(a + 0.11) * r * 0.6]); }
      pts.push([-0.01, -s]);
      localPoly(ctx, base, d, n, pts);
      const gr = ctx.createLinearGradient(base.x, base.y, base.x + d.x * tl * 1.4, base.y + d.y * tl * 1.4);
      gr.addColorStop(0, C.c2); gr.addColorStop(1, C.c1);
      ctx.fillStyle = gr; ctx.globalAlpha = 0.92; ctx.fill(); ctx.globalAlpha = 1; ctx.lineWidth = lw; ctx.strokeStyle = C.finOl; ctx.stroke();
      break;
    }
    default: localPoly(ctx, base, d, n, [[-0.01, s], [tl, tl * 0.8], [tl * 0.6, 0], [tl, -tl * 0.8], [-0.01, -s]]); draw();
  }
}

// ───────────── Nadadeiras dorsal / anal ─────────────
function drawDorsal(ctx, g, art, C, lw, R) {
  const H = g.Hh;
  const fill = (a = 0.95, color = C.fin) => { ctx.globalAlpha = a; ctx.fillStyle = color; ctx.fill(); ctx.globalAlpha = 1; ctx.lineWidth = lw; ctx.strokeStyle = C.finOl; ctx.stroke(); };
  let r;
  switch (art.dorsal) {
    case 'none': return;
    case 'small': r = edgeFin(ctx, g, 1, 0.42, 0.66, H * 0.65, 'tri'); fill(); break;
    case 'tall': r = edgeFin(ctx, g, 1, 0.48, 0.72, H * 1.25, 'tri', { lean: 0.5 }); fill(); finRays(ctx, r.pts, r.outer, C.finOl, lw * 0.5); break;
    case 'long': r = edgeFin(ctx, g, 1, 0.12, 0.76, H * 0.55, 'flat'); fill(); finRays(ctx, r.pts, r.outer, C.finOl, lw * 0.5); break;
    case 'spiky': r = edgeFin(ctx, g, 1, 0.3, 0.78, H * 0.75, 'spikes', { spikes: 8 }); fill(); finRays(ctx, r.pts, r.outer, C.finOl, lw * 0.6); break;
    case 'sail': r = edgeFin(ctx, g, 1, 0.22, 0.86, H * 2.3, 'sail', { lean: 0.15 }); fill(0.92, C.c2); finRays(ctx, r.pts, r.outer, shade(C.c2, -0.4), lw * 0.6);
      ctx.save(); ctx.clip(); ctx.fillStyle = rgba('#0b2a55', 0.35); for (let i = 0; i < 14; i++) { const p = g.out(0.3 + i * 0.04, 1, H * (0.6 + R() * 1.2)); ctx.beginPath(); ctx.arc(p.x, p.y, H * 0.09, 0, TAU); ctx.fill(); } ctx.restore(); break;
    case 'rear': r = edgeFin(ctx, g, 1, 0.08, 0.3, H * 0.7, 'round'); fill(); break;
    case 'double': edgeFin(ctx, g, 1, 0.55, 0.72, H * 0.7, 'tri'); fill(); edgeFin(ctx, g, 1, 0.25, 0.45, H * 0.55, 'round'); fill(); break;
    case 'triple': edgeFin(ctx, g, 1, 0.6, 0.75, H * 0.6, 'round'); fill(); edgeFin(ctx, g, 1, 0.38, 0.55, H * 0.55, 'round'); fill(); edgeFin(ctx, g, 1, 0.12, 0.32, H * 0.5, 'round'); fill(); break;
    case 'eel': r = edgeFin(ctx, g, 1, 0.0, 0.72, H * 0.38, 'flat', { lean: 0.1 }); fill(0.9); finRays(ctx, r.pts, r.outer, C.finOl, lw * 0.45); break;
    case 'ribbon': r = edgeFin(ctx, g, 1, 0.04, 0.84, H * 0.42, 'wave', { lean: 0.1 }); fill(0.9); finRays(ctx, r.pts, r.outer, C.finOl, lw * 0.45); break;
    case 'crown': {
      r = edgeFin(ctx, g, 1, 0.3, 0.84, H * 1.35, 'spikes', { spikes: 6, lean: 0.25 });
      const gr = ctx.createLinearGradient(0, -H * 2.5, 0, 0); gr.addColorStop(0, '#fff3b0'); gr.addColorStop(1, C.c2);
      ctx.fillStyle = gr; ctx.fill(); ctx.lineWidth = lw; ctx.strokeStyle = shade(C.c2, -0.45); ctx.stroke(); finRays(ctx, r.pts, r.outer, shade(C.c2, -0.4), lw * 0.5); break;
    }
    case 'hump': edgeFin(ctx, g, 1, 0.35, 0.72, H * 0.35, 'round'); fill(); break;
    case 'leaf': edgeFin(ctx, g, 1, 0.08, 0.82, H * 0.45, 'wave', { lean: 0.05 }); fill(0.9); break;
    case 'sailSpots': r = edgeFin(ctx, g, 1, 0.28, 0.78, H * 1.3, 'sail', { lean: 0.2 }); fill(0.9);
      ctx.save(); ctx.clip(); ctx.fillStyle = C.c2; for (let i = 0; i < 9; i++) { const p = g.out(0.33 + i * 0.05, 1, H * (0.35 + R() * 0.7)); ctx.beginPath(); ctx.arc(p.x, p.y, H * 0.08, 0, TAU); ctx.fill(); } ctx.restore(); break;
    case 'thread': {
      edgeFin(ctx, g, 1, 0.48, 0.62, H * 0.55, 'tri'); fill();
      const a = g.out(0.5, 1, H * 0.5); ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.bezierCurveTo(a.x - 0.08, a.y - H * 0.6, a.x - 0.22, a.y - H * 0.2, a.x - 0.32, a.y - H * 0.3);
      ctx.lineWidth = lw * 1.1; ctx.strokeStyle = C.finOl; ctx.stroke(); break;
    }
    case 'lion': {
      for (let i = 0; i < 9; i++) {
        const t = 0.3 + i * 0.06, b = g.at(t, 0.9), o = g.out(t - 0.05, 1, H * (1.4 + (i % 2) * 0.35));
        ctx.beginPath(); ctx.moveTo(b.x, b.y); ctx.quadraticCurveTo((b.x + o.x) / 2 + 0.02, (b.y + o.y) / 2, o.x, o.y);
        ctx.lineWidth = lw * 2.2; ctx.strokeStyle = C.finOl; ctx.stroke(); ctx.lineWidth = lw * 1.2; ctx.strokeStyle = i % 2 ? '#ffffff' : C.c1; ctx.stroke();
      }
      edgeFin(ctx, g, 1, 0.3, 0.82, H * 0.5, 'round'); fill(0.6); break;
    }
    case 'crestRibbon': {
      r = edgeFin(ctx, g, 1, 0.0, 0.9, H * 0.55, 'wave', { lean: 0.05 }); fill(0.95, C.c2);
      for (let i = 0; i < 5; i++) {
        const b = g.at(0.94 - i * 0.012, 0.9), o = g.out(0.88 - i * 0.03, 1, H * (2.2 + i * 0.2));
        ctx.beginPath(); ctx.moveTo(b.x, b.y); ctx.quadraticCurveTo(b.x - 0.02, (b.y + o.y) / 2, o.x, o.y); ctx.lineWidth = lw * 1.8; ctx.strokeStyle = C.c2; ctx.stroke();
      }
      break;
    }
    case 'crystals': case 'crystalCrown': {
      const big = art.dorsal === 'crystalCrown';
      const k = big ? 7 : 5;
      for (let i = 0; i < k; i++) {
        const t = 0.32 + i * (big ? 0.075 : 0.08);
        const b1 = g.at(t - 0.03, 0.9), b2 = g.at(t + 0.03, 0.9), o = g.out(t - 0.02, 1, H * (big ? 1.2 + 0.5 * Math.sin(i * 1.3 + 0.5) ** 2 : 0.7 + 0.3 * (i % 2)));
        ctx.beginPath(); ctx.moveTo(b1.x, b1.y); ctx.lineTo(o.x, o.y); ctx.lineTo(b2.x, b2.y); ctx.closePath();
        const gr = ctx.createLinearGradient(b1.x, b1.y, o.x, o.y); gr.addColorStop(0, C.c3); gr.addColorStop(1, '#ffffff');
        ctx.fillStyle = gr; ctx.fill(); ctx.lineWidth = lw; ctx.strokeStyle = shade(C.c3, -0.5); ctx.stroke();
        ctx.beginPath(); ctx.moveTo((b1.x + b2.x) / 2, (b1.y + b2.y) / 2); ctx.lineTo(o.x, o.y); ctx.lineWidth = lw * 0.5; ctx.strokeStyle = 'rgba(255,255,255,.7)'; ctx.stroke();
      }
      break;
    }
    case 'iceSpikes': {
      for (let i = 0; i < 7; i++) {
        const t = 0.3 + i * 0.075;
        const b1 = g.at(t - 0.025, 0.9), b2 = g.at(t + 0.025, 0.9), o = g.out(t - 0.04, 1, H * (0.9 + 0.5 * ((i * 37) % 3) / 2));
        ctx.beginPath(); ctx.moveTo(b1.x, b1.y); ctx.lineTo(o.x, o.y); ctx.lineTo(b2.x, b2.y); ctx.closePath();
        ctx.fillStyle = 'rgba(220,248,255,.92)'; ctx.fill(); ctx.lineWidth = lw; ctx.strokeStyle = '#5f9fc4'; ctx.stroke();
      }
      break;
    }
    case 'flame': {
      edgeFin(ctx, g, 1, 0.2, 0.82, H * 1.4, 'flame', { lean: 0.35 });
      const gr = ctx.createLinearGradient(0, -H * 3, 0, 0); gr.addColorStop(0, C.c2); gr.addColorStop(1, C.c3);
      ctx.fillStyle = gr; ctx.globalAlpha = 0.95; ctx.fill(); ctx.globalAlpha = 1; ctx.lineWidth = lw; ctx.strokeStyle = C.finOl; ctx.stroke(); break;
    }
    case 'frilly': r = edgeFin(ctx, g, 1, 0.15, 0.85, H * 0.9, 'wave', { lean: 0.15 }); fill(0.85, C.c4); finRays(ctx, r.pts, r.outer, shade(C.c4, -0.4), lw * 0.5); break;
    case 'shark': edgeFin(ctx, g, 1, 0.42, 0.62, H * 1.05, 'shark', { lean: 0.6 }); fill(1, C.c1); break;
    default: edgeFin(ctx, g, 1, 0.42, 0.66, H * 0.6, 'tri'); fill();
  }
}

function drawAnal(ctx, g, art, C, lw) {
  const H = g.Hh * g.bellyR;
  const fill = (a = 0.92, color = C.fin) => { ctx.globalAlpha = a; ctx.fillStyle = color; ctx.fill(); ctx.globalAlpha = 1; ctx.lineWidth = lw; ctx.strokeStyle = C.finOl; ctx.stroke(); };
  let r;
  switch (art.anal) {
    case 'none': return;
    case 'small': edgeFin(ctx, g, -1, 0.18, 0.34, H * 0.5, 'tri'); fill(); edgeFin(ctx, g, -1, 0.5, 0.58, H * 0.35, 'round'); fill(); break;
    case 'long': r = edgeFin(ctx, g, -1, 0.1, 0.55, H * 0.5, 'flat'); fill(); finRays(ctx, r.pts, r.outer, C.finOl, lw * 0.5); break;
    case 'longRear': r = edgeFin(ctx, g, -1, 0.06, 0.42, H * 0.7, 'triBack'); fill(); break;
    case 'rear': edgeFin(ctx, g, -1, 0.08, 0.28, H * 0.65, 'round'); fill(); break;
    case 'eel': r = edgeFin(ctx, g, -1, 0.0, 0.62, H * 0.38, 'flat', { lean: 0.1 }); fill(0.9); finRays(ctx, r.pts, r.outer, C.finOl, lw * 0.45); break;
    case 'ribbon': r = edgeFin(ctx, g, -1, 0.04, 0.6, H * 0.42, 'wave', { lean: 0.1 }); fill(0.9); break;
    case 'veil': r = edgeFin(ctx, g, -1, 0.12, 0.45, H * 1.6, 'sail', { lean: 0.8 }); fill(0.8, C.c4); finRays(ctx, r.pts, r.outer, shade(C.c4, -0.35), lw * 0.5); break;
    case 'leaf': edgeFin(ctx, g, -1, 0.08, 0.6, H * 0.45, 'wave', { lean: 0.05 }); fill(0.9); break;
    case 'fringe': r = edgeFin(ctx, g, -1, 0.1, 0.5, H * 0.45, 'spikes', { spikes: 10 }); fill(0.7); break;
    case 'whiteEdge': edgeFin(ctx, g, -1, 0.18, 0.34, H * 0.55, 'tri'); fill(); ctx.save(); ctx.clip(); ctx.lineWidth = lw * 2.5; ctx.strokeStyle = '#ffffff'; ctx.stroke(); ctx.restore(); break;
    case 'double': edgeFin(ctx, g, -1, 0.15, 0.32, H * 0.55, 'round'); fill(); edgeFin(ctx, g, -1, 0.38, 0.55, H * 0.55, 'round'); fill(); break;
    case 'tall': edgeFin(ctx, g, -1, 0.2, 0.45, H * 1.0, 'tri', { lean: 0.4 }); fill(); break;
    case 'thread': {
      edgeFin(ctx, g, -1, 0.3, 0.45, H * 0.5, 'tri'); fill();
      const a = g.out(0.35, -1, H * 0.45); ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.bezierCurveTo(a.x - 0.08, a.y + H * 0.6, a.x - 0.2, a.y + H * 0.2, a.x - 0.3, a.y + H * 0.35);
      ctx.lineWidth = lw * 1.1; ctx.strokeStyle = C.finOl; ctx.stroke(); break;
    }
    case 'frilly': r = edgeFin(ctx, g, -1, 0.15, 0.55, H * 0.85, 'wave', { lean: 0.15 }); fill(0.85, C.c4); break;
    case 'flame': edgeFin(ctx, g, -1, 0.12, 0.5, H * 1.0, 'flame', { lean: 0.35 }); fill(0.92, C.c3); break;
    case 'crystals': {
      for (let i = 0; i < 3; i++) {
        const t = 0.25 + i * 0.1, b1 = g.at(t - 0.03, -0.9), b2 = g.at(t + 0.03, -0.9), o = g.out(t - 0.03, -1, H * 0.7);
        ctx.beginPath(); ctx.moveTo(b1.x, b1.y); ctx.lineTo(o.x, o.y); ctx.lineTo(b2.x, b2.y); ctx.closePath();
        ctx.fillStyle = C.c3; ctx.fill(); ctx.lineWidth = lw; ctx.strokeStyle = shade(C.c3, -0.5); ctx.stroke();
      }
      break;
    }
    default: edgeFin(ctx, g, -1, 0.2, 0.36, H * 0.5, 'tri'); fill();
  }
}

function drawPectoral(ctx, g, art, C, lw, front) {
  const te = eyeT(g);
  const t = clamp(te - 0.13 - (g.longBody ? 0.02 : 0), 0.3, 0.9);
  const b = g.at(t, -0.25), tt = g.T(t), n = g.N(t);
  const H = g.Hh;
  const L = (a, c) => ({ x: b.x - tt.x * a - n.x * c, y: b.y - tt.y * a - n.y * c }); // a: para trás, c: para baixo
  const poly = (pts) => { ctx.beginPath(); pts.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y))); ctx.closePath(); };
  const fill = (a = 0.9, color = C.fin) => { ctx.globalAlpha = a; ctx.fillStyle = color; ctx.fill(); ctx.globalAlpha = 1; ctx.lineWidth = lw; ctx.strokeStyle = C.finOl; ctx.stroke(); };
  if (!front) return;
  switch (art.pectoral) {
    case 'none': return;
    case 'wing': poly([L(0, 0), L(H * 1.2, -H * 0.5), L(H * 2.6, -H * 0.2), L(H * 2.4, H * 0.25), L(H * 0.8, H * 0.35)]); fill(0.88, C.c3);
      ctx.save(); ctx.strokeStyle = shade(C.c3, -0.3); ctx.lineWidth = lw * 0.5; for (let i = 1; i < 6; i++) { const e = L(H * (0.6 + i * 0.36), -H * 0.4 + i * 0.08 * H); ctx.beginPath(); ctx.moveTo(b.x, b.y); ctx.lineTo(e.x, e.y); ctx.stroke(); } ctx.restore(); break;
    case 'round': ctx.beginPath(); ctx.ellipse(L(H * 0.35, H * 0.1).x, L(H * 0.35, H * 0.1).y, H * 0.42, H * 0.26, Math.atan2(-tt.y, -tt.x) + 0.4, 0, TAU); fill(); break;
    case 'spine': poly([L(0, -H * 0.05), L(H * 0.9, H * 0.25), L(H * 0.95, H * 0.33), L(0, H * 0.12)]); fill(1, shade(C.fin, -0.15)); break;
    case 'arm': { // nadadeira-"braço" do saltinha
      const e = L(H * 0.15, H * 0.75), f = L(H * 0.55, H * 1.0);
      ctx.beginPath(); ctx.moveTo(b.x, b.y); ctx.quadraticCurveTo(e.x, e.y, f.x, f.y); ctx.lineWidth = lw * 3.2; ctx.strokeStyle = C.finOl; ctx.stroke(); ctx.lineWidth = lw * 2; ctx.strokeStyle = C.fin; ctx.stroke();
      ctx.beginPath(); ctx.ellipse(f.x, f.y, H * 0.25, H * 0.12, 0, 0, TAU); fill(1); break;
    }
    case 'fanBig': { const pts = [L(0, 0)]; for (let i = 0; i <= 8; i++) { const a = -0.6 + i * 0.16; pts.push(L(Math.cos(a) * H * 1.0, Math.sin(a) * H * 0.9 + H * 0.25)); } poly(pts); fill(0.92); break; }
    case 'lionFan': for (let i = 0; i < 7; i++) { const e = L(H * (1.2 + (i % 2) * 0.3), H * (-0.3 + i * 0.25)); ctx.beginPath(); ctx.moveTo(b.x, b.y); ctx.quadraticCurveTo((b.x + e.x) / 2, (b.y + e.y) / 2 + 0.01, e.x, e.y); ctx.lineWidth = lw * 2; ctx.strokeStyle = C.finOl; ctx.stroke(); ctx.lineWidth = lw * 1.1; ctx.strokeStyle = i % 2 ? '#ffffff' : C.c4; ctx.stroke(); } break;
    case 'long': poly([L(0, 0), L(H * 1.4, H * 0.3), L(H * 2.2, H * 1.0), L(H * 1.2, H * 0.6), L(0, H * 0.2)]); fill(0.75, C.c4); break;
    case 'shark': poly([L(-H * 0.1, 0), L(H * 0.9, H * 0.85), L(H * 0.5, H * 0.1)]); fill(1, C.c1); break;
    case 'oar': poly([L(0, 0), L(H * 0.8, H * 0.6), L(H * 2.4, H * 1.4), L(H * 2.5, H * 1.5), L(H * 0.7, H * 0.75), L(0, H * 0.2)]); fill(0.95, C.c2); break;
    case 'frilly': { const pts = [L(0, 0)]; for (let i = 0; i <= 10; i++) pts.push(L(H * (0.4 + i * 0.12), H * (0.2 + 0.25 * Math.sin(i * 1.6) + i * 0.05))); pts.push(L(H * 0.3, H * 0.45)); poly(pts); fill(0.85, C.c4); break; }
    case 'flame': poly([L(0, 0), L(H * 0.7, H * 0.05), L(H * 1.2, H * 0.35), L(H * 0.8, H * 0.35), L(H * 1.25, H * 0.75), L(H * 0.5, H * 0.5)]); fill(0.92, C.c3); break;
    case 'crystalWing': case 'iceWing': {
      const ice = art.pectoral === 'iceWing';
      poly([L(0, 0), L(H * 1.0, -H * 0.2), L(H * 1.9, H * 0.15), L(H * 1.2, H * 0.4), L(H * 1.6, H * 0.8), L(H * 0.6, H * 0.5)]);
      ctx.fillStyle = ice ? 'rgba(220,248,255,.9)' : rgba(C.c3, 0.85); ctx.fill(); ctx.lineWidth = lw; ctx.strokeStyle = ice ? '#5f9fc4' : shade(C.c3, -0.5); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(b.x, b.y); ctx.lineTo(L(H * 1.6, H * 0.15).x, L(H * 1.6, H * 0.15).y); ctx.strokeStyle = 'rgba(255,255,255,.8)'; ctx.lineWidth = lw * 0.6; ctx.stroke(); break;
    }
    case 'whiteEdge': poly([L(0, 0), L(H * 0.8, H * 0.2), L(H * 0.7, H * 0.5), L(0, H * 0.2)]); fill(); ctx.save(); ctx.clip(); ctx.lineWidth = lw * 2.4; ctx.strokeStyle = '#fff'; ctx.stroke(); ctx.restore(); break;
    default: ctx.beginPath(); ctx.ellipse(L(H * 0.35, H * 0.12).x, L(H * 0.35, H * 0.12).y, H * 0.38, H * 0.17, Math.atan2(-tt.y, -tt.x) + 0.35, 0, TAU); fill(0.85);
  }
}

function eyeT(g) { return 1 - clamp(g.Hh * 0.7 + 0.05, 0.07, 0.19) - (g.headBlunt > 0.8 ? 0.015 : 0); }

// ───────────── Focinho alongado (antes do contorno) ─────────────
function drawSnoutExt(ctx, g, art, C, lw) {
  const s = g.P(1), tt = g.T(1), n = g.N(1), H = g.Hh;
  const L = (a, c) => ({ x: s.x + tt.x * a + n.x * c, y: s.y + tt.y * a + n.y * c });
  const poly = (pts, col = C.c1) => { ctx.beginPath(); pts.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y))); ctx.closePath(); ctx.fillStyle = col; ctx.fill(); ctx.lineWidth = lw; ctx.strokeStyle = C.ol; ctx.stroke(); };
  switch (art.mouth) {
    case 'needle': poly([L(-0.02, H * 0.25), L(0.16, H * 0.05), L(0.17, -H * 0.03), L(-0.02, -H * 0.25)], shade(C.c1, -0.1)); break;
    case 'bill': poly([L(-0.03, H * 0.35), L(0.2, H * 0.02), L(-0.03, H * 0.05)], shade(C.c1, -0.25)); break;
    case 'croc': poly([L(-0.02, H * 0.4), L(0.12, H * 0.15), L(0.13, -H * 0.12), L(-0.02, -H * 0.35)], C.c1); break;
    case 'snout': poly([L(-0.01, H * 0.22), L(0.05, H * 0.1), L(0.05, -H * 0.04), L(-0.01, -H * 0.18)], C.c1); break;
    case 'snoutBarbels': poly([L(-0.03, H * 0.5), L(0.14, H * 0.05), L(0.13, -H * 0.12), L(-0.03, -H * 0.4)], shade(C.c1, 0.1)); break;
  }
}

// ───────────── Boca, olho e detalhes da cabeça ─────────────
function drawHead(ctx, g, art, C, lw, opts, R) {
  const H = g.Hh, ex = art.extras || [];
  const te = eyeT(g);
  let er = clamp(H * 0.21, 0.016, 0.055);
  if (ex.includes('bigEye')) er *= 1.45;
  if (ex.includes('smallEye')) er *= 0.65;
  let eye = g.at(te, 0.32);
  if (ex.includes('topEyes')) { eye = g.at(te + 0.02, 1.0); er *= 1.25; }
  const s = g.P(1), tt = g.T(1), n = g.N(1);
  const M = (a, c) => ({ x: s.x + tt.x * a + n.x * c, y: s.y + tt.y * a + n.y * c });
  const line = (pts, color = C.ol, w = lw) => { ctx.beginPath(); pts.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y))); ctx.lineWidth = w; ctx.strokeStyle = color; ctx.lineCap = 'round'; ctx.stroke(); };
  // Guelra
  if (!g.longBody || g.aspect < 9) {
    const tg = clamp(te - er * 2.8 - 0.02, 0.4, 0.95);
    const a = g.at(tg, 0.75), b = g.at(tg - 0.025, 0), c = g.at(tg, -0.7);
    ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.quadraticCurveTo(b.x, b.y, c.x, c.y); ctx.lineWidth = lw * 0.9; ctx.strokeStyle = rgba(C.ol, 0.55); ctx.stroke();
    if (ex.includes('gills')) for (let i = 1; i <= 3; i++) { const q = g.at(tg - i * 0.03, 0.4), r = g.at(tg - i * 0.03, -0.3); line([q, r], rgba(C.ol, 0.6), lw * 0.8); }
  }
  // Boca
  const my = g.headBlunt > 0.7 ? -H * 0.15 : -H * 0.05;
  switch (art.mouth) {
    case 'big': case 'upturnedBig': case 'angler': {
      const up = art.mouth === 'upturnedBig';
      const a = M(-0.005, up ? H * 0.2 : my), b = M(-H * (art.mouth === 'angler' ? 1.1 : 0.7), up ? H * 0.05 : my - H * 0.25);
      ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.quadraticCurveTo((a.x + b.x) / 2, (a.y + b.y) / 2 + H * 0.15, b.x, b.y);
      ctx.lineWidth = lw * 1.4; ctx.strokeStyle = C.ol; ctx.stroke();
      if (art.mouth === 'angler') { // dentes finos
        for (let i = 0; i < 7; i++) { const t = i / 6; const p = { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t + H * 0.06 * Math.sin(t * Math.PI) }; line([p, { x: p.x + 0.004, y: p.y - H * 0.12 }], '#f6f6ff', lw * 0.9); }
      }
      if (ex.includes('bigLips')) { ctx.beginPath(); ctx.ellipse(a.x - 0.008, a.y, H * 0.12, H * 0.18, 0, 0, TAU); ctx.fillStyle = shade(C.c1, -0.15); ctx.fill(); ctx.lineWidth = lw * 0.8; ctx.strokeStyle = C.ol; ctx.stroke(); }
      break;
    }
    case 'beak': case 'beakShort': {
      const k = art.mouth === 'beak' ? 1 : 0.6;
      ctx.beginPath(); const a = M(0.01 * k, my + H * 0.18), b = M(0.035 * k, my), c = M(0.01 * k, my - H * 0.18), d = M(-0.03, my);
      ctx.moveTo(a.x, a.y); ctx.quadraticCurveTo(b.x + 0.01, b.y, c.x, c.y); ctx.lineTo(d.x, d.y); ctx.closePath();
      ctx.fillStyle = art.mouth === 'beak' ? '#f4f0e6' : shade(C.c1, 0.3); ctx.fill(); ctx.lineWidth = lw; ctx.strokeStyle = C.ol; ctx.stroke();
      line([M(-0.02, my), M(0.03 * k, my)], C.ol, lw * 0.8);
      break;
    }
    case 'whiskers': case 'rootWhiskers': case 'chinBarbel': case 'snoutBarbels': {
      line([M(-0.005, my), M(-H * 0.45, my - H * 0.12)], C.ol, lw);
      const count = art.mouth === 'rootWhiskers' ? 4 : art.mouth === 'chinBarbel' ? 1 : art.mouth === 'snoutBarbels' ? 3 : 3;
      for (let i = 0; i < count; i++) {
        const st = art.mouth === 'snoutBarbels' ? M(0.06 - i * 0.012, -H * 0.35) : M(-0.008 - i * 0.012, my - H * 0.05);
        const len = art.mouth === 'rootWhiskers' ? 0.35 + i * 0.05 : art.mouth === 'chinBarbel' ? 0.06 : 0.16 + i * 0.03;
        const end = { x: st.x - 0.03 - len * 0.6, y: st.y + len * (0.45 + i * 0.12) };
        ctx.beginPath(); ctx.moveTo(st.x, st.y);
        ctx.bezierCurveTo(st.x + len * 0.25, st.y + len * 0.25, end.x + len * 0.35, end.y - len * 0.05, end.x, end.y);
        ctx.lineWidth = lw * (art.mouth === 'rootWhiskers' ? 2.2 - i * 0.3 : 1.2); ctx.strokeStyle = art.mouth === 'rootWhiskers' ? '#5a4630' : shade(C.c1, -0.35); ctx.stroke();
        if (art.mouth === 'rootWhiskers') { // ramificações
          const m2 = { x: (st.x + end.x) / 2, y: (st.y + end.y) / 2 };
          ctx.beginPath(); ctx.moveTo(m2.x, m2.y); ctx.lineTo(m2.x - 0.05, m2.y + 0.06); ctx.lineWidth = lw; ctx.stroke();
        }
      }
      break;
    }
    case 'underbite': case 'teeth': case 'teethLong': case 'fangs': case 'croc': case 'shark': {
      const a = M(-0.002, my), b = M(-H * 0.65, my - H * 0.15);
      line([a, b], C.ol, lw * 1.3);
      const k = art.mouth === 'fangs' ? 2 : art.mouth === 'teethLong' ? 5 : art.mouth === 'shark' ? 6 : art.mouth === 'croc' ? 7 : 4;
      for (let i = 0; i < k; i++) {
        const t = (i + 0.5) / k; const p = { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
        const len = art.mouth === 'fangs' ? H * 0.32 : art.mouth === 'teethLong' ? H * 0.2 : H * 0.12;
        ctx.beginPath(); ctx.moveTo(p.x - 0.006, p.y); ctx.lineTo(p.x, p.y + len); ctx.lineTo(p.x + 0.006, p.y); ctx.closePath();
        ctx.fillStyle = '#ffffff'; ctx.fill(); ctx.lineWidth = lw * 0.5; ctx.strokeStyle = C.ol; ctx.stroke();
      }
      break;
    }
    case 'upturned': line([M(0, H * 0.25), M(-H * 0.4, H * 0.05)], C.ol, lw * 1.2); break;
    case 'lip': case 'pout': {
      const p = M(0.004, my);
      ctx.beginPath(); ctx.ellipse(p.x, p.y, H * 0.1, H * 0.16, 0, 0, TAU); ctx.fillStyle = art.mouth === 'pout' ? '#ff6f9e' : shade(C.c1, -0.2); ctx.fill(); ctx.lineWidth = lw * 0.8; ctx.strokeStyle = C.ol; ctx.stroke();
      break;
    }
    case 'buckTeeth': line([M(0, my), M(-H * 0.35, my - H * 0.1)], C.ol, lw * 1.1); ctx.fillStyle = '#ffffff'; { const p = M(-0.004, my); ctx.fillRect(p.x - 0.01, p.y, 0.012, H * 0.18); ctx.strokeStyle = C.ol; ctx.lineWidth = lw * 0.5; ctx.strokeRect(p.x - 0.01, p.y, 0.012, H * 0.18); } break;
    case 'grumpy': { const a = M(0, my), b = M(-H * 0.45, my - H * 0.05); ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.quadraticCurveTo((a.x + b.x) / 2, (a.y + b.y) / 2 - H * 0.12, b.x, b.y + H * 0.1); ctx.lineWidth = lw * 1.2; ctx.strokeStyle = C.ol; ctx.stroke(); break; }
    case 'needle': case 'bill': case 'snout': break;
    default: line([M(-0.002, my), M(-H * 0.28, my - H * 0.06)], C.ol, lw);
  }
  // Olho
  if (!opts.silhouette) {
    const glowEye = ex.includes('glowEye');
    if (ex.includes('eyeBand')) { const a = g.at(te + 0.02, 1), b = g.at(te - 0.02, -1); ctx.save(); ctx.beginPath(); bodyPath(ctx, g); ctx.clip(); line([a, b], C.c3, er * 2.6); ctx.restore(); }
    ctx.beginPath(); ctx.arc(eye.x, eye.y, er * 1.25, 0, TAU); ctx.fillStyle = glowEye ? '#2a1a00' : '#ffffff'; ctx.fill();
    ctx.lineWidth = lw * 0.9; ctx.strokeStyle = C.ol; ctx.stroke();
    ctx.beginPath(); ctx.arc(eye.x + er * 0.25, eye.y, er * 0.78, 0, TAU); ctx.fillStyle = glowEye ? (art.glow || '#ffcf40') : '#1b1b28'; ctx.fill();
    ctx.beginPath(); ctx.arc(eye.x + er * 0.5, eye.y - er * 0.35, er * 0.28, 0, TAU); ctx.fillStyle = '#ffffff'; ctx.fill();
    if (ex.includes('grumpy')) line([{ x: eye.x - er * 1.4, y: eye.y - er * 1.7 }, { x: eye.x + er * 1.4, y: eye.y - er * 1.05 }], C.ol, lw * 1.6);
  }
}

// ───────────── Padrões (recortados no corpo) ─────────────
function drawPattern(ctx, g, art, C, lw, R) {
  const H = g.Hh;
  const dot = (p, r, col) => { ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, TAU); ctx.fillStyle = col; ctx.fill(); };
  const band = (t, w, col, edge) => {
    ctx.beginPath();
    for (let i = 0; i <= 10; i++) { const p = g.at(t - w / 2 + 0.01 * Math.sin(i), 1 - (i / 10) * 2); i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y); }
    for (let i = 10; i >= 0; i--) { const p = g.at(t + w / 2 + 0.01 * Math.sin(i * 1.3), 1 - (i / 10) * 2); ctx.lineTo(p.x, p.y); }
    ctx.closePath(); ctx.fillStyle = col; ctx.fill();
    if (edge) { ctx.lineWidth = lw * 1.2; ctx.strokeStyle = edge; ctx.stroke(); }
  };
  const stripe = (v, t0, t1, w, col) => {
    ctx.beginPath();
    for (let i = 0; i <= 24; i++) { const p = g.at(t0 + ((t1 - t0) * i) / 24, v); i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y); }
    ctx.lineWidth = w; ctx.strokeStyle = col; ctx.lineCap = 'round'; ctx.stroke();
  };
  const scales = (col, step = 0.045, rows = 4, alpha = 0.5) => {
    ctx.save(); ctx.globalAlpha = alpha; ctx.strokeStyle = col; ctx.lineWidth = lw * 0.7;
    for (let r = 0; r < rows; r++) for (let t = 0.08; t < 0.85; t += step) {
      const v = 0.8 - (r * 1.6) / (rows - 1 || 1);
      const p = g.at(t + (r % 2) * step * 0.5, v);
      const rad = Math.min(step * 0.6, H * 0.35);
      ctx.beginPath(); ctx.arc(p.x, p.y, rad, -Math.PI / 2, Math.PI / 2); ctx.stroke();
    }
    ctx.restore();
  };
  switch (art.pattern) {
    case 'stripeH': stripe(0.15, 0.05, 0.85, H * 0.22, C.c3); break;
    case 'stripeHmulti': for (const v of [0.6, 0.25, -0.1]) stripe(v, 0.05, 0.8, H * 0.07, rgba(shade(C.c1, -0.4), 0.6)); break;
    case 'bandsV': for (const t of [0.22, 0.52, 0.8]) band(t, 0.085, C.c3, shade(C.c1, -0.45)); break;
    case 'spots': for (let i = 0; i < 9; i++) dot(g.at(0.15 + R() * 0.7, -0.4 + R() * 1.3), H * (0.1 + R() * 0.1), C.c3); break;
    case 'dots': for (let i = 0; i < 26; i++) dot(g.at(0.08 + R() * 0.84, -0.8 + R() * 1.7), H * 0.07, C.c3); break;
    case 'gradient': stripe(0.1, 0.05, 0.85, H * 0.3, rgba('#ffffff', 0.18)); break;
    case 'eyespot': { const p = g.at(0.28, 0.35); dot(p, H * 0.3, '#ffffff'); dot(p, H * 0.22, C.c3); break; }
    case 'scales': scales(C.c3, 0.05, 4, 0.55); stripe(-0.2, 0.3, 0.85, H * 0.12, rgba(C.c3, 0.35)); break;
    case 'bars': for (let t = 0.2; t < 0.85; t += 0.07) band(t, 0.018, rgba(C.c3, 0.75)); break;
    case 'royal': scales('#ffe9a0', 0.045, 4, 0.6); stripe(0.0, 0.05, 0.9, H * 0.12, rgba(C.c3, 0.75)); break;
    case 'mottled': for (let i = 0; i < 14; i++) { const p = g.at(0.05 + R() * 0.9, -0.2 + R() * 1.2); ctx.beginPath(); ctx.ellipse(p.x, p.y, H * (0.15 + R() * 0.2), H * (0.1 + R() * 0.12), R() * 3, 0, TAU); ctx.fillStyle = rgba(C.c3, 0.55); ctx.fill(); } break;
    case 'freckles': for (let i = 0; i < 30; i++) dot(g.at(0.05 + R() * 0.85, -0.6 + R() * 1.5), H * 0.05, rgba(shade(C.c1, -0.45), 0.8)); for (let i = 0; i < 6; i++) dot(g.at(0.2 + R() * 0.6, 0.2 + R() * 0.6), H * 0.07, C.c3); break;
    case 'veins': stripe(0, 0.0, 0.95, H * 0.07, rgba(C.c3, 0.7)); for (let t = 0.15; t < 0.85; t += 0.1) { stripe(0.5, t, t + 0.06, H * 0.04, rgba(C.c3, 0.55)); ctx.beginPath(); const a = g.at(t, 0), b = g.at(t + 0.07, 0.8), c = g.at(t + 0.07, -0.8); ctx.moveTo(b.x, b.y); ctx.lineTo(a.x, a.y); ctx.lineTo(c.x, c.y); ctx.lineWidth = lw * 0.6; ctx.strokeStyle = rgba(C.c3, 0.5); ctx.stroke(); } break;
    case 'lateralLine': stripe(0.05, 0.02, 0.9, H * 0.12, C.c3); break;
    case 'marbled': for (let i = 0; i < 18; i++) { const p = g.at(R(), -0.6 + R() * 1.6); ctx.beginPath(); ctx.ellipse(p.x, p.y, H * (0.25 + R() * 0.3), H * (0.12 + R() * 0.12), R() * 3, 0, TAU); ctx.fillStyle = rgba(C.c3, 0.6); ctx.fill(); } break;
    case 'blotches': for (const t of [0.2, 0.36, 0.52, 0.68]) dot(g.at(t, 0.6), H * 0.22, C.c3); break;
    case 'bigScalesRed': {
      const gr = ctx.createLinearGradient(g.P(0).x, 0, g.P(0.55).x, 0); gr.addColorStop(0, rgba(C.c3, 0.8)); gr.addColorStop(1, rgba(C.c3, 0));
      ctx.fillStyle = gr; ctx.fillRect(-0.6, -0.5, 1.2, 1); scales(shade(C.c1, -0.45), 0.06, 4, 0.55); break;
    }
    case 'snake': for (let t = 0.08; t < 0.85; t += 0.08) { dot(g.at(t, 0.45), H * 0.18, C.c3); dot(g.at(t + 0.04, -0.25), H * 0.14, rgba(C.c3, 0.8)); } break;
    case 'bark': for (let i = 0; i < 16; i++) { const t = R() * 0.9; stripe(-0.8 + R() * 1.6, t, t + 0.08 + R() * 0.08, H * 0.05, rgba(shade(C.c1, -0.5), 0.6)); } break;
    case 'speckled': for (let i = 0; i < 60; i++) dot(g.at(R(), -0.4 + R() * 1.4), H * 0.04, rgba(C.c3, 0.75)); break;
    case 'silver': stripe(0.45, 0.05, 0.9, H * 0.25, rgba(C.c1, 0.6)); stripe(-0.05, 0.05, 0.9, H * 0.1, rgba('#ffffff', 0.55)); break;
    case 'charSpots': for (let i = 0; i < 16; i++) { const p = g.at(0.08 + R() * 0.8, -0.3 + R() * 1.1); dot(p, H * 0.11, rgba('#d3f0ff', 0.6)); dot(p, H * 0.07, C.c3); } break;
    case 'lumpRows': for (const v of [0.75, 0.15, -0.5]) for (let t = 0.15; t < 0.85; t += 0.09) { const p = g.at(t, v); dot(p, H * 0.11, shade(C.c1, -0.25)); dot({ x: p.x - H * 0.03, y: p.y - H * 0.03 }, H * 0.04, rgba('#ffffff', 0.6)); } break;
    case 'bones': { stripe(0, 0.05, 0.92, H * 0.05, rgba('#7fa5ba', 0.7)); for (let t = 0.1; t < 0.85; t += 0.045) { const a = g.at(t, 0), b = g.at(t - 0.03, 0.7), c = g.at(t - 0.03, -0.6); ctx.beginPath(); ctx.moveTo(b.x, b.y); ctx.lineTo(a.x, a.y); ctx.lineTo(c.x, c.y); ctx.lineWidth = lw * 0.5; ctx.strokeStyle = rgba('#7fa5ba', 0.55); ctx.stroke(); } break; }
    case 'scutes': for (const v of [0.85, 0.2, -0.6]) for (let t = 0.1; t < 0.85; t += 0.06) { const p = g.at(t, v); ctx.beginPath(); ctx.moveTo(p.x - 0.018, p.y); ctx.lineTo(p.x, p.y - H * 0.13); ctx.lineTo(p.x + 0.018, p.y); ctx.lineTo(p.x, p.y + H * 0.13); ctx.closePath(); ctx.fillStyle = C.c3; ctx.fill(); ctx.lineWidth = lw * 0.6; ctx.strokeStyle = C.ol; ctx.stroke(); } break;
    case 'aurora': for (const [v, col] of [[0.55, '#7dffb0'], [0.15, '#b38cff'], [-0.3, '#8ff0ff']]) stripe(v, 0.05, 0.92, H * 0.18, rgba(col, 0.5)); break;
    case 'ember': { const gr = ctx.createLinearGradient(g.P(0).x, 0, g.P(1).x, 0); gr.addColorStop(0, rgba('#5a0d00', 0.6)); gr.addColorStop(0.6, rgba(C.c3, 0)); ctx.fillStyle = gr; ctx.fillRect(-0.6, -0.5, 1.2, 1); for (let i = 0; i < 12; i++) dot(g.at(R(), -0.5 + R()), H * 0.05, rgba(C.c3, 0.9)); break; }
    case 'lavaCracks': ctx.save(); ctx.shadowColor = C.c3; ctx.shadowBlur = 0; for (let i = 0; i < 9; i++) { let t = 0.1 + R() * 0.75, v = -0.6 + R() * 1.4; ctx.beginPath(); let p = g.at(t, v); ctx.moveTo(p.x, p.y); for (let k = 0; k < 4; k++) { t += 0.02 + R() * 0.04; v += (R() - 0.5) * 0.6; p = g.at(t, v); ctx.lineTo(p.x, p.y); } ctx.lineWidth = lw * 1.2; ctx.strokeStyle = C.c3; ctx.stroke(); } ctx.restore(); break;
    case 'faceStripes': for (let i = 0; i < 3; i++) { const a = g.at(0.82 + i * 0.03, 0.8), b = g.at(0.74 + i * 0.03, -0.6); ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.quadraticCurveTo(a.x + 0.02, (a.y + b.y) / 2, b.x, b.y); ctx.lineWidth = H * 0.08; ctx.strokeStyle = C.c3; ctx.stroke(); } stripe(0.1, 0.1, 0.7, H * 0.06, rgba(C.c3, 0.6)); break;
    case 'neon': stripe(0.05, 0.02, 0.55, H * 0.28, C.c3); stripe(0.05, 0.02, 0.55, H * 0.1, rgba('#ffffff', 0.5)); break;
    case 'warts': for (let i = 0; i < 26; i++) { const p = g.at(0.05 + R() * 0.9, -0.6 + R() * 1.5); dot(p, H * (0.05 + R() * 0.07), shade(C.c1, 0.2)); } for (let i = 0; i < 6; i++) dot(g.at(R(), R() - 0.2), H * 0.08, rgba(C.c3, 0.7)); break;
    case 'chevron': for (let t = 0.15; t < 0.8; t += 0.08) { const a = g.at(t + 0.03, 0.85), b = g.at(t, 0.15), c = g.at(t + 0.03, -0.4); ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.lineTo(c.x, c.y); ctx.lineWidth = H * 0.1; ctx.strokeStyle = rgba(C.c3, 0.75); ctx.stroke(); } break;
    case 'zebra': for (let t = 0.05; t < 0.92; t += 0.06) band(t, 0.022, C.c3); break;
    case 'magmaVeins': ctx.save(); for (let i = 0; i < 7; i++) { let t = 0.02 + i * 0.13, v = -0.2 + R() * 0.6; ctx.beginPath(); let p = g.at(t, v); ctx.moveTo(p.x, p.y); for (let k = 0; k < 5; k++) { t += 0.02; v += (R() - 0.5) * 0.9; p = g.at(Math.min(0.97, t), Math.max(-0.9, Math.min(0.9, v))); ctx.lineTo(p.x, p.y); } ctx.lineWidth = lw * 2.2; ctx.strokeStyle = rgba(C.c3, 0.45); ctx.stroke(); ctx.lineWidth = lw; ctx.strokeStyle = '#ffd36a'; ctx.stroke(); } ctx.restore(); break;
    case 'countershade': { ctx.beginPath(); for (let i = 0; i <= 30; i++) { const p = g.at(i / 30, -0.15 + 0.05 * Math.sin(i)); i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y); } for (let i = 30; i >= 0; i--) { const p = g.at(i / 30, -1); ctx.lineTo(p.x, p.y); } ctx.closePath(); ctx.fillStyle = C.c2; ctx.fill(); break; }
    case 'phoenix': { const gr = ctx.createLinearGradient(g.P(0).x, 0, g.P(1).x, 0); gr.addColorStop(0, rgba(C.c3, 0.8)); gr.addColorStop(1, rgba(C.c2, 0.6)); ctx.fillStyle = gr; ctx.fillRect(-0.6, -0.5, 1.2, 1); scales('#fff1a8', 0.05, 4, 0.65); break; }
    case 'prism': case 'facetsBig': {
      const step = art.pattern === 'prism' ? 0.14 : 0.18;
      const cols = ['#ffffff', C.c3, C.c2, shade(C.c1, -0.2)];
      let k = 0;
      for (let t = 0; t < 1; t += step) for (const v of [1, 0, -1]) {
        const a = g.at(t, v), b = g.at(t + step, v), c = g.at(t + step / 2, v - 0.95 * Math.sign(v || 1));
        ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.lineTo(c.x, c.y); ctx.closePath();
        ctx.fillStyle = rgba(cols[k++ % cols.length], 0.35); ctx.fill(); ctx.lineWidth = lw * 0.5; ctx.strokeStyle = rgba('#ffffff', 0.6); ctx.stroke();
      }
      break;
    }
    case 'photophores': for (let t = 0.12; t < 0.85; t += 0.06) { const p = g.at(t, -0.55); dot(p, H * 0.12, rgba(C.c3, 0.35)); dot(p, H * 0.06, C.c3); } for (let t = 0.2; t < 0.8; t += 0.1) dot(g.at(t, 0.3), H * 0.05, rgba(C.c3, 0.8)); break;
    case 'glass': stripe(0, 0.05, 0.9, H * 0.05, rgba('#9cc6da', 0.8)); for (let t = 0.1; t < 0.85; t += 0.05) { const a = g.at(t, 0.6), b = g.at(t, -0.6); ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.lineWidth = lw * 0.4; ctx.strokeStyle = rgba('#9cc6da', 0.6); ctx.stroke(); } break;
    case 'gemScales': for (let r = 0; r < 4; r++) for (let t = 0.1; t < 0.88; t += 0.07) { const p = g.at(t + (r % 2) * 0.035, 0.75 - r * 0.5); ctx.beginPath(); ctx.moveTo(p.x - 0.02, p.y); ctx.lineTo(p.x, p.y - H * 0.2); ctx.lineTo(p.x + 0.02, p.y); ctx.lineTo(p.x, p.y + H * 0.2); ctx.closePath(); ctx.fillStyle = rgba(r % 2 ? '#ffffff' : C.c3, 0.35); ctx.fill(); ctx.lineWidth = lw * 0.5; ctx.strokeStyle = rgba('#ffffff', 0.7); ctx.stroke(); } break;
    case 'deep': for (let i = 0; i < 20; i++) dot(g.at(R(), -0.8 + R() * 1.6), H * 0.04, rgba(C.c3, 0.4)); break;
    case 'iridescent': for (const [v, col] of [[0.6, '#ffc4f0'], [0.2, '#c4f1ff'], [-0.2, '#fff3c4'], [-0.6, '#d6c4ff']]) stripe(v, 0.0, 1, H * 0.35, rgba(col, 0.45)); break;
    case 'dragonScales': scales(C.c3, 0.045, 5, 0.7); stripe(0.1, 0.05, 0.9, H * 0.08, rgba('#ffffff', 0.4)); break;
    case 'oarSpots': for (let t = 0.05; t < 0.95; t += 0.04) { band(t, 0.008, rgba('#5c4f8a', 0.45)); if ((t * 100) % 8 < 4) dot(g.at(t, 0.4), H * 0.12, rgba('#5c4f8a', 0.6)); } break;
    case 'rainbowArmor': {
      const cols = ['#ff9bd2', '#ffe08a', '#9bffcf', '#8fd8ff', '#c79bff'];
      for (let r = 0; r < 3; r++) for (let t = 0.05; t < 0.9; t += 0.09) {
        const a = g.at(t, 1 - r * 0.7), b = g.at(t + 0.09, 1 - r * 0.7), c = g.at(t + 0.09, 0.3 - r * 0.7), d = g.at(t, 0.3 - r * 0.7);
        ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.lineTo(c.x, c.y); ctx.lineTo(d.x, d.y); ctx.closePath();
        ctx.fillStyle = rgba(cols[(r * 3 + Math.round(t * 11)) % cols.length], 0.42); ctx.fill(); ctx.lineWidth = lw * 0.6; ctx.strokeStyle = rgba('#ffffff', 0.75); ctx.stroke();
      }
      break;
    }
  }
}

function drawExtras(ctx, g, art, C, lw, R, opts) {
  const H = g.Hh, ex = art.extras || [];
  const te = eyeT(g);
  if (ex.includes('spikes')) for (let i = 0; i < 16; i++) { const t = 0.1 + (i % 8) * 0.1, side = i < 8 ? 1 : -1, b = g.at(t, side * 0.95), o = g.out(t, side, H * 0.22); ctx.beginPath(); ctx.moveTo(b.x - 0.01, b.y); ctx.lineTo(o.x, o.y); ctx.lineTo(b.x + 0.01, b.y); ctx.fillStyle = shade(C.c1, -0.2); ctx.fill(); ctx.lineWidth = lw * 0.7; ctx.strokeStyle = C.ol; ctx.stroke(); }
  if (ex.includes('headSpines')) for (let i = 0; i < 4; i++) { const b = g.at(te - 0.04 - i * 0.04, 0.95), o = g.out(te - 0.06 - i * 0.04, 1, H * 0.3); ctx.beginPath(); ctx.moveTo(b.x - 0.01, b.y); ctx.lineTo(o.x, o.y); ctx.lineTo(b.x + 0.01, b.y); ctx.fillStyle = C.c4; ctx.fill(); ctx.lineWidth = lw * 0.7; ctx.strokeStyle = C.ol; ctx.stroke(); }
  if (ex.includes('adipose')) { edgeFin(ctx, g, 1, 0.12, 0.2, H * 0.35, 'round'); ctx.fillStyle = C.fin; ctx.fill(); ctx.lineWidth = lw; ctx.strokeStyle = C.finOl; ctx.stroke(); }
  if (ex.includes('bump')) { const p = g.at(te + 0.03, 0.95); ctx.beginPath(); ctx.ellipse(p.x, p.y + H * 0.05, H * 0.35, H * 0.25, 0, Math.PI, TAU); ctx.fillStyle = shade(C.c1, 0.08); ctx.fill(); ctx.lineWidth = lw; ctx.strokeStyle = C.ol; ctx.stroke(); }
  if (ex.includes('lumps') || ex.includes('warts')) { /* desenhados no padrão */ }
  if (ex.includes('moss')) for (let i = 0; i < 9; i++) { const t = 0.2 + i * 0.07, b = g.at(t, 0.95); ctx.beginPath(); ctx.ellipse(b.x, b.y - H * 0.05, H * 0.16, H * 0.1, 0, 0, TAU); ctx.fillStyle = i % 2 ? '#7fb53a' : '#9ed65a'; ctx.fill(); }
  if (ex.includes('tusk')) { const s = g.at(te + 0.05, 0.6), tt = g.T(1); ctx.beginPath(); ctx.moveTo(s.x, s.y - H * 0.08); ctx.lineTo(s.x + tt.x * 0.36, s.y + tt.y * 0.36 - H * 0.3); ctx.lineTo(s.x, s.y + H * 0.08); ctx.closePath(); const gr = ctx.createLinearGradient(s.x, s.y, s.x + 0.36, s.y); gr.addColorStop(0, '#d6f4ff'); gr.addColorStop(1, '#ffffff'); ctx.fillStyle = gr; ctx.fill(); ctx.lineWidth = lw; ctx.strokeStyle = '#5f9fc4'; ctx.stroke(); for (let i = 1; i < 5; i++) { const a = { x: s.x + tt.x * 0.07 * i, y: s.y - H * 0.08 * i * 0.6 }; ctx.beginPath(); ctx.moveTo(a.x, a.y - 0.008); ctx.lineTo(a.x + 0.012, a.y + 0.012); ctx.lineWidth = lw * 0.5; ctx.stroke(); } }
  if (ex.includes('horn') || ex.includes('horns')) { const b = g.at(te + 0.01, 0.95); const two = ex.includes('horns'); for (let k = 0; k < (two ? 2 : 1); k++) { const o = { x: b.x - 0.04 - k * 0.05, y: b.y - H * (two ? 0.7 : 1.2) }; ctx.beginPath(); ctx.moveTo(b.x - 0.02 - k * 0.05, b.y); ctx.lineTo(o.x, o.y); ctx.lineTo(b.x + 0.02 - k * 0.05, b.y); ctx.closePath(); ctx.fillStyle = two ? C.c3 : '#ffffff'; ctx.fill(); ctx.lineWidth = lw; ctx.strokeStyle = shade(C.c3, -0.5); ctx.stroke(); } }
  if (ex.includes('crown')) { const b = g.at(te - 0.02, 0.9); ctx.beginPath(); const w = H * 0.6; ctx.moveTo(b.x - w, b.y); ctx.lineTo(b.x - w, b.y - H * 0.45); ctx.lineTo(b.x - w / 2, b.y - H * 0.25); ctx.lineTo(b.x, b.y - H * 0.55); ctx.lineTo(b.x + w / 2, b.y - H * 0.25); ctx.lineTo(b.x + w, b.y - H * 0.45); ctx.lineTo(b.x + w, b.y); ctx.closePath(); ctx.fillStyle = '#ffd23f'; ctx.fill(); ctx.lineWidth = lw; ctx.strokeStyle = '#a06a00'; ctx.stroke(); }
  if (ex.includes('crest')) { for (let i = 0; i < 4; i++) { const b = g.at(te - 0.01 - i * 0.02, 0.95), o = g.out(te - 0.04 - i * 0.03, 1, H * (0.6 + i * 0.12)); ctx.beginPath(); ctx.moveTo(b.x, b.y); ctx.quadraticCurveTo(b.x - 0.01, (b.y + o.y) / 2, o.x, o.y); ctx.lineWidth = lw * 1.6; ctx.strokeStyle = C.c3; ctx.stroke(); } }
  if (ex.includes('whiskers')) for (let i = 0; i < 2; i++) { const s = g.at(0.985, -0.2), e = { x: s.x - 0.05 - i * 0.05, y: s.y + H * (0.7 + i * 0.4) }; ctx.beginPath(); ctx.moveTo(s.x, s.y); ctx.quadraticCurveTo(s.x + 0.03, (s.y + e.y) / 2, e.x, e.y); ctx.lineWidth = lw * 1.2; ctx.strokeStyle = C.c3; ctx.stroke(); }
  if (ex.includes('chinBarbel')) { const s = g.at(0.96, -0.9); ctx.beginPath(); ctx.moveTo(s.x, s.y); ctx.lineTo(s.x - 0.01, s.y + H * 0.35); ctx.lineWidth = lw * 1.1; ctx.strokeStyle = shade(C.c1, -0.4); ctx.stroke(); }
  if (ex.includes('tentacles')) for (let i = 0; i < 3; i++) { const s = g.at(0.93 - i * 0.03, -0.3), e = { x: s.x + 0.02, y: s.y + H * 0.5 }; ctx.beginPath(); ctx.moveTo(s.x, s.y); ctx.lineTo(e.x, e.y); ctx.lineWidth = lw * 1.3; ctx.strokeStyle = '#ffffff'; ctx.stroke(); }
  if (ex.includes('lure')) { const b = g.at(te + 0.02, 1), tip = { x: b.x + 0.1, y: b.y - H * 1.3 }; ctx.beginPath(); ctx.moveTo(b.x, b.y); ctx.quadraticCurveTo(b.x - 0.02, tip.y, tip.x, tip.y); ctx.lineWidth = lw * 1.2; ctx.strokeStyle = shade(C.c1, -0.3); ctx.stroke(); if (!opts.silhouette) { ctx.beginPath(); ctx.arc(tip.x, tip.y, H * 0.22, 0, TAU); ctx.fillStyle = rgba(C.c3, 0.35); ctx.fill(); } ctx.beginPath(); ctx.arc(tip.x, tip.y, H * 0.12, 0, TAU); ctx.fillStyle = C.c3; ctx.fill(); ctx.lineWidth = lw * 0.6; ctx.strokeStyle = C.ol; ctx.stroke(); }
  if (ex.includes('heart') && !opts.silhouette) { const p = g.at(0.62, -0.35); ctx.beginPath(); ctx.arc(p.x, p.y, H * 0.13, 0, TAU); ctx.fillStyle = C.c3; ctx.fill(); }
  if (ex.includes('lateralWhite')) { ctx.beginPath(); for (let i = 0; i <= 20; i++) { const p = g.at(0.05 + i * 0.042, 0.15 + 0.15 * Math.sin(i * 0.4)); i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y); } ctx.lineWidth = lw * 1.1; ctx.strokeStyle = rgba('#ffffff', 0.8); ctx.stroke(); }
  if (ex.includes('faceLines')) for (let i = 0; i < 2; i++) { const a = g.at(0.9 - i * 0.04, 0.6), b = g.at(0.86 - i * 0.04, -0.6); ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.lineWidth = lw * 1.2; ctx.strokeStyle = C.c3; ctx.stroke(); }
  if (ex.includes('finEdge')) { /* bordas pretas: contorno extra nas nadadeiras já aplicado */ }
  if (ex.includes('frost') && !opts.silhouette) for (let i = 0; i < 10; i++) { const p = g.at(R(), 0.5 + R() * 0.5); star(ctx, p.x, p.y, H * 0.09, '#ffffff'); }
}

function star(ctx, x, y, r, col) {
  ctx.beginPath();
  for (let i = 0; i < 8; i++) { const a = (i / 8) * TAU, rr = i % 2 ? r * 0.35 : r; ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); }
  ctx.closePath(); ctx.fillStyle = col; ctx.fill();
}

// ───────────── Função principal ─────────────
// Desenha a espécie centralizada no retângulo (0,0,w,h) do contexto.
export function drawFish(ctx, species, w, h, opts = {}) {
  const art = species.art;
  const g = buildGeom(art);
  const R = rng(species.index * 7919 + 17);
  const [c1, c2, c3, c4] = art.colors;
  const C = { c1, c2, c3, c4, fin: c4, ol: shade(c1, -0.62), finOl: shade(c4, -0.55) };
  // Caixa de enquadramento aproximada (unidades do corpo)
  const H = g.Hh;
  const tailL = clamp(H * 1.7, 0.1, 0.26) * (art.tail === 'veil' ? 2.1 : art.tail === 'pointed' ? 1.6 : art.tail === 'flame' ? 1.55 : art.tail === 'crystalBig' ? 1.4 : 1.25);
  let top = H * 1.05 + ({ sail: H * 2.3, tall: H * 1.2, crown: H * 1.4, lion: H * 1.9, crestRibbon: H * 2.4, flame: H * 1.45, crystalCrown: H * 1.7, iceSpikes: H * 1.4, sailSpots: H * 1.3, frilly: H * 0.9, shark: H * 1.05, spiky: H * 0.75, thread: H * 0.9 }[art.dorsal] ?? H * 0.6);
  if (art.extras?.includes('lure')) top = Math.max(top, H * 2.4);
  if (art.extras?.includes('horn')) top = Math.max(top, H * 2.2);
  if (art.extras?.includes('tusk')) top = Math.max(top, H * 1.6);
  if (art.tail === 'shark' || art.tail === 'veil' || art.tail === 'lunate' || art.tail === 'deepFork') top = Math.max(top, tailL * 0.95);
  let bot = H * g.bellyR * 1.05 + ({ veil: H * 1.7, tall: H, long: H * 0.5, frilly: H * 0.85, flame: H }[art.anal] ?? H * 0.5);
  if (art.pectoral === 'wing' || art.pectoral === 'oar' || art.pectoral === 'long') bot = Math.max(bot, H * 2);
  if (art.mouth === 'rootWhiskers') bot = Math.max(bot, H * 2.6);
  if (['whiskers', 'snoutBarbels'].includes(art.mouth)) bot = Math.max(bot, H * 1.6);
  bot = Math.max(bot, tailL * 0.95);
  const front = ({ needle: 0.17, bill: 0.2, croc: 0.13, snout: 0.05, snoutBarbels: 0.14 }[art.mouth] ?? 0) + (art.extras?.includes('tusk') ? 0.3 : 0) + 0.01;
  const waveA = g.longBody ? Math.min(0.11, 0.025 * (g.aspect - 5)) : 0;
  const bx0 = -0.5 - tailL, bx1 = 0.5 + front, by0 = -top - waveA, by1 = bot + waveA;
  const bw = bx1 - bx0, bh = by1 - by0;
  const pad = opts.pad ?? 0.08;
  const sc = Math.min((w * (1 - pad * 2)) / bw, (h * (1 - pad * 2)) / bh);
  const lw = (opts.lineWidth ?? 1.6) / sc;

  ctx.save();
  ctx.translate(w / 2 - ((bx0 + bx1) / 2) * sc, h / 2 - ((by0 + by1) / 2) * sc);
  if (opts.flip) { ctx.translate(((bx0 + bx1) / 2) * sc, 0); ctx.scale(-1, 1); ctx.translate(-((bx0 + bx1) / 2) * sc, 0); }
  ctx.scale(sc, sc);
  ctx.lineJoin = 'round'; ctx.lineCap = 'round';

  // Aura discreta dos lendários
  if (art.glow && !opts.silhouette && opts.glow !== false) {
    ctx.save();
    const gr = ctx.createRadialGradient(0, 0, 0.05, 0, 0, 0.75);
    gr.addColorStop(0, rgba(art.glow, 0.35)); gr.addColorStop(1, rgba(art.glow, 0));
    ctx.fillStyle = gr; ctx.fillRect(bx0 - 0.2, by0 - 0.2, bw + 0.4, bh + 0.4);
    ctx.restore();
  }

  // Nadadeiras de trás
  drawTail(ctx, g, art, C, lw, R);
  drawDorsal(ctx, g, art, C, lw, R);
  drawAnal(ctx, g, art, C, lw, R);
  drawSnoutExt(ctx, g, art, C, lw);

  // Corpo
  const translucent = art.extras?.includes('translucent');
  bodyPath(ctx, g);
  const gr = ctx.createLinearGradient(0, -H * 1.1, 0, H * g.bellyR * 1.1);
  gr.addColorStop(0, shade(c1, -0.12)); gr.addColorStop(0.45, c1); gr.addColorStop(0.62, mix(c1, c2, 0.6)); gr.addColorStop(1, c2);
  ctx.globalAlpha = translucent ? 0.62 : 1;
  ctx.fillStyle = gr; ctx.fill();
  ctx.globalAlpha = 1;
  ctx.save();
  bodyPath(ctx, g); ctx.clip();
  drawPattern(ctx, g, art, C, lw, R);
  // sombreamento volumétrico
  const sh = ctx.createLinearGradient(0, -H, 0, H * g.bellyR);
  sh.addColorStop(0, 'rgba(255,255,255,0.28)'); sh.addColorStop(0.35, 'rgba(255,255,255,0)'); sh.addColorStop(0.8, 'rgba(0,0,0,0)'); sh.addColorStop(1, 'rgba(0,0,0,0.18)');
  ctx.fillStyle = sh; ctx.fillRect(bx0, by0, bw, bh);
  if (art.extras?.includes('shine')) { ctx.beginPath(); for (let i = 0; i <= 16; i++) { const p = g.at(0.3 + i * 0.035, 0.55); i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y); } ctx.lineWidth = H * 0.12; ctx.strokeStyle = 'rgba(255,255,255,0.55)'; ctx.stroke(); }
  ctx.restore();
  bodyPath(ctx, g);
  ctx.lineWidth = lw * 1.15; ctx.strokeStyle = C.ol; ctx.stroke();

  drawExtras(ctx, g, art, C, lw, R, opts);
  drawPectoral(ctx, g, art, C, lw, true);
  drawHead(ctx, g, art, C, lw, opts, R);
  ctx.restore();
}

// ───────────── Cache de imagens (ícone, coleção, sprite) ─────────────
const cache = new Map();
const MAX_IMAGES = 160;
// kind: 'icon' (quadrado, contorno grosso), 'card' (coleção, grande), 'sprite' (mundo)
export function fishImage(id, kind = 'icon', size = 64, silhouette = false, store = true) {
  const key = `${id}|${kind}|${size}|${silhouette ? 1 : 0}`;
  let c = cache.get(key);
  if (c) return c;
  const sp = SPECIES_BY_ID[id];
  const w = kind === 'card' ? size : kind === 'sprite' ? size : size;
  const h = kind === 'card' ? Math.round(size * 0.62) : kind === 'sprite' ? Math.round(size * 0.6) : size;
  c = makeCanvas(w, h);
  const ctx = c.getContext('2d');
  const lineWidth = kind === 'icon' ? Math.max(1.4, size / 34) : kind === 'card' ? Math.max(1.6, size / 150) : Math.max(1.2, size / 60);
  drawFish(ctx, sp, w, h, { lineWidth, pad: kind === 'icon' ? 0.07 : 0.06, silhouette });
  if (silhouette) {
    ctx.globalCompositeOperation = 'source-in';
    ctx.fillStyle = '#1d3a4a';
    ctx.fillRect(0, 0, w, h);
  }
  if (store) {
    cache.set(key, c);
    if (cache.size > MAX_IMAGES) { const k0 = cache.keys().next().value; cache.delete(k0); }
  }
  return c;
}
// Imagens para a interface: guarda só a URL (PNG comprimido), não o canvas
const urlCache = new Map();
export function fishDataURL(id, kind, size, silhouette = false) {
  const key = `${id}|${kind}|${size}|${silhouette}`;
  let u = urlCache.get(key);
  if (!u) {
    const c = fishImage(id, kind, size, silhouette, false);
    u = c.toDataURL();
    c.width = c.height = 1;
    urlCache.set(key, u);
  }
  return u;
}
