# Deepotsav 🪔

A Diwali sky you conduct with your bare hands. Point the webcam at yourself and the
festival responds to real gestures: palms bloom fireworks, a fingertip becomes a
sparkler, a pinch flings rockets, a fist charges a mega shell, and a thumbs up lights
the whole row of diyas.

The page opens on a full-screen **Happy Diwali** greeting while the sky celebrates on
its own — shells launch continuously from the first frame, with a grand finale every so
often, and `made by Harsh` sits in the corner of the greeting and the live view.

Everything runs in the browser. The camera feed never leaves the device.

## Gestures

| Gesture | What happens |
| --- | --- |
| ✋ Open palm | Fireworks keep blooming where your hand is. Two open hands starts the grand finale. |
| ☝️ Point | A gold sparkler follows your fingertip. Move fast to throw a streak of fire. |
| 🤏 Pinch | Hold a shell in the air; release to fling it. Pinching or pointing near a diya lights it. |
| ✌️ Peace sign | Spins a chakri (ground spinner) at your fingertips. |
| ✊ Fist | Hold to charge (meter fills), open your hand to launch a giant shell. |
| 👍 Thumbs up | Lights every diya at once. |

Lost the camera? Move the mouse to draw sparklers, click to burst, press <kbd>1</kbd>–<kbd>6</kbd>
to fire each gesture, <kbd>Space</kbd> for the finale, <kbd>M</kbd> to mute, <kbd>H</kbd> for help.

## How it works

- **Hand tracking** — MediaPipe Tasks Vision `HandLandmarker` running in `VIDEO` mode on
  the webcam, with GPU delegate and a CPU fallback. The wasm runtime and the model are
  served from this site, not a CDN.
- **Gesture classification** (`src/gesture-math.js`) — pure geometry: finger extension
  from joint angles (so it works at any hand size or distance), thumb extension from its
  reach across the palm, pinch from thumb-to-index distance gated by how far the index
  finger reaches. Per-hand label hysteresis keeps jitter from retriggering actions.
- **Fireworks** (`src/fireworks.js`) — a time-based additive particle engine on canvas:
  rockets with gravity, seven shell shapes (peony, chrysanthemum, willow, ring, palm,
  crackle, double), sparkler emission, chakri wheels and shockwave rings. Trails come
  from a per-frame `destination-out` fade; glow uses cached hue sprites.
- **Sound** (`src/audio.js`) — WebAudio only, no samples: filtered noise for booms and
  crackle, oscillator thumps, chime clusters for diyas.
- **Ambience** (`src/ambient.js`) — starfield and drifting bokeh behind the action.

## Commands

```bash
npm install      # dependencies
npm run assets   # copies wasm + downloads the hand model into public/
npm run dev      # http://localhost:3000
npm test         # synthetic-hand checks for the gesture classifier
npm run build    # static build into dist/
```

`npm run dev` and `npm run build` run `assets` automatically. The model (~7.5 MB) and
wasm runtime are gitignored and fetched on first run.

## Publish on GitHub Pages

The site is static, so GitHub Pages can host it. A workflow is included at
`.github/workflows/deploy.yml`: it builds with the repository name as the base path and
deploys `dist/`.

1. Push this project to a GitHub repository (Pages needs a public repo on the free plan).
2. Repository **Settings → Pages → Build and deployment → Source: GitHub Actions**.
3. Push to `main`, or run the workflow from the Actions tab.
4. The site appears at `https://<user>.github.io/<repo>/`.

The workflow runs `npm ci`, which triggers `npm run assets` to download the hand model
and copy the wasm runtime, so none of the generated files need to be committed.

> **Pages needs a public repository on the free plan.** If the first run fails at the
> `actions/configure-pages@v5` step, the repository was private: make it public
> (Settings → General → Danger Zone → Change visibility) and re-run the workflow.
> The project builds fine either way — only Pages publishing is gated.

For a user site (`https://<user>.github.io/`) or a custom domain, set the `VITE_BASE`
environment variable in the workflow to `/`.

## Privacy

The webcam stream is used locally for landmark detection only. Nothing is recorded,
stored or uploaded, and there is no server component.

## Known limits

- Needs a reasonably lit room and one clear hand in frame; two hands work, more do not.
- Hand tracking downloads ~7.5 MB of model on first use, so the first start takes a moment.
- The site is a static build; it depends on the browser's `getUserMedia` support.
