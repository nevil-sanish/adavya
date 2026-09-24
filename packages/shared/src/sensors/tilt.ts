export type Direction = 'LEFT' | 'RIGHT';

export interface TiltState {
  /** Direction the phone currently leans past the lock angle, if any. */
  leaning: Direction | null;
  /** 0..1 progress toward locking the current lean. */
  progress: number;
  /** False until the phone returns to neutral after a lock. */
  armed: boolean;
  /** Set once, on the update that completes a lock. */
  locked?: Direction;
}

/**
 * Turns device `gamma` (left/right tilt in degrees, phone held flat or angled)
 * into single locked directions. A lean must be held for `holdMs`; after a lock
 * the phone must return within `neutralDeg` before the next one can start.
 */
export function createTiltLock(opts: { lockDeg?: number; neutralDeg?: number; holdMs?: number } = {}) {
  const lockDeg = opts.lockDeg ?? 30;
  const neutralDeg = opts.neutralDeg ?? 12;
  const holdMs = opts.holdMs ?? 700;
  let armed = false;
  let candidate: Direction | null = null;
  let since = 0;

  return function update(gamma: number, t: number): TiltState {
    const leaning: Direction | null = gamma <= -lockDeg ? 'LEFT' : gamma >= lockDeg ? 'RIGHT' : null;
    if (!armed) {
      if (Math.abs(gamma) <= neutralDeg) armed = true;
      candidate = null;
      return { leaning, progress: 0, armed };
    }
    if (leaning === null) {
      candidate = null;
      return { leaning, progress: 0, armed };
    }
    if (leaning !== candidate) {
      candidate = leaning;
      since = t;
    }
    const progress = Math.min(1, (t - since) / holdMs);
    if (progress >= 1) {
      armed = false;
      candidate = null;
      return { leaning, progress: 1, armed, locked: leaning };
    }
    return { leaning, progress, armed };
  };
}
