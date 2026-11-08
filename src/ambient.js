// Ambient night sky: stars, drifting bokeh and slow embers on their own canvas.

const TAU = Math.PI * 2;
const rand = (a, b) => a + Math.random() * (b - a);

const ORB_TINTS = [
  ['rgba(255, 196, 92, ', 'rgba(255, 140, 40, '],
  ['rgba(255, 138, 160, ', 'rgba(255, 80, 120, '],
  ['rgba(255, 240, 200, ', 'rgba(255, 180, 110, '],
];

function orbSprite(inner, outer, size = 128) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  grad.addColorStop(0, inner + '0.9)');
  grad.addColorStop(0.35, inner + '0.35)');
  grad.addColorStop(0.7, outer + '0.12)');
  grad.addColorStop(1, outer + '0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, size, size);
  return c;
}

export class Ambient {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.stars = [];
    this.orbs = [];
    this.sprites = ORB_TINTS.map(([i, o]) => orbSprite(i, o, 128));
    this.t = 0;
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
    this.seed();
  }

  seed() {
    const area = (this.w * this.h) / (1440 * 900);
    const starCount = Math.round(150 * Math.max(0.6, Math.min(1.7, area)));
    this.stars = Array.from({ length: starCount }, () => ({
      x: Math.random() * this.w,
      y: Math.random() * this.h * 0.82,
      r: rand(0.4, 1.5),
      a: rand(0.15, 0.75),
      phase: Math.random() * TAU,
      speed: rand(0.4, 1.7),
      warm: Math.random() < 0.55,
    }));

    const orbCount = Math.round(16 * Math.max(0.5, Math.min(1.5, area)));
    this.orbs = Array.from({ length: orbCount }, () => this.makeOrb(true));
  }

  makeOrb(initial = false) {
    return {
      x: rand(-40, this.w + 40),
      y: initial ? rand(0, this.h) : this.h + rand(40, 220),
      size: rand(90, 300),
      vy: rand(-16, -5),
      vx: rand(-5, 5),
      a: rand(0.1, 0.32),
      tint: (Math.random() * this.sprites.length) | 0,
      phase: Math.random() * TAU,
      drift: rand(0.25, 0.8),
    };
  }

  update(dt) {
    this.t += dt;
    for (const o of this.orbs) {
      o.y += o.vy * dt;
      o.x += (o.vx + Math.sin(this.t * o.drift + o.phase) * 7) * dt;
      if (o.y < -o.size) Object.assign(o, this.makeOrb(false));
    }
  }

  draw() {
    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.w, this.h);

    // stars
    for (const s of this.stars) {
      const tw = 0.55 + 0.45 * Math.sin(this.t * s.speed + s.phase);
      ctx.globalAlpha = s.a * tw;
      ctx.fillStyle = s.warm ? '#ffe9bd' : '#e6ecff';
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r, 0, TAU);
      ctx.fill();
    }

    // bokeh
    ctx.globalCompositeOperation = 'lighter';
    for (const o of this.orbs) {
      const sprite = this.sprites[o.tint];
      ctx.globalAlpha = o.a * (0.75 + 0.25 * Math.sin(this.t * 0.6 + o.phase));
      ctx.drawImage(sprite, o.x - o.size / 2, o.y - o.size / 2, o.size, o.size);
    }
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1;
  }
}
