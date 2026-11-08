// A small additive-particle fireworks engine drawn on a 2D canvas.
// Everything is time-based so it behaves the same at 30fps or 144fps.

const TAU = Math.PI * 2;
const rnd = (a, b) => a + Math.random() * (b - a);
const pick = (arr) => arr[(Math.random() * arr.length) | 0];
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

const PALETTES = [
  [44, 34, 24], // gold / amber
  [14, 30, 44], // saffron
  [332, 348, 6], // rose
  [188, 202, 174], // teal
  [274, 290, 306], // violet
  [96, 116, 138], // green
  [52, 40, 18], // marigold
];

const SHELLS = ['peony', 'chrysanthemum', 'willow', 'ring', 'palm', 'crackle', 'double'];

export class Sky {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.sprites = new Map();
    this.parts = [];
    this.rockets = [];
    this.rings = [];
    this.wheels = [];
    this.timers = [];
    this.t = 0;
    this.flash = 0;
    this.sparkAcc = 0;
    this.onExplode = null;
    this.w = 0;
    this.h = 0;
    this.resize();
    window.addEventListener('resize', () => this.resize());
  }

  resize() {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    this.w = window.innerWidth;
    this.h = window.innerHeight;
    this.canvas.width = Math.floor(this.w * dpr);
    this.canvas.height = Math.floor(this.h * dpr);
    this.canvas.style.width = this.w + 'px';
    this.canvas.style.height = this.h + 'px';
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.ctx.clearRect(0, 0, this.w, this.h);
  }

  sprite(hue) {
    const key = Math.round(hue / 10) * 10;
    let s = this.sprites.get(key);
    if (!s) {
      const size = 56;
      s = document.createElement('canvas');
      s.width = s.height = size;
      const g = s.getContext('2d');
      const grad = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
      grad.addColorStop(0, `hsla(${key},100%,97%,1)`);
      grad.addColorStop(0.18, `hsla(${key},100%,80%,0.95)`);
      grad.addColorStop(0.45, `hsla(${key},100%,62%,0.4)`);
      grad.addColorStop(0.75, `hsla(${key},100%,55%,0.1)`);
      grad.addColorStop(1, `hsla(${key},100%,50%,0)`);
      g.fillStyle = grad;
      g.fillRect(0, 0, size, size);
      this.sprites.set(key, s);
    }
    return s;
  }

  spark(x, y, vx, vy, o = {}) {
    if (this.parts.length > 3000) this.parts.splice(0, 80);
    this.parts.push({
      x,
      y,
      px: x,
      py: y,
      vx,
      vy,
      life: 0,
      max: o.life ?? rnd(0.7, 1.5),
      size: o.size ?? rnd(1.1, 2.6),
      hue: o.hue ?? 44,
      grav: o.grav ?? 130,
      drag: o.drag ?? 0.94,
      trail: !!o.trail,
      twinkle: o.twinkle ?? Math.random() < 0.4,
      split: !!o.split,
      phase: Math.random() * TAU,
    });
  }

  /* ------------------------------------------------ shells */

  burst(x, y, opts = {}) {
    const { count = 46, radius = 78, hues = null } = opts;
    const pal = hues || pick(PALETTES);
    const base = pick(pal);
    const n = Math.round(count);
    for (let i = 0; i < n; i++) {
      const a = Math.random() * TAU;
      const sp = radius * rnd(0.4, 1.25);
      this.spark(x, y, Math.cos(a) * sp, Math.sin(a) * sp, {
        hue: (base + rnd(-16, 16) + 360) % 360,
        life: rnd(0.7, 1.5),
        size: rnd(1.3, 3),
        grav: 150,
        drag: 0.93,
      });
    }
    this.rings.push({ x, y, r0: 3, max: radius * 1.7, life: 0, dur: 0.5, hue: base });
  }

  peony(x, y, pal, s, hueOffset = 0) {
    const count = Math.round(70 * s);
    for (let i = 0; i < count; i++) {
      const a = Math.random() * TAU;
      const sp = rnd(130, 340) * s;
      const hue = (pick(pal) + hueOffset + rnd(-12, 12) + 360) % 360;
      this.spark(x, y, Math.cos(a) * sp, Math.sin(a) * sp, {
        hue,
        life: rnd(0.9, 1.75),
        size: rnd(1.4, 3.1),
        grav: 120,
        drag: 0.935,
      });
    }
  }

  chrysanthemum(x, y, pal, s) {
    const hue = pick(pal);
    for (let ring = 0; ring < 3; ring++) {
      const count = Math.round((26 - ring * 6) * s);
      const speed = (220 - ring * 55) * s;
      for (let i = 0; i < count; i++) {
        const a = (i / count) * TAU + ring * 0.35 + rnd(-0.05, 0.05);
        this.spark(x, y, Math.cos(a) * speed, Math.sin(a) * speed, {
          hue: (hue + ring * 14 + rnd(-8, 8) + 360) % 360,
          life: rnd(1.3, 2.1),
          size: rnd(1.6, 3.2),
          grav: 105,
          drag: 0.955,
          trail: true,
        });
      }
    }
  }

  willow(x, y, pal, s) {
    const hue = 42;
    const count = Math.round(60 * s);
    for (let i = 0; i < count; i++) {
      const a = Math.random() * TAU;
      const sp = rnd(70, 200) * s;
      this.spark(x, y, Math.cos(a) * sp, Math.sin(a) * sp, {
        hue: (hue + rnd(-10, 18) + 360) % 360,
        life: rnd(2, 3.1),
        size: rnd(1.5, 2.8),
        grav: 210,
        drag: 0.965,
        trail: true,
      });
    }
  }

  ringShell(x, y, pal, s) {
    const count = Math.round(48 * s);
    const speed = 260 * s;
    const squash = rnd(0.65, 0.95);
    for (let i = 0; i < count; i++) {
      const a = (i / count) * TAU;
      this.spark(x, y, Math.cos(a) * speed, Math.sin(a) * speed * squash, {
        hue: (i % 2 ? pal[0] : pal[1] ?? pal[0]) + rnd(-6, 6),
        life: rnd(1.1, 1.7),
        size: rnd(1.6, 3),
        grav: 90,
        drag: 0.94,
      });
    }
  }

  palmShell(x, y, pal, s) {
    const count = Math.round(18 * s) + 6;
    const hue = pick(pal);
    for (let i = 0; i < count; i++) {
      const a = Math.random() * TAU;
      const sp = rnd(140, 290) * s;
      this.spark(x, y, Math.cos(a) * sp, Math.sin(a) * sp, {
        hue: (hue + rnd(-10, 10) + 360) % 360,
        life: rnd(1.4, 2.2),
        size: rnd(3, 5.4),
        grav: 150,
        drag: 0.95,
        trail: true,
        split: true,
      });
    }
  }

  crackleShell(x, y, pal, s) {
    const hue = pick(pal);
    const count = Math.round(80 * s);
    for (let i = 0; i < count; i++) {
      const a = Math.random() * TAU;
      const sp = rnd(110, 300) * s;
      this.spark(x, y, Math.cos(a) * sp, Math.sin(a) * sp, {
        hue: (hue + rnd(-18, 18) + 360) % 360,
        life: rnd(0.5, 1.1),
        size: rnd(1, 2.2),
        grav: 130,
        drag: 0.92,
        split: true,
      });
    }
  }

  doubleShell(x, y, pal, s) {
    const a1 = pick(pal);
    const a2 = pick(PALETTES.filter((p) => p !== pal))[0];
    for (let i = 0; i < 34; i++) {
      const a = (i / 34) * TAU;
      this.spark(x, y, Math.cos(a) * 120 * s, Math.sin(a) * 120 * s, {
        hue: a1,
        life: rnd(1.1, 1.8),
        size: 2.4,
        grav: 100,
        drag: 0.94,
      });
    }
    for (let i = 0; i < 52; i++) {
      const a = Math.random() * TAU;
      const sp = rnd(230, 350) * s;
      this.spark(x, y, Math.cos(a) * sp, Math.sin(a) * sp, {
        hue: (a2 + rnd(-10, 10) + 360) % 360,
        life: rnd(1, 1.7),
        size: rnd(1.4, 2.8),
        grav: 130,
        drag: 0.935,
      });
    }
  }

  explode(r) {
    const { x, y, shell, pal, power = 1 } = r;
    const s = 0.7 + power * 0.75;
    this.rings.push({ x, y, r0: 4, max: 52 * s + 26, life: 0, dur: 0.55, hue: pick(pal) });
    this.flash = Math.min(0.55, this.flash + 0.1 * power);

    switch (shell) {
      case 'chrysanthemum':
        this.chrysanthemum(x, y, pal, s);
        break;
      case 'willow':
        this.willow(x, y, pal, s);
        break;
      case 'ring':
        this.ringShell(x, y, pal, s);
        break;
      case 'palm':
        this.palmShell(x, y, pal, s);
        break;
      case 'crackle':
        this.crackleShell(x, y, pal, s);
        break;
      case 'double':
        this.doubleShell(x, y, pal, s);
        break;
      default:
        this.peony(x, y, pal, s);
    }
    if (this.onExplode) this.onExplode({ x, y, power });
  }

  launchShell(opts = {}) {
    const x = opts.x ?? this.w / 2;
    const power = opts.power ?? 0.7;
    const pal = opts.pal || pick(PALETTES);
    const startX = clamp(x + rnd(-24, 24), 40, this.w - 40);
    const startY = this.h + 8;
    const targetX = clamp(x + rnd(-90, 90), 70, this.w - 70);
    const targetY = rnd(this.h * 0.1, this.h * 0.4);
    const g = 720;
    const hgt = Math.max(160, startY - targetY);
    const vy = -Math.sqrt(2 * g * hgt);
    const t = Math.abs(vy) / g;
    const vx = (targetX - startX) / t;
    this.rockets.push({
      x: startX,
      y: startY,
      vx,
      vy,
      pal,
      hue: pick(pal),
      shell: opts.shell || pick(SHELLS),
      power,
      life: 0,
    });
  }

  fling(x, y, vx = 0, vy = 0, opts = {}) {
    const pal = opts.pal || pick(PALETTES);
    const speed = Math.hypot(vx, vy);
    const power = clamp(0.55 + speed / 2200, 0.55, 1);
    this.rockets.push({
      x,
      y,
      vx: clamp(vx * 0.35, -300, 300),
      vy: clamp(vy * 0.3, -220, 220) - rnd(520, 700),
      pal,
      hue: pick(pal),
      shell: opts.shell || pick(SHELLS),
      power,
      life: 0,
    });
  }

  sparkler(x, y, dt) {
    this.sparkAcc += dt * 150;
    const n = Math.min(16, Math.floor(this.sparkAcc));
    this.sparkAcc -= n;
    for (let i = 0; i < n; i++) {
      const a = Math.random() * TAU;
      const sp = rnd(15, 135);
      this.spark(x + rnd(-2, 2), y + rnd(-2, 2), Math.cos(a) * sp, Math.sin(a) * sp - 24, {
        hue: 44 + rnd(-8, 10),
        life: rnd(0.22, 0.7),
        size: rnd(0.7, 1.9),
        grav: 170,
        drag: 0.9,
      });
    }
    if (Math.random() < dt * 26) {
      this.spark(x, y, rnd(-20, 20), rnd(-30, 10), {
        hue: 48,
        life: 0.18,
        size: 2.6,
        grav: 0,
        drag: 0.9,
      });
    }
  }

  streak(x, y, vx, vy) {
    const n = 12;
    for (let i = 0; i < n; i++) {
      this.spark(x, y, vx * rnd(0.2, 0.6) + rnd(-40, 40), vy * rnd(0.2, 0.6) + rnd(-40, 40), {
        hue: rnd(30, 52),
        life: rnd(0.3, 0.7),
        size: rnd(1.2, 2.6),
        grav: 80,
        drag: 0.94,
        trail: true,
      });
    }
  }

  chakri(x, y) {
    const hue = rnd(34, 50);
    this.wheels.push({
      x,
      y,
      angle: Math.random() * TAU,
      spin: rnd(9, 15) * (Math.random() < 0.5 ? -1 : 1),
      life: 0,
      dur: rnd(2.2, 3.1),
      hue,
      acc: 0,
    });
    this.rings.push({ x, y, r0: 2, max: 46, life: 0, dur: 0.45, hue });
  }

  ember(x, y, vy = -80) {
    this.spark(x, y, rnd(-14, 14), vy, {
      hue: rnd(30, 46),
      life: rnd(1.2, 2.4),
      size: rnd(1, 2.2),
      grav: -12,
      drag: 0.985,
      twinkle: true,
    });
  }

  rain(count = 40) {
    for (let i = 0; i < count; i++) {
      this.ember(rnd(0, this.w), rnd(-40, this.h * 0.3), rnd(40, 120));
    }
  }

  finale() {
    const n = 5;
    for (let i = 0; i < n; i++) {
      const x = ((i + 0.5) / n) * this.w + rnd(-40, 40);
      this.timers.push({ at: this.t + i * 0.16, x, power: rnd(0.75, 1), shell: pick(['peony', 'chrysanthemum', 'double', 'palm']) });
    }
    this.rain(60);
    this.flash = 0.7;
  }

  /* ------------------------------------------------ update */

  update(dt) {
    this.t += dt;
    this.flash *= Math.pow(0.02, dt);

    for (let i = this.timers.length - 1; i >= 0; i--) {
      const tm = this.timers[i];
      if (this.t >= tm.at) {
        this.launchShell({ x: tm.x, power: tm.power, shell: tm.shell });
        this.timers.splice(i, 1);
      }
    }

    for (let i = this.rockets.length - 1; i >= 0; i--) {
      const r = this.rockets[i];
      r.vy += 720 * dt;
      r.x += r.vx * dt;
      r.y += r.vy * dt;
      r.life += dt;
      this.spark(r.x + rnd(-1.6, 1.6), r.y + rnd(0, 3), rnd(-16, 16), rnd(0, 46), {
        hue: r.hue,
        life: rnd(0.2, 0.55),
        size: rnd(0.7, 1.7),
        grav: 40,
        drag: 0.9,
      });
      if (r.vy > -34 || r.y < 44 || r.life > 4.5) {
        this.explode(r);
        this.rockets.splice(i, 1);
      }
    }

    const parts = this.parts;
    for (let i = parts.length - 1; i >= 0; i--) {
      const p = parts[i];
      p.life += dt;
      if (p.life >= p.max) {
        if (p.split && Math.random() < 0.55) this.popSplit(p);
        parts.splice(i, 1);
        continue;
      }
      const drag = Math.pow(p.drag, dt * 60);
      p.vx *= drag;
      p.vy = p.vy * drag + p.grav * dt;
      p.px = p.x;
      p.py = p.y;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
    }

    for (let i = this.rings.length - 1; i >= 0; i--) {
      const r = this.rings[i];
      r.life += dt;
      if (r.life >= r.dur) this.rings.splice(i, 1);
    }

    for (let i = this.wheels.length - 1; i >= 0; i--) {
      const w = this.wheels[i];
      w.life += dt;
      w.angle += w.spin * dt;
      w.acc += dt * 90;
      const n = Math.floor(w.acc);
      w.acc -= n;
      const fade = 1 - w.life / w.dur;
      for (let k = 0; k < n; k++) {
        const a = w.angle + (k / Math.max(1, n)) * TAU + rnd(-0.2, 0.2);
        this.spark(w.x + Math.cos(a) * 30, w.y + Math.sin(a) * 30, Math.cos(a) * rnd(40, 120), Math.sin(a) * rnd(40, 120), {
          hue: (w.hue + rnd(-12, 12) + 360) % 360,
          life: rnd(0.2, 0.6),
          size: rnd(0.8, 2),
          grav: 120,
          drag: 0.92,
        });
      }
      if (w.life >= w.dur) {
        this.burst(w.x, w.y, { count: 26, radius: 60, hues: [w.hue] });
        this.wheels.splice(i, 1);
      }
    }
  }

  popSplit(p) {
    if (this.parts.length > 2900) return;
    for (let i = 0; i < 2; i++) {
      this.spark(p.x, p.y, rnd(-70, 70), rnd(-70, 70), {
        hue: (p.hue + rnd(-14, 14) + 360) % 360,
        life: rnd(0.18, 0.45),
        size: rnd(0.7, 1.4),
        grav: 120,
        drag: 0.9,
      });
    }
  }

  /* ------------------------------------------------ draw */

  draw() {
    const ctx = this.ctx;
    const w = this.w;
    const h = this.h;

    // fade previous frame to leave light trails
    ctx.globalCompositeOperation = 'destination-out';
    ctx.fillStyle = 'rgba(0,0,0,0.34)';
    ctx.fillRect(0, 0, w, h);
    ctx.globalCompositeOperation = 'lighter';

    // shockwave rings
    for (const r of this.rings) {
      const t = clamp(r.life / r.dur, 0, 1);
      const ease = 1 - (1 - t) * (1 - t);
      const radius = r.r0 + (r.max - r.r0) * ease;
      const alpha = (1 - t) * 0.55;
      ctx.strokeStyle = `hsla(${r.hue},100%,74%,${alpha})`;
      ctx.lineWidth = Math.max(0.4, (1 - t) * 3.2);
      ctx.beginPath();
      ctx.arc(r.x, r.y, Math.max(0.1, radius), 0, TAU);
      ctx.stroke();
    }

    // chakri wheels
    for (const wh of this.wheels) {
      const fade = 1 - wh.life / wh.dur;
      ctx.save();
      ctx.translate(wh.x, wh.y);
      ctx.rotate(wh.angle);
      ctx.strokeStyle = `hsla(${wh.hue},100%,72%,${0.5 * fade})`;
      ctx.lineWidth = 2;
      for (let i = 0; i < 4; i++) {
        ctx.rotate(TAU / 4);
        ctx.beginPath();
        ctx.arc(0, 0, 26, 0, Math.PI * 0.85);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(0, 0, 14, Math.PI * 0.2, Math.PI * 1.1);
        ctx.stroke();
      }
      ctx.restore();
    }

    // rockets with a hot head
    for (const r of this.rockets) {
      const sp = this.sprite(r.hue);
      ctx.globalAlpha = 1;
      ctx.drawImage(sp, r.x - 12, r.y - 12, 24, 24);
    }

    // particles
    for (const p of this.parts) {
      const t = p.life / p.max;
      let a = t < 0.1 ? t / 0.1 : 1 - (t - 0.1) / 0.9;
      if (p.twinkle) a *= 0.65 + 0.35 * Math.sin(p.life * 34 + p.phase);
      if (a <= 0.01) continue;
      const r = p.size * (0.55 + 0.45 * (1 - t));
      const sp = this.sprite(p.hue);
      ctx.globalAlpha = a;
      if (p.trail) {
        ctx.strokeStyle = `hsla(${p.hue},100%,72%,${a * 0.5})`;
        ctx.lineWidth = Math.max(0.6, r * 0.7);
        ctx.beginPath();
        ctx.moveTo(p.px, p.py);
        ctx.lineTo(p.x, p.y);
        ctx.stroke();
      }
      ctx.drawImage(sp, p.x - r * 2.4, p.y - r * 2.4, r * 4.8, r * 4.8);
    }

    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';

    if (this.flash > 0.01) {
      ctx.fillStyle = `rgba(255,226,170,${Math.min(0.16, this.flash * 0.16)})`;
      ctx.fillRect(0, 0, w, h);
    }
  }
}
