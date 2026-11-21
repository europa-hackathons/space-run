# Space game, stage 1 (MVP) specification

Date: 2026-11-21
Source: Team 3 meeting notes (Granola), https://notes.granola.ai/t/893f39d0-dcd7-4d45-b407-e5383c4dc9ec-008umkv4
Status: approved and built on 2026-11-21

## 1. Intent

Team 3 is building a game to submit for the winter party, where players stand in front of a screen and play. The full concept is a spaceship that dodges asteroids, shoots aliens, collects gems for upgrades and visits different planets, controlled by hand gestures through a camera.

Stage 1 is the smallest playable version of that: one ship, button controls, one 90 second round. Its purpose is to get something on screen that the team can play and tune quickly, before any camera work starts.

## 2. Scope

Items marked (notes) come from the meeting notes. Items marked (Anton) come from Anton's correction on 2026-11-21. Items marked (call) are decisions made while writing this spec and are open to correction.

### In scope

- A spaceship the player controls with keyboard buttons (notes)
- Playable on mobile phones with on-screen touch buttons, because kids will test it on phones (Anton)
- The ship flies forward, into the screen. Asteroids and aliens come towards the player from the distance (Anton)
- Asteroids that must be dodged (notes)
- Aliens that pop up and must be shot (notes)
- A 90 second round (notes)
- A score, a start screen and a results screen (call)
- Rendering in real 3D with Three.js, with the ship as a 3D model made in Blender (Anton)

### Out of scope for stage 1

- Camera and hand gesture controls (notes: this is version 2)
- Gems and spaceship upgrades (call: cut for simplicity)
- Different planets as settings (call: cut for simplicity, one starfield)
- Vertical ship movement (call: cut for simplicity, see section 3)
- Sound and music (call)
- Online leaderboard and multiplayer (call)

### Anti-goals

- No top-down or side-scrolling view. The player must feel they are flying towards things.
- No backend. If stage 1 needs more than a static page, it is too big.
- Gameplay must not wait on art. Models are loaded from `.glb` files, and the game falls back to simple generated shapes when a model is missing.

## 3. Gameplay

### View

- The camera sits behind and slightly above the ship and looks forward. The ship is drawn near the bottom centre of the screen, seen from behind.
- Asteroids and aliens appear small near the horizon and grow as they approach.
- A starfield streams outward from the vanishing point to show forward motion.
- The view fills the whole browser window in any shape. On tall (portrait) phone screens the vertical field of view widens so the sides stay visible.

```
+--------------------------------------------------+
| SCORE 1200            TIME 47            ♥ ♥ ♥   |
|              .        ·       .                  |
|        .          👾 · ◦          .              |
|                  ◯       |                       |
|      .                   |      👾        .      |
|            ◯             |                       |
|   ⬤                      |                       |
|                        /_▲_\                     |
+--------------------------------------------------+
   far objects are small, near objects are large
```

### World model

To keep stage 1 simple, everything lives on one flat plane (call). Each object has two coordinates:

- `x`: sideways position, from -300 to 300 world units.
- `z`: distance ahead of the ship. The ship is at `z = 0`. Objects spawn at `z = 2000`.

The ship does not actually move forward. Instead every object's `z` decreases at the current flight speed, which looks the same to the player.

### Ship

- Moves left and right only, at 400 units/s, clamped to the `x` range.
- Fires bullets straight ahead (increasing `z`) at 1500 units/s. Holding the fire button repeats with a 250 ms cooldown. A bullet is removed beyond `z = 2000`.
- Has 3 lives. After a hit the ship is invulnerable for 1.5 s and blinks.

### Controls

| Action | Keys |
|---|---|
| Move left | Left arrow, A |
| Move right | Right arrow, D |
| Fire | Space |
| Start or restart | Enter |

On touch devices three on-screen buttons appear while playing: left and right at the bottom left, and FIRE at the bottom right. They can be held, and steering and firing work at the same time. Start and restart are a tap on the button shown on the start and results screens.

### Asteroids

- Spawn at `z = 2000` with a random radius of 30 to 70 units. They do not move sideways. About a third are aimed at the ship's current `x` so that standing still is not safe (call); the rest get a random `x`.
- Cannot be destroyed. A bullet that hits an asteroid disappears.
- Hitting the ship costs 1 life and removes the asteroid.
- An asteroid that passes behind the ship is removed.

### Aliens

- Spawn at `z = 2000` with a random `x` and sway left and right as they approach (sine wave, 80 unit amplitude). Radius 35 units.
- One bullet destroys an alien and awards 100 points.
- Aliens do not shoot in stage 1.
- Hitting the ship costs 1 life and removes the alien.
- An alien that passes behind the ship is removed with no penalty.

### Collisions

- An object hits the ship when it reaches the ship's depth (`z` crossing 0) and its sideways distance from the ship is less than the two radii combined.
- A bullet hits an object when their `z` positions cross during a frame and their sideways distance is less than the two radii combined.

### Difficulty

Flight speed and spawn rates change linearly over the round:

