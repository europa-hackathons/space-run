import { CONFIG as C } from './config';

/** One frame of player intent. Stage 1 fills it from the keyboard; stage 2 can fill it from the camera. */
export interface InputState {
  moveX: number; // -1 (left) to 1 (right)
  /** Optional absolute position, -1 (far left) to 1 (far right). Used by camera steering when moveX is 0. */
  targetX?: number | null;
  fire: boolean;
  confirm: boolean; // start or restart
}

export type Phase = 'start' | 'playing' | 'results';

export interface Asteroid {
  id: number;
  x: number;
  z: number;
  radius: number;
  /** 0..1, used by the renderer to pick a model and a tumble. */
  seed: number;
}

export interface Alien {
  id: number;
  x: number;
  baseX: number;
  z: number;
  radius: number;
  swayPhase: number;
  seed: number;
}

export interface Bullet {
  id: number;
  x: number;
  z: number;
}

export type GameEvent =
  | { type: 'alienDestroyed'; x: number; z: number }
  | { type: 'shipHit'; x: number; z: number }
  | { type: 'bulletBlocked'; x: number; z: number }
  | { type: 'fired'; x: number; z: number };

export interface GameState {
  phase: Phase;
  elapsed: number;
  kills: number;
  lives: number;
  shipX: number;
  moveX: number;
  invuln: number;
  fireCooldown: number;
  asteroids: Asteroid[];
  aliens: Alien[];
  bullets: Bullet[];
  asteroidTimer: number;
  alienTimer: number;
  best: number;
  nextId: number;
  prevConfirm: boolean;
  /** Multiplies flight speed. 1 normally, lower in camera mode to allow for tracking delay. */
  speedScale: number;
  /** Multiplies the ship's hit radius. 1 normally, lower in camera mode to be more forgiving. */
  hitScale: number;
  /** Things that happened during the last update, for the renderer. */
  events: GameEvent[];
}

export type Rng = () => number;

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

/** Sets how forgiving the game is. Takes effect immediately and is kept across rounds. */
export function setAssist(s: GameState, speedScale: number, hitScale: number): void {
  s.speedScale = speedScale;
  s.hitScale = hitScale;
}

export function createGame(best = 0): GameState {
  return {
    phase: 'start',
    elapsed: 0,
    kills: 0,
    lives: C.startLives,
    shipX: 0,
    moveX: 0,
    invuln: 0,
    fireCooldown: 0,
    asteroids: [],
    aliens: [],
    bullets: [],
    asteroidTimer: C.asteroidIntervalStart,
    alienTimer: C.alienIntervalStart,
    best,
    nextId: 1,
    prevConfirm: false,
    speedScale: 1,
    hitScale: 1,
    events: [],
  };
}

export function score(s: GameState): number {
  return s.kills * C.pointsPerAlien + Math.floor(s.elapsed) * C.pointsPerSecond;
}

export function timeLeft(s: GameState): number {
  return Math.max(0, C.roundSeconds - s.elapsed);
}

/** 0 at the start of the round, 1 at the end. */
export function progress(s: GameState): number {
  return clamp(s.elapsed / C.roundSeconds, 0, 1);
}

export function flightSpeed(s: GameState): number {
  return lerp(C.flightSpeedStart, C.flightSpeedEnd, progress(s)) * s.speedScale;
}

function startRound(s: GameState): void {
  const fresh = createGame(s.best);
  Object.assign(s, fresh, { phase: 'playing', prevConfirm: true, speedScale: s.speedScale, hitScale: s.hitScale });
}

function endRound(s: GameState): void {
  s.phase = 'results';
  s.best = Math.max(s.best, score(s));
}

function spawn(s: GameState, dt: number, rng: Rng): void {
  const p = progress(s);
  s.asteroidTimer -= dt;
  if (s.asteroidTimer <= 0) {
    s.asteroidTimer += lerp(C.asteroidIntervalStart, C.asteroidIntervalEnd, p);
    const aimed = rng() < C.asteroidAimChance;
    s.asteroids.push({
      id: s.nextId++,
      x: aimed ? s.shipX : lerp(-C.xLimit, C.xLimit, rng()),
      z: C.spawnZ,
      radius: lerp(C.asteroidRadiusMin, C.asteroidRadiusMax, rng()),
      seed: rng(),
    });
  }
  s.alienTimer -= dt;
  if (s.alienTimer <= 0) {
    s.alienTimer += lerp(C.alienIntervalStart, C.alienIntervalEnd, p);
    const limit = C.xLimit - C.alienSwayAmplitude;
    const baseX = lerp(-limit, limit, rng());
    s.aliens.push({
      id: s.nextId++,
      x: baseX,
      baseX,
      z: C.spawnZ,
      radius: C.alienRadius,
      swayPhase: rng() * Math.PI * 2,
      seed: rng(),
    });
  }
}

/** True when the z ranges swept this frame overlap and the objects are close enough sideways. */
function bulletHits(b: Bullet, bPrevZ: number, o: { x: number; z: number; radius: number }, oPrevZ: number): boolean {
  return b.z >= o.z && bPrevZ <= oPrevZ && Math.abs(b.x - o.x) < o.radius + C.bulletRadius;
}

