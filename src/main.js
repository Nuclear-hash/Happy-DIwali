import './style.css';
import { Sky } from './fireworks.js';
import { Ambient } from './ambient.js';
import { HandTracker, HAND_CONNECTIONS } from './gestures.js';
import { SoundKit } from './audio.js';

const $ = (sel) => document.querySelector(sel);
const rnd = (a, b) => a + Math.random() * (b - a);
const TAU = Math.PI * 2;

const el = {
  bg: $('#bg'),
  fx: $('#fx'),
  intro: $('#intro'),
  startCamera: $('#startCamera'),
  startPointer: $('#startPointer'),
  loading: $('#loading'),
  loadingText: $('#loadingText'),
  dock: $('#dock'),
  cursors: $('#cursors'),
  toast: $('#toast'),
  camPanel: $('#camPanel'),
  camToggle: $('#camToggle'),
  camCanvas: $('#camCanvas'),
  camStatus: $('#camStatus'),
  video: $('#video'),
  statShots: $('#statShots'),
  statDiyas: $('#statDiyas'),
  charge: $('#charge'),
  chargeFill: $('#chargeFill'),
  help: $('#help'),
  helpBtn: $('#helpBtn'),
  closeHelp: $('#closeHelp'),
  muteBtn: $('#muteBtn'),
  diyaRow: $('#diyaRow'),
  wish: $('#wish'),
  wishClose: $('#wishClose'),
};

const sky = new Sky(el.fx);
const ambient = new Ambient(el.bg);
const audio = new SoundKit();
const tracker = new HandTracker(el.video);
const camCtx = el.camCanvas.getContext('2d');

const GESTURE_LABEL = {
  open: 'Bloom',
  point: 'Sparkler',
  pinch: 'Fling',
  peace: 'Chakri',
  horns: 'Fountain',
  gun: 'Volley',
  ok: 'Rangoli',
  fist: 'Charging',
  thumbsUp: 'Light',
  unknown: 'Hand',
};

let mode = 'idle'; // idle | camera | pointer
let running = false;
let shots = 0;
let litCount = 0;
let allLit = false;
let lastFinale = -10;
let noHandSince = null;
let hintShown = false;

const diyas = [];
const handMemory = new Map();
const cursorNodes = new Map();
const cursorSeen = new Map();

const pointer = { x: window.innerWidth / 2, y: window.innerHeight * 0.4, vx: 0, vy: 0, last: 0, active: false };

/* ------------------------------------------------------------------ status */

function bumpShots(n = 1) {
  shots += n;
  el.statShots.textContent = String(shots);
}

let toastTimer = 0;
function toast(message, ms = 2400) {
  el.toast.textContent = message;
  el.toast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.toast.classList.remove('show'), ms);
}

function setCharge(v) {
  if (v > 0.02) {
    el.charge.hidden = false;
    el.chargeFill.style.width = `${Math.round(v * 100)}%`;
  } else {
    el.charge.hidden = true;
    el.chargeFill.style.width = '0%';
  }
}

/* ------------------------------------------------------------------- diyas */

function buildDiyas(count = 11) {
  for (let i = 0; i < count; i++) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'diya';
    btn.style.setProperty('--h', (0.82 + Math.random() * 0.34).toFixed(2));
    btn.setAttribute('aria-label', `Light diya ${i + 1}`);
    btn.innerHTML = '<span class="halo"></span><span class="flame"></span><span class="bowl"></span>';
    btn.addEventListener('click', () => lightDiya(i));
    el.diyaRow.appendChild(btn);
    diyas.push({ el: btn, lit: false });
  }
  el.statDiyas.textContent = `0 / ${diyas.length}`;
}

function lightDiya(index) {
  const d = diyas[index];
  if (!d || d.lit) return;
  d.lit = true;
  d.el.classList.add('lit');
  litCount++;
  el.statDiyas.textContent = `${litCount} / ${diyas.length}`;
  const r = d.el.getBoundingClientRect();
  sky.burst(r.left + r.width / 2, r.top + 10, { count: 12, radius: 40, hues: [42, 30] });
  audio.chime(540 + litCount * 26);
  if (litCount >= diyas.length && !allLit) {
    allLit = true;
    setTimeout(celebrate, 320);
  }
}

function lightAllDiyas() {
  const unlit = diyas.map((d, i) => i).filter((i) => !diyas[i].lit);
  if (!unlit.length) {
    toast('Every diya is already lit 🪔');
    return;
  }
  unlit.forEach((i, k) => setTimeout(() => lightDiya(i), k * 110));
}