| Value | At 0 s | At 90 s |
|---|---|---|
| Flight speed (how fast objects approach) | 500 units/s | 800 units/s |
| Asteroid spawn interval | 1.2 s | 0.4 s |
| Alien spawn interval | 2.5 s | 1.0 s |

At the starting speed an object takes 4 seconds to reach the ship, and 2.5 seconds at the end.

### Round and scoring

- A round lasts 90 seconds. It ends when the timer reaches 0 or the ship has 0 lives, whichever comes first.
- Score: 100 per alien destroyed, plus 10 per full second survived.
- The best score is kept in `localStorage` and shown on the results screen.

### Screens

1. Start: title, controls summary, "Press Enter to start".
2. Playing: the forward view with a HUD showing score, remaining time and lives.
3. Results: final score, best score, "Press Enter to play again".

## 4. Technical approach

### Approaches considered

1. **Vite + TypeScript + Three.js (chosen, Anton).** Real 3D with a perspective camera, lighting and a loaded ship model. Stage 2 camera input (for example MediaPipe hand tracking) runs in the same browser page. Cost: a little more setup than a flat canvas, and a loading step for the model.
2. **Canvas 2D with a hand-written perspective projection.** The earlier choice, when everything was a shape drawn in code. Dropped because it cannot render a 3D model, so the Blender ship would have to become a flat picture.
3. **Babylon.js or react-three-fiber.** Babylon.js is heavier with no gain at this size. react-three-fiber adds a React layer that a game loop does not need.

### Logic and rendering stay separate

The game logic is still two dimensional and knows nothing about Three.js. It works in `x` and `z` as described in section 3. The renderer reads the game state every frame and positions 3D objects to match. This keeps the rules unit testable without a browser.

### Coordinate mapping

Three.js cameras look down the negative Z axis, so the renderer maps game coordinates like this (call):

| Game | Three.js |
|---|---|
| `x` (sideways) | `position.x = x` |
| `z` (distance ahead) | `position.z = -z` |
| the flat plane | `position.y = 0` |

One game unit equals one Three.js unit.

### Scene

- **Camera:** `PerspectiveCamera` behind and above the ship, looking forward and slightly down. It follows the ship sideways with a small lag so steering is visible. Position, field of view and lag are tunables.
- **Lighting:** one directional light plus one ambient light. No shadows.
- **Fog:** distance fog fades objects in near the spawn distance so they do not pop into view.
- **Starfield:** a `Points` cloud that moves towards the camera at flight speed and wraps around.
- **Ship:** loaded from `public/models/ship.glb` with `GLTFLoader`. It banks slightly when steering. Until the model exists, or if loading fails, a cone placeholder is used.
- **Asteroids:** six Blender models, `public/models/asteroid-1.glb` to `asteroid-6.glb`. Each spawn picks one at random with a random rotation and scale, and tumbles slowly.
- **Aliens:** six Blender models (`alien-saucer`, `alien-claw`, `alien-fighter`, `alien-panels`, `alien-pod`, `alien-heavy`), picked at random per spawn. All types behave identically in stage 1.
- **Bullets:** short emissive capsules.
- **Engine flames:** two additive cones or sprites at the engine positions, flickering in code, not part of the model.
- **HUD and screens:** HTML elements laid over the canvas, not drawn in 3D.

### Ship model (Blender)

Reference: the second concept image supplied by Anton on 2026-11-21 (dark grey hull, red accents on the nose, wings and fin tops, dark blue canopy, twin canted tail fins, two engines, blue light strips).

- Low-poly and flat shaded with chamfered edges and layered panels for detail, about 6,000 triangles or fewer (currently 5,116).
- The player sees the ship from behind and above, so the engines, fins and wing tops carry the detail.
- Solid colour materials only, no image textures: three shades of dark grey for hull panels, black for recesses and panel gaps, red accents, dark blue glossy canopy, navy engine nozzles, and an emissive blue for the light strips and engine rings.
- Orientation in Blender: nose pointing along -Y, up along +Z. The glTF export turns this into nose along +Z in Three.js, so the renderer rotates the player ship 180 degrees to fly along -Z. Aliens use the same convention and therefore already face the player.
- Origin at the centre of the ship. Wingspan of about 2.8 Blender units; the renderer scales it to fit the ship's hit radius.
- Export as a single binary glTF file (`.glb`) with transforms applied.
- The model is generated by the script `assets/blender/build_ship.py`, which is the source of truth for its shape and colours. All models are kept together in `assets/blender/models.blend`.
- The scene is dark, so the renderer needs enough light on the ship (for example a rim light from behind) for the dark hull to stay readable against space.

### Alien and asteroid models (Blender)

Reference: the alien and asteroid concept sheets supplied by Anton on 2026-11-21. All six aliens and six asteroids from the sheets are modelled.

