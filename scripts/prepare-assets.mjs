// Copies the MediaPipe wasm runtime out of node_modules and fetches the hand
// landmark model into public/ so the site runs entirely from its own origin.
import {
  existsSync,
  mkdirSync,
  copyFileSync,
  readdirSync,
  statSync,
  createWriteStream,
} from 'node:fs';
import { join, dirname } from 'node:path';
import https from 'node:https';

const root = process.cwd();
const MODEL_URL =
  'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task';

const wasmSrc = join(root, 'node_modules/@mediapipe/tasks-vision/wasm');
const wasmDst = join(root, 'public/wasm');

if (existsSync(wasmSrc)) {
  const srcFiles = readdirSync(wasmSrc).filter((f) => statSync(join(wasmSrc, f)).isFile());
  const missing = srcFiles.some((f) => !existsSync(join(wasmDst, f)));
  if (missing) {
    mkdirSync(wasmDst, { recursive: true });
    for (const f of srcFiles) copyFileSync(join(wasmSrc, f), join(wasmDst, f));
    console.log(`[assets] copied ${srcFiles.length} wasm files`);
  }
} else {
  console.warn('[assets] mediapipe wasm not found — run npm install first');
}

const modelPath = join(root, 'public/models/hand_landmarker.task');
if (!existsSync(modelPath)) {
  mkdirSync(dirname(modelPath), { recursive: true });
  await download(MODEL_URL, modelPath);
  console.log('[assets] downloaded hand_landmarker.task');
}

function download(url, dest, redirects = 0) {
  return new Promise((resolve, reject) => {
    if (redirects > 5) return reject(new Error('too many redirects'));
    https
      .get(url, (res) => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          res.resume();
          return download(res.headers.location, dest, redirects + 1).then(resolve, reject);
        }
        if (res.statusCode !== 200) {
          res.resume();
          return reject(new Error(`model download failed: HTTP ${res.statusCode}`));
        }
        const out = createWriteStream(dest);
        res.pipe(out);
        out.on('finish', () => out.close(() => resolve()));
        out.on('error', reject);
      })
      .on('error', reject);
  });
}
