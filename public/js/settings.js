// Configurações do jogador (salvas no navegador)
const KEY = 'fishisle.settings.v1';
const DEFAULTS = { master: 0.8, sfx: 0.9, ambience: 0.6, quality: 'high', dynRes: true, showFps: false, name: '', char: 0 };

export const settings = { ...DEFAULTS };
try { Object.assign(settings, JSON.parse(localStorage.getItem(KEY) || '{}')); } catch {}

const listeners = new Set();
export function saveSettings(patch = {}) {
  Object.assign(settings, patch);
  try { localStorage.setItem(KEY, JSON.stringify(settings)); } catch {}
  for (const f of listeners) f(settings);
}
export function onSettings(f) { listeners.add(f); return () => listeners.delete(f); }

// Sessão (para reconectar na mesma sala sem duplicar o personagem)
const SKEY = 'fishisle.session.v1';
export function getSession() { try { return JSON.parse(localStorage.getItem(SKEY) || 'null'); } catch { return null; } }
export function setSession(s) { try { s ? localStorage.setItem(SKEY, JSON.stringify(s)) : localStorage.removeItem(SKEY); } catch {} }