- Aliens: dark purple-grey hulls with emissive green lights, 1,700 to 2,500 triangles each. Generated by `build_aliens.py` (saucer, claw), `build_aliens_b.py` (fighter, panels) and `build_aliens_c.py` (pod, heavy claw) in `assets/blender/`.
- Asteroids: faceted dark rock with flat-floored craters, 1,280 to 1,900 triangles each, about 1 unit in radius. Generated by `build_asteroids.py` (1, 2) and `build_asteroids_b.py` (3 to 6).
- The blue rim light on the asteroids in the concept art is a lighting effect, so it belongs to the renderer (a blue back light), not the models.
- If a model fails to load, the renderer falls back to a generated shape so the game still runs.

### Structure

- `src/main.ts`: startup, game loop (`requestAnimationFrame`, delta time capped at 50 ms).
- `src/game.ts`: game state and the `update(dt, input)` function. Pure logic in `x` and `z`, no DOM or Three.js access.
- `src/render/`: Three.js scene, camera, lights, object meshes and syncing them to the game state.
- `src/hud.ts`: HTML overlay for score, time, lives and the start and results screens.
- `src/input.ts`: keyboard and touch button handling, merged into one `InputState`.
- `src/config.ts`: every tunable number in sections 3 and 4, in one place.

### Input abstraction

The game logic reads one object per frame and never touches the keyboard directly:

```ts
interface InputState {
  moveX: number;   // -1 (left) to 1 (right)
  fire: boolean;
  confirm: boolean; // start or restart
}
```

Stage 1 fills it from the keyboard and the touch buttons. Stage 2 can fill the same object from camera hand tracking without changing game logic.

### Deployment for phone testing

`npm run build:artifact` builds the game and packs it into one page, `dist/space-run.html`, with the models packed into `dist/models.json` (Claude artifacts do not serve `.glb` files). These two files are published as a Claude artifact. The model loader uses `models.json` when it is present and the individual `.glb` files otherwise.

## 4b. Stage 2: camera mode (built 2026-11-21)

The player stands in front of a webcam and steers with their body. Designed for 6 to 9 year olds (Anton).

### Controls

| Action | Movement |
|---|---|
| Steer | Step or lean left and right. The ship goes to where the player is. |
| Fire | Raise either hand above its shoulder. Holding it up keeps firing. |
| Start or restart | Hold both hands up for 0.6 seconds. This also records where "centre" is for that player. |

- An auto-fire option on the start screen lets the youngest players only steer.
- Keyboard and touch buttons keep working in camera mode and take priority while pressed.
- If nobody is visible for 0.6 seconds during a round, the game pauses and asks the player to step back in.
- A mirrored camera view with the tracked body is shown in the bottom-left corner, larger on the start, results and pause screens. A marker along its bottom edge shows the steering position.

### How it works

- Tracking uses MediaPipe Pose Landmarker (lite model) in the browser. Video is processed on the device only; nothing is recorded or sent anywhere.
- Steering measures how far the middle of the shoulders is from the calibrated centre, in units of the player's own shoulder width. That makes it independent of the player's size and distance from the camera. A movement of 0.9 shoulder widths sends the ship to the edge of the playfield.
- The signal has a small dead zone around the centre and is smoothed over about 0.08 seconds.
- `InputState` gained an optional `targetX` (-1 to 1). When it is set and no button is pressed, the ship flies towards that position at up to 1.6 times its normal speed.
- Camera mode is more forgiving to allow for tracking delay: flight speed is 85% and the ship's hit radius is 80%.
- All of these numbers are in `CONFIG.bodyControl` in `src/config.ts`.

### Files

- `src/pose.ts`: pure functions that turn body landmarks into a steering target and raised-hand flags. Unit tested.
- `src/camera.ts`: webcam, tracking model, smoothing, calibration and the preview drawing. The tracking library is loaded only when camera mode is chosen.
- `public/mediapipe/`: the pose model file, plus the MediaPipe runtime copied from `node_modules` by `npm run prepare-camera` (run automatically by `dev` and `build`), so the game works without internet.

### Hosting

Camera access needs HTTPS or `localhost`. The game is deployed to Vercel at https://space-run-game.vercel.app. The Claude artifact cannot use the camera and stays a buttons-only build.

## 5. Done when

- `npm run dev` opens the game in a desktop browser.
- The game is playable on a phone with the touch buttons, in portrait and landscape.
- The view reads as flying forward: objects appear small in the distance and grow as they approach, and stars stream past.
- A player can start a round, steer, fire, destroy aliens, lose lives to asteroids and aliens, and reach the results screen by timer or by losing all lives.
- The results screen shows the final and best score, and Enter starts a new round.
- Changing a value in `src/config.ts` changes the corresponding behaviour with no other edits.
- The game is playable with the placeholder ship, and shows the Blender model once `public/models/ship.glb` exists.
- Unit tests cover scoring, collisions, life loss with invulnerability, and both round end conditions.

## 6. Left to the builder

- Exact colours and fonts.
- Ship and bullet hit radii, and the camera, light and fog values.
- Test runner choice (Vitest is the natural fit with Vite).

## 7. Later stages (not specified here)

- Vertical ship movement, gems and ship upgrades, planets as settings (notes), sound, alien fire.
