// Serves the MediaPipe WASM runtime from this app instead of a CDN (event Wi-Fi can be unreliable).
import fs from 'node:fs';

const from = new URL('../node_modules/@mediapipe/tasks-vision/wasm/', import.meta.url);
const to = new URL('../public/mediapipe/wasm/', import.meta.url);
fs.mkdirSync(to, { recursive: true });
for (const file of fs.readdirSync(from)) fs.copyFileSync(new URL(file, from), new URL(file, to));
console.log('Copied MediaPipe WASM to public/mediapipe/wasm');
