// Conexão WebSocket com reconexão automática pelo token da sessão.
export class Net {
  constructor() {
    this.ws = null;
    this.handlers = new Map();
    this.joinMsg = null;
    this.connected = false;
    this.reconnecting = false;
    this.closedByUser = false;
    this.lastPong = 0;
    this.rtt = 0;
    this.clockOffset = 0; // servidor - cliente (ms)
  }
  on(type, fn) { this.handlers.set(type, fn); }
  url() { return `${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/ws`; }
  // Resolve com a primeira resposta (welcome ou err)
  connect(join) {
    this.joinMsg = join;
    this.closedByUser = false;
    return new Promise((resolve) => {
      let settled = false;
      const ws = new WebSocket(this.url());
      this.ws = ws;
      ws.onopen = () => ws.send(JSON.stringify({ t: 'join', ...join }));
      ws.onmessage = (ev) => {
        let m; try { m = JSON.parse(ev.data); } catch { return; }
        if (!settled && (m.t === 'welcome' || m.t === 'err')) {
          settled = true;
          if (m.t === 'welcome') { this.connected = true; this._startPing(); this.clockOffset = m.now - Date.now(); }
          resolve(m);
        }
        if (m.t === 'pong') { this.rtt = Date.now() - m.c; this.clockOffset = m.n + this.rtt / 2 - Date.now(); }
        if (m.t === 'kicked') this.closedByUser = true;
        this.handlers.get(m.t)?.(m);
      };
      ws.onclose = () => {
        const was = this.connected;
        this.connected = false;
        clearInterval(this.pingT);
        if (!settled) { settled = true; resolve({ t: 'err', code: 'offline', msg: 'Não foi possível conectar ao servidor.' }); }
        if (was && !this.closedByUser) this.handlers.get('_disconnected')?.();
      };
      ws.onerror = () => {};
    });
  }
  _startPing() {
    clearInterval(this.pingT);
    this.pingT = setInterval(() => this.send({ t: 'ping', c: Date.now() }), 2000);
  }
  serverNow() { return Date.now() + this.clockOffset; }
  send(o) { if (this.ws && this.ws.readyState === 1) this.ws.send(JSON.stringify(o)); }
  close() { this.closedByUser = true; clearInterval(this.pingT); try { this.ws?.close(); } catch {} this.connected = false; }
}
