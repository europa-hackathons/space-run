import { describe, expect, it } from 'vitest';
import { CONFIG as C } from './config';
import { createGame, flightSpeed, score, setAssist, update, type GameState, type InputState } from './game';

const idle: InputState = { moveX: 0, fire: false, confirm: false };
const DT = 1 / 60;
/** Random source that never aims asteroids at the ship and spawns everything at the far right. */
const rng = () => 0.999;

function playing(): GameState {
  const s = createGame();
  update(s, DT, { ...idle, confirm: true }, rng);
  expect(s.phase).toBe('playing');
  // Push spawns far away so tests control every object.
  s.asteroidTimer = 1e9;
  s.alienTimer = 1e9;
  return s;
}

const asteroid = (x: number, z: number, radius = 40) => ({ id: 9000 + Math.round(z), x, z, radius, seed: 0 });
const alien = (x: number, z: number) => ({ id: 8000 + Math.round(z), x, baseX: x, z, radius: C.alienRadius, swayPhase: 0, seed: 0 });

describe('starting', () => {
  it('waits on the start screen until confirm is pressed', () => {
    const s = createGame();
    update(s, DT, idle, rng);
    expect(s.phase).toBe('start');
    update(s, DT, { ...idle, confirm: true }, rng);
    expect(s.phase).toBe('playing');
    expect(s.lives).toBe(C.startLives);
  });
});

describe('ship', () => {
  it('moves sideways and stays inside the playfield', () => {
    const s = playing();
    update(s, 0.5, { ...idle, moveX: 1 }, rng);
    expect(s.shipX).toBeCloseTo(C.shipSpeed * 0.5);
    for (let i = 0; i < 200; i++) update(s, DT, { ...idle, moveX: 1 }, rng);
    expect(s.shipX).toBe(C.xLimit);
  });

  it('fires with a cooldown while the button is held', () => {
    const s = playing();
    update(s, DT, { ...idle, fire: true }, rng);
    update(s, DT, { ...idle, fire: true }, rng);
    expect(s.bullets).toHaveLength(1);
    for (let t = 0; t < C.fireCooldown; t += DT) update(s, DT, { ...idle, fire: true }, rng);
    expect(s.bullets).toHaveLength(2);
  });
});

describe('position steering', () => {
  it('moves the ship to the target position and stops there', () => {
    const s = playing();
    for (let i = 0; i < 120; i++) update(s, DT, { ...idle, targetX: 0.5 }, rng);
    expect(s.shipX).toBeCloseTo(0.5 * C.xLimit);
    expect(s.moveX).toBeCloseTo(0);
  });

  it('cannot move faster than the boosted ship speed', () => {
    const s = playing();
    update(s, 0.05, { ...idle, targetX: 1 }, rng);
    expect(s.shipX).toBeCloseTo(C.shipSpeed * C.targetSpeedBoost * 0.05);
    expect(s.moveX).toBe(1);
  });

  it('lets button steering override the target', () => {
    const s = playing();
    update(s, 0.1, { ...idle, moveX: -1, targetX: 1 }, rng);
    expect(s.shipX).toBeLessThan(0);
  });
});

describe('assist', () => {
  it('slows the flight speed and survives a restart', () => {
    const s = playing();
    const normal = flightSpeed(s);
    setAssist(s, 0.5, 0.8);
    expect(flightSpeed(s)).toBeCloseTo(normal * 0.5);
    s.elapsed = C.roundSeconds;
    update(s, DT, idle, rng);
    update(s, DT, { ...idle, confirm: true }, rng);
    expect(s.phase).toBe('playing');
    expect(s.speedScale).toBe(0.5);
    expect(s.hitScale).toBe(0.8);
  });

  it('shrinks the ship hit radius', () => {
    const s = playing();
    const radius = 40;
    const x = radius + C.shipRadius - 2; // just inside the normal hit range
    setAssist(s, 1, 0.5);
    s.asteroids.push({ id: 7000, x, z: 40, radius, seed: 0 });
    for (let i = 0; i < 5; i++) update(s, DT, idle, rng);
    expect(s.lives).toBe(C.startLives);
  });
});

