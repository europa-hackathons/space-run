import { CONFIG as C } from './config';
import { score, timeLeft, type GameState, type Phase } from './game';
import { bind } from './i18n';

const $ = (id: string) => document.getElementById(id)!;

/** HTML overlay: score, time, lives and the start and results screens. */
export class Hud {
  private lastPhase: Phase | null = null;
  private lastText = { score: '', time: '', lives: '' };
  private bestBefore = 0;

  constructor(private readonly isTouch: boolean) {}

  update(s: GameState): void {
    if (s.phase !== this.lastPhase) {
      if (s.phase === 'playing') this.bestBefore = s.best;
      $('screen-start').classList.toggle('hidden', s.phase !== 'start');
      $('screen-results').classList.toggle('hidden', s.phase !== 'results');
      $('hud').classList.toggle('hidden', s.phase === 'start');
      $('touch').classList.toggle('hidden', !(this.isTouch && s.phase === 'playing'));
      if (s.phase === 'results') {
        bind($('results-title'), s.lives <= 0 ? 'shipDestroyed' : 'roundComplete');
        $('results-score').textContent = String(score(s));
        $('results-best').textContent = String(s.best);
        $('results-new').classList.toggle('hidden', !(score(s) > this.bestBefore && score(s) > 0));
      }
      document.body.dataset.phase = s.phase;
      this.lastPhase = s.phase;
    }

    const next = {
      score: String(score(s)),
      time: String(Math.ceil(timeLeft(s))),
      lives: '♥'.repeat(Math.max(0, s.lives)) + '♡'.repeat(Math.max(0, C.startLives - s.lives)),
    };
    if (next.score !== this.lastText.score) $('hud-score').textContent = next.score;
    if (next.time !== this.lastText.time) {
      $('hud-time').textContent = next.time;
      $('hud-time').classList.toggle('low', timeLeft(s) <= 10);
    }
    if (next.lives !== this.lastText.lives) $('hud-lives').textContent = next.lives;
    this.lastText = next;
  }
}