let rectCache = [];
let rectTime = 0;

function tryLightNear(x, y) {
  const now = performance.now();
  if (now - rectTime > 400) {
    rectCache = diyas.map((d, i) => {
      const r = d.el.getBoundingClientRect();
      return { i, x: r.left + r.width / 2, y: r.top + 16 };
    });
    rectTime = now;
  }
  for (const r of rectCache) {
    if (!diyas[r.i].lit && Math.hypot(r.x - x, r.y - y) < 66) lightDiya(r.i);
  }
}

/* ---------------------------------------------------------------- gestures */

function memory(id) {
  let st = handMemory.get(id);
  if (!st) {
    st = {
      x: 0,
      y: 0,
      vx: 0,
      vy: 0,
      speed: 0,
      prev: null,
      lastBurst: -9,
      lastStreak: -9,
      lastChakri: -9,
      lastLight: -9,
      lastVolley: -9,
      lastRangoli: -9,
      charge: 0,
      pinchStart: 0,
      pinchFrom: { x: 0, y: 0 },
    };
    handMemory.set(id, st);
  }
  return st;
}

function releasePinch(h, st, now) {
  const held = Math.max(0.1, now - (st.pinchStart || now));
  const dx = h.x - st.pinchFrom.x;
  const dy = h.y - st.pinchFrom.y;
  const moved = Math.hypot(dx, dy);
  if (moved < 26 && held < 0.45) {
    sky.burst(h.x, h.y, { count: 30, radius: 64 });
    audio.pop(0.55);
    bumpShots();
  } else {
    sky.fling(h.x, h.y, dx / held, dy / held);
    audio.whoosh(0.6);
  }
}

function releaseCharge(h, st) {
  const p = st.charge;
  st.charge = 0;
  setCharge(0);
  if (p < 0.12) return;
  sky.launchShell({ x: h.x, power: 0.3 + p * 0.7, shell: p > 0.75 ? 'chrysanthemum' : undefined });
  audio.whoosh(0.75);
}

function triggerFinale() {
  const now = performance.now() / 1000;
  if (now - lastFinale < 2.4) return;
  lastFinale = now;
  sky.finale();
  audio.boom(1);
  audio.crackle(10);
  bumpShots(5);
  toast('The grand finale 🌟', 3000);
}

let wishTimer = 0;

function showWish() {
  el.wish.hidden = false;
  const reveal = () => el.wish.classList.add('show');
  requestAnimationFrame(reveal);
  // requestAnimationFrame is paused in background tabs, so guarantee the
  // reveal still happens when the user comes back.
  setTimeout(reveal, 80);
  clearTimeout(wishTimer);
  wishTimer = setTimeout(hideWish, 9000);
}

function hideWish() {
  clearTimeout(wishTimer);
  el.wish.classList.remove('show');
  setTimeout(() => {
    if (!el.wish.classList.contains('show')) el.wish.hidden = true;
  }, 650);
}

function celebrate() {
  sky.finale();
  lastFinale = performance.now() / 1000;
  sky.rain(90);
  audio.boom(1);
  audio.crackle(12);
  bumpShots(5);
  showWish();
}

