// Fish Isle — servidor HTTP (arquivos do jogo) + WebSocket (multiplayer).
// Sem dependências externas: node server/index.js
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { attachWebSocket } from './ws.js';
import { Room, makeCode } from './room.js';
import { MAX_PLAYERS_PER_ROOM } from '../shared/config.js';
import { ISLAND_ORDER, getRegion } from '../shared/islands.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const PORT = Number(process.env.PORT) || 3000;
const HOST = process.env.HOST || '0.0.0.0';
const QUIET = process.env.QUIET === '1';
const log = (...a) => { if (!QUIET) console.log(new Date().toISOString().slice(11, 19), ...a); };

const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.woff2': 'font/woff2',
};
const STATIC = [['/shared/', join(ROOT, 'shared')], ['/', join(ROOT, 'public')]];

// Pré-gera as regiões (colisão e mapas) para que a primeira viagem não pese no servidor
for (const id of ISLAND_ORDER) getRegion(id);

const rooms = new Map();
function createRoom(isPublic) {
  const code = makeCode((c) => rooms.has(c));
  const r = new Room(code, isPublic, log);
  rooms.set(code, r);
  log(`sala ${code} criada (${isPublic ? 'pública' : 'privada'})`);
  return r;
}
setInterval(() => {
  for (const [code, r] of rooms) if (r.isEmptyAndStale()) { r.destroy(); rooms.delete(code); log(`sala ${code} encerrada`); }
}, 15_000).unref();

const server = createServer(async (req, res) => {
  const url = new URL(req.url, 'http://x');
  if (url.pathname === '/healthz') {
    res.writeHead(200, { 'content-type': 'application/json' });
    return res.end(JSON.stringify({ ok: true, rooms: rooms.size, players: [...rooms.values()].reduce((a, r) => a + r.connectedCount(), 0) }));
  }
  if (url.pathname === '/api/rooms') {
    res.writeHead(200, { 'content-type': 'application/json', 'cache-control': 'no-store' });
    return res.end(JSON.stringify([...rooms.values()].filter((r) => r.isPublic).map((r) => ({ code: r.code, count: r.connectedCount(), max: MAX_PLAYERS_PER_ROOM }))));
  }
  for (const [prefix, dir] of STATIC) {
    if (!url.pathname.startsWith(prefix)) continue;
    let rel = decodeURIComponent(url.pathname.slice(prefix.length)) || 'index.html';
    const file = normalize(join(dir, rel));
    if (!file.startsWith(dir)) break;
    try {
      const st = await stat(file);
      const path = st.isDirectory() ? join(file, 'index.html') : file;
      const body = await readFile(path);
      res.writeHead(200, {
        'content-type': MIME[extname(path)] || 'application/octet-stream',
        'cache-control': extname(path) === '.html' ? 'no-cache' : 'public, max-age=300',
      });
      return res.end(body);
    } catch { break; }
  }
  res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
  res.end('Não encontrado');
});

attachWebSocket(server, '/ws', (ws) => {
  let joined = false;
  const timeout = setTimeout(() => { if (!joined) ws.close(4001, 'sem identificação'); }, 10_000);
  ws.on('message', (raw) => {
    let m;
    try { m = JSON.parse(raw); } catch { return; }
    if (!m || typeof m !== 'object') return;
    if (!joined) {
      if (m.t !== 'join') return;
      let room;
      if (m.mode === 'create') room = createRoom(false);
      else if (m.mode === 'code') {
        room = rooms.get(String(m.code || '').toUpperCase().trim());
        if (!room) return ws.send(JSON.stringify({ t: 'err', code: 'notfound', msg: 'Sala não encontrada. Confira o código.' }));
      } else { // jogar: sala pública com vaga, a mais cheia primeiro
        room = [...rooms.values()].filter((r) => r.isPublic && r.occupancy() < MAX_PLAYERS_PER_ROOM).sort((a, b) => b.connectedCount() - a.connectedCount())[0] || createRoom(true);
      }
      const res = room.join(ws, m);
      if (res.error === 'full') {
        return ws.send(JSON.stringify({ t: 'err', code: 'full', msg: `A sala ${room.code} está cheia (${MAX_PLAYERS_PER_ROOM}/${MAX_PLAYERS_PER_ROOM}). Tente outra sala ou crie uma nova.` }));
      }
      joined = true;
      clearTimeout(timeout);
      return;
    }
    ws.room.handle(ws, m);
  });
  ws.on('close', () => { clearTimeout(timeout); if (joined) ws.room.leave(ws); });
});

server.listen(PORT, HOST, () => log(`Fish Isle rodando em http://localhost:${PORT}`));

for (const sig of ['SIGINT', 'SIGTERM']) process.on(sig, () => { log('encerrando…'); server.close(); process.exit(0); });
