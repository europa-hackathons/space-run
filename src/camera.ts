import type { PoseLandmarker } from '@mediapipe/tasks-vision';
import { CONFIG as C } from './config';
import { LEFT_SHOULDER, LEFT_WRIST, RIGHT_SHOULDER, RIGHT_WRIST, readPose, steerTarget, type Landmark, type PoseReading } from './pose';

const BASE = import.meta.env.BASE_URL;
// Body lines drawn on the preview: shoulders, arms, torso, hips.
const BONES: [number, number][] = [[11, 12], [11, 13], [13, 15], [12, 14], [14, 16], [11, 23], [12, 24], [23, 24]];

/**
 * Webcam body tracking. Video is processed on this device only; nothing is recorded or sent anywhere.
 * Steering follows the middle of the shoulders, a raised hand fires, and both hands held up confirms.
 */
export class CameraControl {
  active = false;
  /** True while a player is clearly visible. */
  tracked = false;
  /** Smoothed steering target, -1 (left) to 1 (right). */
  targetX = 0;
  fire = false;

  private readonly video = document.createElement('video');
  private readonly ctx: CanvasRenderingContext2D;
  private landmarker: PoseLandmarker | null = null;
  private stream: MediaStream | null = null;
  private landmarks: Landmark[] | null = null;
  private reading: PoseReading | null = null;
  private lastVideoTime = -1;
  /** Timestamp of the last frame given to the tracker. It must never go backwards. */
  private lastStamp = 0;
  private failures = 0;
  private lastSeen = -Infinity;
  private centerX = 0.5;
  private bothUpSince: number | null = null;
  private armed = true;
  private confirmPulse = false;

  constructor(private readonly preview: HTMLCanvasElement) {
    this.ctx = preview.getContext('2d')!;
    this.video.playsInline = true;
    this.video.muted = true;
  }

  static get supported(): boolean {
    return !!navigator.mediaDevices?.getUserMedia;
  }

