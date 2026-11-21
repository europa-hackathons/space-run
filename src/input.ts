import type { CameraControl } from './camera';
import type { InputState } from './game';

/** Keyboard, on-screen touch buttons and (optionally) camera body tracking, merged into one InputState. */
export class Input {
  private keys = new Set<string>();
  private touch = { left: false, right: false, fire: false };
  /** Set by Enter or a tap on a start button; consumed by the next read(). */
  private confirmTap = false;
  readonly isTouch: boolean;
  /** Set while camera mode is on. */
  camera: CameraControl | null = null;
  /** Camera mode option: fire all the time, so the player only has to steer. */
  autoFire = false;

  constructor() {
    this.isTouch = window.matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window;
    document.body.classList.toggle('is-touch', this.isTouch);

    window.addEventListener('keydown', (e) => {
      if (['ArrowLeft', 'ArrowRight', 'Space', 'Enter'].includes(e.code)) e.preventDefault();
      this.keys.add(e.code);
      if (e.code === 'Enter') this.confirmTap = true; // latched, so a very quick press is not missed
    });
    window.addEventListener('keyup', (e) => this.keys.delete(e.code));
    window.addEventListener('blur', () => {
      this.keys.clear();
      this.touch = { left: false, right: false, fire: false };
    });

    this.hold('btn-left', 'left');
    this.hold('btn-right', 'right');
    this.hold('btn-fire', 'fire');

    for (const el of document.querySelectorAll<HTMLElement>('[data-confirm]')) {
      el.addEventListener('click', () => {
        this.confirmTap = true;
      });
    }
    // Stop the page from scrolling, zooming or showing menus while playing.
    document.addEventListener('contextmenu', (e) => e.preventDefault());
    document.addEventListener('gesturestart', (e) => e.preventDefault());
  }

  private hold(id: string, key: 'left' | 'right' | 'fire'): void {
    const el = document.getElementById(id);
    if (!el) return;
    const set = (down: boolean) => (e: PointerEvent) => {
      e.preventDefault();
      this.touch[key] = down;
      el.classList.toggle('active', down);
      if (down) el.setPointerCapture(e.pointerId);
    };
    el.addEventListener('pointerdown', set(true));
    el.addEventListener('pointerup', set(false));
    el.addEventListener('pointercancel', set(false));
    el.addEventListener('lostpointercapture', () => {
      this.touch[key] = false;
      el.classList.remove('active');
    });
  }

  read(): InputState {
    const left = this.keys.has('ArrowLeft') || this.keys.has('KeyA') || this.touch.left;
    const right = this.keys.has('ArrowRight') || this.keys.has('KeyD') || this.touch.right;
    let confirm = this.keys.has('Enter') || this.confirmTap;
    this.confirmTap = false;
    let fire = this.keys.has('Space') || this.touch.fire;
    let targetX: number | null = null;
    const cam = this.camera;
    if (cam?.active) {
      if (cam.tracked) targetX = cam.targetX;
      fire ||= cam.fire || this.autoFire;
      confirm ||= cam.takeConfirm();
    }
    // Buttons win over the camera whenever they are pressed.
    return { moveX: (right ? 1 : 0) - (left ? 1 : 0), targetX, fire, confirm };
  }
}
