// Janelas do jogo: inventário/coleção, loja, mapa, configurações e confirmações.
import { $, $$, el, esc, fmt, COIN_SVG, ISLAND_COLORS } from './dom.js';
import { SPECIES, SPECIES_BY_ID, formatProbability } from '/shared/fish.js';
import { RARITIES, RARITY_ORDER, MAX_PLAYERS_PER_ROOM, CAPACITY_MAX, CAPACITY_STEP, WORLD_W, WORLD_H, MAP_W, MAP_H, TILE } from '/shared/config.js';
import { ISLANDS, ISLAND_ORDER, T, isWaterT } from '/shared/islands.js';
import { RODS, ROD_ORDER, BAITS, COSMETICS, SHOPS, capacityUpgradePrice } from '/shared/items.js';
import { fishDataURL } from '../art/fishArt.js';
import { CHARACTERS, drawCharacter } from '../art/charArt.js';
import { drawBoatHull } from '../art/boatArt.js';
import { PALETTES } from '../art/palettes.js';
import { makeCanvas, TAU, shade } from '../art/util.js';
import { settings, saveSettings } from '../settings.js';
import { sound } from '../audio.js';

const rarBadge = (r) => `<span class="rar ${r}">${RARITIES[r].symbol} ${RARITIES[r].label}</span>`;
const stars = (d) => '★'.repeat(Math.max(1, Math.round(d * 5))) + '☆'.repeat(5 - Math.max(1, Math.round(d * 5)));
const cm = (v) => `${String(v).replace('.', ',')} cm`;
const kg = (v) => `${v < 1 ? (v * 1000).toFixed(0) + ' g' : String(v.toFixed(2)).replace('.', ',') + ' kg'}`;

export class Panels {
  constructor(root, game) {
    this.root = root; this.g = game;
    this.kind = null;
    this.state = { tab: 'inv', sort: 'recent', sel: null, collIsland: null, collSel: null, shopTab: 'sell', sellSel: new Set() };
  }
  get open() { return !!this.kind; }
  close() {
    if (!this.kind) return;
    this.root.innerHTML = '';
    this.kind = null;
    this.confirmOpen = false;
    sound.play('close');
    this.g.onPanelChange();
  }
  _shell(title, body, extraHeadHTML = '', cls = '') {
    this.root.innerHTML = '';
    const bd = el(`<div class="backdrop"><div class="modal ${cls}" role="dialog" aria-modal="true" aria-label="${esc(title)}">
      <div class="modal-head">${extraHeadHTML || `<h2>${esc(title)}</h2>`}<button class="close" aria-label="Fechar">✕</button></div>
      <div class="modal-body">${body}</div></div></div>`);
    bd.addEventListener('mousedown', (e) => { if (e.target === bd) this.close(); });
    $('.close', bd).onclick = () => this.close();
    this.root.appendChild(bd);
    return bd;
  }
  show(kind, opts = {}) {
    const was = this.kind;
    this.kind = kind;
    if (opts.tab) this.state.tab = opts.tab;
    if (!was) sound.play('open');
    this.render();
    this.g.onPanelChange();
  }
  render() {
    if (this.confirmOpen) return;
    switch (this.kind) {
      case 'inventory': return this.renderInventory();
      case 'shop': return this.renderShop();
      case 'map': return this.renderMap();
      case 'settings': return this.renderSettings();
    }
  }
  refresh() { if (this.kind && !this.confirmOpen) this.render(); }

