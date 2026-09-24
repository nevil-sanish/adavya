export const MORSE: Record<string, string> = {
  A: '.-', B: '-...', C: '-.-.', D: '-..', E: '.', F: '..-.', G: '--.', H: '....', I: '..',
  J: '.---', K: '-.-', L: '.-..', M: '--', N: '-.', O: '---', P: '.--.', Q: '--.-', R: '.-.',
  S: '...', T: '-', U: '..-', V: '...-', W: '.--', X: '-..-', Y: '-.--', Z: '--..',
};

export const DEFAULT_MORSE_WORDS = [
  'CAT', 'DOG', 'SUN', 'MAP', 'KEY', 'BOX', 'SKY', 'OWL', 'JAM', 'ZIP', 'FOX', 'WEB',
];

export function isThreeLetterWord(word: string): boolean {
  return /^[A-Z]{3}$/.test(word);
}
