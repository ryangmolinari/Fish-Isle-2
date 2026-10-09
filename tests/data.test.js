// Validação dos dados e mapas: node tests/data.test.js
import assert from 'node:assert/strict';
import { SPECIES, spawnTable } from '../shared/fish.js';
import { RARITY_ORDER } from '../shared/config.js';
import { getRegion, ISLAND_ORDER } from '../shared/islands.js';
import { RODS, ROD_ORDER } from '../shared/items.js';
import { minigameParams, createMinigame, stepMinigame, replayMinigame } from '../shared/minigame.js';
import { botHold } from './bot-brain.js';
import { mulberry32 } from '../shared/rng.js';

let passed = 0;
const ok = (name, fn) => { fn(); passed++; console.log('  ✓', name); };

console.log('Espécies');
ok('exatamente 50 espécies com ids e nomes únicos', () => {
  assert.equal(SPECIES.length, 50);
  assert.equal(new Set(SPECIES.map((s) => s.id)).size, 50);
  assert.equal(new Set(SPECIES.map((s) => s.name)).size, 50);
});
ok('10 por ilha: 4 comuns, 3 incomuns, 2 raras, 1 lendária', () => {
  for (const id of ISLAND_ORDER) {
    const g = SPECIES.filter((s) => s.island === id);
    assert.equal(g.length, 10, id);
    const c = Object.fromEntries(RARITY_ORDER.map((r) => [r, g.filter((s) => s.rarity === r).length]));
    assert.deepEqual(c, { common: 4, uncommon: 3, rare: 2, legendary: 1 }, id);
  }
});
ok('campos obrigatórios e intervalos válidos', () => {
  for (const s of SPECIES) {
    for (const k of ['name', 'desc', 'island', 'rarity', 'behavior']) assert.ok(s[k], `${s.id}.${k}`);
    assert.ok(s.size[0] < s.size[1] && s.kg[0] < s.kg[1], s.id);
    assert.ok(s.value > 0 && s.difficulty > 0 && s.difficulty < 1, s.id);
    assert.ok(s.art && s.art.shape.length === 5 && s.art.colors.length === 4, s.id);
  }
});
ok('silhuetas diferentes (combinação forma+cauda+dorsal+boca única)', () => {
  const keys = SPECIES.map((s) => [s.art.shape.join(','), s.art.tail, s.art.dorsal, s.art.mouth].join('|'));
  assert.equal(new Set(keys).size, 50);
});
ok('probabilidades por ilha somam 100% e respeitam 55/28/14/3', () => {
  for (const id of ISLAND_ORDER) {
    const t = spawnTable(id);
    const sum = t.reduce((a, e) => a + e.p, 0);
    assert.ok(Math.abs(sum - 1) < 1e-9);
    const by = (r) => t.filter((e) => SPECIES.find((s) => s.id === e.id).rarity === r).reduce((a, e) => a + e.p, 0);
    assert.ok(Math.abs(by('common') - 0.55) < 1e-9 && Math.abs(by('legendary') - 0.03) < 1e-9);
  }
});