function touchesShip(s: GameState, o: { x: number; z: number; radius: number }, prevZ: number): boolean {
  return o.z <= C.shipDepth && prevZ >= -C.shipDepth && Math.abs(o.x - s.shipX) < o.radius + C.shipRadius * s.hitScale;
}

function hitShip(s: GameState, x: number): void {
  s.lives -= 1;
  s.invuln = C.invulnSeconds;
  s.events.push({ type: 'shipHit', x, z: 0 });
}

export function update(s: GameState, dt: number, input: InputState, rng: Rng = Math.random): void {
  s.events = [];
  const confirmPressed = input.confirm && !s.prevConfirm;
  s.prevConfirm = input.confirm;

  if (s.phase !== 'playing') {
    if (confirmPressed) startRound(s);
    return;
  }

  s.elapsed += dt;
  const speed = flightSpeed(s);

  // Ship
  if (input.moveX === 0 && input.targetX != null) {
    // Position steering: head for the target spot, no faster than the ship can fly.
    const gap = clamp(input.targetX, -1, 1) * C.xLimit - s.shipX;
    const maxStep = C.shipSpeed * C.targetSpeedBoost * dt;
    s.shipX = clamp(s.shipX + clamp(gap, -maxStep, maxStep), -C.xLimit, C.xLimit);
    s.moveX = clamp(gap / C.targetBankDistance, -1, 1);
  } else {
    s.moveX = clamp(input.moveX, -1, 1);
    s.shipX = clamp(s.shipX + s.moveX * C.shipSpeed * dt, -C.xLimit, C.xLimit);
  }
  s.invuln = Math.max(0, s.invuln - dt);
  s.fireCooldown = Math.max(0, s.fireCooldown - dt);
  if (input.fire && s.fireCooldown === 0) {
    s.fireCooldown = C.fireCooldown;
    s.bullets.push({ id: s.nextId++, x: s.shipX, z: C.shipDepth });
    s.events.push({ type: 'fired', x: s.shipX, z: C.shipDepth });
  }

  spawn(s, dt, rng);

  // Move everything, remembering where it was so fast objects cannot skip past each other.
  const prevZ = new Map<number, number>();
  for (const b of s.bullets) {
    prevZ.set(b.id, b.z);
    b.z += C.bulletSpeed * dt;
  }
  for (const a of s.asteroids) {
    prevZ.set(a.id, a.z);
    a.z -= speed * dt;
  }
  for (const a of s.aliens) {
    prevZ.set(a.id, a.z);
    a.z -= speed * dt;
    a.x = clamp(a.baseX + C.alienSwayAmplitude * Math.sin(a.swayPhase + s.elapsed * C.alienSwayFrequency), -C.xLimit, C.xLimit);
  }

  // Bullets: the nearest thing in the way takes the hit.
  const deadBullets = new Set<number>();
  const deadAliens = new Set<number>();
  for (const b of s.bullets) {
    const bPrev = prevZ.get(b.id)!;
    let nearest: { kind: 'asteroid' | 'alien'; id: number; x: number; z: number } | null = null;
    for (const a of s.asteroids) {
      if (bulletHits(b, bPrev, a, prevZ.get(a.id)!) && (!nearest || a.z < nearest.z)) {
        nearest = { kind: 'asteroid', id: a.id, x: a.x, z: a.z };
      }
    }
    for (const a of s.aliens) {
      if (!deadAliens.has(a.id) && bulletHits(b, bPrev, a, prevZ.get(a.id)!) && (!nearest || a.z < nearest.z)) {
        nearest = { kind: 'alien', id: a.id, x: a.x, z: a.z };
      }
    }
    if (!nearest) continue;
    deadBullets.add(b.id);
    if (nearest.kind === 'alien') {
      deadAliens.add(nearest.id);
      s.kills += 1;
      s.events.push({ type: 'alienDestroyed', x: nearest.x, z: nearest.z });
    } else {
      s.events.push({ type: 'bulletBlocked', x: b.x, z: nearest.z });
    }
  }
  s.bullets = s.bullets.filter((b) => !deadBullets.has(b.id) && b.z <= C.spawnZ);
  s.aliens = s.aliens.filter((a) => !deadAliens.has(a.id));

  // Ship collisions. While invulnerable, objects pass through.
  const survives = (o: { id: number; x: number; z: number; radius: number }): boolean => {
    if (o.z < C.despawnZ) return false;
    if (s.invuln === 0 && s.lives > 0 && touchesShip(s, o, prevZ.get(o.id)!)) {
      hitShip(s, o.x);
      return false;
    }
    return true;
  };
  s.asteroids = s.asteroids.filter(survives);
  s.aliens = s.aliens.filter(survives);

  if (s.lives <= 0 || s.elapsed >= C.roundSeconds) {
    s.elapsed = Math.min(s.elapsed, C.roundSeconds);
    endRound(s);
  }
}