function updateHands(dt, now) {
  const hands = tracker.detect();
  const cursors = [];
  let maxCharge = 0;

  if (!hands.length) {
    if (noHandSince == null) noHandSince = now;
    if (now - noHandSince > 5 && !hintShown) {
      hintShown = true;
      toast('Raise an open hand into the frame ✋', 3600);
    }
  } else {
    noHandSince = null;
    hintShown = false;
  }

  for (const h of hands) {
    const st = memory(h.id);
    st.vx = dt > 0 ? (h.x - st.x) / dt : 0;
    st.vy = dt > 0 ? (h.y - st.y) / dt : 0;
    st.speed = Math.hypot(st.vx, st.vy);
    st.x = h.x;
    st.y = h.y;

    if ((h.label === 'pinch' || h.label === 'point') && h.y > window.innerHeight * 0.6) {
      tryLightNear(h.x, h.y);
    }

    if (h.label === 'pinch' && st.prev !== 'pinch') {
      st.pinchStart = now;
      st.pinchFrom = { x: h.x, y: h.y };
    }

    switch (h.label) {
      case 'open':
        if (now - st.lastBurst > 0.34) {
          st.lastBurst = now;
          sky.burst(h.x, h.y, { count: 42, radius: 74 });
          audio.pop(0.5);
          bumpShots();
        }
        break;
      case 'point':
        sky.sparkler(h.x, h.y, dt);
        if (st.speed > 820 && now - st.lastStreak > 0.3) {
          st.lastStreak = now;
          sky.streak(h.x, h.y, st.vx, st.vy);
          audio.hiss();
        }
        break;
      case 'peace':
        if (now - st.lastChakri > 1.0) {
          st.lastChakri = now;
          sky.chakri(h.x, h.y);
          audio.zirr();
        }
        break;
      case 'fist':
        st.charge = Math.min(1, st.charge + dt / 1.4);
        maxCharge = Math.max(maxCharge, st.charge);
        if (Math.random() < dt * 22) sky.ember(h.x + rnd(-24, 24), h.y + rnd(-18, 22), -rnd(40, 110));
        break;
      case 'thumbsUp':
        if (now - st.lastLight > 1.8) {
          st.lastLight = now;
          lightAllDiyas();
        }
        break;
      case 'pinch':
        sky.sparkler(h.x, h.y, dt * 0.4);
        break;
      case 'horns':
        sky.fountain(h.x, h.y, dt);
        if (Math.random() < dt * 5) audio.hiss();
        break;
      case 'gun':
        if (now - st.lastVolley > 0.9) {
          st.lastVolley = now;
          sky.volley(h.x, h.y);
          audio.whoosh(0.5);
          audio.crackle(3);
        }
        break;
      case 'ok':
        if (now - st.lastRangoli > 1.3) {
          st.lastRangoli = now;
          sky.rangoli(h.x, h.y);
          audio.chime(620);
        }
        break;
      default:
        break;
    }

    if (st.prev === 'pinch' && h.label !== 'pinch') releasePinch(h, st, now);
    if (st.prev === 'fist' && h.label !== 'fist') releaseCharge(h, st);
    st.prev = h.label;

    cursors.push({ id: h.id, x: h.x, y: h.y, label: h.label });
  }

  setCharge(maxCharge);

  const openHands = hands.filter((h) => h.label === 'open').length;
  if (openHands >= 2) triggerFinale();

  updateCursors(cursors);
  updateDock(hands.map((h) => h.label));
}

function updatePointer(dt) {
  const now = performance.now() / 1000;
  if (pointer.active && now - pointer.last < 0.55) {
    sky.sparkler(pointer.x, pointer.y, dt);
  }
  updateCursors([{ id: 'mouse', x: pointer.x, y: pointer.y, label: 'point' }]);
  updateDock([]);
}

function updateCursors(list) {
  const now = performance.now();
  for (const c of list) {
    let node = cursorNodes.get(c.id);
    if (!node) {
      node = document.createElement('div');
      node.className = 'cursor';
      node.innerHTML = '<span class="ring"></span><span class="label"></span>';
      el.cursors.appendChild(node);
      cursorNodes.set(c.id, node);
    }
    node.style.transform = `translate3d(${c.x}px, ${c.y}px, 0)`;
    node.classList.add('armed');
    node.classList.toggle('pinch', c.label === 'pinch');
    node.classList.toggle('charge', c.label === 'fist');
    const text = GESTURE_LABEL[c.label] || 'Hand';
    const label = node.querySelector('.label');
    if (label.textContent !== text) label.textContent = text;
    cursorSeen.set(c.id, now);
  }
  for (const [id, node] of cursorNodes) {
    if (now - (cursorSeen.get(id) ?? 0) > 900) {
      node.remove();
      cursorNodes.delete(id);
    } else if (!list.some((c) => c.id === id)) {
      node.classList.remove('armed');
    }
  }
}

function updateDock(labels) {
  const active = new Set(labels.filter(Boolean));
  for (const item of el.dock.children) {
    item.classList.toggle('active', active.has(item.dataset.gesture));
  }
}

let flashTimer = 0;
function flashGesture(gesture) {
  updateDock([gesture]);
  clearTimeout(flashTimer);
  flashTimer = setTimeout(() => updateDock([]), 650);
}

/* ------------------------------------------------------------ camera preview */

