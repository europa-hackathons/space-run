const MUTE_KEY = 'space-run-muted';
const VOLUME = 0.55;

/** Background music: plays from the start of each round, fades out when the round ends. */
export class Music {
  private readonly audio = new Audio(`${import.meta.env.BASE_URL}audio/soundtrack.mp3`);
  private readonly button = document.getElementById('btn-mute');
  private unlocked = false;
  private wanted = false;
  private fade = 0;
  muted = false;
  /** Called whenever sound is switched on or off, so other sounds can follow. */
  onMuteChange: (muted: boolean) => void = () => {};

  constructor() {
    this.audio.loop = true;
    this.audio.preload = 'auto';
    this.audio.volume = VOLUME;
    try {
      this.muted = localStorage.getItem(MUTE_KEY) === '1';
    } catch {
      // Storage can be unavailable; start with sound on.
    }
    this.showMuted();
    this.button?.addEventListener('click', () => this.toggleMute());

    // Browsers only allow sound after the player has tapped, clicked or pressed a key.
    // The first such action unlocks the audio so that later rounds can start it freely
    // (for example when a round starts by raising both hands in camera mode).
    const unlock = () => {
      if (this.unlocked) return;
      this.unlocked = true;
      const starting = this.audio.play();
      starting?.then(() => {
        if (!this.wanted) this.audio.pause();
      }).catch(() => {
        this.unlocked = false; // try again on the next action
      });
    };
    for (const type of ['pointerdown', 'keydown', 'touchend']) window.addEventListener(type, unlock, { passive: true });
  }

  private showMuted(): void {
    this.audio.muted = this.muted;
    if (this.button) {
      this.button.textContent = this.muted ? '🔇' : '🔊';
      this.button.setAttribute('aria-pressed', String(this.muted));
    }
    this.onMuteChange(this.muted);
  }

  toggleMute(): void {
    this.muted = !this.muted;
    try {
      localStorage.setItem(MUTE_KEY, this.muted ? '1' : '0');
    } catch {
      // The choice just will not be remembered.
    }
    this.showMuted();
  }

  /** Starts the track from the beginning, for a new round. */
  start(): void {
    this.wanted = true;
    window.clearInterval(this.fade);
    this.audio.currentTime = 0;
    this.audio.volume = VOLUME;
    void this.audio.play().catch(() => {
      // Not unlocked yet; the game simply plays without music.
    });
  }

  /** Pauses or resumes mid-round, for example while the player is out of the camera's view. */
  hold(paused: boolean): void {
    if (!this.wanted) return;
    if (paused && !this.audio.paused) this.audio.pause();
    else if (!paused && this.audio.paused) void this.audio.play().catch(() => {});
  }

  /** Fades the music out, for the end of a round. */
  stop(): void {
    if (!this.wanted) return;
    this.wanted = false;
    window.clearInterval(this.fade);
    this.fade = window.setInterval(() => {
      const next = this.audio.volume - VOLUME / 12;
      if (next <= 0.01) {
        window.clearInterval(this.fade);
        this.audio.pause();
        this.audio.volume = VOLUME;
      } else {
        this.audio.volume = next;
      }
    }, 60);
  }
}
