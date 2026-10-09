// Ponto de entrada do cliente
import { Game } from './game.js';

function boot() {
  try { new Game(); }
  catch (e) {
    console.error(e);
    document.body.insertAdjacentHTML('beforeend', `<div style="position:fixed;inset:0;display:flex;align-items:center;justify-content:center;font:700 16px system-ui;color:#fff;background:#16424a">Não foi possível iniciar o jogo: ${String(e.message)}</div>`);
  }
}
if (document.fonts?.ready) document.fonts.ready.then(boot, boot); else boot();
