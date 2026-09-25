/** Approximate sound level from time-domain samples. `offsetDb` maps dBFS to a rough dB SPL scale. */
export function rmsDb(samples: ArrayLike<number>, offsetDb = 90): number {
  let sum = 0;
  for (let i = 0; i < samples.length; i++) sum += samples[i] * samples[i];
  const rms = Math.sqrt(sum / Math.max(1, samples.length));
  if (rms < 1e-10) return 0;
  return Math.max(0, Math.min(120, 20 * Math.log10(rms) + offsetDb));
}

export function median(values: readonly number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

export interface Plateau {
  levelDb: number;
  holdMs: number;
  endedAt: number;
}

/**
 * Detects a sound level: readings stay within `bandDb` of their running mean
 * for `holdMs`, above `floorDb` (ambient noise plus a margin). Each level reports
 * once; the sound must leave the band before the next report. With `holdMs: 0`
 * every new level is reported as soon as it is reached (a "hit"), at most once
 * per `minIntervalMs`.
 */
export function createPlateauDetector(opts: { bandDb?: number; holdMs?: number; floorDb?: number; minIntervalMs?: number } = {}) {
  const bandDb = opts.bandDb ?? 2.5;
  const holdMs = opts.holdMs ?? 1500;
  const minIntervalMs = opts.minIntervalMs ?? 0;
  let floorDb = opts.floorDb ?? 0;
  let since = -1;
  let sum = 0;
  let count = 0;
  let reported = false;
  let lastReportAt = -Infinity;

  const reset = () => {
    since = -1;
    sum = 0;
    count = 0;
    reported = false;
  };

  return {
    setFloor(db: number) {
      floorDb = db;
    },
    update(db: number, t: number): Plateau | null {
      if (db < floorDb) {
        reset();
        return null;
      }
      if (since >= 0 && Math.abs(db - sum / count) > bandDb) reset();
      if (since < 0) since = t;
      sum += db;
      count += 1;
      if (!reported && t - since >= holdMs && t - lastReportAt >= minIntervalMs) {
        reported = true;
        lastReportAt = t;
        return { levelDb: Math.round((sum / count) * 10) / 10, holdMs: Math.round(t - since), endedAt: t };
      }
      return null;
    },
  };
}