let camStatusText = '';
function drawCam() {
  const width = el.camCanvas.clientWidth || 208;
  const height = el.camCanvas.clientHeight || 156;
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  if (el.camCanvas.width !== Math.round(width * dpr) || el.camCanvas.height !== Math.round(height * dpr)) {
    el.camCanvas.width = Math.round(width * dpr);
    el.camCanvas.height = Math.round(height * dpr);
  }
  camCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
  camCtx.clearRect(0, 0, width, height);

  const hands = tracker.raw || [];
  for (const lm of hands) {
    camCtx.strokeStyle = 'rgba(255,206,120,0.8)';
    camCtx.lineWidth = 1.3;
    camCtx.beginPath();
    for (const [a, b] of HAND_CONNECTIONS) {
      camCtx.moveTo((1 - lm[a].x) * width, lm[a].y * height);
      camCtx.lineTo((1 - lm[b].x) * width, lm[b].y * height);
    }
    camCtx.stroke();
    camCtx.fillStyle = '#ffe7ae';
    for (const p of lm) {
      camCtx.beginPath();
      camCtx.arc((1 - p.x) * width, p.y * height, 1.7, 0, TAU);
      camCtx.fill();
    }
  }

  const text = hands.length ? `${hands.length} hand${hands.length > 1 ? 's' : ''} tracked` : 'searching for hands';
  if (text !== camStatusText) {
    camStatusText = text;
    el.camStatus.textContent = text;
  }
}

/* ------------------------------------------------------------------- flow */

function reportCameraError(err) {
  console.error('[camera]', err);
  el.loading.hidden = true;
  el.startCamera.disabled = false;
  el.startCamera.querySelector('.btn-text').textContent = 'Try camera again';
  const name = err?.name || '';
  let message = 'Camera could not start.';
  if (name === 'NotAllowedError' || name === 'SecurityError') {
    message = 'Camera permission was blocked — allow it in the browser, or use mouse mode.';
  } else if (name === 'NotFoundError' || name === 'OverconstrainedError') {
    message = 'No camera found on this device — mouse mode works just as well.';
  } else if (name === 'NotReadableError') {
    message = 'The camera is busy in another app — close it and try again.';
  }
  toast(message, 6000);
}

async function startWithCamera() {
  // Create/resume audio while the click is still a user activation — the camera
  // and model awaits below would otherwise expire it and leave audio silent.
  audio.ensure();
  audio.unlock();
  el.startCamera.disabled = true;
  el.loading.hidden = false;
  el.loadingText.textContent = 'Waking the camera…';
  try {
    await tracker.openCamera();
  } catch (err) {
    reportCameraError(err);
    return;
  }

  el.loadingText.textContent = 'Loading hand tracking…';
  try {
    await tracker.load();
  } catch (err) {
    console.error('[hands]', err);
    reportCameraError(err);
    tracker.stopCamera();
    toast('Hand tracking could not load — try mouse mode.', 6000);
    return;
  }

  begin('camera');
}

function begin(nextMode) {
  mode = nextMode;
  running = true;
  document.body.classList.remove('at-intro');
  audio.ensure();
  el.muteBtn.classList.toggle('is-off', audio.muted);

  el.intro.classList.add('leaving');
  setTimeout(() => {
    el.intro.hidden = true;
    el.intro.classList.remove('leaving');
  }, 540);

  el.camPanel.hidden = mode !== 'camera';
  if (mode === 'camera') {
    toast('Raise a palm into frame ✋', 4200);
  } else {
    toast('Move the mouse to draw — click to burst', 4200);
  }
}

/* ------------------------------------------------------------------ events */

el.startCamera.addEventListener('click', startWithCamera);

el.startPointer.addEventListener('click', () => {
  audio.ensure();
  audio.unlock();
  begin('pointer');
});

el.muteBtn.addEventListener('click', () => {
  audio.ensure();
  audio.setMuted(!audio.muted);
  el.muteBtn.classList.toggle('is-off', audio.muted);
  el.muteBtn.setAttribute('aria-pressed', String(audio.muted));
  toast(audio.muted ? 'Sound off' : 'Sound on', 1400);
});

el.camToggle.addEventListener('click', () => {
  if (mode !== 'camera') {
    toast('Camera is off — you are in mouse mode', 2400);
    return;
  }
  el.camPanel.classList.toggle('hide');
});

el.helpBtn.addEventListener('click', () => {
  el.help.hidden = false;
});

el.closeHelp.addEventListener('click', () => {
  el.help.hidden = true;
});

el.help.addEventListener('click', (e) => {
  if (e.target === el.help) el.help.hidden = true;
});

window.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    el.help.hidden = true;
    hideWish();
    return;
  }
  if (!running) return;
  if (e.key === 'm' || e.key === 'M') {
    el.muteBtn.click();
    return;
  }
  if (e.key === '?' || e.key === 'h' || e.key === 'H') {
    el.help.hidden = !el.help.hidden;
    return;
  }
  if (e.code === 'Space') {
    e.preventDefault();
    triggerFinale();
    return;
  }
  const n = Number(e.key);
  if (n >= 1 && n <= 9) demoGesture(n);
});