describe('scoring', () => {
  it('awards points for a destroyed alien', () => {
    const s = playing();
    s.aliens.push(alien(0, 300));
    update(s, DT, { ...idle, fire: true }, rng);
    for (let i = 0; i < 30 && s.aliens.length; i++) update(s, DT, idle, rng);
    expect(s.aliens).toHaveLength(0);
    expect(s.kills).toBe(1);
    expect(score(s)).toBe(C.pointsPerAlien);
  });

  it('awards points per full second survived', () => {
    const s = playing();
    s.elapsed = 5.5;
    expect(score(s)).toBe(5 * C.pointsPerSecond);
  });

  it('does not destroy an alien that is out of line sideways', () => {
    const s = playing();
    s.aliens.push(alien(150, 300));
    update(s, DT, { ...idle, fire: true }, rng);
    for (let i = 0; i < 30; i++) update(s, DT, idle, rng);
    expect(s.kills).toBe(0);
  });
});

describe('collisions', () => {
  it('an asteroid blocks a bullet and survives', () => {
    const s = playing();
    s.asteroids.push(asteroid(0, 300));
    s.aliens.push(alien(0, 600));
    update(s, DT, { ...idle, fire: true }, rng);
    for (let i = 0; i < 8; i++) update(s, DT, idle, rng);
    expect(s.bullets).toHaveLength(0);
    expect(s.asteroids).toHaveLength(1);
    expect(s.kills).toBe(0);
  });

  it('an asteroid hitting the ship costs a life and is removed', () => {
    const s = playing();
    s.asteroids.push(asteroid(0, 40));
    for (let i = 0; i < 5; i++) update(s, DT, idle, rng);
    expect(s.lives).toBe(C.startLives - 1);
    expect(s.asteroids).toHaveLength(0);
    expect(s.invuln).toBeGreaterThan(0);
  });

  it('an alien hitting the ship costs a life', () => {
    const s = playing();
    s.aliens.push(alien(0, 40));
    for (let i = 0; i < 5; i++) update(s, DT, idle, rng);
    expect(s.lives).toBe(C.startLives - 1);
    expect(s.aliens).toHaveLength(0);
  });

  it('an asteroid passing to the side does not hit', () => {
    const s = playing();
    s.asteroids.push(asteroid(200, 40));
    for (let i = 0; i < 40; i++) update(s, DT, idle, rng);
    expect(s.lives).toBe(C.startLives);
  });

  it('the ship cannot be hit again while invulnerable', () => {
    const s = playing();
    s.asteroids.push(asteroid(0, 40), asteroid(0, 120));
    for (let i = 0; i < 20; i++) update(s, DT, idle, rng);
    expect(s.lives).toBe(C.startLives - 1);
    // After invulnerability runs out, the ship can be hit again.
    for (let t = 0; t < C.invulnSeconds; t += DT) update(s, DT, idle, rng);
    expect(s.invuln).toBe(0);
    s.asteroids.push(asteroid(0, 40));
    for (let i = 0; i < 5; i++) update(s, DT, idle, rng);
    expect(s.lives).toBe(C.startLives - 2);
  });
});

describe('round end', () => {
  it('ends when the timer runs out', () => {
    const s = playing();
    s.elapsed = C.roundSeconds - DT / 2;
    update(s, DT, idle, rng);
    expect(s.phase).toBe('results');
    expect(s.elapsed).toBe(C.roundSeconds);
    expect(s.best).toBe(C.roundSeconds * C.pointsPerSecond);
  });

  it('ends when the last life is lost', () => {
    const s = playing();
    s.lives = 1;
    s.kills = 3;
    s.asteroids.push(asteroid(0, 40));
    for (let i = 0; i < 5; i++) update(s, DT, idle, rng);
    expect(s.phase).toBe('results');
    expect(s.best).toBe(3 * C.pointsPerAlien);
  });

  it('keeps the best score and restarts on confirm', () => {
    const s = playing();
    s.kills = 2;
    s.elapsed = C.roundSeconds;
    update(s, DT, idle, rng);
    const best = s.best;
    update(s, DT, { ...idle, confirm: true }, rng);
    expect(s.phase).toBe('playing');
    expect(s.kills).toBe(0);
    expect(s.lives).toBe(C.startLives);
    expect(s.best).toBe(best);
  });
});

describe('difficulty', () => {
  it('spawns asteroids and aliens over time', () => {
    const s = createGame();
    update(s, DT, { ...idle, confirm: true }, rng);
    for (let t = 0; t < 3; t += DT) update(s, DT, idle, rng);
    expect(s.asteroids.length).toBeGreaterThanOrEqual(2);
    expect(s.aliens.length).toBeGreaterThanOrEqual(1);
  });
});