  /** Asks for the camera and loads the tracking model. Throws if either fails. */
  async start(): Promise<void> {
    this.stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } },
      audio: false,
    });
    try {
      this.video.srcObject = this.stream;
      await this.video.play();
      if (!this.landmarker) {
        this.landmarker = await this.createLandmarker();
        // The first detection is slow while the model warms up, so do it now rather than mid-game.
        this.landmarker.detectForVideo(this.video, this.nextStamp());
      }
    } catch (err) {
      this.stop();
      throw err;
    }
    this.preview.width = this.video.videoWidth || 640;
    this.preview.height = this.video.videoHeight || 480;
    this.centerX = 0.5;
    this.lastSeen = -Infinity;
    this.active = true;
  }

  private async createLandmarker(): Promise<PoseLandmarker> {
    const { FilesetResolver, PoseLandmarker } = await import('@mediapipe/tasks-vision');
    const fileset = await FilesetResolver.forVisionTasks(`${BASE}mediapipe/wasm`);
    const create = (delegate: 'GPU' | 'CPU') =>
      PoseLandmarker.createFromOptions(fileset, {
        baseOptions: { modelAssetPath: `${BASE}mediapipe/pose_landmarker_lite.task`, delegate },
        runningMode: 'VIDEO',
        numPoses: 1,
      });
    return create('GPU').catch(() => create('CPU'));
  }

  stop(): void {
    this.stream?.getTracks().forEach((t) => t.stop());
    this.stream = null;
    this.video.srcObject = null;
    this.active = false;
    this.tracked = false;
    this.fire = false;
    this.targetX = 0;
  }

  /** Makes the player's current position the centre. Called when a round starts. */
  calibrate(): void {
    if (this.reading) this.centerX = this.reading.centerX;
    this.targetX = 0;
  }

  /** True once after both hands were held up long enough. */
  takeConfirm(): boolean {
    const pulse = this.confirmPulse;
    this.confirmPulse = false;
    return pulse;
  }

  /** 0..1 progress of the "both hands up" hold, for on-screen feedback. */
  get holdProgress(): number {
    if (this.bothUpSince === null || !this.armed) return 0;
    return Math.min(1, (performance.now() - this.bothUpSince) / (C.bodyControl.startHold * 1000));
  }

  /**
   * The tracker stops working for good if it is ever given a timestamp that is not later than the
   * previous one, and browser frame times can run slightly behind the clock. So keep our own counter.
   */
  private nextStamp(): number {
    this.lastStamp = Math.max(this.lastStamp + 1, performance.now());
    return this.lastStamp;
  }

  /** Runs the tracker on the current video frame. A tracker error must never stop the game. */
  private detect(now: number): void {
    if (!this.landmarker) return;
    try {
      const result = this.landmarker.detectForVideo(this.video, this.nextStamp());
      this.landmarks = result.landmarks[0] ?? null;
      this.reading = readPose(this.landmarks ?? undefined);
      if (this.reading) this.lastSeen = now;
      this.failures = 0;
    } catch (err) {
      this.landmarks = null;
      this.reading = null;
      if (++this.failures === 1) console.warn('Body tracking failed on a frame', err);
      if (this.failures === 5) void this.rebuild();
    }
  }

  /** Replaces a broken tracker with a fresh one. */
  private async rebuild(): Promise<void> {
    const broken = this.landmarker;
    this.landmarker = null;
    try {
      broken?.close();
    } catch {
      // Already unusable; nothing to clean up.
    }
    try {
      this.landmarker = await this.createLandmarker();
      this.failures = 0;
    } catch (err) {
      console.warn('Body tracking could not be restarted', err);
    }
  }

  update(now: number, dt: number): void {
    if (!this.active) return;
    const cfg = C.bodyControl;

    if (this.landmarker && this.video.readyState >= 2 && this.video.videoWidth > 0 && this.video.currentTime !== this.lastVideoTime) {
      this.lastVideoTime = this.video.currentTime;
      this.detect(now);
    }
    this.tracked = now - this.lastSeen < cfg.lostAfter * 1000;

    const r = this.reading;
    if (r) {
      const target = steerTarget(r, this.centerX);
      this.targetX += (target - this.targetX) * (1 - Math.exp(-dt / cfg.smoothing));
    }
    this.fire = !!r && (r.leftHandUp || r.rightHandUp);

    if (r && r.leftHandUp && r.rightHandUp) {
      this.bothUpSince ??= now;
      if (this.armed && now - this.bothUpSince >= cfg.startHold * 1000) {
        this.confirmPulse = true;
        this.armed = false;
      }
    } else {
      this.bothUpSince = null;
      this.armed = true; // hands must come down before the next confirm
    }

    this.draw();
  }

  /** Mirrored camera view with the tracked body drawn on top, so players see what the game sees. */
  private draw(): void {
    const { ctx, preview } = this;
    const w = preview.width;
    const h = preview.height;
    ctx.save();
    ctx.translate(w, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(this.video, 0, 0, w, h);
    const lm = this.landmarks;
    if (lm && this.reading) {
      ctx.lineWidth = Math.max(3, w / 110);
      ctx.lineCap = 'round';
      ctx.strokeStyle = '#3aa0ff';
      ctx.beginPath();
      for (const [a, b] of BONES) {
        if (!lm[a] || !lm[b]) continue;
        ctx.moveTo(lm[a].x * w, lm[a].y * h);
        ctx.lineTo(lm[b].x * w, lm[b].y * h);
      }
      ctx.stroke();
      const dot = (i: number, up: boolean) => {
        if (!lm[i]) return;
        ctx.fillStyle = up ? '#7dff6a' : '#e8eeff';
        ctx.beginPath();
        ctx.arc(lm[i].x * w, lm[i].y * h, up ? w / 28 : w / 50, 0, Math.PI * 2);
        ctx.fill();
      };
      dot(LEFT_WRIST, this.reading.leftHandUp);
      dot(RIGHT_WRIST, this.reading.rightHandUp);
      dot(LEFT_SHOULDER, false);
      dot(RIGHT_SHOULDER, false);
    }
    ctx.restore();

    // Steering marker along the bottom edge, and the hold bar along the top.
    ctx.fillStyle = 'rgba(4, 5, 13, 0.55)';
    ctx.fillRect(0, h - h / 16, w, h / 16);
    ctx.fillStyle = this.tracked ? '#3aa0ff' : '#ff4d5a';
    const markerX = w / 2 + (this.targetX * w) / 2;
    ctx.fillRect(markerX - w / 40, h - h / 16, w / 20, h / 16);
    const hold = this.holdProgress;
    if (hold > 0) {
      ctx.fillStyle = '#7dff6a';
      ctx.fillRect(0, 0, w * hold, h / 20);
    }
  }
}
