/** Every tunable number in one place. Distances are in game units (1 game unit = 1 Three.js unit). */
export const CONFIG = {
  // Round
  roundSeconds: 90,
  startLives: 3,
  invulnSeconds: 1.5,

  // World
  xLimit: 300,
  spawnZ: 2000,
  despawnZ: -260,

  // Ship
  shipSpeed: 400,
  shipRadius: 26,
  shipDepth: 28,

  /** Position steering (camera): how much faster than shipSpeed the ship may chase its target. */
  targetSpeedBoost: 1.6,
  /** Position steering: gap to the target, in game units, at which the ship banks fully. */
  targetBankDistance: 70,

  // Camera mode (body tracking)
  bodyControl: {
    /** Sideways movement, in shoulder widths, that sends the ship to the edge of the playfield. */
    steerRange: 0.9,
    /** Movement around the centre, as a share of steerRange, that is ignored. */
    deadZone: 0.07,
    /** Smoothing time for the steering signal, in seconds. */
    smoothing: 0.08,
    /** How far above the shoulder a wrist must be to count as "hand up", in shoulder widths. */
    handUpMargin: 0.2,
    /** Seconds both hands must stay up to start a round. */
    startHold: 0.6,
    /** Seconds without a visible player before the game pauses. */
    lostAfter: 0.6,
    speedScale: 0.85,
    hitScale: 0.8,
  },

  // Bullets
  bulletSpeed: 1500,
  bulletRadius: 6,
  fireCooldown: 0.25,

  // Asteroids
  asteroidRadiusMin: 30,
  asteroidRadiusMax: 70,
  asteroidIntervalStart: 1.2,
  asteroidIntervalEnd: 0.4,
  /** Share of asteroids aimed at the ship's current position, so standing still is not safe. */
  asteroidAimChance: 0.35,

  // Aliens
  alienRadius: 35,
  alienSwayAmplitude: 80,
  alienSwayFrequency: 1.6,
  alienIntervalStart: 2.5,
  alienIntervalEnd: 1.0,

  // Difficulty
  flightSpeedStart: 500,
  flightSpeedEnd: 800,

  // Scoring
  pointsPerAlien: 100,
  pointsPerSecond: 10,

  // Rendering
  camera: { fov: 60, height: 95, distance: 175, lookAhead: 420, lookHeight: 12, followX: 0.85, lag: 6 },
  fog: { color: 0x04050d, near: 1100, far: 2000 },
  shipVisualRadius: 34,
  alienVisualScale: 1.2,
  starCount: 1400,

  // Model files in public/models. Missing files are skipped.
  models: {
    ship: 'ship.glb',
    aliens: ['alien-saucer.glb', 'alien-claw.glb', 'alien-fighter.glb', 'alien-panels.glb', 'alien-pod.glb', 'alien-heavy.glb'],
    asteroids: ['asteroid-1.glb', 'asteroid-2.glb', 'asteroid-3.glb', 'asteroid-4.glb', 'asteroid-5.glb', 'asteroid-6.glb'],
  },
};
