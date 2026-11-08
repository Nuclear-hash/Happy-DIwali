// Synthetic-hand check for the gesture classifier. Builds a parametric hand,
// poses it, and asserts the label the tracker would produce. Run: npm test
import { readHand } from '../src/gesture-math.js';

const LENS = {
  index: [0.40, 0.27, 0.20],
  middle: [0.44, 0.30, 0.22],
  ring: [0.41, 0.28, 0.20],
  pinky: [0.33, 0.21, 0.18],
};
const MCP = {
  index: [-0.26, -0.94],
  middle: [0, -1.0],
  ring: [0.25, -0.95],
  pinky: [0.46, -0.84],
};
const FAN = {
  index: -Math.PI / 2 - 0.18,
  middle: -Math.PI / 2,
  ring: -Math.PI / 2 + 0.13,
  pinky: -Math.PI / 2 + 0.26,
};
const CURL_SIGN = { index: 1, middle: 1, ring: -1, pinky: -1 };

const THUMB_OPEN = [[-0.28, -0.16], [-0.52, -0.36], [-0.74, -0.56], [-0.95, -0.72]];
const THUMB_FOLDED = [[-0.28, -0.16], [-0.38, -0.40], [-0.26, -0.60], [-0.02, -0.68]];

const lerp = (a, b, t) => [
  a[0] + (b[0] - a[0]) * t,
  a[1] + (b[1] - a[1]) * t,
];

function chain(mcp, angle, lens, curl, sign) {
  const pts = [mcp];
  let a = angle;
  let x = mcp[0];
  let y = mcp[1];
  for (let k = 0; k < lens.length; k++) {
    a += curl * 1.6 * sign * (k === 0 ? 0.7 : 1);
    x += Math.cos(a) * lens[k];
    y += Math.sin(a) * lens[k];
    pts.push([x, y]);
  }
  return pts; // mcp, pip, dip, tip
}

function buildHand({
  curl = { index: 0, middle: 0, ring: 0, pinky: 0 },
  thumb = 0,
  rotate = 0,
  scale = 0.3,
  origin = { x: 0.5, y: 0.86 },
  pinchTips = false,
} = {}) {
  const local = new Array(21);
  local[0] = [0, 0];

  for (let i = 0; i < 4; i++) {
    local[1 + i] = lerp(THUMB_OPEN[i], THUMB_FOLDED[i], thumb);
  }

  for (const name of ['index', 'middle', 'ring', 'pinky']) {
    const pts = chain(MCP[name], FAN[name], LENS[name], curl[name], CURL_SIGN[name]);
    const base = name === 'index' ? 5 : name === 'middle' ? 9 : name === 'ring' ? 13 : 17;
    pts.forEach((p, i) => {
      local[base + i] = p;
    });
  }

  if (pinchTips) {
    local[4] = [...local[8]];
  }

  const cos = Math.cos(rotate);
  const sin = Math.sin(rotate);
  return local.map(([x, y]) => {
    const rx = x * cos - y * sin;
    const ry = x * sin + y * cos;
    return { x: origin.x + rx * scale, y: origin.y + ry * scale };
  });
}

const OPEN = { index: 0.05, middle: 0.05, ring: 0.05, pinky: 0.05 };
const FIST = { index: 1, middle: 1, ring: 1, pinky: 1 };

const cases = [
  { name: 'open palm', hand: buildHand({ curl: OPEN }), expect: 'open' },
  { name: 'open palm, tilted', hand: buildHand({ curl: OPEN, rotate: 0.6 }), expect: 'open' },
  { name: 'open palm, small/far', hand: buildHand({ curl: OPEN, scale: 0.16 }), expect: 'open' },
  { name: 'open palm, fingers left', hand: buildHand({ curl: OPEN, rotate: 1.55 }), expect: 'open' },
  { name: 'fist', hand: buildHand({ curl: FIST, thumb: 1 }), expect: 'fist' },
  { name: 'thumbs up', hand: buildHand({ curl: FIST, thumb: 0 }), expect: 'thumbsUp' },
  { name: 'pointing', hand: buildHand({ curl: { ...FIST, index: 0.03 }, thumb: 0.9 }), expect: 'point' },
  { name: 'pointing, tilted', hand: buildHand({ curl: { ...FIST, index: 0.03 }, thumb: 0.9, rotate: -0.5 }), expect: 'point' },
  { name: 'peace', hand: buildHand({ curl: { ...FIST, index: 0.03, middle: 0.03 } }), expect: 'peace' },
  { name: 'finger gun', hand: buildHand({ curl: { ...FIST, index: 0.03 }, thumb: 0 }), expect: 'gun' },
  { name: 'horns', hand: buildHand({ curl: { ...FIST, index: 0.03, pinky: 0.03 }, thumb: 0.6 }), expect: 'horns' },
  { name: 'ok sign', hand: buildHand({ curl: { ...FIST, index: 0.5, middle: 0.05, ring: 0.05, pinky: 0.05 }, thumb: 0.15, pinchTips: true }), expect: 'ok' },
  { name: 'pinch', hand: buildHand({ curl: { ...FIST, index: 0.55, middle: 0.6 }, thumb: 0.15, pinchTips: true }), expect: 'pinch' },
];

let failed = 0;
for (const c of cases) {
  const result = readHand(c.hand);
  const ok = result.label === c.expect;
  if (!ok) failed++;
  console.log(
    `${ok ? 'PASS' : 'FAIL'}  ${c.name.padEnd(24)} expected ${c.expect.padEnd(9)} got ${result.label}  pinch=${result.pinchDist.toFixed(2)}`
  );
}

if (failed) {
  console.error(`\n${failed} gesture case(s) failed`);
  process.exit(1);
}
console.log('\nAll gesture cases passed.');
