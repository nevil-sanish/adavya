import { randomInt as cryptoRandomInt, randomUUID } from 'node:crypto';

/** Inclusive integer in [min, max]. */
export function randomInt(min: number, max: number): number {
  return cryptoRandomInt(min, max + 1);
}

export function shuffled<T>(items: readonly T[]): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = cryptoRandomInt(i + 1);
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

export function pick<T>(items: readonly T[], count: number): T[] {
  return shuffled(items).slice(0, count);
}

/** Exactly four random numeric digits, leading zeros allowed. */
export function fourDigitCode(): string {
  return String(cryptoRandomInt(10_000)).padStart(4, '0');
}

export function newId(): string {
  return randomUUID();
}
