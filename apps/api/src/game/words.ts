import { randomInt, shuffled } from '../lib/random.js';

/**
 * Common three-letter English words for random Level 02 assignments. Only the
 * words that can be spelled from the ten locations' letters are ever used, so
 * the list can be broader than the current pool. Admins can replace it
 * (task02 configuration → `words`).
 */
export const DEFAULT_ASSIGNMENT_WORDS = [
  'ACE', 'ACT', 'ADD', 'AGE', 'AGO', 'AID', 'AIM', 'AIR', 'ALL', 'AND', 'ANT', 'ANY', 'APE', 'APT', 'ARC', 'ARE',
  'ARK', 'ARM', 'ART', 'ASH', 'ASK', 'ATE', 'AWE', 'AXE', 'BAD', 'BAG', 'BAN', 'BAT', 'BAY', 'BED', 'BEE', 'BET',
  'BIG', 'BIN', 'BIT', 'BOW', 'BOX', 'BOY', 'BUD', 'BUG', 'BUN', 'BUS', 'BUT', 'BUY', 'CAB', 'CAN', 'CAP', 'CAR',
  'CAT', 'COD', 'COG', 'CON', 'COT', 'COW', 'CRY', 'CUB', 'CUP', 'CUT', 'DAM', 'DAY', 'DEN', 'DEW', 'DIG', 'DIM',
  'DIP', 'DOE', 'DOG', 'DOT', 'DRY', 'DUE', 'DYE', 'EAR', 'EAT', 'EEL', 'EGG', 'EGO', 'ELF', 'ELK', 'END', 'ERA',
  'EYE', 'FAN', 'FAR', 'FAT', 'FEW', 'FIG', 'FIN', 'FIT', 'FIX', 'FLY', 'FOE', 'FOG', 'FOR', 'FOX', 'FUN', 'FUR',
  'GAP', 'GAS', 'GEM', 'GET', 'GUM', 'GUT', 'GYM', 'HAM', 'HAT', 'HEN', 'HER', 'HID', 'HIM', 'HIP', 'HIT', 'HOP',
  'HOT', 'HOW', 'HUB', 'HUG', 'HUT', 'ICE', 'INK', 'INN', 'ION', 'IVY', 'JAM', 'JAR', 'JAW', 'JET', 'JOB', 'JOG',
  'JOY', 'KEY', 'KID', 'KIN', 'KIT', 'LAB', 'LAP', 'LAW', 'LAY', 'LED', 'LEG', 'LET', 'LID', 'LIP', 'LOG',
  'LOT', 'LOW', 'MAN', 'MAP', 'MAT', 'MEN', 'MET', 'MIX', 'MOB', 'MOM', 'MOP', 'MUD', 'MUG', 'NAP', 'NET', 'NEW',
  'NOD', 'NOR', 'NOT', 'NOW', 'NUT', 'OAK', 'OAR', 'OAT', 'ODD', 'OFF', 'OIL', 'OLD', 'ONE', 'OPT', 'ORB', 'ORE',
  'OUR', 'OUT', 'OWL', 'OWN', 'PAD', 'PAN', 'PAT', 'PAW', 'PAY', 'PEA', 'PEN', 'PER', 'PET', 'PIE', 'PIG', 'PIN',
  'PIT', 'POD', 'POT', 'PRO', 'PUB', 'PUN', 'PUT', 'RAG', 'RAM', 'RAN', 'RAP', 'RAT', 'RAW', 'RAY', 'RED', 'RIB',
  'RID', 'RIM', 'RIP', 'ROB', 'ROD', 'ROE', 'ROT', 'ROW', 'RUB', 'RUG', 'RUN', 'SAD', 'SAP', 'SAT', 'SAW', 'SAY',
  'SEA', 'SEE', 'SET', 'SEW', 'SHE', 'SIP', 'SIR', 'SIT', 'SIX', 'SKI', 'SKY', 'SOB', 'SON', 'SOW', 'SOY',
  'SPA', 'SPY', 'SUM', 'SUN', 'TAB', 'TAG', 'TAN', 'TAP', 'TAR', 'TAX', 'TEA', 'TEN', 'THE', 'TIE', 'TIN', 'TIP',
  'TOE', 'TON', 'TOP', 'TOY', 'TRY', 'TUB', 'TUG', 'TWO', 'URN', 'USE', 'VAN', 'VAT', 'VET', 'WAR', 'WAX', 'WAY',
  'WEB', 'WET', 'WHO', 'WHY', 'WIG', 'WIN', 'WIT', 'WON', 'YAK', 'YAM', 'YES', 'YET', 'YOU', 'ZIP', 'ZOO',
];

export interface PoolLocation {
  locationId: string;
  letter: string;
}

export interface GeneratedAssignment {
  locationIds: string[];
  correctLocationIds: string[];
  word: string;
}

/** Every way to spell `word` with distinct locations, as location ids in word order. */
export function spellings(word: string, pool: readonly PoolLocation[]): string[][] {
  const out: string[][] = [];
  const walk = (i: number, used: string[]) => {
    if (i === word.length) {
      out.push(used);
      return;
    }
    for (const l of pool) {
      if (l.letter === word[i] && !used.includes(l.locationId)) walk(i + 1, [...used, l.locationId]);
    }
  };
  walk(0, []);
  return out;
}

/** The words from `words` that the pool can spell, uppercased and de-duplicated. */
export function formableWords(words: readonly string[], pool: readonly PoolLocation[]): string[] {
  return [...new Set(words.map((w) => w.trim().toUpperCase()))].filter((w) => /^[A-Z]{3}$/.test(w) && spellings(w, pool).length > 0);
}

/**
 * A random Level 02 assignment: a spellable word that has been used least so far
 * (so teams get different words until the list runs out), three locations that
 * spell it, two random decoys, and a random riddle order for all five.
 * Returns null when no word can be spelled from the pool.
 */
export function randomAssignment(
  pool: readonly PoolLocation[],
  words: readonly string[],
  usedWords: Readonly<Record<string, number>>
): GeneratedAssignment | null {
  const candidates = formableWords(words, pool);
  if (candidates.length === 0) return null;
  const leastUsed = Math.min(...candidates.map((w) => usedWords[w] ?? 0));
  const fresh = candidates.filter((w) => (usedWords[w] ?? 0) === leastUsed);
  const word = fresh[randomInt(0, fresh.length - 1)];

  const options = spellings(word, pool);
  const correct = options[randomInt(0, options.length - 1)];
  const decoys = shuffled(pool.filter((l) => !correct.includes(l.locationId))).slice(0, 2).map((l) => l.locationId);
  return { locationIds: shuffled([...correct, ...decoys]), correctLocationIds: correct, word };
}