console.log('Mapas');
for (const id of ISLAND_ORDER) {
  const r = getRegion(id);
  // BFS em grade de 16px sobre o terreno caminhável
  const S = 16, W = Math.ceil(3072 / S), H = Math.ceil(2304 / S);
  const seen = new Uint8Array(W * H);
  const start = [Math.floor(r.spawn.x / S), Math.floor(r.spawn.y / S)];
  const q = [start]; seen[start[1] * W + start[0]] = 1;
  while (q.length) {
    const [x, y] = q.pop();
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx, ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= W || ny >= H || seen[ny * W + nx]) continue;
      if (!r.walkable(nx * S + S / 2, ny * S + S / 2)) continue;
      seen[ny * W + nx] = 1; q.push([nx, ny]);
    }
  }
  const reach = (x, y, rad = 24) => {
    for (let yy = y - rad; yy <= y + rad; yy += 8) for (let xx = x - rad; xx <= x + rad; xx += 8) {
      const gx = Math.floor(xx / S), gy = Math.floor(yy / S);
      if (gx >= 0 && gy >= 0 && gx < W && gy < H && seen[gy * W + gx]) return true;
    }
    return false;
  };
  ok(`${id}: spawn, loja e embarque alcançáveis a pé`, () => {
    assert.ok(r.walkable(r.spawn.x, r.spawn.y), 'spawn');
    assert.ok(reach(r.shop.x, r.shop.y, 32), 'loja');
    for (const m of r.moorings) assert.ok(reach(m.board.x, m.board.y), 'embarque');
  });
  ok(`${id}: barco cabe no cais e todas as passagens têm rota`, () => {
    for (const m of r.moorings) {
      assert.ok(r.boatFits(m.boat.x, m.boat.y, m.boat.a), 'barco no cais');
      for (const g of Object.values(r.gates)) {
        assert.ok(r.navigable(g.x, g.y), `passagem ${g.to} navegável`);
        const avoid = Object.values(r.gates).filter((o) => o !== g).map((o) => ({ x: o.x, y: o.y, r: o.r + 40 }));
        const route = r.findRoute(m.boat.x, m.boat.y, g.x, g.y, avoid);
        assert.ok(route.length >= 2 && r._lineNav(route[route.length - 2], route[route.length - 1]), `rota até ${g.to}`);
        for (const p of route) for (const o of avoid) assert.ok(Math.hypot(p.x - o.x, p.y - o.y) >= o.r - 1, `rota até ${g.to} não cruza outra passagem`);
      }
    }
    const gs = Object.values(r.gates);
    for (let i = 0; i < gs.length; i++) for (let j = i + 1; j < gs.length; j++)
      assert.ok(Math.hypot(gs[i].x - gs[j].x, gs[i].y - gs[j].y) > 230, `passagens ${gs[i].to}/${gs[j].to} separadas`);
  });
  ok(`${id}: chegada de cada ilha é segura`, () => {
    for (const other of ISLAND_ORDER) if (other !== id) {
      const a = r.arrivalFrom(other);
      assert.ok(r.boatFits(a.x, a.y, a.a), `chegada de ${other}`);
      // a chegada precisa estar ligada ao mar aberto: há rota válida até o cais e de volta à passagem
      for (const target of [r.moorings[0].boat, r.gates[other]]) {
        const route = r.findRoute(a.x, a.y, target.x, target.y);
        for (let k = 0; k < route.length - 1; k++) assert.ok(r._lineNav(route[k], route[k + 1]), `rota da chegada (${other}) até ${target.to || 'cais'}`);
      }
      assert.ok(Math.hypot(a.x - r.gates[other].x, a.y - r.gates[other].y) > r.gates[other].r + 30, 'fora da passagem');
    }
  });
  ok(`${id}: ${r.hotspots.length} pontos de pesca acessíveis com a vara inicial`, () => {
    assert.ok(r.hotspots.length >= 4);
    for (const h of r.hotspots) {
      assert.ok(r.fishable(h.x, h.y), `hotspot ${h.x},${h.y} na água`);
      let best = Infinity;
      for (let gy = 0; gy < H; gy++) for (let gx = 0; gx < W; gx++) if (seen[gy * W + gx]) {
        const d = Math.hypot(gx * S + 8 - h.x, gy * S + 8 - h.y);
        if (d < best) best = d;
      }
      assert.ok(best - h.r * 0.6 <= RODS.vara_bambu.range - 10, `hotspot ${h.x},${h.y} alcance ${best.toFixed(0)}`);
    }
  });
}

console.log('Minigame');
ok('simulação determinística e reprodutível pelo servidor', () => {
  const sp = SPECIES.find((s) => s.rarity === 'rare');
  const p = minigameParams(sp, RODS.vara_carbono);
  const s = createMinigame(p, 12345);
  const bits = [];
  const rr = mulberry32(9);
  while (!s.done) { const h = botHold(s, 0.9, rr); bits.push(h ? 1 : 0); stepMinigame(s, h); }
  const rep = replayMinigame(p, 12345, bits);
  assert.equal(rep.result, s.result); assert.equal(rep.tick, s.tick); assert.equal(rep.progress, s.progress);
});
ok('dificuldade cresce com a raridade e varas melhores ajudam', () => {
  const winRate = (rar, rodId, skill) => {
    let w = 0, n = 0;
    for (const sp of SPECIES.filter((s) => s.rarity === rar)) for (let seed = 1; seed <= 12; seed++) {
      const s = createMinigame(minigameParams(sp, RODS[rodId]), seed * 977);
      const rr = mulberry32(seed);
      while (!s.done) stepMinigame(s, botHold(s, skill, rr));
      n++; if (s.result === 'caught') w++;
    }
    return w / n;
  };
  const rows = [];
  for (const rar of RARITY_ORDER) rows.push([rar, ...ROD_ORDER.map((r) => (winRate(rar, r, 0.8) * 100).toFixed(0) + '%')]);
  console.table(rows.map((r) => Object.fromEntries([['raridade', r[0]], ...ROD_ORDER.map((id, i) => [RODS[id].name, r[i + 1]])])));
  assert.ok(winRate('common', 'vara_bambu', 0.8) > winRate('legendary', 'vara_bambu', 0.8));
  assert.ok(winRate('legendary', 'vara_prismatica', 0.8) >= winRate('legendary', 'vara_bambu', 0.8));
  assert.ok(winRate('legendary', 'vara_prismatica', 0.8) < 1, 'vara não garante lendária');
});

console.log(`\n${passed} verificações passaram.`);