  // ───────────────── Inventário e coleção ─────────────────
  renderInventory() {
    const y = this.g.you, st = this.state;
    const head = `<h2>${st.tab === 'inv' ? 'Inventário' : 'Coleção'}</h2>
      <div class="tabs"><button class="tab ${st.tab === 'inv' ? 'on' : ''}" data-tab="inv">🎒 Inventário</button><button class="tab ${st.tab === 'coll' ? 'on' : ''}" data-tab="coll">📖 Coleção</button></div>`;
    const body = st.tab === 'inv' ? this._invBody(y) : this._collBody(y);
    const bd = this._shell('Inventário', body, head);
    bd.addEventListener('click', (e) => {
      const t = e.target.closest('[data-tab],[data-sort],[data-sel],[data-isl],[data-csel],[data-equip]');
      if (!t) return;
      if (t.dataset.tab) { st.tab = t.dataset.tab; sound.play('click'); }
      if (t.dataset.sort) { st.sort = t.dataset.sort; sound.play('click'); }
      if (t.dataset.sel) st.sel = t.dataset.sel;
      if (t.dataset.isl) { st.collIsland = t.dataset.isl; st.collSel = null; sound.play('click'); }
      if (t.dataset.csel) st.collSel = t.dataset.csel;
      if (t.dataset.equip) { const [kind, id, slot] = t.dataset.equip.split('|'); this.g.net.send({ t: 'equip', kind, id: id === 'null' ? null : kind === 'char' ? +id : id, slot }); sound.play('click'); }
      this.render();
    });
  }
  _stacks(y) {
    const map = new Map();
    for (const f of y.inventory) {
      if (!map.has(f.sp)) map.set(f.sp, { sp: f.sp, items: [], value: 0, last: 0 });
      const s = map.get(f.sp); s.items.push(f); s.value += f.value; s.last = Math.max(s.last, f.t);
    }
    const arr = [...map.values()];
    const ri = (s) => RARITY_ORDER.indexOf(SPECIES_BY_ID[s.sp].rarity), ii = (s) => ISLAND_ORDER.indexOf(SPECIES_BY_ID[s.sp].island);
    const by = { recent: (a, b) => b.last - a.last, island: (a, b) => ii(a) - ii(b) || ri(a) - ri(b), rarity: (a, b) => ri(b) - ri(a) || ii(a) - ii(b), value: (a, b) => b.value - a.value };
    return arr.sort(by[this.state.sort]);
  }
  _invBody(y) {
    const st = this.state;
    const stacks = this._stacks(y);
    if (!stacks.find((s) => s.sp === st.sel)) st.sel = stacks[0]?.sp || null;
    const empties = Math.max(0, Math.min(24, y.capacity - y.inventory.length));
    const slots = stacks.map((s) => {
      const sp = SPECIES_BY_ID[s.sp];
      return `<button class="slot ${sp.rarity} ${st.sel === s.sp ? 'sel' : ''}" data-sel="${s.sp}" title="${esc(sp.name)}" aria-label="${esc(sp.name)}, ${RARITIES[sp.rarity].label}, ${s.items.length} unidade(s)">
        <span class="r">${RARITIES[sp.rarity].symbol}</span><img alt="" src="${fishDataURL(s.sp, 'icon', 96)}"><span class="q">×${s.items.length}</span></button>`;
    }).join('') + Array.from({ length: empties }, () => '<div class="slot empty"></div>').join('');
    const sel = st.sel && stacks.find((s) => s.sp === st.sel);
    let detail = '<div class="detail"><p class="muted">Pesque algo para ver os detalhes aqui. Clique e segure na água para lançar a linha.</p></div>';
    if (sel) {
      const sp = SPECIES_BY_ID[sel.sp];
      const items = [...sel.items].sort((a, b) => b.cm - a.cm);
      detail = `<div class="detail"><div class="art"><img alt="${esc(sp.name)}" src="${fishDataURL(sp.id, 'card', 520)}"></div>
        <h3>${esc(sp.name)}</h3><div class="row" style="margin:4px 0">${rarBadge(sp.rarity)}<span class="muted">${esc(ISLANDS[sp.island].name)}</span></div>
        <p>${esc(sp.desc)}</p>
        <dl class="stats"><dt>Quantidade</dt><dd>${items.length}</dd><dt>Valor total</dt><dd>${fmt(sel.value)} moedas</dd></dl>
        <div style="margin-top:8px;max-height:140px;overflow:auto">${items.map((f) => `<div class="muted" style="display:flex;justify-content:space-between;border-top:1px dashed #c9d6d2;padding:3px 0"><span>${cm(f.cm)} · ${kg(f.kg)}</span><b>${fmt(f.value)} 🪙</b></div>`).join('')}</div></div>`;
    }
    const rods = y.rods.map((id) => `<div class="equip-card ${y.rod === id ? 'on' : ''}"><i style="width:12px;height:12px;border-radius:50%;background:${RODS[id].color};border:2px solid #16424a"></i>${esc(RODS[id].name)}${y.rod === id ? ' ✓' : ` <button class="btn small" data-equip="rod|${id}">Equipar</button>`}</div>`).join('');
    const baits = Object.entries(y.baits).filter(([, n]) => n > 0).map(([id, n]) => `<div class="equip-card ${y.bait === id ? 'on' : ''}">${esc(BAITS[id].name)} ×${n}${y.bait === id ? ' ✓' : ` <button class="btn small" data-equip="bait|${id}">Usar</button>`}</div>`).join('')
      + `<div class="equip-card ${!y.bait ? 'on' : ''}">Sem isca${!y.bait ? ' ✓' : ' <button class="btn small" data-equip="bait|null">Usar</button>'}</div>`;
    const cos = (slot, label) => {
      const owned = y.cosmetics.filter((id) => COSMETICS[id].slot === slot);
      if (!owned.length) return '';
      return `<div class="equip-card">${label}: ${owned.map((id) => `<button class="btn small ${y.equip[slot] === id ? 'primary' : ''}" data-equip="cosmetic|${id}|${slot}">${esc(COSMETICS[id].name)}</button>`).join(' ')} <button class="btn small ${!y.equip[slot] ? 'primary' : ''}" data-equip="cosmetic|null|${slot}">Nenhum</button></div>`;
    };
    return `<div class="inv-top"><div><b class="display" style="font-size:20px">Mochila ${y.inventory.length}/${y.capacity}</b> <span class="muted">· ${fmt(y.inventory.reduce((a, f) => a + f.value, 0))} moedas em peixes</span></div>
      <div class="tabs sub-tabs"><span class="muted">Organizar:</span>${[['recent', 'Recentes'], ['island', 'Ilha'], ['rarity', 'Raridade'], ['value', 'Valor']].map(([k, l]) => `<button class="tab ${this.state.sort === k ? 'on' : ''}" data-sort="${k}">${l}</button>`).join('')}</div></div>
      <div class="inv-layout"><div><div class="grid">${slots}</div>
      <h3 style="margin:16px 0 6px;font-size:20px">Equipamento</h3>
      <div class="muted">Varas</div><div class="equip-row">${rods}</div>
      <div class="muted" style="margin-top:8px">Iscas</div><div class="equip-row">${baits}</div>
      <div class="equip-row">${cos('hat', 'Chapéu')}${cos('paint', 'Pintura do barco')}${cos('flag', 'Bandeira')}</div>
      </div>${detail}</div>`;
  }
  _collBody(y) {
    const st = this.state;
    st.collIsland = st.collIsland || this.g.regionId;
    const total = SPECIES.filter((s) => y.collection[s.id]?.n > 0).length;
    const isl = st.collIsland;
    const list = SPECIES.filter((s) => s.island === isl).sort((a, b) => RARITY_ORDER.indexOf(a.rarity) - RARITY_ORDER.indexOf(b.rarity));
    const got = (id) => y.collection[id]?.n > 0;
    const tabs = ISLAND_ORDER.map((id) => {
      const n = SPECIES.filter((s) => s.island === id && got(s.id)).length;
      return `<button class="tab ${isl === id ? 'on' : ''}" data-isl="${id}"><i style="display:inline-block;width:10px;height:10px;border-radius:50%;background:${ISLAND_COLORS[id]};border:2px solid #16424a"></i> ${ISLANDS[id].short} <small>${n}/10</small></button>`;
    }).join('');
    const cards = list.map((s) => {
      const k = got(s.id), c = y.collection[s.id];
      return `<button class="card ${s.rarity} ${k ? '' : 'unknown'} ${st.collSel === s.id ? 'sel' : ''}" data-csel="${s.id}" aria-label="${k ? esc(s.name) : 'Espécie desconhecida'}">
        <div class="pic"><img alt="" src="${fishDataURL(s.id, 'card', 260, !k)}"></div>
        <div class="nm">${k ? esc(s.name) : '???'}</div>
        <div class="sm">${rarBadge(s.rarity)}</div>
        <div class="sm">${k ? `×${c.n} · máx ${cm(c.max)}` : 'Não capturado'}</div></button>`;
    }).join('');
    let detail = '';
    if (st.collSel) {
      const s = SPECIES_BY_ID[st.collSel], k = got(s.id), c = y.collection[s.id];
      detail = `<div class="detail" style="margin-top:12px;position:static"><div class="inv-layout" style="grid-template-columns:260px 1fr">
        <div class="art"><img alt="${k ? esc(s.name) : 'Silhueta'}" src="${fishDataURL(s.id, 'card', 520, !k)}"></div>
        <div><h3>${k ? esc(s.name) : '??? — espécie desconhecida'}</h3><div class="row" style="margin:4px 0">${rarBadge(s.rarity)}<span class="muted">${esc(ISLANDS[s.island].name)}</span></div>
        <p>${k ? esc(s.desc) : 'Pesque nesta ilha para descobrir. Iscas e pontos de pesca borbulhantes ajudam a encontrar os mais raros.'}</p>
        <dl class="stats" style="grid-template-columns:auto 1fr auto 1fr">
          <dt>Tamanho</dt><dd>${s.size[0]}–${s.size[1]} cm</dd><dt>Peso</dt><dd>${kg(s.kg[0])}–${kg(s.kg[1])}</dd>
          <dt>Valor base</dt><dd>${fmt(s.value)} 🪙</dd><dt>Chance</dt><dd>${formatProbability(s.id)}</dd>
          <dt>Dificuldade</dt><dd title="${Math.round(s.difficulty * 100)}%">${stars(s.difficulty)}</dd><dt>Capturados</dt><dd>${k ? c.n : 0}</dd>
          <dt>Maior</dt><dd>${k ? cm(c.max) : '—'}</dd></dl></div></div></div>`;
    }
    return `<div class="coll-head"><div><b class="display" style="font-size:22px">${total}/50 espécies</b> <span class="muted">· ${ISLANDS[isl].name}: ${list.filter((s) => got(s.id)).length}/10</span></div>
      <div class="progress" style="flex:1;max-width:320px"><div style="width:${(total / 50) * 100}%"></div></div></div>
      <div class="tabs" style="margin-bottom:10px">${tabs}</div><div class="coll-grid">${cards}</div>${detail}`;
  }

