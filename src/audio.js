// Synthesised fireworks audio — no samples, everything built from oscillators
// and noise so the whole site stays a few hundred kilobytes.

export class SoundKit {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.noise = null;
    this.muted = false;
  }

  ensure() {
    if (this.ctx) {
      this.unlock();
      return true;
    }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return false;
    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.master.gain.value = this.muted ? 0 : 0.75;
    this.master.connect(this.ctx.destination);
    this.noise = this.makeNoise(2.5);
    // a context created outside a user gesture starts suspended; resume it
    this.unlock();
    return true;
  }

  // Call from a real user gesture (click/key) to satisfy autoplay policies.
  unlock() {
    if (!this.ctx) return;
    if (this.ctx.state === 'suspended') this.ctx.resume().catch(() => {});
  }

  setMuted(muted) {
    this.muted = muted;
    if (this.master && this.ctx) {
      this.master.gain.cancelScheduledValues(this.ctx.currentTime);
      this.master.gain.setTargetAtTime(muted ? 0 : 0.75, this.ctx.currentTime, 0.05);
    }
  }

  makeNoise(seconds) {
    const rate = this.ctx.sampleRate;
    const len = Math.floor(rate * seconds);
    const buf = this.ctx.createBuffer(1, len, rate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    return buf;
  }

  noiseSource() {
    const src = this.ctx.createBufferSource();
    src.buffer = this.noise;
    src.loop = true;
    return src;
  }

  // big shell thump + airy tail
  boom(power = 0.7) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const p = Math.max(0.1, Math.min(1, power));

    const src = this.noiseSource();
    const lp = this.ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(2200 * p + 400, t);
    lp.frequency.exponentialRampToValueAtTime(140, t + 0.55);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.42 * p, t + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.8);
    src.connect(lp).connect(g).connect(this.master);
    src.start(t);
    src.stop(t + 0.85);

    const osc = this.ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(150, t);
    osc.frequency.exponentialRampToValueAtTime(36, t + 0.4);
    const og = this.ctx.createGain();
    og.gain.setValueAtTime(0.5 * p, t);
    og.gain.exponentialRampToValueAtTime(0.0001, t + 0.55);
    osc.connect(og).connect(this.master);
    osc.start(t);
    osc.stop(t + 0.6);
  }

  // small crisp pop for palm blooms
  pop(power = 0.5) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const src = this.noiseSource();
    const bp = this.ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 1100 + Math.random() * 900;
    bp.Q.value = 0.9;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.16 * power, t + 0.006);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.16);
    src.connect(bp).connect(g).connect(this.master);
    src.start(t);
    src.stop(t + 0.2);
  }

  whoosh(duration = 0.55) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const src = this.noiseSource();
    const bp = this.ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.Q.value = 1.4;
    bp.frequency.setValueAtTime(320, t);
    bp.frequency.exponentialRampToValueAtTime(2600, t + duration);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.12, t + duration * 0.4);
    g.gain.exponentialRampToValueAtTime(0.0001, t + duration);
    src.connect(bp).connect(g).connect(this.master);
    src.start(t);
    src.stop(t + duration + 0.05);
  }

  // sparkler hiss: short grainy bursts
  hiss() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const src = this.noiseSource();
    const hp = this.ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 3200;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.045, t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.22);
    src.connect(hp).connect(g).connect(this.master);
    src.start(t);
    src.stop(t + 0.25);
  }

  crackle(count = 7) {
    if (!this.ctx) return;
    const base = this.ctx.currentTime;
    for (let i = 0; i < count; i++) {
      const t = base + Math.random() * 0.5;
      const src = this.noiseSource();
      const bp = this.ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.value = 1800 + Math.random() * 2600;
      bp.Q.value = 1.6;
      const g = this.ctx.createGain();
      const amp = 0.04 + Math.random() * 0.09;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(amp, t + 0.004);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.09);
      src.connect(bp).connect(g).connect(this.master);
      src.start(t);
      src.stop(t + 0.12);
    }
  }

  // shimmering chime used when a diya catches light
  chime(root = 660) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    [1, 1.5, 2.02].forEach((mult, i) => {
      const osc = this.ctx.createOscillator();
      osc.type = 'triangle';
      osc.frequency.value = root * mult;
      const g = this.ctx.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.09 / (i + 1), t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 1.5 - i * 0.15);
      osc.connect(g).connect(this.master);
      osc.start(t);
      osc.stop(t + 1.6);
    });
  }

  // whirring chakri
  zirr() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(180, t);
    osc.frequency.linearRampToValueAtTime(330, t + 0.5);
    const lp = this.ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 1400;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.05, t + 0.08);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.9);
    osc.connect(lp).connect(g).connect(this.master);
    osc.start(t);
    osc.stop(t + 0.95);
  }
}
