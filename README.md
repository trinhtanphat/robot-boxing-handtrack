# Steel Champions · Robot Boxing HandTrack

[Live demo](https://trinhtanphat.github.io/robot-boxing-handtrack/) · [GitHub Actions](https://github.com/trinhtanphat/robot-boxing-handtrack/actions)

A browser-only 3D robot boxing prototype where **your hands and upper-body movement drive Atlas**. MediaPipe runs in the browser, the webcam stays in a picture-in-picture card, and the game maps hand gestures, apparent hand depth, sidesteps, lean and crouch into a procedural Three.js fighter.

## What is included

- Three.js Steel Champions arena with Atlas and Brutus procedural robot fighters.
- MediaPipe two-hand tracking (`numHands: 2`) for fist state, hand position and punch extension.
- MediaPipe pose tracking for body center, sidestep, lean and crouch.
- GPU inference with automatic CPU fallback for both hand and pose models.
- Mirrored picture-in-picture camera with live hand + body landmark overlay.
- Camera-vs-AI mode and local 2-player keyboard mode.
- Health, timer, guard reduction, hit detection, impact VFX, camera shake and calibration.
- Vitest unit tests plus GitHub Actions CI and GitHub Pages deployment.

## Controls

| Player | Controls |
| --- | --- |
| Atlas | Webcam: move both hands and upper body; close a fist and move it toward the camera to punch |
| Atlas fallback | `A` / `D` move, `F` left punch, `G` right punch |
| Brutus local | `←` / `→` move, `N` left punch, `M` right punch |
| View | Drag to orbit; wheel/pinch to zoom |

Use **Calibrate guard** while standing in your normal boxing guard with your upper body visible. Calibration stores neutral hand size for punch depth and the body center used for sidestep/lean/crouch mapping.

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

This repository includes `.github/workflows/pages.yml`. Pushes to `main` run tests, build the Vite app, upload `dist/`, and deploy it with GitHub Pages. The Vite base path is relative (`./`) so the app works under the repository sub-path.

## Privacy

Video frames are processed in the browser. The app does not upload or store camera video. MediaPipe WASM/model assets are downloaded from Google/jsDelivr when vision tracking starts.

## Architecture

```text
src/
  main.js                 app loop, input routing, camera/body integration and combat
  lib/arena.js            Three.js arena, lighting, impact VFX and camera
  lib/robot.js            Atlas/Brutus procedural robot rigs
  lib/handTracker.js      camera + MediaPipe Hand Landmarker
  lib/bodyTracker.js      MediaPipe Pose Landmarker
  lib/bodyMotion.js       pose calibration and body-to-robot mapping
  lib/controlMath.js      hand gesture/depth mapping and helpers
  lib/game.js             round/health/hit rules
tests/
  bodyMotion.test.js
  controlMath.test.js
```

## Roadmap

Useful next steps include physics-backed hit reactions, sound, replay capture, configurable sensitivity, WebRTC multiplayer, spectator mode, richer robot skins and a more advanced pose/footwork model.

This repository is a **virtual game/simulation**. It contains no actuator, motor, weapon, or physical-robot control layer.

## License

MIT