  // ───────────────── Loja ─────────────────
  renderShop() {
    const g = this.g, y = g.you, st = this.state, shop = SHOPS[g.regionId], th = shop.theme;
    const tabs = [['sell', '💰 Vender'], ['rods', '🎣 Varas'], ['baits', '🪱 Iscas'], ['bag', '🎒 Mochila'], ['cos', '🎩 Cosméticos']];
    const head = `<div class="shop-banner" style="flex:1"><div class="keeper"><canvas width="128" height="128"></canvas></div>
      <div><h2>${esc(shop.name)}</h2><p>${esc(shop.keeper)}: “${esc(shop.greeting)}”</p></div>
      <div class="balance"><div class="muted" style="color:inherit">Saldo</div><b>${fmt(y.coins)} 🪙</b><div class="muted" style="color:inherit;font-size:12px">Vara: ${esc(RODS[y.rod].name)}</div></div></div>`;
    const body = `<div class="tabs" style="margin-bottom:12px">${tabs.map(([k, l]) => `<button class="tab ${st.shopTab === k ? 'on' : ''}" data-stab="${k}">${l}</button>`).join('')}</div>${this._shopTab(y, shop)}`;
    const bd = this._shell(shop.name, body, head);
    const modal = $('.modal', bd);
    modal.style.setProperty('--shop-bg', th.bg); modal.style.setProperty('--shop-ink', th.ink); modal.style.setProperty('--shop-accent', th.banner);
    $('.modal-head', bd).classList.add('shop-head'); $('.modal-body', bd).classList.add('shop-body');
    this._drawKeeper($('.keeper canvas', bd));
    this.afterShop();
    bd.addEventListener('click', (e) => this._shopClick(e));
    bd.addEventListener('change', (e) => { if (e.target.dataset.pick) { e.target.checked ? st.sellSel.add(e.target.dataset.pick) : st.sellSel.delete(e.target.dataset.pick); this.render(); } });
  }
  _drawKeeper(cv) {
    const keepers = { tropical: 1, mangue: 4, congelada: 5, vulcanica: 3, cristais: 2 };
    const hats = { tropical: 'chapeu_palha', mangue: 'chapeu_explorador', congelada: 'gorro_la', vulcanica: 'bandana_brasa', cristais: 'tiara_cristal' };
    const g = cv.getContext('2d');
    g.setTransform(3.2, 0, 0, 3.2, 64, 150);
    drawCharacter(g, CHARACTERS[keepers[this.g.regionId]], { dir: 0, pose: 'swing', hat: hats[this.g.regionId] });
  }
  _shopTab(y, shop) {
    const st = this.state;
    const price = (p, ok = true) => `<span class="price" style="color:${ok ? 'inherit' : '#b5332a'}">${fmt(p)} 🪙</span>`;
    switch (st.shopTab) {
      case 'sell': {
        const inv = [...y.inventory].sort((a, b) => b.value - a.value);
        for (const id of [...st.sellSel]) if (!inv.find((f) => f.uid === id)) st.sellSel.delete(id);
        const total = inv.filter((f) => st.sellSel.has(f.uid)).reduce((a, f) => a + f.value, 0);
        if (!inv.length) return '<div class="item"><h4>Nada para vender</h4><div class="desc">Volte com peixes! O valor depende da espécie e do tamanho.</div></div>';
        return `<div class="row" style="margin-bottom:8px;flex-wrap:wrap"><button class="btn small" data-qs="all">Selecionar tudo</button><button class="btn small" data-qs="common">Só comuns</button><button class="btn small" data-qs="dupes">Repetidos</button><button class="btn small" data-qs="none">Limpar</button></div>
          <div class="sell-list">${inv.map((f) => { const sp = SPECIES_BY_ID[f.sp]; return `<label class="sell-row ${st.sellSel.has(f.uid) ? 'on' : ''}"><input type="checkbox" data-pick="${f.uid}" ${st.sellSel.has(f.uid) ? 'checked' : ''}><img alt="" src="${fishDataURL(f.sp, 'icon', 96)}"><span><b>${esc(sp.name)}</b> ${rarBadge(sp.rarity)}<br><span class="muted">${cm(f.cm)} · ${kg(f.kg)}</span></span><b>${fmt(f.value)} 🪙</b><button class="btn small" data-sell1="${f.uid}">Vender</button></label>`; }).join('')}</div>
          <div class="sell-bar"><span><b>${st.sellSel.size}</b> selecionado(s) · total <b>${fmt(total)} 🪙</b></span><button class="btn primary" data-sellsel ${st.sellSel.size ? '' : 'disabled'}>Vender selecionados</button></div>`;
      }
      case 'rods': {
        const ids = [...new Set([...shop.rods, ...y.rods])].sort((a, b) => RODS[a].tier - RODS[b].tier);
        const max = { range: 340, control: 1.5, resistance: 1.65 };
        return `<div class="items">${ids.map((id) => {
          const r = RODS[id], owned = y.rods.includes(id), eq = y.rod === id, sells = shop.rods.includes(id);
          return `<div class="item ${owned ? 'owned' : ''}">${eq ? '<span class="badge">Equipada</span>' : owned ? '<span class="badge" style="background:#3aa6c4">Sua</span>' : ''}
            <h4>${esc(r.name)} <small class="muted">nível ${r.tier}</small></h4><div class="desc">${esc(r.desc)}</div>
            <div class="bars"><div>Alcance <span class="b"><i style="width:${(r.range / max.range) * 100}%"></i></span></div><div>Controle <span class="b"><i style="width:${(r.control / max.control) * 100}%"></i></span></div><div>Resistência <span class="b"><i style="width:${(r.resistance / max.resistance) * 100}%"></i></span></div></div>
            <div class="row" style="justify-content:space-between">${owned ? '<span class="muted">Comprada</span>' : price(r.price, y.coins >= r.price)}${eq ? '' : owned ? `<button class="btn small teal" data-equip="rod|${id}">Equipar</button>` : sells ? `<button class="btn small primary" data-buy="rod|${id}" ${y.coins >= r.price ? '' : 'disabled'}>Comprar</button>` : ''}</div></div>`;
        }).join('')}</div><p class="muted" style="margin-top:10px">Varas melhores alcançam mais longe, aumentam a zona de controle e aguentam mais tensão — mas nenhuma garante um lendário.</p>`;
      }
      case 'baits':
        return `<div class="items">${shop.baits.map((id) => {
          const b = BAITS[id], n = y.baits[id] | 0;
          return `<div class="item"><h4><i style="display:inline-block;width:12px;height:12px;border-radius:50%;background:${b.color};border:2px solid #16424a"></i> ${esc(b.name)} ×${b.pack}</h4><div class="desc">${esc(b.desc)}</div>
            <div class="muted">Você tem: ${n}${y.bait === id ? ' (equipada)' : ''}</div>
            <div class="row" style="justify-content:space-between">${price(b.price, y.coins >= b.price)}<span class="row">${n > 0 && y.bait !== id ? `<button class="btn small" data-equip="bait|${id}">Usar</button>` : ''}<button class="btn small primary" data-buy="bait|${id}" ${y.coins >= b.price ? '' : 'disabled'}>Comprar</button></span></div></div>`;
        }).join('')}</div><p class="muted" style="margin-top:10px">Uma isca é usada a cada lançamento. Iscas encurtam a espera e dão um empurrãozinho em peixes mais raros.</p>`;
      case 'bag': {
        const p = capacityUpgradePrice(y.capacity);
        return `<div class="items"><div class="item"><h4>🎒 Ampliar mochila</h4><div class="desc">Carregue mais peixes antes de voltar à loja.</div>
          <div class="display" style="font-size:28px">${y.capacity} ${p != null ? `→ ${y.capacity + CAPACITY_STEP}` : ''} espaços</div>
          <div class="row" style="justify-content:space-between">${p != null ? price(p, y.coins >= p) : '<span class="muted">Tamanho máximo</span>'}${p != null ? `<button class="btn small primary" data-buy="capacity|" ${y.coins >= p ? '' : 'disabled'}>Ampliar</button>` : ''}</div></div></div><p class="muted" style="margin-top:10px">Capacidade máxima: ${CAPACITY_MAX} peixes.</p>`;
      }
      case 'cos':
        return `<div class="items">${shop.cosmetics.map((id) => {
          const c = COSMETICS[id], owned = y.cosmetics.includes(id), eq = y.equip[c.slot] === id;
          return `<div class="item ${owned ? 'owned' : ''}">${eq ? '<span class="badge">Em uso</span>' : ''}<canvas class="cos-prev" data-cos="${id}" width="440" height="140" style="width:100%;border-radius:10px;border:2px solid #16424a;background:${c.slot === 'hat' ? '#e4f6f3' : '#3aa6c4'}"></canvas>
            <h4>${esc(c.name)}</h4><div class="desc">${esc(c.desc)} <i>(${c.slot === 'hat' ? 'personagem' : 'barco'})</i></div>
            <div class="row" style="justify-content:space-between">${owned ? '<span class="muted">Comprado</span>' : price(c.price, y.coins >= c.price)}${owned ? (eq ? `<button class="btn small" data-equip="cosmetic|null|${c.slot}">Tirar</button>` : `<button class="btn small teal" data-equip="cosmetic|${id}|${c.slot}">Usar</button>`) : `<button class="btn small primary" data-buy="cosmetic|${id}" ${y.coins >= c.price ? '' : 'disabled'}>Comprar</button>`}</div></div>`;
        }).join('')}</div>`;
    }
    return '';
  }
  _shopClick(e) {
    const st = this.state, y = this.g.you;
    const t = e.target.closest('[data-stab],[data-buy],[data-equip],[data-qs],[data-sell1],[data-sellsel]');
    if (!t) return;
    if (t.dataset.stab) { st.shopTab = t.dataset.stab; sound.play('click'); return this.render(); }
    if (t.dataset.buy != null) {
      const [kind, id] = t.dataset.buy.split('|');
      this.g.net.send({ t: 'buy', kind, id: id || null });
      t.disabled = true;
      return;
    }
    if (t.dataset.equip) { const [kind, id, slot] = t.dataset.equip.split('|'); this.g.net.send({ t: 'equip', kind, id: id === 'null' ? null : id, slot }); sound.play('click'); return; }
    if (t.dataset.qs) {
      e.preventDefault();
      st.sellSel.clear();
      const seen = new Set();
      const inv = [...y.inventory].sort((a, b) => b.cm - a.cm);
      for (const f of inv) {
        const r = SPECIES_BY_ID[f.sp].rarity;
        if (t.dataset.qs === 'all') st.sellSel.add(f.uid);
        if (t.dataset.qs === 'common' && r === 'common') st.sellSel.add(f.uid);
        if (t.dataset.qs === 'dupes') { if (seen.has(f.sp)) st.sellSel.add(f.uid); seen.add(f.sp); }
      }
      sound.play('click');
      return this.render();
    }
    if (t.dataset.sell1) { e.preventDefault(); return this._confirmSell([t.dataset.sell1]); }
    if (t.dataset.sellsel != null) return this._confirmSell([...st.sellSel]);
  }
  _confirmSell(uids) {
    const y = this.g.you;
    const items = y.inventory.filter((f) => uids.includes(f.uid));
    if (!items.length) return;
    const total = items.reduce((a, f) => a + f.value, 0);
    const rare = items.filter((f) => ['rare', 'legendary'].includes(SPECIES_BY_ID[f.sp].rarity));
    this.confirm({
      title: 'Confirmar venda',
      html: `<p style="font-size:17px;font-weight:800">Vender ${items.length} peixe${items.length > 1 ? 's' : ''} por <span style="color:#a8740a">${fmt(total)} moedas</span>?</p>
        <div class="row" style="justify-content:center;flex-wrap:wrap;gap:4px">${items.slice(0, 12).map((f) => `<img alt="" width="40" height="40" src="${fishDataURL(f.sp, 'icon', 96)}">`).join('')}${items.length > 12 ? `<b>+${items.length - 12}</b>` : ''}</div>
        ${rare.length ? `<p class="muted">Inclui ${rare.length} peixe(s) raro(s) ou lendário(s). A coleção continua registrada.</p>` : ''}
        <p class="muted">Saldo após a venda: ${fmt(y.coins + total)} moedas.</p>`,
      ok: 'Vender',
      onOk: () => { this.g.net.send({ t: 'sell', uids: items.map((f) => f.uid), expect: total }); this.state.sellSel.clear(); },
    });
  }
  afterShop() {
    // desenha prévias de cosméticos
    $$('.cos-prev', this.root).forEach((cv) => {
      const id = cv.dataset.cos, c = COSMETICS[id], g = cv.getContext('2d');
      g.clearRect(0, 0, cv.width, cv.height);
      if (c.slot === 'hat') { g.setTransform(2.6, 0, 0, 2.6, 220, 132); drawCharacter(g, CHARACTERS[this.g.you.char], { dir: 0, pose: 'swing', hat: id }); }
      else { g.setTransform(2.2, 0, 0, 2.2, 220, 70); drawBoatHull(g, 0, 0, 0, c.slot === 'paint' ? id : this.g.you.equip.paint, c.slot === 'flag' ? id : this.g.you.equip.flag, 1, 0); }
    });
  }

