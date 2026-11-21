/** Sound effects. Each name is a file in public/audio/<name>.mp3; missing files are skipped silently. */
const SOUNDS = {
  fire: 0.25,
  'alien-destroyed': 0.6,
  'ship-hit': 0.85,
  'bullet-blocked': 0.3,
  'round-start': 0.8,
  'round-complete': 0.85,
  'ship-destroyed': 0.85,
  'new-best': 0.8,
  countdown: 0.4,
  charge: 0.5,
  'player-lost': 0.6,
  click: 0.4,
  ambience: 0.35,
  engine: 0.15,
} as const;

export type SoundName = keyof typeof SOUNDS;

export class Sfx {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private readonly buffers = new Map<SoundName, AudioBuffer>();
  private readonly loops = new Map<SoundName, { source: AudioBufferSourceNode; gain: GainNode }>();
  private readonly wantedLoops = new Set<SoundName>();
  private muted = false;

  constructor() {
    // Browsers only allow sound after the player has tapped, clicked or pressed a key.
    const unlock = () => {
      if (!this.ctx) void this.init();
      else if (this.ctx.state === 'suspended') void this.ctx.resume();
    };
    for (const type of ['pointerdown', 'keydown', 'touchend']) window.addEventListener(type, unlock, { passive: true });
  }

  private async init(): Promise<void> {
    const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    this.ctx = ctx;
    this.master = ctx.createGain();
    this.master.gain.value = this.muted ? 0 : 1;
    this.master.connect(ctx.destination);
    await Promise.all(
      (Object.keys(SOUNDS) as SoundName[]).map(async (name) => {
        try {
          const res = await fetch(`${import.meta.env.BASE_URL}audio/${name}.mp3`);
          const type = res.headers.get('content-type') ?? '';
          if (!res.ok || !type.startsWith('audio')) return; // not generated yet
          this.buffers.set(name, await ctx.decodeAudioData(await res.arrayBuffer()));
          if (this.wantedLoops.has(name)) this.startLoop(name);
        } catch {
          // A sound that fails to load is simply not played.
        }
      }),
    );
  }

  setMuted(muted: boolean): void {
    this.muted = muted;
    if (this.master) this.master.gain.value = muted ? 0 : 1;
  }

  /** Plays a one-shot sound. Several can overlap. */
  play(name: SoundName, volume = 1): void {
    const buffer = this.buffers.get(name);
    if (!this.ctx || !this.master || !buffer) return;
    const source = this.ctx.createBufferSource();
    source.buffer = buffer;
    const gain = this.ctx.createGain();
    gain.gain.value = SOUNDS[name] * volume;
    source.connect(gain).connect(this.master);
    source.start();
  }

  /** Turns a looping sound on or off, with a short fade. */
  loop(name: SoundName, on: boolean): void {
    if (on === this.wantedLoops.has(name)) return;
    if (on) {
      this.wantedLoops.add(name);
      this.startLoop(name);
    } else {
      this.wantedLoops.delete(name);
      const playing = this.loops.get(name);
      if (playing && this.ctx) {
        const t = this.ctx.currentTime;
        playing.gain.gain.setValueAtTime(playing.gain.gain.value, t);
        playing.gain.gain.linearRampToValueAtTime(0, t + 0.4);
        playing.source.stop(t + 0.45);
        this.loops.delete(name);
      }
    }
  }

  private startLoop(name: SoundName): void {
    const buffer = this.buffers.get(name);
    if (!this.ctx || !this.master || !buffer || this.loops.has(name)) return;
    const source = this.ctx.createBufferSource();
    source.buffer = buffer;
    source.loop = true;
    const gain = this.ctx.createGain();
    const t = this.ctx.currentTime;
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(SOUNDS[name], t + 0.4);
    source.connect(gain).connect(this.master);
    source.start();
    this.loops.set(name, { source, gain });
  }
}
