// Ferramentas de automação usadas pelos testes de ponta a ponta (inativas no jogo normal).
// Movem o personagem pelas mesmas regras do jogador (velocidade, colisão e validação do servidor).

export function installDebug(game) {
  const api = {
    // caminha até (x,y) por BFS em grade de 8 px
    walkTo(tx, ty) {
      const r = game.region, me = game.me, S = 8, W = 384, H = 288;
      const sx = Math.floor(me.x / S), sy = Math.floor(me.y / S);
      const prev = new Int32Array(W * H).fill(-1), seen = new Uint8Array(W * H);
      const q = [sy * W + sx]; seen[q[0]] = 1;
      // semeia células caminháveis vizinhas (o ponto atual pode estar colado num obstáculo)
      for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) {
        const n = (sy + dy) * W + sx + dx;
        if (!seen[n] && r.walkable((sx + dx) * S + 4, (sy + dy) * S + 4)) { seen[n] = 1; prev[n] = q[0]; q.push(n); }
      }
      let best = q[0], bd = Infinity;
      for (let i = 0; i < q.length; i++) {
        const c = q[i], x = c % W, y = (c / W) | 0;
        const d = Math.hypot(x * S + 4 - tx, y * S + 4 - ty);
        if (d < bd) { bd = d; best = c; }
        if (d < 8) break;
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const nx = x + dx, ny = y + dy, n = ny * W + nx;
          if (nx < 0 || ny < 0 || nx >= W || ny >= H || seen[n]) continue;
          if (!r.walkable(nx * S + 4, ny * S + 4) || !r.walkable(x * S + 4 + dx * 4, y * S + 4 + dy * 4)) continue;
          seen[n] = 1; prev[n] = c; q.push(n);
        }
      }
      const pts = [];
      for (let c = best; c !== -1; c = prev[c]) pts.push({ x: (c % W) * S + 4, y: ((c / W) | 0) * S + 4 });
      pts.reverse();
      game._auto = { kind: 'walk', pts, i: 0 };
      return pts.length;
    },
    sailTo(tx, ty) { game._auto = { kind: 'sail', tx, ty }; },
    stop() { game._auto = null; },
    get busy() { return !!game._auto; },
    autoFight: false,
    // posição útil para lançar: ponto de água mais próximo
    castTarget() {
      const r = game.region, me = game.me;
      for (let d = 60; d < 160; d += 10) for (let k = 0; k < 32; k++) {
        const a = (k / 32) * Math.PI * 2, x = me.x + Math.cos(a) * d, y = me.y + Math.sin(a) * d;
        if (r.fishable(x, y) && r.fishable(x + 12, y) && r.fishable(x, y + 12)) return { x, y, d };
      }
      return null;
    },
  };
  game.debug = api;
  return api;
}

// Passo de automação chamado pelo laço do jogo (antes da física)
export function autoStep(game, dt) {
  const A = game._auto;
  if (!A) return null;
  const me = game.me;
  if (A.kind === 'walk' && me.mode === 'walk') {
    while (A.i < A.pts.length && Math.hypot(A.pts[A.i].x - me.x, A.pts[A.i].y - me.y) < 2) A.i++;
    if (A.i >= A.pts.length) { game._auto = null; return null; }
    // sem progresso por alguns quadros: pula para o próximo ponto (ou replaneja)
    A.clock = (A.clock || 0) + dt;
    if (A.lx == null || Math.hypot(me.x - A.lx, me.y - A.ly) > 1) { A.lx = me.x; A.ly = me.y; A.lt = A.clock; }
    else if (A.clock - A.lt > 0.35) { A.i = Math.min(A.pts.length - 1, A.i + 1); A.lt = A.clock; A.skips = (A.skips || 0) + 1; if (A.skips > 12) { const end = A.pts[A.pts.length - 1]; game.debug.walkTo(end.x, end.y); return null; } }
    const p = A.pts[A.i];
    const dx = p.x - me.x, dy = p.y - me.y, L = Math.hypot(dx, dy) || 1;
    return [dx / L, dy / L];
  }
  if (A.kind === 'sail' && me.mode === 'boat') {
    const b = me.boat;
    if (!A.route || (A.t = (A.t || 0) - dt) <= 0) {
      const avoid = Object.values(game.region.gates).filter((g) => Math.hypot(g.x - A.tx, g.y - A.ty) > 20).map((g) => ({ x: g.x, y: g.y, r: g.r + 40 }));
      A.route = game.region.findRoute(b.x, b.y, A.tx, A.ty, avoid); A.t = 0.5;
    }
    const next = A.route[1] || { x: A.tx, y: A.ty };
    if (Math.hypot(A.tx - b.x, A.ty - b.y) < 40) { game._auto = null; return [0, 1]; }
    // progresso medido pelo comprimento restante da rota (não pela linha reta até o alvo)
    let dist = Math.hypot(next.x - b.x, next.y - b.y);
    for (let k = 1; k < A.route.length - 1; k++) dist += Math.hypot(A.route[k + 1].x - A.route[k].x, A.route[k + 1].y - A.route[k].y);
    // detecção de travamento: sem progresso por 2,5 s → manobra de ré
    A.clock = (A.clock || 0) + dt;
    if (A.best == null || dist < A.best - 10) { A.best = dist; A.bestT = A.clock; }
    if (!A.back && A.clock - A.bestT > 2.5) { A.back = 1.0; A.bestT = A.clock; }
    let da = Math.atan2(next.y - b.y, next.x - b.x) - b.a;
    while (da > Math.PI) da -= Math.PI * 2; while (da < -Math.PI) da += Math.PI * 2;
    const ad = Math.abs(da);
    if (A.back > 0) { A.back -= dt; if (A.back <= 0) A.back = 0; return [-Math.sign(da || 1), 1]; }
    let thrust = ad < 0.6 ? -1 : (b.v > 60 ? 1 : 0);
    return [ad > 0.06 ? Math.sign(da) : 0, thrust];
  }
  return null;
}
