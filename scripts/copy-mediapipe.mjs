// Copies the MediaPipe WebAssembly runtime into public/ so the game can load it from its own host
// (works offline at the party; nothing is fetched from a CDN at runtime).
import { cpSync, mkdirSync } from 'node:fs';

mkdirSync('public/mediapipe/wasm', { recursive: true });
cpSync('node_modules/@mediapipe/tasks-vision/wasm', 'public/mediapipe/wasm', { recursive: true });
console.log('Copied MediaPipe runtime to public/mediapipe/wasm');