el.wishClose.addEventListener('click', hideWish);

// Any interaction can unlock audio if the context was created suspended.
['pointerdown', 'keydown', 'touchstart'].forEach((evt) =>
  document.addEventListener(evt, () => audio.unlock(), { passive: true })
);

document.addEventListener('pointermove', (e) => {
  pointer.vx = e.clientX - pointer.x;
  pointer.vy = e.clientY - pointer.y;
  pointer.x = e.clientX;
  pointer.y = e.clientY;
  pointer.last = performance.now() / 1000;
  pointer.active = true;
});

document.addEventListener('pointerdown', (e) => {
  if (!running) return;
  if (e.target.closest('button, .overlay, .dock, .hud, .cam-panel')) return;
  sky.burst(pointer.x, pointer.y, { count: 40, radius: 76 });
  audio.pop(0.55);
  bumpShots();
});

document.addEventListener('pointerleave', () => {
  pointer.active = false;
});

function demoGesture(n) {
  const cx = window.innerWidth / 2;
  const cy = window.innerHeight * 0.42;
  switch (n) {
    case 1:
      sky.burst(cx, cy, { count: 52, radius: 96 });
      audio.pop(0.6);
      bumpShots();
      flashGesture('open');
      break;
    case 2:
      sky.sparkler(cx, cy, 0.5);
      sky.streak(cx, cy, 260, 0);
      audio.hiss();
      flashGesture('point');
      break;
    case 3:
      sky.fling(cx, cy, 0, 300);
      audio.whoosh(0.6);
      flashGesture('pinch');
      break;
    case 4:
      sky.chakri(cx, cy);
      audio.zirr();
      flashGesture('peace');
      break;
    case 5:
      sky.launchShell({ x: cx, power: 1, shell: 'chrysanthemum' });
      audio.whoosh(0.75);
      flashGesture('fist');
      break;
    case 6:
      lightAllDiyas();
      flashGesture('thumbsUp');
      break;
    case 7:
      sky.fountain(cx, cy, 0.4);
      audio.hiss();
      flashGesture('horns');
      break;
    case 8:
      sky.volley(cx, cy);
      audio.whoosh(0.5);
      flashGesture('gun');
      break;
    case 9:
      sky.rangoli(cx, cy);
      audio.chime(620);
      flashGesture('ok');
      break;
    default:
      break;
  }
}

/* -------------------------------------------------------------------- loop */

sky.onExplode = ({ power }) => {
  audio.boom(power);
  bumpShots();
};

/* -------------------------------------------------------------- auto show */

// The sky celebrates on its own from the moment the page opens.
let autoNext = 0;

function autoShow(now) {
  if (now < autoNext) return;
  autoNext = now + (running ? rnd(1.1, 2.2) : rnd(0.45, 1.1));
  const x = rnd(window.innerWidth * 0.08, window.innerWidth * 0.92);
  if (Math.random() < 0.24) {
    sky.burst(x, rnd(window.innerHeight * 0.12, window.innerHeight * 0.42), {
      count: 26,
      radius: 60,
    });
  } else {
    sky.launchShell({ x, power: rnd(0.55, 1) });
  }
}

function openingShow() {
  const w = window.innerWidth;
  for (let i = 0; i < 6; i++) {
    setTimeout(() => sky.launchShell({ x: ((i + 0.5) / 6) * w, power: rnd(0.75, 1) }), i * 170);
  }
  setTimeout(() => sky.finale(), 1100);
}

let last = performance.now();
function frame(now) {
  const dt = Math.min(0.05, Math.max(0.001, (now - last) / 1000));
  last = now;

  ambient.update(dt);
  ambient.draw();

  autoShow(now / 1000);

  if (running) {
    if (mode === 'camera') updateHands(dt, now / 1000);
    else if (mode === 'pointer') updatePointer(dt);
  }

  sky.update(dt);
  sky.draw();

  if (mode === 'camera' && tracker.ready) drawCam();

  requestAnimationFrame(frame);
}

buildDiyas();
requestAnimationFrame(frame);
setTimeout(openingShow, 420);

if (import.meta.env.DEV) {
  window.__diwali = { sky, audio, tracker };
}

// light two diyas as a welcome, so the row never looks dead on arrival
setTimeout(() => {
  lightDiya(3);
}, 900);
setTimeout(() => {
  lightDiya(7);
}, 1600);
