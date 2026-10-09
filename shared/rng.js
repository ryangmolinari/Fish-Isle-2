// Utilidades determinísticas (iguais no servidor e no navegador).
// Usam apenas aritmética exata (+ - * / floor, operações inteiras) para que
// cliente e servidor cheguem exatamente aos mesmos resultados.

export function mulberry32(seed) {
  let a = seed >>> 0;
  return function rand() {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function hash2(x, y, seed = 0) {
  let h = (Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263) + Math.imul(seed | 0, 1442695041)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h = h ^ (h >>> 16);
  return (h >>> 0) / 4294967296;
}

export function hashStr(s) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h >>> 0;
}

const smooth = (t) => t * t * (3 - 2 * t);

// Ruído de valor 2D suave em [0,1)
export function valueNoise(x, y, seed = 0) {
  const xi = Math.floor(x), yi = Math.floor(y);
  const xf = x - xi, yf = y - yi;
  const a = hash2(xi, yi, seed), b = hash2(xi + 1, yi, seed);
  const c = hash2(xi, yi + 1, seed), d = hash2(xi + 1, yi + 1, seed);
  const u = smooth(xf), v = smooth(yf);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}

// Ruído fractal (3 oitavas) em ~[0,1)
export function fbm(x, y, seed = 0, oct = 3) {
  let amp = 0.5, freq = 1, sum = 0, norm = 0;
  for (let i = 0; i < oct; i++) {
    sum += amp * valueNoise(x * freq, y * freq, seed + i * 17);
    norm += amp;
    amp *= 0.5;
    freq *= 2;
  }
  return sum / norm;
}

export function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
export function lerp(a, b, t) { return a + (b - a) * t; }
export function dist(ax, ay, bx, by) { const dx = ax - bx, dy = ay - by; return Math.sqrt(dx * dx + dy * dy); }

// Seno aproximado só com aritmética (determinístico entre motores JS).
// Bhaskara I, erro máximo ~0,0016 — suficiente para movimento de jogo.
export function dsin(x) {
  const TWO_PI = 6.283185307179586;
  let t = x - Math.floor(x / TWO_PI) * TWO_PI; // [0, 2π)
  let sign = 1;
  if (t > 3.141592653589793) { t -= 3.141592653589793; sign = -1; }
  const p = t * (3.141592653589793 - t);
  return sign * (16 * p) / (49.34802200544679 - 4 * p);
}
