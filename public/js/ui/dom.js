// Pequenas utilidades de DOM
export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
export function esc(s) { return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
export function el(html) { const t = document.createElement('template'); t.innerHTML = html.trim(); return t.content.firstElementChild; }
export const fmt = (n) => Number(n).toLocaleString('pt-BR');
export const COIN_SVG = `<svg class="ico" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="10" fill="#ffd23f" stroke="#16424a" stroke-width="2.5"/><circle cx="12" cy="12" r="6" fill="none" stroke="#c48a0a" stroke-width="2"/><path d="M9 9.5l3-1.5v8" stroke="#c48a0a" stroke-width="2" fill="none" stroke-linecap="round"/></svg>`;
export const ISLAND_COLORS = { tropical: '#2fc4b2', mangue: '#5f8a3a', congelada: '#8fd0f0', vulcanica: '#ff6a2a', cristais: '#a67cff' };
