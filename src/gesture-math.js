// Pure gesture geometry — no MediaPipe imports, so it can be unit tested in Node.

export const HAND_CONNECTIONS = [
  [0, 1], [1, 2], [2, 3], [3, 4],
  [0, 5], [5, 6], [6, 7], [7, 8],
  [5, 9], [9, 10], [10, 11], [11, 12],
  [9, 13], [13, 14], [14, 15], [15, 16],
  [13, 17], [17, 18], [18, 19], [19, 20],
  [0, 17],
];

export const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const mid = (a, b) => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });

// A finger is counted as extended when its proximal and distal phalanges are
// roughly collinear. Angle-based, so it does not depend on hand size or the
// distance the hand is held from the camera.
export function straight(lm, mcp, pip, tip) {
  const ax = lm[pip].x - lm[mcp].x;
  const ay = lm[pip].y - lm[mcp].y;
  const bx = lm[tip].x - lm[pip].x;
  const by = lm[tip].y - lm[pip].y;
  const na = Math.hypot(ax, ay);
  const nb = Math.hypot(bx, by);
  if (na < 1e-6 || nb < 1e-6) return false;
  const cos = (ax * bx + ay * by) / (na * nb);
  return cos > 0.35; // bent less than ~70°
}

export function readHand(lm) {
  const palm = Math.max(0.028, dist(lm[0], lm[9]));
  const fingers = {
    index: straight(lm, 5, 6, 8),
    middle: straight(lm, 9, 10, 12),
    ring: straight(lm, 13, 14, 16),
    pinky: straight(lm, 17, 18, 20),
  };
  // thumb is "out" when it clears the pinky side of the palm and is not folded in
  const thumb =
    dist(lm[4], lm[17]) / palm > 1.0 && straight(lm, 2, 3, 4);
  const pinchDist = dist(lm[4], lm[8]) / palm;
  // in a closed fist the thumb also touches the index tip, so a pinch also
  // requires the index finger to be reaching away from the palm
  const indexReach = dist(lm[8], lm[0]) / palm;
  const circle = pinchDist < 0.44;
  // an L-shaped thumb sits far from the base of the index; a tucked one does not
  const thumbOut = dist(lm[4], lm[5]) / palm > 0.62;

  let label = 'unknown';
  if (circle && fingers.middle && fingers.ring && fingers.pinky) {
    label = 'ok';
  } else if (circle && indexReach > 1.12 && !(fingers.index && fingers.middle && fingers.ring)) {
    label = 'pinch';
  } else if (fingers.index && fingers.middle && (fingers.ring || fingers.pinky)) {
    label = 'open';
  } else if (fingers.index && fingers.middle && !fingers.ring && !fingers.pinky) {
    label = 'peace';
  } else if (fingers.index && fingers.pinky && !fingers.middle && !fingers.ring) {
    label = 'horns';
  } else if (fingers.index && !fingers.middle && !fingers.ring && !fingers.pinky) {
    label = thumbOut && thumb ? 'gun' : 'point';
  } else if (!fingers.index && !fingers.middle && !fingers.ring && !fingers.pinky) {
    label = thumb && lm[4].y < lm[3].y ? 'thumbsUp' : 'fist';
  }

  const palmCenter = {
    x: (lm[0].x + lm[5].x + lm[9].x + lm[13].x + lm[17].x) / 5,
    y: (lm[0].y + lm[5].y + lm[9].y + lm[13].y + lm[17].y) / 5,
  };
  const anchor = label === 'point' ? lm[8] : label === 'pinch' ? mid(lm[4], lm[8]) : palmCenter;

  return { label, fingers, thumb, pinchDist, anchor, palm, palmCenter };
}
