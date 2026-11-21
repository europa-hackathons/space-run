/** Interface texts in English and Swedish. Values may contain simple HTML such as <b>. */
const TEXTS = {
  en: {
    tagline: 'Dodge the asteroids. Shoot the aliens. Survive 90 seconds.',
    keysKeyboard: '<b>← →</b> or <b>A D</b> to steer · <b>Space</b> to fire',
    keysTouch: '<b>◀ ▶</b> to steer · <b>FIRE</b> to shoot',
    startKeyboard: 'Press Enter to start',
    startTouch: 'Tap to start',
    playWithCamera: 'Play with camera',
    moveSteer: '<b>Step or lean</b> left and right to steer',
    moveFire: '<b>Hand up</b> to fire',
    moveStart: '<b>Both hands up</b> to start',
    handsToStart: '🙌 Raise both hands to start!',
    autoFire: 'Auto-fire (just steer)',
    useButtons: 'Use buttons instead',
    score: 'SCORE',
    time: 'TIME',
    lives: 'LIVES',
    best: 'BEST',
    fire: 'FIRE',
    newBest: '· new best!',
    shipDestroyed: 'SHIP DESTROYED',
    roundComplete: 'ROUND COMPLETE',
    againKeyboard: 'Press Enter to play again',
    againTouch: 'Tap to play again',
    handsToRestart: '🙌 Raise both hands to play again!',
    pausedTitle: 'WHERE DID YOU GO?',
    pausedHint: 'Step back in front of the camera',
    cameraStarting: 'Starting the camera…',
    cameraBlocked: 'The camera is blocked. Allow camera access for this page, or play with the buttons.',
    cameraFailed: 'The camera could not be started. You can still play with the buttons.',
    switchLanguage: '🇸🇪 Svenska',
  },
  sv: {
    tagline: 'Undvik asteroiderna. Skjut utomjordingarna. Överlev i 90 sekunder.',
    keysKeyboard: '<b>← →</b> eller <b>A D</b> för att styra · <b>Mellanslag</b> för att skjuta',
    keysTouch: '<b>◀ ▶</b> för att styra · <b>SKJUT</b> för att skjuta',
    startKeyboard: 'Tryck på Enter för att starta',
    startTouch: 'Tryck för att starta',
    playWithCamera: 'Spela med kameran',
    moveSteer: '<b>Kliv eller luta dig</b> åt vänster och höger för att styra',
    moveFire: '<b>Upp med handen</b> för att skjuta',
    moveStart: '<b>Upp med båda händerna</b> för att starta',
    handsToStart: '🙌 Räck upp båda händerna för att starta!',
    autoFire: 'Skjut automatiskt (styr bara)',
    useButtons: 'Använd knapparna i stället',
    score: 'POÄNG',
    time: 'TID',
    lives: 'LIV',
    best: 'BÄST',
    fire: 'SKJUT',
    newBest: '· nytt rekord!',
    shipDestroyed: 'SKEPPET FÖRSTÖRT',
    roundComplete: 'RUNDAN KLAR',
    againKeyboard: 'Tryck på Enter för att spela igen',
    againTouch: 'Tryck för att spela igen',
    handsToRestart: '🙌 Räck upp båda händerna för att spela igen!',
    pausedTitle: 'VART TOG DU VÄGEN?',
    pausedHint: 'Ställ dig framför kameran igen',
    cameraStarting: 'Startar kameran…',
    cameraBlocked: 'Kameran är blockerad. Tillåt kameraåtkomst för den här sidan, eller spela med knapparna.',
    cameraFailed: 'Kameran kunde inte startas. Du kan fortfarande spela med knapparna.',
    switchLanguage: '🇬🇧 English',
  },
} as const;

export type Language = keyof typeof TEXTS;
export type TextKey = keyof (typeof TEXTS)['en'];

const STORAGE_KEY = 'space-run-language';
let current: Language = 'en';

function initial(): Language {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === 'en' || saved === 'sv') return saved;
  } catch {
    // Storage can be unavailable; fall back to the browser language.
  }
  return navigator.language.toLowerCase().startsWith('sv') ? 'sv' : 'en';
}

/** Fills every element that has a data-i18n attribute with the text for the current language. */
function apply(): void {
  document.documentElement.lang = current;
  for (const el of document.querySelectorAll<HTMLElement>('[data-i18n]')) {
    const key = el.dataset.i18n as TextKey | '';
    el.innerHTML = key ? TEXTS[current][key] : '';
  }
}

/** Sets which text an element shows. It keeps following the language. Pass null to clear it. */
export function bind(el: HTMLElement, key: TextKey | null): void {
  el.dataset.i18n = key ?? '';
  el.innerHTML = key ? TEXTS[current][key] : '';
}

export function setLanguage(lang: Language): void {
  current = lang;
  try {
    localStorage.setItem(STORAGE_KEY, lang);
  } catch {
    // The choice just will not be remembered.
  }
  apply();
}

/** Picks the starting language and wires up the switch button. */
export function initLanguage(): void {
  current = initial();
  apply();
  document.getElementById('btn-language')?.addEventListener('click', () => setLanguage(current === 'en' ? 'sv' : 'en'));
}
