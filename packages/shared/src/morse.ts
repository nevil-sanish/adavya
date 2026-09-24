export const MORSE: Record<string, string> = {
  A: '.-', B: '-...', C: '-.-.', D: '-..', E: '.', F: '..-.', G: '--.', H: '....', I: '..',
  J: '.---', K: '-.-', L: '.-..', M: '--', N: '-.', O: '---', P: '.--.', Q: '--.-', R: '.-.',
  S: '...', T: '-', U: '..-', V: '...-', W: '.--', X: '-..-', Y: '-.--', Z: '--..',
};

/** Presses shorter than this are dots; longer are dashes. */
export const DASH_THRESHOLD_MS = 250;

export function pressSymbol(durationMs: number, thresholdMs = DASH_THRESHOLD_MS): '.' | '-' {
  return durationMs < thresholdMs ? '.' : '-';
}

export function letterForMorse(morse: string): string | null {
  return Object.entries(MORSE).find(([, code]) => code === morse)?.[0] ?? null;
}
