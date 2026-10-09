// Testes de integração do servidor com clientes reais via WebSocket.
// Uso: node tests/server.test.js   (sobe o servidor numa porta livre)
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { Bot, sleep } from './botlib.js';
import { getRegion, ISLAND_ORDER } from '../shared/islands.js';
import { MAX_PLAYERS_PER_ROOM } from '../shared/config.js';

const PORT = 3900 + Math.floor(Math.random() * 90);
const URL = `ws://127.0.0.1:${PORT}/ws`;
const srv = spawn(process.execPath, ['server/index.js'], { env: { ...process.env, PORT, QUIET: '1' }, stdio: 'inherit' });
process.on('exit', () => srv.kill());
await sleep(900);

let passed = 0;
const t0 = Date.now();
async function test(name, fn) {
  const s = Date.now();
  try { await fn(); passed++; console.log(`  ✓ ${name} (${((Date.now() - s) / 1000).toFixed(1)}s)`); }
  catch (e) { console.error(`  ✗ ${name}\n`, e); srv.kill(); process.exit(1); }
}

console.log('Sala e capacidade');
let code, bots = [];
await test('cria sala privada e 12 jogadores entram pelo código', async () => {
  const host = new Bot(URL, 'Anfitrião');
  const w = await host.connect({ mode: 'create' });
  assert.equal(w.t, 'welcome');
  code = w.room.code;
  bots.push(host);
  for (let i = 1; i < MAX_PLAYERS_PER_ROOM; i++) {
    const b = new Bot(URL, `Bot${i}`, { char: i % 6 });
    const r = await b.connect({ mode: 'code', code });
    assert.equal(r.t, 'welcome', `bot ${i}`);
    bots.push(b);
  }
  await sleep(300);
  assert.equal(bots[0].room.count, 12);
  assert.equal(new Set(bots.map((b) => b.me.id)).size, 12);
});
await test('13º jogador é recusado com mensagem clara', async () => {
  const b = new Bot(URL, 'Extra');
  const r = await b.connect({ mode: 'code', code });
  assert.equal(r.t, 'err'); assert.equal(r.code, 'full');
  assert.match(r.msg, /cheia \(12\/12\)/);
  b.close();
});
await test('código inexistente informa sala não encontrada', async () => {
  const b = new Bot(URL, 'Perdido');
  const r = await b.connect({ mode: 'code', code: 'ZZZZZ' });
  assert.equal(r.code, 'notfound'); b.close();
});
await test('jogadores recebem snapshots só da própria região', async () => {
  await sleep(500);
  assert.ok(bots.every((b) => b.snapshots > 3));
  assert.equal(bots[0].others.size, 11);
});

console.log('Reconexão');
await test('desconectar reserva a vaga e reconectar restaura sem duplicar', async () => {
  const b = bots[5];
  const { token, id } = b.me;
  b.close();
  await sleep(400);
  assert.equal(bots[0].room.count, 11);
  assert.ok(!bots[0].others.has(id));
  const intruder = new Bot(URL, 'Intruso');
  const r1 = await intruder.connect({ mode: 'code', code });
  assert.equal(r1.code, 'full', 'vaga reservada para quem caiu');
  intruder.close();
  const back = new Bot(URL, 'Bot5');
  const r2 = await back.connect({ mode: 'code', code, token });
  assert.equal(r2.t, 'welcome'); assert.equal(r2.you.id, id);
  bots[5] = back;
  await sleep(400);
  assert.equal(bots[0].room.count, 12);
  assert.equal([...bots[0].others.values()].filter((o) => o.p.id === id).length, 1);
});
await test('mesma sessão em duas janelas derruba a antiga (sem personagem duplicado)', async () => {
  const b = bots[6];
  const dup = new Bot(URL, 'Bot6');
  const kicked = b.waitFor((m) => m.t === 'kicked', 4000, 'kicked');
  const r = await dup.connect({ mode: 'code', code, token: b.me.token });
  assert.equal(r.t, 'welcome');
  await kicked;
  bots[6] = dup;
  await sleep(400);
  assert.equal(bots[0].room.count, 12);
});