  // ───────────────── Mapa ─────────────────
  renderMap() {
    const g = this.g;
    const dest = g.destination;
    const by = g.room.byIsland || {};
    const btns = ISLAND_ORDER.map((id) => {
      const [x, yv] = ISLANDS[id].world;
      return `<button class="isle-btn ${id === g.regionId ? 'here' : ''} ${id === dest ? 'dest' : ''}" style="left:${x * 100}%;top:${yv * 100 + 8}%" data-dest="${id}">${esc(ISLANDS[id].short)} <small>${by[id] ? `👥${by[id]}` : ''}</small></button>`;
    }).join('');
    const status = g.me.mode === 'boat'
      ? (dest ? `Siga a <b>rota pontilhada</b> até a passagem para <b>${esc(ISLANDS[dest].name)}</b>.` : 'Escolha uma ilha no mapa para traçar a rota.')
      : 'Vá até o cais e pressione <span class="kbd">E</span> para pegar um barco. Depois siga a rota pontilhada.';
    const body = `<div class="map-wrap"><div><div class="world-map"><canvas width="900" height="620"></canvas>${btns}</div>
      <p style="margin:10px 0 0;font-weight:700">${status}</p></div>
      <div><h3 style="font-size:20px;margin-bottom:6px">${esc(ISLANDS[g.regionId].name)}</h3><div class="mini"><canvas></canvas></div>
      <div class="legend"><span><i style="background:#ff4a3d"></i> Você</span><span><i style="background:#ffd23f"></i> Loja</span><span><i style="background:#ffffff"></i> Cais / barco</span><span><i style="background:#7dffb0"></i> Pontos de pesca</span><span><i style="background:#ff6fd0"></i> Passagens para outras ilhas</span></div>
      <p class="muted">Jogadores na sala: ${g.room.count}/${MAX_PLAYERS_PER_ROOM}</p></div></div>`;
    const bd = this._shell('Mapa de navegação', body);
    this._drawWorldMap($('.world-map canvas', bd));
    this._drawMini($('.mini canvas', bd));
    bd.addEventListener('click', (e) => {
      const d = e.target.closest('[data-dest]')?.dataset.dest;
      if (!d) return;
      sound.play('click');
      if (d === g.regionId) { g.toast('Você já está nesta ilha.'); return; }
      g.setDestination(d);
      this.render();
    });
  }
  _drawWorldMap(cv) {
    const g = cv.getContext('2d'), W = cv.width, H = cv.height;
    const gr = g.createRadialGradient(W / 2, H / 2, 50, W / 2, H / 2, W * 0.7);
    gr.addColorStop(0, '#4fc0d8'); gr.addColorStop(1, '#1f6f96');
    g.fillStyle = gr; g.fillRect(0, 0, W, H);
    g.strokeStyle = 'rgba(255,255,255,.18)'; g.lineWidth = 2;
    for (let i = 0; i < 60; i++) { const x = (i * 137) % W, y = (i * 211) % H; g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + 8, y - 4, x + 16, y); g.stroke(); }
    // rotas entre as ilhas
    const P = (id) => [ISLANDS[id].world[0] * W, ISLANDS[id].world[1] * H];
    g.setLineDash([6, 8]); g.lineWidth = 2.5;
    for (let i = 0; i < ISLAND_ORDER.length; i++) for (let j = i + 1; j < ISLAND_ORDER.length; j++) {
      const a = P(ISLAND_ORDER[i]), b = P(ISLAND_ORDER[j]);
      const isDest = (ISLAND_ORDER[i] === this.g.regionId && ISLAND_ORDER[j] === this.g.destination) || (ISLAND_ORDER[j] === this.g.regionId && ISLAND_ORDER[i] === this.g.destination);
      g.strokeStyle = isDest ? '#ffd23f' : 'rgba(255,255,255,.35)'; g.lineWidth = isDest ? 4 : 2;
      g.beginPath(); g.moveTo(...a); g.lineTo(...b); g.stroke();
    }
    g.setLineDash([]);
    // ilhas estilizadas
    for (const id of ISLAND_ORDER) {
      const [x, y] = P(id), pal = PALETTES[id];
      g.fillStyle = 'rgba(255,255,255,.35)'; g.beginPath(); g.ellipse(x, y + 4, 62, 40, 0, 0, TAU); g.fill();
      g.fillStyle = pal.ground[id === 'tropical' ? T.SAND : id === 'mangue' ? T.MUD : id === 'congelada' ? T.SNOW : id === 'vulcanica' ? T.BLACKSAND : T.CRYSTAL];
      g.strokeStyle = '#16424a'; g.lineWidth = 3;
      g.beginPath();
      for (let k = 0; k <= 20; k++) { const a = (k / 20) * TAU, r = 1 + 0.18 * Math.sin(a * 3 + id.length) + 0.1 * Math.sin(a * 5); g.lineTo(x + Math.cos(a) * 52 * r, y + Math.sin(a) * 32 * r); }
      g.closePath(); g.fill(); g.stroke();
      // ícone da região
      g.save(); g.translate(x, y);
      if (id === 'tropical') { g.strokeStyle = '#8a5a33'; g.lineWidth = 4; g.beginPath(); g.moveTo(0, 14); g.quadraticCurveTo(4, 0, 2, -14); g.stroke(); g.fillStyle = '#3fae4f'; for (let k = 0; k < 5; k++) { g.beginPath(); g.ellipse(2 + Math.cos(k * 1.3) * 10, -16 + Math.sin(k * 1.3) * 4, 11, 4, k * 1.3, 0, TAU); g.fill(); } }
      if (id === 'mangue') { g.fillStyle = '#3f7d3a'; g.beginPath(); g.arc(-8, -6, 12, 0, TAU); g.arc(8, -8, 13, 0, TAU); g.fill(); g.strokeStyle = '#5b4730'; g.lineWidth = 2.5; for (let k = -2; k <= 2; k++) { g.beginPath(); g.moveTo(k * 3, 2); g.lineTo(k * 7, 14); g.stroke(); } }
      if (id === 'congelada') { g.fillStyle = '#2f6b5a'; for (const dx of [-12, 8]) { g.beginPath(); g.moveTo(dx - 10, 12); g.lineTo(dx + 10, 12); g.lineTo(dx, -14); g.fill(); g.fillStyle = '#fff'; g.beginPath(); g.moveTo(dx - 4, -4); g.lineTo(dx, -14); g.lineTo(dx + 4, -4); g.fill(); g.fillStyle = '#2f6b5a'; } }
      if (id === 'vulcanica') { g.fillStyle = '#4a4246'; g.beginPath(); g.moveTo(-24, 14); g.lineTo(-6, -16); g.lineTo(6, -16); g.lineTo(24, 14); g.fill(); g.fillStyle = '#ff6a1a'; g.beginPath(); g.ellipse(0, -16, 7, 3, 0, 0, TAU); g.fill(); g.fillStyle = 'rgba(120,110,110,.7)'; g.beginPath(); g.arc(4, -26, 7, 0, TAU); g.arc(12, -34, 9, 0, TAU); g.fill(); }
      if (id === 'cristais') { for (const [dx, h, c] of [[-10, 22, '#b48cff'], [2, 30, '#8fdcff'], [12, 18, '#d0b8ff']]) { g.fillStyle = c; g.strokeStyle = '#3a2a6a'; g.lineWidth = 2; g.beginPath(); g.moveTo(dx - 5, 12); g.lineTo(dx, 12 - h); g.lineTo(dx + 5, 12); g.closePath(); g.fill(); g.stroke(); } }
      g.restore();
    }
    // rosa dos ventos
    g.save(); g.translate(60, H - 60); g.fillStyle = '#fff7e8'; g.strokeStyle = '#16424a'; g.lineWidth = 2;
    g.beginPath(); g.moveTo(0, -30); g.lineTo(7, 0); g.lineTo(0, 30); g.lineTo(-7, 0); g.closePath(); g.fill(); g.stroke();
    g.fillStyle = '#16424a'; g.font = 'bold 14px sans-serif'; g.textAlign = 'center'; g.fillText('N', 0, -36); g.restore();
  }
  _drawMini(cv) {
    const g = this.g, r = g.region, S = 3;
    cv.width = MAP_W * S; cv.height = MAP_H * S;
    const c = cv.getContext('2d');
    const pal = PALETTES[g.regionId];
    if (!this._miniCache || this._miniCache.id !== g.regionId) {
      const base = makeCanvas(MAP_W * S, MAP_H * S), b = base.getContext('2d');
      b.fillStyle = pal.waterDeep; b.fillRect(0, 0, base.width, base.height);
      for (let y = 0; y < MAP_H; y++) for (let x = 0; x < MAP_W; x++) {
        const t = r.tile(x, y);
        if (isWaterT(t)) { if (t !== T.WATER) { b.fillStyle = pal.waterShallow; b.fillRect(x * S, y * S, S, S); } continue; }
        b.fillStyle = pal.ground[t] || '#ccc'; b.fillRect(x * S, y * S, S, S);
      }
      b.fillStyle = '#c99659';
      for (const d of r.docks) b.fillRect(d.x / TILE * S, d.y / TILE * S, Math.max(S, d.w / TILE * S), Math.max(S, d.h / TILE * S));
      this._miniCache = { id: g.regionId, base };
    }
    c.drawImage(this._miniCache.base, 0, 0);
    const dot = (x, y, col, rad = 4) => { c.beginPath(); c.arc(x / TILE * S, y / TILE * S, rad, 0, TAU); c.fillStyle = col; c.fill(); c.lineWidth = 1.5; c.strokeStyle = '#16424a'; c.stroke(); };
    for (const h of r.hotspots) dot(h.x, h.y, '#7dffb0', 3);
    for (const gt of Object.values(r.gates)) { dot(gt.x, gt.y, '#ff6fd0', 5); c.fillStyle = '#fff'; c.font = 'bold 10px sans-serif'; c.textAlign = 'center'; c.fillText(ISLANDS[gt.to].short, Math.min(cv.width - 30, Math.max(30, gt.x / TILE * S)), Math.min(cv.height - 4, Math.max(12, gt.y / TILE * S + (gt.y < 300 ? 16 : -8)))); }
    for (const m of r.moorings) dot(m.board.x, m.board.y, '#ffffff', 4);
    dot(r.shop.x, r.shop.y, '#ffd23f', 4);
    if (g.route?.length) { c.setLineDash([3, 3]); c.strokeStyle = '#ffd23f'; c.lineWidth = 2; c.beginPath(); g.route.forEach((p, i) => (i ? c.lineTo(p.x / TILE * S, p.y / TILE * S) : c.moveTo(p.x / TILE * S, p.y / TILE * S))); c.stroke(); c.setLineDash([]); }
    dot(g.me.x, g.me.y, '#ff4a3d', 5);
  }

  // ───────────────── Configurações ─────────────────
  renderSettings() {
    const s = settings;
    const inGame = this.g.inGame;
    const vol = (k, l) => `<div class="set-row"><label>${l}<span>${Math.round(s[k] * 100)}%</span></label><input type="range" min="0" max="1" step="0.05" value="${s[k]}" data-vol="${k}" aria-label="${l}"></div>`;
    const body = `<div class="set-grid"><div>
      <h3 style="font-size:20px;margin-bottom:10px">Som</h3>${vol('master', 'Volume geral')}${vol('sfx', 'Efeitos')}${vol('ambience', 'Ambiente das ilhas')}
      <h3 style="font-size:20px;margin:6px 0 10px">Gráficos</h3>
      <div class="set-row"><label>Qualidade</label><div class="seg">${[['low', 'Baixa'], ['medium', 'Média'], ['high', 'Alta']].map(([k, l]) => `<button class="${s.quality === k ? 'on' : ''}" data-q="${k}">${l}</button>`).join('')}</div>
      <span class="muted">Baixa: menos partículas, resolução reduzida e iluminação simplificada.</span></div>
      <div class="set-row"><label style="justify-content:flex-start;gap:8px"><input type="checkbox" data-dyn ${s.dynRes !== false ? 'checked' : ''} style="pointer-events:auto;width:18px;height:18px"> Resolução dinâmica <span class="muted">(mantém a fluidez em telas grandes)</span></label></div>
      <div class="set-row"><label style="justify-content:flex-start;gap:8px"><input type="checkbox" data-fps ${s.showFps ? 'checked' : ''} style="pointer-events:auto;width:18px;height:18px"> Mostrar FPS</label></div>
      </div><div><h3 style="font-size:20px;margin-bottom:10px">Controles</h3><div class="controls">
      <span class="kbd">WASD</span><span>Andar ou pilotar o barco (setas também)</span>
      <span class="kbd">Mouse</span><span>Mirar · segurar e soltar para lançar · segurar para recolher na luta</span>
      <span class="kbd">Botão dir.</span><span>Cancelar a pesca</span>
      <span class="kbd">E</span><span>Interagir, embarcar e desembarcar</span>
      <span class="kbd">I</span><span>Inventário e coleção</span>
      <span class="kbd">M</span><span>Mapa e destinos</span>
      <span class="kbd">Esc</span><span>Fechar janelas / configurações</span></div>
      ${inGame ? `<div class="row" style="margin-top:18px;flex-wrap:wrap"><button class="btn primary" data-act="resume">Voltar ao jogo</button><button class="btn coral" data-act="quit">Sair para o menu</button></div>` : ''}
      </div></div>`;
    const bd = this._shell('Configurações', body);
    bd.addEventListener('input', (e) => { const k = e.target.dataset.vol; if (k) { saveSettings({ [k]: +e.target.value }); e.target.previousElementSibling.lastElementChild.textContent = Math.round(+e.target.value * 100) + '%'; } });
    bd.addEventListener('change', (e) => {
      if (e.target.dataset.fps != null) saveSettings({ showFps: e.target.checked });
      if (e.target.dataset.dyn != null) { saveSettings({ dynRes: e.target.checked }); this.g.dyn = 1; }
    });
    bd.addEventListener('click', (e) => {
      const q = e.target.dataset.q, act = e.target.dataset.act;
      if (q) { saveSettings({ quality: q }); sound.play('click'); this.render(); }
      if (act === 'resume') this.close();
      if (act === 'quit') this.confirm({ title: 'Sair da sala?', html: '<p>Seu progresso fica guardado na sala por 30 minutos. Você pode voltar com “Continuar” no menu.</p>', ok: 'Sair', onOk: () => { this.close(); this.g.quitToMenu(); } });
    });
  }

  // ───────────────── Confirmação ─────────────────
  confirm({ title, html, ok = 'Confirmar', onOk }) {
    this.confirmOpen = true;
    const bd = el(`<div class="backdrop" style="z-index:5"><div class="modal confirm"><div class="modal-head"><h2>${esc(title)}</h2></div><div class="modal-body">${html}<div class="actions"><button class="btn" data-c="no">Cancelar</button><button class="btn primary" data-c="yes">${esc(ok)}</button></div></div></div></div>`);
    const done = (yes) => { bd.remove(); this.confirmOpen = false; if (yes) onOk?.(); this.render(); };
    bd.addEventListener('click', (e) => { const c = e.target.dataset.c; if (c) { sound.play('click'); done(c === 'yes'); } });
    this.root.appendChild(bd);
    this._confirmEl = bd;
    $('[data-c=yes]', bd).focus();
  }
  escape() {
    if (this.confirmOpen) { this._confirmEl?.remove(); this.confirmOpen = false; this.render(); return true; }
    if (this.kind) { this.close(); return true; }
    return false;
  }
}
