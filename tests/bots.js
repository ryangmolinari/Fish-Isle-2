// Carga de jogadores simulados (protocolo real). Útil para testar a sala cheia e o desempenho.
// Uso: node tests/bots.js [--url ws://localhost:3000/ws] [--code ABCDE] [--n 11] [--secs 60]
// Sem --code, cria uma sala e imprime o código.
import { Bot, sleep } from './botlib.js';
import { getRegion } from '../shared/islands.js';

const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : d; };
const URL = arg('url', 'ws://localhost:3000/ws');
const N = +arg('n', 11);
const SECS = +arg('secs', 60);
let code = arg('code', null);

const bots = [];
const stats = { casts: 0, caught: 0, lost: 0, sails: 0, travels: 0, snaps: 0 };

async function life(b, i) {
  const end = Date.now() + SECS * 1000;
  const r = getRegion('tropical');
  const pier = r.moorings[0];
  // 7 pescam perto do píer, 2 navegam por perto, 2 viajam entre ilhas
  const role = i < 7 ? 'fisher' : i < 9 ? 'sailor' : 'traveler';
  try {
    if (role === 'fisher') {
      const spot = { x: pier.board.x + (i % 2 ? -10 : 10), y: pier.board.y - 40 - i * 22 };
      await b.walkTo(spot.x, spot.y);
      while (Date.now() < end) {
        stats.casts++;
        const res = await b.fishOnce(0.6 + Math.random() * 0.35).catch(() => ({ result: 'err' }));
        if (res.result === 'caught') stats.caught++; else stats.lost++;
        if (b.me.inventory.length >= b.me.capacity - 1) { await b.walkTo(r.shop.x, r.shop.y); b.send({ t: 'sell', uids: b.me.inventory.map((f) => f.uid) }); await sleep(500); await b.walkTo(spot.x, spot.y); }
        await sleep(300 + Math.random() * 1200);
      }
    } else {
      await b.walkTo(pier.board.x, pier.board.y);
      b.send({ t: 'board' });
      await b.waitFor((m) => m.t === 'mode' && m.mode === 'boat', 5000, 'barco');
      const isl = ['mangue', 'congelada', 'vulcanica', 'cristais'];
      let k = i;
      while (Date.now() < end) {
        if (role === 'sailor') {
          const a = Math.random() * Math.PI * 2;
          await b.sailTo(pier.boat.x + Math.cos(a) * 380, pier.boat.y + 160 + Math.abs(Math.sin(a)) * 220, 30);
          stats.sails++;
        } else {
          const reg = getRegion(b.me.region);
          const to = b.me.region === 'tropical' ? isl[k++ % isl.length] : 'tropical';
          const g = reg.gates[to];
          await b.sailTo(g.x, g.y, g.r * 0.6);
          b.send({ t: 'travel', to });
          await b.waitFor((m) => m.t === 'region', 5000, 'viagem').then(() => stats.travels++, () => {});
        }
      }
    }
  } catch (e) { stats.err = (stats.err || 0) + 1; }
}

const t0 = Date.now();
if (!code) {
  const host = new Bot(URL, 'Bot0', { char: 0 });
  const w = await host.connect({ mode: 'create' });
  code = w.room.code;
  bots.push(host);
}
console.log(`sala ${code}`);
for (let i = bots.length; i < N; i++) {
  const b = new Bot(URL, `Bot${i}`, { char: i % 6 });
  const r = await b.connect({ mode: 'code', code });
  if (r.t !== 'welcome') { console.log('recusado:', r.msg); break; }
  bots.push(b);
  await sleep(80);
}
console.log(`${bots.length} bots conectados`);
await Promise.all(bots.map((b, i) => life(b, i)));
const byRole = (from, to) => bots.slice(from, to).reduce((a, b) => a + (b.corrections || 0), 0);
console.log(JSON.stringify({ secs: ((Date.now() - t0) / 1000).toFixed(0), ...stats, corrections: { pescadores: byRole(0, 7), navegadores: byRole(7, 9), viajantes: byRole(9, 11) } }));
for (const b of bots) b.close();
process.exit(0);