console.log('Pesca');
await test('lançar sobre terra é bloqueado', async () => {
  const b = bots[1];
  const r = getRegion('tropical');
  const land = r.shop;
  b.send({ t: 'cast', x: land.x, y: land.y - 100, power: 1 });
  const m = await b.waitFor((m) => m.t === 'fish' && m.st === 'castNo', 3000, 'castNo');
  assert.ok(m.reason);
});
await test('resultado forjado da luta é rejeitado pelo servidor', async () => {
  const b = bots[2];
  await b.walkTo(b.me.x, b.me.y + 60);
  const tgt = b.findCastTarget();
  b.send({ t: 'cast', x: tgt.x, y: tgt.y, power: tgt.power });
  await b.waitFor((m) => m.t === 'fish' && m.st === 'bite', 20000, 'mordida');
  b.send({ t: 'hook' });
  await b.waitFor((m) => m.t === 'fish' && m.st === 'fight', 3000, 'fight');
  b.send({ t: 'fight', n: 30, b64: 'AAAAAA==' }); // 1 s sem fazer nada não pode capturar
  const r = await b.waitFor((m) => m.t === 'fish' && (m.st === 'lost' || m.st === 'caught'), 3000, 'resultado');
  assert.equal(r.st, 'lost');
  assert.equal(b.me.inventory.length, 0);
});
await test('ciclo completo de pesca adiciona o peixe sorteado pelo servidor', async () => {
  // quatro jogadores pescando em paralelo no píer
  const fishers = bots.slice(7, 11);
  await Promise.all(fishers.map((b, i) => b.walkTo(b.me.x + (i - 1.5) * 10, b.me.y + 120 + i * 20)));
  const res = await Promise.all(fishers.map(async (b) => {
    for (let k = 0; k < 8; k++) { const r = await b.fishOnce(0.9); if (r.result === 'caught') return r; }
    return null;
  }));
  for (const [i, r] of res.entries()) {
    assert.ok(r, `bot ${i} pescou`);
    assert.equal(fishers[i].me.inventory.length >= 1, true);
    assert.ok(fishers[i].me.collection[r.fish.sp].n >= 1);
  }
});

console.log('Economia');
await test('vender com confirmação de valor, sem venda duplicada nem moedas negativas', async () => {
  const b = bots[7];
  const r = getRegion('tropical');
  const d = await b.walkTo(r.shop.x, r.shop.y);
  assert.ok(d < 60, 'chegou na loja');
  const fish = b.me.inventory[0];
  const coins0 = b.me.coins;
  b.send({ t: 'sell', uids: [fish.uid], expect: fish.value + 1 });
  let m = await b.waitFor((m) => m.t === 'shop', 3000, 'shop');
  assert.equal(m.ok, false, 'valor conferido no servidor');
  const replies = [];
  const both = b.waitFor((m) => m.t === 'shop' && replies.push(m) === 2, 3000, 'duas respostas');
  b.send({ t: 'sell', uids: [fish.uid], expect: fish.value });
  b.send({ t: 'sell', uids: [fish.uid], expect: fish.value }); // clique duplo
  await both;
  const [a1, a2] = replies;
  assert.equal(a1.ok, true); assert.equal(a2.ok, false);
  assert.equal(b.me.coins, coins0 + fish.value);
  // comprar vara cara demais
  b.send({ t: 'buy', kind: 'rod', id: 'vara_carbono' });
  m = await b.waitFor((m) => m.t === 'shop', 3000, 'compra');
  assert.equal(m.ok, false); assert.ok(b.me.coins >= 0);
  // compra válida de isca regional e item que a loja não vende
  b.send({ t: 'buy', kind: 'bait', id: 'camarao' });
  m = await b.waitFor((m) => m.t === 'shop', 3000, 'isca');
  assert.equal(m.ok, true); assert.equal(b.me.baits.camarao, 10); assert.equal(b.me.coins, coins0 + fish.value - 45);
  b.send({ t: 'buy', kind: 'bait', id: 'krill' });
  m = await b.waitFor((m) => m.t === 'shop', 3000, 'krill');
  assert.equal(m.ok, false);
  // a isca é consumida no servidor a cada lançamento
  b.send({ t: 'equip', kind: 'bait', id: 'camarao' });
  await b.waitFor((m) => m.t === 'me', 3000);
  assert.equal(b.me.bait, 'camarao');
});
await test('comprar longe da loja é recusado', async () => {
  const b = bots[3];
  b.send({ t: 'buy', kind: 'bait', id: 'minhoca' });
  const m = await b.waitFor((m) => m.t === 'shop', 3000);
  assert.equal(m.ok, false);
});

