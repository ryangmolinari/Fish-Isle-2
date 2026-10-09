// Servidor WebSocket (RFC 6455) mínimo, sem dependências externas.
// Suporta mensagens de texto, fragmentação, ping/pong, fechamento e limite de tamanho.
import { createHash } from 'node:crypto';
import { EventEmitter } from 'node:events';

const GUID = '258EAFA5-E914-47DA-95CA-C5AB0DC85B11';
const MAX_MESSAGE = 64 * 1024;

export class WSConnection extends EventEmitter {
  constructor(socket, req) {
    super();
    this.socket = socket;
    this.req = req;
    this.ip = req.headers['x-forwarded-for']?.split(',')[0].trim() || socket.remoteAddress;
    this.buf = Buffer.alloc(0);
    this.frag = null;
    this.open = true;
    this.lastPong = Date.now();
    socket.setNoDelay(true);
    socket.on('data', (d) => this._onData(d));
    socket.on('close', () => this._closed());
    socket.on('error', () => this._closed());
  }
  send(text) {
    if (!this.open) return;
    const payload = Buffer.from(text);
    this.socket.write(Buffer.concat([this._header(0x1, payload.length), payload]));
  }
  ping() { if (this.open) this.socket.write(this._header(0x9, 0)); }
  close(code = 1000, reason = '') {
    if (!this.open) return;
    const r = Buffer.from(reason).subarray(0, 120);
    const p = Buffer.alloc(2 + r.length);
    p.writeUInt16BE(code, 0); r.copy(p, 2);
    try { this.socket.write(Buffer.concat([this._header(0x8, p.length), p])); } catch {}
    this.open = false;
    setTimeout(() => this.socket.destroy(), 200);
    this._closed();
  }
  terminate() { this.socket.destroy(); this._closed(); }
  get bufferedAmount() { return this.socket.writableLength; }

  _header(op, len) {
    if (len < 126) return Buffer.from([0x80 | op, len]);
    if (len < 65536) { const h = Buffer.alloc(4); h[0] = 0x80 | op; h[1] = 126; h.writeUInt16BE(len, 2); return h; }
    const h = Buffer.alloc(10); h[0] = 0x80 | op; h[1] = 127; h.writeBigUInt64BE(BigInt(len), 2); return h;
  }
  _closed() {
    if (this._didClose) return;
    this._didClose = true;
    this.open = false;
    this.emit('close');
  }
  _onData(d) {
    this.buf = this.buf.length ? Buffer.concat([this.buf, d]) : d;
    while (this.buf.length >= 2) {
      const b0 = this.buf[0], b1 = this.buf[1];
      const fin = (b0 & 0x80) !== 0, op = b0 & 0x0f, masked = (b1 & 0x80) !== 0;
      let len = b1 & 0x7f, off = 2;
      if (len === 126) { if (this.buf.length < 4) return; len = this.buf.readUInt16BE(2); off = 4; }
      else if (len === 127) {
        if (this.buf.length < 10) return;
        const big = this.buf.readBigUInt64BE(2);
        if (big > BigInt(MAX_MESSAGE)) return this.close(1009, 'mensagem grande demais');
        len = Number(big); off = 10;
      }
      if (!masked) return this.close(1002, 'frame sem máscara');
      if (len > MAX_MESSAGE) return this.close(1009, 'mensagem grande demais');
      if (this.buf.length < off + 4 + len) return;
      const mask = this.buf.subarray(off, off + 4);
      const payload = Buffer.from(this.buf.subarray(off + 4, off + 4 + len));
      for (let i = 0; i < payload.length; i++) payload[i] ^= mask[i & 3];
      this.buf = this.buf.subarray(off + 4 + len);
      if (op === 0x8) { this.close(1000); return; }
      if (op === 0x9) { this.socket.write(Buffer.concat([this._header(0xa, payload.length), payload])); continue; }
      if (op === 0xa) { this.lastPong = Date.now(); continue; }
      if (op === 0x1 || op === 0x2) {
        if (fin) this.emit('message', payload.toString('utf8'));
        else this.frag = [payload];
      } else if (op === 0x0 && this.frag) {
        this.frag.push(payload);
        const total = this.frag.reduce((a, b) => a + b.length, 0);
        if (total > MAX_MESSAGE) return this.close(1009, 'mensagem grande demais');
        if (fin) { const m = Buffer.concat(this.frag).toString('utf8'); this.frag = null; this.emit('message', m); }
      }
    }
  }
}

// Anexa o tratamento de upgrade ao servidor HTTP
export function attachWebSocket(server, path, onConnection) {
  const conns = new Set();
  server.on('upgrade', (req, socket) => {
    const url = new URL(req.url, 'http://x');
    const key = req.headers['sec-websocket-key'];
    if (url.pathname !== path || req.headers.upgrade?.toLowerCase() !== 'websocket' || !key) {
      socket.end('HTTP/1.1 400 Bad Request\r\n\r\n');
      return;
    }
    const accept = createHash('sha1').update(key + GUID).digest('base64');
    socket.write(['HTTP/1.1 101 Switching Protocols', 'Upgrade: websocket', 'Connection: Upgrade', `Sec-WebSocket-Accept: ${accept}`, '', ''].join('\r\n'));
    const ws = new WSConnection(socket, req);
    conns.add(ws);
    ws.on('close', () => conns.delete(ws));
    onConnection(ws, req);
  });
  // Batimentos: encerra conexões que não respondem
  const hb = setInterval(() => {
    const now = Date.now();
    for (const ws of conns) {
      if (now - ws.lastPong > 35_000) ws.terminate();
      else ws.ping();
    }
  }, 12_000);
  hb.unref();
  return conns;
}
