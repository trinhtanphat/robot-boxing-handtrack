# Robot Boxing Â· HandTrack 3D

A browser-only 3D boxing prototype where **your two hands drive a procedural robot boxer**. The webcam preview stays in a small corner while MediaPipe Hand Landmarker runs locally in the browser and maps hand position / apparent hand depth to the robot's fists.

## What is included

- Three.js 3D boxing ring with two procedural robot fighters.
- MediaPipe two-hand tracking from the webcam (`numHands: 2`).
- Mirrored picture-in-picture camera with live hand landmarks.
- Camera-vs-AI mode and local 2-player mode.
- P1 keyboard fallback for testing without a camera.
- Health, timer, hit detection, round state, calibration and responsive UI.
- Vitest unit tests plus GitHub Actions CI and GitHub Pages deployment.

## Controls

| Player | Controls |
| --- | --- |
| P1 | Webcam: move both hands; close a fist and move it toward the camera to extend that arm |
| P1 fallback | `A` / `D` move, `F` left punch, `G` right punch |
| P2 local | `â†` / `â†’` move, `N` left punch, `M` right punch |
| View | Drag to orbit; wheel/pinch to zoom |

Use **Calibrate guard** while holding both hands in a normal boxing guard. Calibration stores the current apparent hand size as the neutral depth.

## Run locally

```bash
npm install
npm run dev
```

Open the local Vite URL and allow camera access. `getUserMedia()` works on `localhost` and secure HTTPS pages.

## Test and build

```bash
npm run check
npm run preview
```

The production build is emitted to `dist/`.

## Deploy

This repository includes `.github/workflows/pages.yml`. On pushes to `main` it runs tests, builds the Vite app, uploads `dist/`, and deploys it with GitHub Pages. The Vite base path is relative (`./`) so the app works under a repository sub-path.

## Privacy

Video frames are processed in the browser. This prototype does not upload or store camera video. MediaPipe WASM/model assets are downloaded from Google/jsDelivr when the tracker starts.

## Architecture

```text
src/
  main.js                 app loop, input routing, UI, combat
  lib/arena.js            Three.js scene, ring, lights, camera
  lib/robot.js            procedural robot rig + arm targets
  lib/handTracker.js      camera + MediaPipe Hand Landmarker
  lib/controlMath.js      gesture/depth mapping and helpers
  lib/game.js             round/health/hit rules
tests/
  controlMath.test.js
```

## Roadmap

Useful next steps for the game include GLTF robot skins, Rapier physics, body/pose tracking, sound, replay capture, WebRTC multiplayer, configurable punch sensitivity, and a spectator mode.

This repository is a **virtual game/simulation**. It contains no actuator, motor, weapon, or physical-robot control layer.

## License

MIT
