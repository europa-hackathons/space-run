import { CameraControl } from './camera';
import { CONFIG as C } from './config';
import { createGame, score, setAssist, timeLeft, update } from './game';
import { Hud } from './hud';
import { bind, initLanguage } from './i18n';
import { Input } from './input';
import { Music } from './music';
import { loadModels } from './render/models';
import { Renderer } from './render/renderer';
import { Sfx } from './sfx';

const BEST_KEY = 'space-run-best';

function loadBest(): number {
  try {
    return Number(localStorage.getItem(BEST_KEY)) || 0;
  } catch {
    return 0;
  }
}

function saveBest(best: number): void {
  try {
    localStorage.setItem(BEST_KEY, String(best));
  } catch {
    // Storage can be unavailable (private mode); the game still works without it.
  }
}

initLanguage();

const input = new Input();
const music = new Music();
const sfx = new Sfx();
sfx.setMuted(music.muted);
music.onMuteChange = (muted) => sfx.setMuted(muted);
document.addEventListener('click', (e) => {
  if ((e.target as HTMLElement).closest('button:not(.touch-btn)')) sfx.play('click');
});
const hud = new Hud(input.isTouch);
const state = createGame(loadBest());
const renderer = new Renderer(document.getElementById('scene') as HTMLCanvasElement, await loadModels());

if (import.meta.env.DEV) Object.assign(window, { game: state, music });

// Camera mode: the player steers with their body in front of a webcam.
const preview = document.getElementById('cam-preview') as HTMLCanvasElement;
const camera = new CameraControl(preview);
const cameraButton = document.getElementById('btn-camera') as HTMLButtonElement;
const cameraStatus = document.getElementById('camera-status')!;
const autoFire = document.getElementById('opt-autofire') as HTMLInputElement;

function useButtons(): void {
  camera.stop();
  input.camera = null;
  input.autoFire = false;
  setAssist(state, 1, 1);
  document.body.classList.remove('mode-camera', 'is-paused');
  preview.classList.add('hidden');
  document.getElementById('paused')!.classList.add('hidden');
}

async function useCamera(): Promise<void> {
  cameraButton.disabled = true;
  bind(cameraStatus, 'cameraStarting');
  try {
    await camera.start();
    input.camera = camera;
    input.autoFire = autoFire.checked;
    setAssist(state, C.bodyControl.speedScale, C.bodyControl.hitScale);
    document.body.classList.add('mode-camera');
    preview.classList.remove('hidden');
    bind(cameraStatus, null);
  } catch (err) {
    const denied = err instanceof DOMException && (err.name === 'NotAllowedError' || err.name === 'SecurityError');
    bind(cameraStatus, denied ? 'cameraBlocked' : 'cameraFailed');
    console.warn('Camera mode failed to start', err);
    useButtons();
  } finally {
    cameraButton.disabled = false;
  }
}

if (CameraControl.supported) cameraButton.addEventListener('click', () => void useCamera());
else cameraButton.classList.add('hidden');
document.getElementById('btn-buttons')!.addEventListener('click', useButtons);
autoFire.addEventListener('change', () => {
  input.autoFire = autoFire.checked;
});

let last = performance.now();
let savedBest = state.best;
let phase = state.phase;
let resultsAt = 0;
let wasPaused = false;
let wasCharging = false;
let lastSecond = -1;
let bestBeforeRound = state.best;

function frame(now: number): void {
  // Ask for the next frame first, so an unexpected error in one frame can never freeze the game.
  requestAnimationFrame(frame);
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;

  camera.update(now, dt);
  const inp = input.read();
  // Ignore confirm briefly after a round ends, so a held button or raised hands do not skip the results.
  if (state.phase === 'results' && now - resultsAt < 1000) inp.confirm = false;
  // A round started by raising both hands also sets where "centre" is for this player.
  if (camera.active && inp.confirm && state.phase !== 'playing') camera.calibrate();

  // In camera mode, pause while nobody is in view.
  const paused = camera.active && state.phase === 'playing' && !camera.tracked;
  document.body.classList.toggle('is-paused', paused);
  document.getElementById('paused')!.classList.toggle('hidden', !paused);
  if (!paused) {
    update(state, dt, inp);
    for (const e of state.events) {
      if (e.type === 'fired') sfx.play('fire');
      else if (e.type === 'alienDestroyed') sfx.play('alien-destroyed');
      else if (e.type === 'shipHit') sfx.play('ship-hit');
      else sfx.play('bullet-blocked');
    }
  }
  music.hold(paused);

  // Sounds that follow the state of the game rather than a single event.
  if (paused && !wasPaused) sfx.play('player-lost');
  wasPaused = paused;
  const charging = camera.active && state.phase !== 'playing' && camera.holdProgress > 0;
  if (charging && !wasCharging) sfx.play('charge');
  wasCharging = charging;
  const second = Math.ceil(timeLeft(state));
  if (state.phase === 'playing' && second !== lastSecond && second <= 10 && second > 0) sfx.play('countdown');
  lastSecond = second;
  sfx.loop('engine', state.phase === 'playing' && !paused);
  sfx.loop('ambience', state.phase !== 'playing');

  if (state.phase !== phase) {
    phase = state.phase;
    if (phase === 'playing') {
      bestBeforeRound = state.best === score(state) ? 0 : state.best;
      music.start();
      sfx.play('round-start');
    }
    if (phase === 'results') {
      resultsAt = now;
      music.stop();
      sfx.play(state.lives <= 0 ? 'ship-destroyed' : 'round-complete');
      if (score(state) > bestBeforeRound && score(state) > 0) window.setTimeout(() => sfx.play('new-best'), 1800);
    }
  }
  if (state.best !== savedBest) {
    savedBest = state.best;
    saveBest(savedBest);
  }
  hud.update(state);
  renderer.render(state, paused ? 0 : dt);
}

requestAnimationFrame(frame);
