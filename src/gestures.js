// Webcam hand tracking + gesture classification on top of MediaPipe Tasks Vision.
import { FilesetResolver, HandLandmarker } from '@mediapipe/tasks-vision';
import { readHand, HAND_CONNECTIONS } from './gesture-math.js';

export { HAND_CONNECTIONS };

// Respect Vite's base so the model and wasm runtime also resolve when the site is
// hosted under a subpath (GitHub Pages project sites).
const BASE = import.meta.env.BASE_URL;
const MODEL_URL = `${BASE}models/hand_landmarker.task`;
const WASM_ROOT = `${BASE}wasm`;

export class HandTracker {
  constructor(video) {
    this.video = video;
    this.landmarker = null;
    this.stream = null;
    this.hands = [];
    this.raw = [];
    this.lastVideoTime = -1;
    this.ready = false;
    this.smooth = new Map();
    this.labels = new Map();
  }

  async openCamera() {
    if (!navigator.mediaDevices?.getUserMedia) {
      throw new Error('This browser has no camera access API.');
    }
    this.stream = await navigator.mediaDevices.getUserMedia({
      audio: false,
      video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } },
    });
    this.video.srcObject = this.stream;
    await this.video.play().catch(() => {});
    await new Promise((resolve) => {
      if (this.video.readyState >= 2) return resolve();
      this.video.onloadeddata = () => resolve();
      setTimeout(resolve, 2500);
    });
  }

  stopCamera() {
    if (this.stream) {
      for (const track of this.stream.getTracks()) track.stop();
      this.stream = null;
    }
    this.video.srcObject = null;
  }

  async load() {
    if (this.ready) return;
    const fileset = await FilesetResolver.forVisionTasks(WASM_ROOT);
    const options = {
      baseOptions: { modelAssetPath: MODEL_URL, delegate: 'GPU' },
      runningMode: 'VIDEO',
      numHands: 2,
      minHandDetectionConfidence: 0.55,
      minHandPresenceConfidence: 0.5,
      minTrackingConfidence: 0.5,
    };
    try {
      this.landmarker = await HandLandmarker.createFromOptions(fileset, options);
    } catch (err) {
      console.warn('[hands] GPU delegate unavailable, using CPU', err);
      this.landmarker = await HandLandmarker.createFromOptions(fileset, {
        ...options,
        baseOptions: { modelAssetPath: MODEL_URL, delegate: 'CPU' },
      });
    }
    this.ready = true;
  }

  detect() {
    const video = this.video;
    if (!this.landmarker || video.readyState < 2) return this.hands;
    if (video.currentTime === this.lastVideoTime) return this.hands;
    this.lastVideoTime = video.currentTime;

    let result;
    try {
      result = this.landmarker.detectForVideo(video, performance.now());
    } catch (err) {
      return this.hands;
    }

    const landmarks = result.landmarks || [];
    const handedness = result.handednesses || [];
    const now = performance.now();
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const out = [];
    this.raw = landmarks;

    landmarks.forEach((lm, i) => {
      const info = readHand(lm);
      const id = `hand${i}`;

      // gesture hysteresis so tiny tracking jitters don't retrigger actions
      let state = this.labels.get(id);
      if (!state) {
        state = { label: info.label, candidate: info.label, since: now };
        this.labels.set(id, state);
      }
      if (info.label !== state.candidate) {
        state.candidate = info.label;
        state.since = now;
      } else if (info.label !== state.label && now - state.since > 110) {
        state.label = info.label;
      }
      const label = state.label;

      // smooth the cursor with a light exponential filter
      const prev = this.smooth.get(id) || { x: info.anchor.x, y: info.anchor.y };
      const sx = prev.x + (info.anchor.x - prev.x) * 0.42;
      const sy = prev.y + (info.anchor.y - prev.y) * 0.42;
      this.smooth.set(id, { x: sx, y: sy });

      // mirror the feed and gently stretch the usable area toward the edges
      const nx = (1 - sx - 0.5) * 1.16 + 0.5;
      const ny = (sy - 0.5) * 1.12 + 0.5;

      out.push({
        id,
        label,
        words: label,
        x: Math.max(-40, Math.min(vw + 40, nx * vw)),
        y: Math.max(-40, Math.min(vh + 40, ny * vh)),
        pinch: info.pinchDist,
        landmarks: lm,
        handedness: handedness[i]?.[0]?.categoryName ?? 'Right',
      });
    });

    // drop smoothing state for hands that left the frame
    if (landmarks.length === 0) this.labels.clear();

    this.hands = out;
    return out;
  }
}
