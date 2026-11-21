import { describe, expect, it } from 'vitest';
import { CONFIG as C } from './config';
import { LEFT_SHOULDER, LEFT_WRIST, RIGHT_SHOULDER, RIGHT_WRIST, readPose, steerTarget, type Landmark } from './pose';

/** A player facing the camera. Their left shoulder appears on the right of the image. */
function body(centerX = 0.5, opts: { leftWristY?: number; rightWristY?: number; width?: number; visibility?: number } = {}): Landmark[] {
  const w = opts.width ?? 0.2;
  const lm: Landmark[] = Array.from({ length: 33 }, () => ({ x: 0, y: 0, visibility: 0 }));
  const v = opts.visibility ?? 0.9;
  lm[LEFT_SHOULDER] = { x: centerX + w / 2, y: 0.4, visibility: v };
  lm[RIGHT_SHOULDER] = { x: centerX - w / 2, y: 0.4, visibility: v };
  lm[LEFT_WRIST] = { x: centerX + w / 2, y: opts.leftWristY ?? 0.7, visibility: 0.9 };
  lm[RIGHT_WRIST] = { x: centerX - w / 2, y: opts.rightWristY ?? 0.7, visibility: 0.9 };
  return lm;
}

describe('readPose', () => {
  it('returns null without a clearly visible body', () => {
    expect(readPose(undefined)).toBeNull();
    expect(readPose(body(0.5, { visibility: 0.2 }))).toBeNull();
    expect(readPose(body(0.5, { width: 0.01 }))).toBeNull();
  });

  it('measures the shoulder centre and width', () => {
    const r = readPose(body(0.6))!;
    expect(r.centerX).toBeCloseTo(0.6);
    expect(r.shoulderWidth).toBeCloseTo(0.2);
  });

  it('detects each raised hand separately', () => {
    expect(readPose(body())).toMatchObject({ leftHandUp: false, rightHandUp: false });
    expect(readPose(body(0.5, { leftWristY: 0.2 }))).toMatchObject({ leftHandUp: true, rightHandUp: false });
    expect(readPose(body(0.5, { leftWristY: 0.2, rightWristY: 0.2 }))).toMatchObject({ leftHandUp: true, rightHandUp: true });
  });

  it('does not count a hand at shoulder height as up', () => {
    expect(readPose(body(0.5, { leftWristY: 0.39 }))!.leftHandUp).toBe(false);
  });
});

describe('steerTarget', () => {
  it('is zero at the calibrated centre and inside the dead zone', () => {
    expect(steerTarget(readPose(body(0.5))!, 0.5)).toBe(0);
    expect(steerTarget(readPose(body(0.505))!, 0.5)).toBe(0);
  });

  it('steers right when the player moves to their right (left in the image)', () => {
    expect(steerTarget(readPose(body(0.42))!, 0.5)).toBeGreaterThan(0);
    expect(steerTarget(readPose(body(0.58))!, 0.5)).toBeLessThan(0);
  });

  it('reaches full deflection at the steer range and no further', () => {
    const full = 0.2 * C.bodyControl.steerRange;
    expect(steerTarget(readPose(body(0.5 - full))!, 0.5)).toBeCloseTo(1);
    expect(steerTarget(readPose(body(0.5 - full * 2))!, 0.5)).toBe(1);
  });

  it('scales with body size, so a smaller or farther player steers the same way', () => {
    const near = steerTarget(readPose(body(0.5 - 0.1, { width: 0.2 }))!, 0.5);
    const far = steerTarget(readPose(body(0.5 - 0.05, { width: 0.1 }))!, 0.5);
    expect(far).toBeCloseTo(near);
  });
});
