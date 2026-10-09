// HUD: moedas, ilha atual, sala/ocupação, equipamento, destino e atalhos.
import { $, el, esc, fmt, COIN_SVG, ISLAND_COLORS } from './dom.js';
import { ISLANDS } from '/shared/islands.js';
import { RODS, BAITS } from '/shared/items.js';
import { MAX_PLAYERS_PER_ROOM } from '/shared/config.js';

export class Hud {
  constructor(root, game) {
    this.root = root; this.g = game;
    root.innerHTML = `
      <div class="hud-tl">
        <div class="chip coins" title="Moedas">${COIN_SVG}<span data-k="coins">0</span></div>
        <div class="chip island-chip"><i class="dot" data-k="idot"></i><div><span data-k="island"></span><small data-k="isub"></small></div></div>
      </div>
      <div class="hud-tr">
        <div class="chip room-chip"><span>Sala</span><span class="code" data-k="code"></span><button data-act="copy" title="Copiar código">copiar</button></div>
        <div class="chip room-chip" title="Jogadores conectados na sala (todas as ilhas)"><span>👥</span><span class="occ" data-k="occ"></span><b data-k="count"></b><span class="ping" data-k="ping"></span></div>
      </div>
      <div class="hud-tc"><div class="chip dest hidden" data-k="dest"></div></div>
      <div class="hud-bl"><div class="chip gear"><i class="rod-dot" data-k="rodc"></i><div><span data-k="rod"></span><br><small data-k="bait"></small></div></div></div>
      <div class="hud-br"><div class="chip keys">
        <span><b class="kbd">WASD</b> Mover</span><span><b class="kbd">E</b> Interagir</span><span><b class="kbd">I</b> Inventário</span><span><b class="kbd">M</b> Mapa</span><span><b class="kbd">Esc</b> Menu</span>
      </div></div>`;
    this.k = {};
    root.querySelectorAll('[data-k]').forEach((n) => (this.k[n.dataset.k] = n));
    root.querySelector('[data-act=copy]').onclick = () => {
      navigator.clipboard?.writeText(this.g.room.code).then(() => this.g.toast('Código copiado! Envie para seus amigos.', 'ok'), () => {});
    };
    this.last = {};
  }
  set(k, v, prop = 'textContent') { if (this.last[k] !== v) { this.last[k] = v; this.k[k][prop] = v; } }
  update() {
    const g = this.g, y = g.you;
    if (!y) return;
    this.set('coins', fmt(y.coins));
    const isl = ISLANDS[g.regionId];
    this.set('island', isl.name); this.set('isub', isl.subtitle);
    this.k.idot.style.background = ISLAND_COLORS[g.regionId];
    this.set('code', g.room.code);
    const n = g.room.count;
    this.set('count', `${n}/${MAX_PLAYERS_PER_ROOM}`);
    if (this.last.occN !== n) { this.last.occN = n; this.k.occ.innerHTML = Array.from({ length: MAX_PLAYERS_PER_ROOM }, (_, i) => `<i class="${i < n ? 'on' : ''}"></i>`).join(''); }
    const rod = RODS[y.rod];
    this.set('rod', rod.name);
    this.k.rodc.style.background = rod.color;
    this.set('bait', y.bait ? `Isca: ${BAITS[y.bait].name} ×${y.baits[y.bait] || 0}` : 'Sem isca equipada');
  }
  ping(ms) { this.set('ping', `${ms} ms`); }
  dest(info) {
    if (!info) { this.k.dest.classList.add('hidden'); this.last.dest = null; return; }
    this.k.dest.classList.remove('hidden');
    const html = `<span class="arrow" style="transform:rotate(${info.angle.toFixed(2)}rad)">➜</span><span>${esc(info.label)} <b>${esc(info.name)}</b> · ${fmt(info.dist)} m</span>`;
    if (this.last.dest !== html) { this.last.dest = html; this.k.dest.innerHTML = html; }
  }
}