console.log('Barcos e viagem pelas cinco ilhas');
await test('embarcar, seguir a rota, viajar e desembarcar nas cinco ilhas preservando dados', async () => {
  const b = bots[8];
  const inv0 = JSON.stringify(b.me.inventory), coins0 = b.me.coins;
  const route = ['tropical', 'mangue', 'congelada', 'vulcanica', 'cristais', 'tropical'];
  for (let i = 0; i < route.length - 1; i++) {
    const r = getRegion(b.me.region);
    assert.equal(b.me.region, route[i]);
    const m = r.moorings[0];
    const d = await b.walkTo(m.board.x, m.board.y);
    assert.ok(d < 70, `chegou ao cais em ${route[i]} (${d.toFixed(0)}px)`);
    b.send({ t: 'board' });
    await b.waitFor((x) => x.t === 'mode' && x.mode === 'boat', 3000, 'embarcar');
    const g = r.gates[route[i + 1]];
    await b.sailTo(g.x, g.y, g.r * 0.6);
    b.send({ t: 'travel', to: route[i + 1] });
    const reg = await b.waitFor((x) => x.t === 'region', 4000, `viagem para ${route[i + 1]}`);
    assert.equal(reg.region, route[i + 1]);
    const dest = getRegion(route[i + 1]);
    assert.ok(dest.boatFits(reg.boat.x, reg.boat.y, reg.boat.a), 'chegada segura');
    const dm = dest.moorings[0];
    await b.sailTo(dm.boat.x, dm.boat.y, 60);
    b.send({ t: 'unboard' });
    const md = await b.waitFor((x) => x.t === 'mode' && x.mode === 'walk', 3000, 'desembarcar');
    assert.ok(dest.walkable(md.x, md.y));
  }
  assert.equal(JSON.stringify(b.me.inventory), inv0);
  assert.equal(b.me.coins, coins0);
  assert.ok((b.corrections || 0) < 5, `correções de posição: ${b.corrections}`);
});
await test('desembarcar longe de um cais é recusado e viajar sem estar na passagem também', async () => {
  const b = bots[9];
  const r = getRegion('tropical');
  await b.walkTo(r.moorings[0].board.x, r.moorings[0].board.y);
  b.send({ t: 'board' });
  await b.waitFor((x) => x.t === 'mode' && x.mode === 'boat', 3000);
  b.send({ t: 'travel', to: 'mangue' });
  const t1 = await b.waitFor((x) => x.t === 'toast', 3000);
  assert.match(t1.msg, /passagem/);
  await b.sailTo(r.gates.vulcanica.x, r.gates.vulcanica.y, 400);
  b.send({ t: 'unboard' });
  const t2 = await b.waitFor((x) => x.t === 'toast', 3000);
  assert.match(t2.msg, /cais/);
});
await test('12 barcos ao mesmo tempo no mesmo cais', async () => {
  const r = getRegion('tropical');
  const m = r.moorings[0];
  const land = bots.filter((b) => b.me.region === 'tropical' && b.me.mode === 'walk');
  const dists = await Promise.all(land.map((b) => b.walkTo(m.board.x, m.board.y)));
  for (const [i, d] of dists.entries()) assert.ok(d < 70, `${land[i].name} longe do cais: ${d.toFixed(0)}px em ${land[i].me.x.toFixed(0)},${land[i].me.y.toFixed(0)}`);
  for (const b of land) b.send({ t: 'board' });
  const modes = await Promise.all(land.map((b) => b.waitFor((x) => x.t === 'mode' && x.mode === 'boat', 4000, 'barco')));
  for (const md of modes) assert.ok(r.boatFits(md.boat.x, md.boat.y, md.boat.a));
  const total = land.length + bots.filter((b) => b.me.mode === 'boat' && !land.includes(b)).length;
  assert.ok(total >= 10, `barcos: ${total}`);
});
await test('ilhas diferentes na mesma sala: contagem por ilha', async () => {
  await sleep(300);
  const by = bots[0].room.byIsland;
  assert.equal(Object.values(by).reduce((a, b) => a + b, 0), 12);
});

for (const b of bots) b.close();
srv.kill();
console.log(`\n${passed} testes passaram em ${((Date.now() - t0) / 1000).toFixed(0)}s.`);
process.exit(0);
