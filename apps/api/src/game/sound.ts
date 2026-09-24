import { randomInt } from '../lib/random.js';

/**
 * Three distinct integer targets in [minDb, maxDb], each at least `separationDb`
 * apart so a hit on one cannot land inside another's tolerance band.
 */
export function generateSoundTargets(minDb: number, maxDb: number, separationDb: number): number[] {
  if (maxDb - minDb < separationDb * 2) {
    throw new Error('Sound range is too narrow for three separated targets.');
  }
  for (let attempt = 0; attempt < 1000; attempt++) {
    const targets = [randomInt(minDb, maxDb), randomInt(minDb, maxDb), randomInt(minDb, maxDb)];
    const sorted = [...targets].sort((a, b) => a - b);
    if (sorted[1] - sorted[0] >= separationDb && sorted[2] - sorted[1] >= separationDb) return targets;
  }
  // Deterministic fallback: evenly spaced across the range.
  const step = Math.floor((maxDb - minDb) / 2);
  return [minDb, minDb + step, maxDb];
}
