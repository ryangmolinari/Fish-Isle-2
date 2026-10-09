// Minigame de tensão — simulação determinística compartilhada.
// O cliente roda a simulação em tempo real com o botão do mouse; o servidor
// recebe a sequência de entradas (um bit por passo) e a reproduz para validar
// a captura. Só aritmética exata + dsin, então o resultado é idêntico nos dois lados.

import { mulberry32, dsin, clamp } from './rng.js';
import { FISHING } from './config.js';

export const MG_DT = 1 / FISHING.minigameHz;
export const MG_MAX_TICKS = FISHING.minigameMaxSeconds * FISHING.minigameHz;
export const BREAK_LINE = 0.92;

export function minigameParams(species, rod) {
  const d = species.difficulty;
  const c = rod.control;
  return {
    seedBehavior: species.behavior,
    zoneHalf: clamp((0.17 - 0.07 * d) * c, 0.07, 0.24),
    zoneSpeed: 0.22 + 0.8 * d,
    surgeRate: (0.15 + 1.15 * d),          // surtos por segundo
    surgeForce: (0.5 + 0.9 * d) / c,
    holdAcc: 2.3,
    dropAcc: 1.9,
    gain: (0.16 - 0.06 * d) * (1 + (c - 1) * 0.6),
    drain: 0.08 + 0.1 * d,
    strainLimit: rod.resistance,
  };
}

export function createMinigame(params, seed) {
  return {
    p: params,
    rand: mulberry32(seed),
    tick: 0,
    tension: 0.35, tv: 0,
    zc: 0.45, zv: 0, target: 0.45, retarget: 0,
    progress: 0.35, strain: 0,
    surge: 0,       // visual: intensidade do último puxão
    inside: false,
    done: false, result: null, // 'caught' | 'escaped' | 'snapped'
  };
}

export function stepMinigame(s, hold) {
  if (s.done) return s;
  const p = s.p, dt = MG_DT, r = s.rand;
  s.tick++;
  const tSec = s.tick * dt;
  const zLo = p.zoneHalf + 0.02, zHi = 0.88 - p.zoneHalf;
  const tired = 1 - 0.35 * s.progress;
  const sp = p.zoneSpeed * tired;

  // Movimento da zona de sucesso conforme o comportamento do peixe
  switch (p.seedBehavior) {
    case 'smooth':
      s.target = 0.47 + 0.3 * dsin(tSec * (0.6 + sp * 0.9));
      break;
    case 'circler':
      s.target = 0.47 + 0.22 * dsin(tSec * (0.9 + sp)) + 0.12 * dsin(tSec * (2.3 + sp * 1.7) + 1.3);
      break;
    case 'sinker':
      s.retarget -= dt;
      if (s.retarget <= 0) { s.target = zLo + (zHi - zLo) * (r() * r()); s.retarget = 0.8 + r() * 1.6; }
      break;
    case 'darter':
      s.retarget -= dt;
      if (s.retarget <= 0) { s.target = zLo + (zHi - zLo) * r(); s.retarget = 0.5 + r() * (1.6 - sp * 0.6); }
      break;
    default: // erratic
      s.retarget -= dt;
      if (s.retarget <= 0) { s.target = zLo + (zHi - zLo) * r(); s.retarget = 0.25 + r() * 0.9; }
      s.target += (r() - 0.5) * 0.04 * sp;
  }
  s.target = clamp(s.target, zLo, zHi);
  const springK = p.seedBehavior === 'darter' || p.seedBehavior === 'erratic' ? 9 * sp : 4 * sp;
  s.zv += (s.target - s.zc) * springK * dt;
  s.zv *= 1 - Math.min(0.9, 4.2 * dt);
  s.zc = clamp(s.zc + s.zv * dt, zLo, zHi);

  // Ponteiro de tensão: segurar = recolher (tensão sobe), soltar = afrouxar
  const acc = hold ? p.holdAcc : -p.dropAcc;
  s.tv += acc * dt;
  if (r() < p.surgeRate * dt) { // puxão do peixe
    const f = p.surgeForce * (0.5 + r() * 0.5);
    s.tv += f;
    s.surge = 1;
  }
  s.surge = Math.max(0, s.surge - dt * 2.5);
  s.tv *= 1 - Math.min(0.9, 2.6 * dt);
  s.tension += s.tv * dt;
  if (s.tension < 0) { s.tension = 0; s.tv = 0; }
  if (s.tension > 1) { s.tension = 1; s.tv = 0; }

  // Progresso
  s.inside = Math.abs(s.tension - s.zc) <= p.zoneHalf;
  s.progress += (s.inside ? p.gain : -p.drain) * dt;

  // Risco de arrebentar a linha
  if (s.tension >= BREAK_LINE) s.strain += dt;
  else s.strain = Math.max(0, s.strain - dt * 0.8);

  if (s.progress >= 1) { s.progress = 1; s.done = true; s.result = 'caught'; }
  else if (s.progress <= 0) { s.progress = 0; s.done = true; s.result = 'escaped'; }
  else if (s.strain >= p.strainLimit) { s.done = true; s.result = 'snapped'; }
  else if (s.tick >= MG_MAX_TICKS) { s.done = true; s.result = 'escaped'; }
  return s;
}

// Codificação compacta das entradas: bits → base64
export function encodeInputs(bits) {
  const bytes = new Uint8Array(Math.ceil(bits.length / 8));
  for (let i = 0; i < bits.length; i++) if (bits[i]) bytes[i >> 3] |= 1 << (i & 7);
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return { n: bits.length, b64: typeof btoa === 'function' ? btoa(bin) : Buffer.from(bytes).toString('base64') };
}

export function decodeInputs({ n, b64 }) {
  const bin = typeof atob === 'function' ? atob(b64) : Buffer.from(b64, 'base64').toString('binary');
  const bits = new Array(n);
  for (let i = 0; i < n; i++) bits[i] = (bin.charCodeAt(i >> 3) >> (i & 7)) & 1;
  return bits;
}

// Reproduz uma luta inteira (usado pelo servidor)
export function replayMinigame(params, seed, bits) {
  const s = createMinigame(params, seed);
  for (let i = 0; i < bits.length && !s.done; i++) stepMinigame(s, bits[i] === 1);
  return s;
}
