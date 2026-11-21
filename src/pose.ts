import { CONFIG as C } from './config';

/** A body landmark in camera image coordinates: x and y from 0 to 1, y pointing down. */
export interface Landmark {
  x: number;
  y: number;
  visibility?: number;
}

/** What the game needs to know about the player's body in one camera frame. */
export interface PoseReading {
  /** Middle of the shoulders, in image coordinates. */
  centerX: number;
  /** Distance between the shoulders, in image coordinates. Used as the ruler for everything else. */
  shoulderWidth: number;
  leftHandUp: boolean;
  rightHandUp: boolean;
}

// MediaPipe pose landmark indices.
export const LEFT_SHOULDER = 11;
export const RIGHT_SHOULDER = 12;
export const LEFT_WRIST = 15;
export const RIGHT_WRIST = 16;

const seen = (p: Landmark | undefined, min: number): p is Landmark => !!p && (p.visibility ?? 1) >= min;

/** Returns null when the shoulders are not clearly visible. */
export function readPose(landmarks: Landmark[] | undefined): PoseReading | null {
  if (!landmarks) return null;
  const ls = landmarks[LEFT_SHOULDER];
  const rs = landmarks[RIGHT_SHOULDER];
  if (!seen(ls, 0.5) || !seen(rs, 0.5)) return null;
  const shoulderWidth = Math.abs(ls.x - rs.x);
  if (shoulderWidth < 0.03) return null; // too far away or turned sideways
  const margin = C.bodyControl.handUpMargin * shoulderWidth;
  const handUp = (wrist: Landmark | undefined, shoulder: Landmark) => seen(wrist, 0.4) && wrist.y < shoulder.y - margin;
  return {
    centerX: (ls.x + rs.x) / 2,
    shoulderWidth,
    leftHandUp: handUp(landmarks[LEFT_WRIST], ls),
    rightHandUp: handUp(landmarks[RIGHT_WRIST], rs),
  };
}

/**
 * Turns the player's sideways position into a steering target from -1 (left) to 1 (right).
 * The camera image is not mirrored, so the player moving to their right moves left in the image.
 */
export function steerTarget(reading: PoseReading, calibratedCenterX: number): number {
  const { steerRange, deadZone } = C.bodyControl;
  const raw = (calibratedCenterX - reading.centerX) / reading.shoulderWidth / steerRange;
  const magnitude = Math.abs(raw);
  if (magnitude <= deadZone) return 0;
  // Rescale so the output starts from 0 at the edge of the dead zone.
  return Math.sign(raw) * Math.min(1, (magnitude - deadZone) / (1 - deadZone));
}
