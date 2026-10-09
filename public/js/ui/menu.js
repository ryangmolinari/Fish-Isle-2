// Menu inicial: apelido, seleção de personagem, jogar / criar sala / entrar por código.
import { $, el, esc } from './dom.js';
import { CHARACTERS, drawCharacter } from '../art/charArt.js';
import { settings, saveSettings, getSession } from '../settings.js';
import { sound } from '../audio.js';

export class Menu {
  constructor(root, handlers) {
    this.root = root;
    this.h = handlers;
    this.busy = false;
    this.render();
  }
  render() {
    const sess = getSession();
    this.root.innerHTML = '';
    const node = el(`
      <div class="menu-wrap">
        <div class="logo">
          <h1>Fish <span>Isle</span></h1>
          <p>Pesque, colecione e navegue entre cinco ilhas com até 12 amigos na mesma sala.</p>
          <div class="tags"><span>🏝 5 ilhas</span><span>🐟 50 espécies</span><span>⛵ Barcos</span><span>👥 Até 12 jogadores</span></div>
        </div>
        <div class="panel menu-card">
          <h2>Prepare seu pescador</h2>
          ${sess ? `<div class="continue" style="margin-bottom:12px"><span>Você estava na sala <b>${esc(sess.code)}</b></span><button class="btn small teal" data-act="continue">Continuar</button></div>` : ''}
          <div class="field"><label for="nick">Apelido</label><input id="nick" class="input" maxlength="16" placeholder="Seu nome no jogo" value="${esc(settings.name)}" autocomplete="off"></div>
          <div class="field"><label>Personagem</label><div class="chars"></div><div class="char-desc"></div></div>
          <div class="menu-actions">
            <button class="btn primary big" data-act="play">🎣 Jogar</button>
            <div class="row">
              <button class="btn teal" data-act="create">Criar sala</button>
              <input id="code" class="input grow" maxlength="5" placeholder="CÓDIGO" style="text-transform:uppercase;letter-spacing:3px;text-align:center">
              <button class="btn" data-act="join">Entrar</button>
            </div>
          </div>
          <div class="menu-error hidden" role="alert"></div>
          <div class="menu-foot"><button class="btn small" data-act="settings">⚙ Configurações</button><span>WASD mover · E interagir · I inventário · M mapa</span></div>
        </div>
      </div>`);
    this.root.appendChild(node);
    const chars = $('.chars', node);
    this.canvases = [];
    CHARACTERS.forEach((c, i) => {
      const b = el(`<button class="char-btn" title="${esc(c.name)}" aria-label="${esc(c.name)}"><canvas width="96" height="116"></canvas><span>${esc(c.name)}</span></button>`);
      b.onclick = () => { sound.init(); sound.play('click'); this.select(i); };
      chars.appendChild(b);
      this.canvases.push($('canvas', b));
    });
    this.select(settings.char | 0);
    node.addEventListener('click', (e) => {
      const act = e.target.closest('[data-act]')?.dataset.act;
      if (!act) return;
      sound.init(); sound.play('click');
      const name = $('#nick').value.trim();
      saveSettings({ name });
      if (act === 'settings') return this.h.settings();
      if (this.busy) return;
      if (act === 'play') this.h.play({ mode: 'quick' });
      if (act === 'create') this.h.play({ mode: 'create' });
      if (act === 'join') {
        const code = $('#code').value.trim().toUpperCase();
        if (code.length !== 5) return this.error('Digite o código de 5 letras da sala.');
        this.h.play({ mode: 'code', code });
      }
      if (act === 'continue') this.h.play({ mode: 'code', code: sess.code, token: sess.token });
    });
    $('#code', node).addEventListener('keydown', (e) => { if (e.key === 'Enter') node.querySelector('[data-act=join]').click(); });
    this.anim();
  }
  select(i) {
    saveSettings({ char: i });
    [...this.root.querySelectorAll('.char-btn')].forEach((b, k) => b.classList.toggle('sel', k === i));
    $('.char-desc', this.root).textContent = CHARACTERS[i].desc;
    this.sel = i;
  }
  anim() {
    cancelAnimationFrame(this.raf);
    let last = 0;
    const loop = (ts) => {
      if (this.root.classList.contains('hidden')) return;
      this.raf = requestAnimationFrame(loop);
      if (ts - last < 90) return;
      last = ts;
      const t = ts / 1000;
      this.canvases.forEach((cv, i) => {
        const g = cv.getContext('2d');
        g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, cv.width, cv.height);
        g.setTransform(2, 0, 0, 2, 48, 104);
        g.fillStyle = 'rgba(0,0,0,.15)'; g.beginPath(); g.ellipse(0, 0, 10, 3.5, 0, 0, 7); g.fill();
        const sel = i === this.sel;
        drawCharacter(g, CHARACTERS[i], { dir: 0, phase: Math.floor(t * 8) % 4, moving: sel, pose: 'swing', breath: (t + i) % 2 < 1, blink: (t * 0.9 + i) % 4 < 0.1 });
      });
    };
    this.raf = requestAnimationFrame(loop);
  }
  error(msg) { const e = $('.menu-error', this.root); e.textContent = msg; e.classList.remove('hidden'); sound.play('error'); }
  clearError() { $('.menu-error', this.root)?.classList.add('hidden'); }
  setBusy(b) { this.busy = b; this.root.querySelectorAll('[data-act]').forEach((x) => { if (x.dataset.act !== 'settings') x.disabled = b; }); }
  show() { this.root.classList.remove('hidden'); this.render(); }
  hide() { this.root.classList.add('hidden'); cancelAnimationFrame(this.raf); }
}
