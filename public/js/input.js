// Teclado e mouse. Quando um menu está aberto, os comandos do mundo ficam bloqueados.
export class Input {
  constructor(canvas) {
    this.keys = new Set();
    this.pressed = new Set(); // apertadas neste quadro
    this.mouse = { x: 0, y: 0, down: false, clicked: false, released: false, right: false };
    this.blocked = false;
    this.canvas = canvas;
    addEventListener('keydown', (e) => {
      const tag = e.target?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
      if (!this.keys.has(k)) this.pressed.add(k);
      this.keys.add(k);
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(e.key)) e.preventDefault();
    });
    addEventListener('keyup', (e) => { const k = e.key.length === 1 ? e.key.toLowerCase() : e.key; this.keys.delete(k); });
    addEventListener('blur', () => { this.keys.clear(); this.mouse.down = false; });
    canvas.addEventListener('mousemove', (e) => { this.mouse.x = e.clientX; this.mouse.y = e.clientY; });
    canvas.addEventListener('mousedown', (e) => {
      this.mouse.x = e.clientX; this.mouse.y = e.clientY;
      if (e.button === 0) { this.mouse.down = true; this.mouse.clicked = true; }
      if (e.button === 2) this.mouse.right = true;
    });
    addEventListener('mouseup', (e) => { if (e.button === 0 && this.mouse.down) { this.mouse.down = false; this.mouse.released = true; } });
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    // toque básico (tablets): um dedo = mouse
    canvas.addEventListener('touchstart', (e) => { const t = e.touches[0]; this.mouse.x = t.clientX; this.mouse.y = t.clientY; this.mouse.down = true; this.mouse.clicked = true; e.preventDefault(); }, { passive: false });
    canvas.addEventListener('touchmove', (e) => { const t = e.touches[0]; this.mouse.x = t.clientX; this.mouse.y = t.clientY; e.preventDefault(); }, { passive: false });
    canvas.addEventListener('touchend', () => { this.mouse.down = false; this.mouse.released = true; });
  }
  down(...ks) { if (this.blocked) return false; return ks.some((k) => this.keys.has(k)); }
  hit(k) { return this.pressed.has(k); } // teclas de interface funcionam mesmo bloqueado
  worldHit(k) { return !this.blocked && this.pressed.has(k); }
  axis() {
    if (this.blocked) return [0, 0];
    let x = 0, y = 0;
    if (this.keys.has('a') || this.keys.has('ArrowLeft')) x -= 1;
    if (this.keys.has('d') || this.keys.has('ArrowRight')) x += 1;
    if (this.keys.has('w') || this.keys.has('ArrowUp')) y -= 1;
    if (this.keys.has('s') || this.keys.has('ArrowDown')) y += 1;
    return [x, y];
  }
  endFrame() { this.pressed.clear(); this.mouse.clicked = false; this.mouse.released = false; this.mouse.right = false; }
  releaseAll() { this.keys.clear(); this.mouse.down = false; }
}
