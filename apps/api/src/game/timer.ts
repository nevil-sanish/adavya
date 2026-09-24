export interface TimerScoring {
  maxPoints: number;
  pointsLostPerSecond: number;
  retryPenalty: number;
}

/** Score for one blind-stopwatch attempt. `retryIndex` is 0 for the first attempt. */
export function scoreAttempt(targetMs: number, durationMs: number, retryIndex: number, cfg: TimerScoring): number {
  const errorMs = Math.abs(durationMs - targetMs);
  const raw = cfg.maxPoints - (errorMs / 1000) * cfg.pointsLostPerSecond - cfg.retryPenalty * retryIndex;
  return Math.max(0, Math.round(raw * 10) / 10);
}
