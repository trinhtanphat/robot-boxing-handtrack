# Steel Champions · Robot Boxing HandTrack 3D

A browser-based 3D robot-boxing game where **your hands and body drive Atlas** while Brutus fights back. MediaPipe runs locally in the browser, combining precise two-hand tracking with full-body pose tracking.

## What is included

- Three.js Steel Champions arena with Atlas and Brutus fighters.
- MediaPipe Hand Landmarker for two-hand fist state, hand position and punch depth.
- MediaPipe Pose Landmarker for lateral movement, body lean/dodge and crouch.
- Hybrid calibration for neutral hand depth, body center, shoulder width and torso height.
- Generated GLB assets for Atlas, Brutus and the arena.
- Atlas/Brutus GLBs include `Idle`, `Guard`, `Jab`, `Cross`, `Hook`, `DodgeLeft`, `DodgeRight` and `Victory` clips.
- Runtime GLB loading with procedural geometry retained as IK/collision fallback.
- Camera-vs-AI and local 2-player modes.
- Health, timer, hit detection, impact sparks, camera shake and responsive HUD.
- Vitest tests plus GitHub Actions CI and GitHub Pages deployment.

## Camera controls

| Action | Camera input |
| --- | --- |
| Move left/right | Shift your hips/body left or right |
| Dodge/lean | Lean shoulders relative to your hips |
| Crouch | Lower your hips after calibration |
| Left/right punch | Close the matching fist and move it toward the camera |
| Guard | Keep both fists close to the upper torso |

Keyboard fallback: `A` / `D` move Atlas, `F` left punch, `G` right punch. Local P2 uses `←` / `→`, `N` and `M`.

Use **Calibrate guard** in a neutral boxing stance with your upper body and at least one hand visible. Calibration stores both hand depth and body proportions.

## Run locally

```bash
npm install
npm run dev
```

`predev` automatically generates the GLB files in `public/assets/models/` before Vite starts.

## Generate / inspect 3D assets

```bash
npm run generate:assets
```

Generated files:

```text
public/assets/models/atlas.glb
public/assets/models/brutus.glb
public/assets/models/arena.glb
```

They are intentionally ignored by Git because they are deterministic build outputs. The source-of-truth is `scripts/generate-model-assets.mjs`.

## Test and build

```bash
npm test
npm run build
# or both:
npm run check
```

`prebuild` regenerates all GLBs before the production Vite build. This means CI validates the Node-side GLTFExporter pipeline as part of every build.

## Privacy

Video frames are processed in the browser and are not uploaded or stored by this project. MediaPipe model/WASM assets are downloaded from Google/jsDelivr when camera tracking starts.

## Architecture

```text
scripts/
  generate-model-assets.mjs   deterministic Atlas / Brutus / arena GLB generator
src/
  main.js                     app loop, input routing, UI, combat
  lib/arena.js                Steel Champions arena, lights, VFX, camera
  lib/robot.js                robot IK/collision fallback + GLB visual adapter
  lib/modelAssets.js          GLB loading and fallback handling
  lib/handTracker.js          hybrid Hands + Pose tracking pipeline
  lib/bodyTracker.js          MediaPipe Pose Landmarker wrapper
  lib/bodyMotion.js           calibrated body-motion mapping
  lib/controlMath.js          hand gesture/depth mapping helpers
  lib/game.js                 round/health/hit rules
tests/
  controlMath.test.js
  bodyMotion.test.js
```

## Deployment

`.github/workflows/pages.yml` runs `npm ci`, unit tests and `npm run build` on pull requests. Pushes to `main` additionally deploy `dist/` to GitHub Pages. Vite uses a relative base path so the app works under the repository sub-path.

This repository is a **virtual game/simulation**. It contains no physical robot, actuator, motor or weapon-control layer.

## License

MIT
