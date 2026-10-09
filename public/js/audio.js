// Áudio procedural (Web Audio): efeitos e ambiente próprio de cada ilha, sem arquivos externos.
import { settings, onSettings } from './settings.js';

class Sound {
  constructor() { this.ctx = null; this.amb = null; this.ambId = null; this.timers = []; }
  init() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    const ctx = this.ctx = new AC();
    this.master = ctx.createGain(); this.master.connect(ctx.destination);
    this.sfxG = ctx.createGain(); this.sfxG.connect(this.master);
    this.ambG = ctx.createGain(); this.ambG.connect(this.master);
    // eco suave para sinos e fanfarras
    this.delay = ctx.createDelay(1); this.delay.delayTime.value = 0.28;
    this.fb = ctx.createGain(); this.fb.gain.value = 0.32;
    this.delay.connect(this.fb); this.fb.connect(this.delay); this.delay.connect(this.sfxG);
    this.noiseBuf = this._noise('white'); this.brownBuf = this._noise('brown');
    this.apply();
    onSettings(() => this.apply());
    if (this.pendingAmb) this.ambience(this.pendingAmb);
  }
  apply() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.master.gain.setTargetAtTime(settings.master, t, 0.05);
    this.sfxG.gain.setTargetAtTime(settings.sfx, t, 0.05);
    this.ambG.gain.setTargetAtTime(settings.ambience, t, 0.05);
  }
  _noise(kind) {
    const n = this.ctx.sampleRate * 2, b = this.ctx.createBuffer(1, n, this.ctx.sampleRate), d = b.getChannelData(0);
    let last = 0;
    for (let i = 0; i < n; i++) { const w = Math.random() * 2 - 1; if (kind === 'brown') { last = (last + 0.02 * w) / 1.02; d[i] = last * 3.5; } else d[i] = w; }
    return b;
  }
  _env(g, t, a, peak, d) { g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(peak, t + a); g.gain.exponentialRampToValueAtTime(0.0001, t + a + d); }
  tone(freq, dur, type = 'sine', vol = 0.2, when = 0, dest, glide) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime + when;
    const o = this.ctx.createOscillator(), g = this.ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, t);
    if (glide) o.frequency.exponentialRampToValueAtTime(glide, t + dur);
    this._env(g, t, 0.008, vol, dur);
    o.connect(g); g.connect(dest || this.sfxG);
    o.start(t); o.stop(t + dur + 0.05);
  }
  noise(dur, filter = 'lowpass', f0 = 1200, f1 = null, vol = 0.3, when = 0, q = 1, dest) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime + when;
    const s = this.ctx.createBufferSource(); s.buffer = this.noiseBuf;
    const f = this.ctx.createBiquadFilter(); f.type = filter; f.frequency.setValueAtTime(f0, t); f.Q.value = q;
    if (f1) f.frequency.exponentialRampToValueAtTime(f1, t + dur);
    const g = this.ctx.createGain(); this._env(g, t, 0.01, vol, dur);
    s.connect(f); f.connect(g); g.connect(dest || this.sfxG);
    s.start(t, Math.random()); s.stop(t + dur + 0.05);
  }
  play(name) {
    if (!this.ctx) return;
    switch (name) {
      case 'click': this.tone(880, 0.05, 'sine', 0.12); break;
      case 'open': this.tone(520, 0.08, 'triangle', 0.12); this.tone(780, 0.1, 'triangle', 0.1, 0.05); break;
      case 'close': this.tone(700, 0.07, 'triangle', 0.1); this.tone(480, 0.09, 'triangle', 0.08, 0.05); break;
      case 'cast': this.noise(0.32, 'bandpass', 2600, 500, 0.35, 0, 2); break;
      case 'splash': this.noise(0.4, 'lowpass', 1800, 300, 0.45); this.tone(140, 0.15, 'sine', 0.25, 0, null, 70); break;
      case 'bite': this.tone(1320, 0.12, 'triangle', 0.25); this.tone(1760, 0.18, 'triangle', 0.22, 0.12); this.noise(0.15, 'highpass', 1500, null, 0.12, 0.02); break;
      case 'hook': this.noise(0.08, 'highpass', 3000, null, 0.3); this.tone(620, 0.12, 'triangle', 0.2, 0, null, 900); break;
      case 'reel': this.tone(1500 + Math.random() * 200, 0.02, 'square', 0.04); break;
      case 'catch': [523, 659, 784, 1047].forEach((f, i) => this.tone(f, 0.25, 'triangle', 0.2, i * 0.09, this.delay)); [523, 659, 784, 1047].forEach((f, i) => this.tone(f, 0.25, 'triangle', 0.18, i * 0.09)); break;
      case 'legendary': [392, 523, 659, 784, 1047, 1319].forEach((f, i) => { this.tone(f, 0.45, 'triangle', 0.18, i * 0.11); this.tone(f * 2, 0.4, 'sine', 0.06, i * 0.11, this.delay); }); break;
      case 'newSpecies': this.tone(1568, 0.3, 'sine', 0.15, 0.35, this.delay); this.tone(2093, 0.4, 'sine', 0.12, 0.45, this.delay); break;
      case 'lost': [494, 440, 392].forEach((f, i) => this.tone(f, 0.18, 'triangle', 0.15, i * 0.12)); break;
      case 'snap': this.tone(900, 0.35, 'sawtooth', 0.12, 0, null, 120); this.noise(0.12, 'highpass', 2500, null, 0.25); break;
      case 'coin': this.tone(1567, 0.09, 'square', 0.08); this.tone(2093, 0.18, 'square', 0.07, 0.07); break;
      case 'error': this.tone(180, 0.18, 'square', 0.08); break;
      case 'travel': this.noise(1.2, 'bandpass', 300, 1800, 0.3, 0, 1.5); this.tone(220, 1.0, 'sine', 0.1, 0.2, this.delay, 440); break;
      case 'board': this.noise(0.3, 'lowpass', 800, 200, 0.3); this.tone(200, 0.2, 'sine', 0.15, 0.05, null, 120); break;
    }
  }
  // Motor do barco: volume e tom acompanham a velocidade
  engine(speed01) {
    if (!this.ctx) return;
    if (!this.eng) {
      const o = this.ctx.createOscillator(), o2 = this.ctx.createOscillator(), f = this.ctx.createBiquadFilter(), g = this.ctx.createGain();
      o.type = 'sawtooth'; o2.type = 'square'; f.type = 'lowpass'; f.frequency.value = 400; g.gain.value = 0;
      o.connect(f); o2.connect(f); f.connect(g); g.connect(this.sfxG); o.start(); o2.start();
      this.eng = { o, o2, f, g };
    }
    const t = this.ctx.currentTime, s = Math.max(0, Math.min(1, speed01));
    this.eng.o.frequency.setTargetAtTime(48 + s * 45, t, 0.1);
    this.eng.o2.frequency.setTargetAtTime(24 + s * 22, t, 0.1);
    this.eng.f.frequency.setTargetAtTime(250 + s * 500, t, 0.1);
    this.eng.g.gain.setTargetAtTime(s > 0.01 ? 0.025 + s * 0.05 : 0, t, 0.15);
  }

  // ───────── Ambiente por ilha ─────────
  ambience(id) {
    if (!this.ctx) { this.pendingAmb = id; return; }
    if (this.ambId === id) return;
    this.ambId = id;
    const old = this.amb;
    if (old) { old.g.gain.setTargetAtTime(0, this.ctx.currentTime, 0.6); setTimeout(() => old.nodes.forEach((n) => { try { n.stop?.(); n.disconnect(); } catch {} }), 2500); }
    for (const t of this.timers) clearTimeout(t);
    this.timers = [];
    const ctx = this.ctx, g = ctx.createGain(); g.gain.value = 0; g.connect(this.ambG);
    g.gain.setTargetAtTime(1, ctx.currentTime, 1.2);
    const nodes = [];
    const loop = (buf, type, freq, vol, lfoRate = 0, lfoDepth = 0, q = 0.7) => {
      const s = ctx.createBufferSource(); s.buffer = buf; s.loop = true;
      const f = ctx.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q;
      const gg = ctx.createGain(); gg.gain.value = vol;
      s.connect(f); f.connect(gg); gg.connect(g); s.start(0, Math.random() * 1.5);
      nodes.push(s, f, gg);
      if (lfoRate) { const l = ctx.createOscillator(), lg = ctx.createGain(); l.frequency.value = lfoRate; lg.gain.value = lfoDepth; l.connect(lg); lg.connect(gg.gain); l.start(); nodes.push(l, lg); }
      return { s, f, gg };
    };
    const every = (min, max, fn) => { const tick = () => { if (this.ambId !== id) return; fn(); this.timers.push(setTimeout(tick, (min + Math.random() * (max - min)) * 1000)); }; this.timers.push(setTimeout(tick, Math.random() * max * 1000)); };
    const out = (vol) => { const gg = ctx.createGain(); gg.gain.value = vol; gg.connect(g); return gg; };
    switch (id) {
      case 'tropical':
        loop(this.brownBuf, 'lowpass', 650, 0.5, 0.11, 0.35);
        loop(this.noiseBuf, 'highpass', 5000, 0.015, 0.2, 0.01);
        every(5, 12, () => { const d = out(0.12); this.tone(1900, 0.18, 'sine', 0.5, 0, d, 1300); this.tone(1700, 0.22, 'sine', 0.4, 0.22, d, 1150); });
        break;
      case 'mangue':
        loop(this.brownBuf, 'lowpass', 300, 0.35, 0.07, 0.15);
        { const ins = loop(this.noiseBuf, 'bandpass', 4600, 0.06, 23, 0.05, 9); nodes.push(ins.s); }
        every(3, 8, () => { const d = out(0.25); for (let i = 0; i < 3; i++) this.tone(110 + Math.random() * 30, 0.08, 'square', 0.25, i * 0.12, d, 90); });
        every(2, 5, () => this.tone(1200 + Math.random() * 800, 0.05, 'sine', 0.05, 0, out(1)));
        break;
      case 'congelada':
        { const w = loop(this.noiseBuf, 'bandpass', 700, 0.18, 0.09, 0.12, 1.5); const l = ctx.createOscillator(), lg = ctx.createGain(); l.frequency.value = 0.05; lg.gain.value = 350; l.connect(lg); lg.connect(w.f.frequency); l.start(); nodes.push(l, lg); }
        loop(this.brownBuf, 'lowpass', 220, 0.25);
        every(6, 14, () => this.tone(70 + Math.random() * 30, 0.5, 'sawtooth', 0.04, 0, out(1), 50));
        every(8, 16, () => [1319, 1760, 1568].forEach((f, i) => this.tone(f, 0.6, 'sine', 0.03, i * 0.2, this.delay)));
        break;
      case 'vulcanica':
        loop(this.brownBuf, 'lowpass', 140, 0.7, 0.05, 0.3);
        every(0.4, 1.6, () => this.tone(180 + Math.random() * 260, 0.06, 'sine', 0.05, 0, out(1), 400 + Math.random() * 200));
        every(0.3, 1.2, () => this.noise(0.03, 'highpass', 3000, null, 0.06, 0, 1, out(1)));
        every(10, 20, () => this.noise(2.5, 'lowpass', 90, 60, 0.6, 0, 1, out(1)));
        break;
      case 'cristais': {
        const notes = [523, 587, 659, 784, 880, 1047];
        for (const f of [261.6, 392, 523.3]) { const o = ctx.createOscillator(), gg = ctx.createGain(); o.frequency.value = f * (1 + (Math.random() - 0.5) * 0.004); o.type = 'sine'; gg.gain.value = 0.03; o.connect(gg); gg.connect(g); o.start(); const l = ctx.createOscillator(), lg = ctx.createGain(); l.frequency.value = 0.1 + Math.random() * 0.1; lg.gain.value = 0.02; l.connect(lg); lg.connect(gg.gain); l.start(); nodes.push(o, gg, l, lg); }
        every(1.2, 3.5, () => this.tone(notes[Math.floor(Math.random() * notes.length)] * (Math.random() < 0.3 ? 2 : 1), 1.4, 'sine', 0.05, 0, this.delay));
        loop(this.brownBuf, 'lowpass', 400, 0.15, 0.08, 0.08);
        break;
      }
    }
    this.amb = { g, nodes };
  }
}
export const sound = new Sound();
