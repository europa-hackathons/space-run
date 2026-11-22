# Space Run

A 90 second space game built for the Europa hackathon. Fly forward, dodge the asteroids, shoot the aliens.

Play it: https://space-run-game.vercel.app

Built by: Noah, and Filip under supervision from Anton

## Controls

| Mode | Steer | Fire | Start |
|---|---|---|---|
| Keyboard | Arrow keys or A / D | Space | Enter |
| Touch | On-screen ◀ ▶ buttons | FIRE button | Tap |
| Camera | Step or lean left and right | Raise a hand | Hold both hands up |

Camera mode tracks the player's body with MediaPipe in the browser. Video stays on the device.
The interface is available in English and Swedish.

## Run it

```bash
npm install
npm run dev
```

Other commands:

- `npm test` runs the unit tests for the game rules and the body-tracking maths.
- `npm run build` makes a production build in `dist/`.
- `vercel deploy --prod` publishes it.

## Layout

- `src/game.ts` holds the game rules as pure logic, with tests in `src/game.test.ts`.
- `src/render/` draws the game with Three.js.
- `src/input.ts`, `src/camera.ts` and `src/pose.ts` handle keyboard, touch and camera controls.
- `src/config.ts` has every tunable number.
- `assets/blender/` has the scripts that generate the 3D models, and the Blender file.
- `public/` has the exported models, sounds and the pose tracking model.
- `docs/superpowers/specs/` has the game specification.
