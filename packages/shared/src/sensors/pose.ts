import type { PoseId } from '../model.ts';

export interface Landmark {
  x: number;
  y: number;
  visibility?: number;
}

const NOSE = 0;
const L_SHOULDER = 11, R_SHOULDER = 12, L_ELBOW = 13, R_ELBOW = 14, L_WRIST = 15, R_WRIST = 16;
const REQUIRED = [NOSE, L_SHOULDER, R_SHOULDER, L_ELBOW, R_ELBOW, L_WRIST, R_WRIST];

type ArmState = 'UP' | 'DOWN' | 'SIDE' | 'OTHER';

/** True when every upper-body landmark the classifier needs is confidently visible. */
export function upperBodyVisible(lm: readonly Landmark[], minVisibility = 0.5): boolean {
  return lm.length >= 17 && REQUIRED.every((i) => (lm[i].visibility ?? 1) >= minVisibility);
}

function armState(lm: readonly Landmark[], shoulder: number, elbow: number, wrist: number, sw: number): ArmState {
  const s = lm[shoulder], e = lm[elbow], w = lm[wrist], nose = lm[NOSE];
  // Image coordinates: y grows downward.
  if (w.y < nose.y - 0.1 * sw && w.y < s.y - 0.8 * sw) return 'UP';
  if (w.y > s.y + 1.0 * sw && Math.abs(w.x - s.x) < 0.8 * sw) return 'DOWN';
  if (Math.abs(w.y - s.y) < 0.5 * sw && Math.abs(e.y - s.y) < 0.5 * sw && Math.abs(w.x - s.x) > 1.2 * sw) return 'SIDE';
  return 'OTHER';
}

/**
 * Classifies MediaPipe pose landmarks (normalized image coordinates) into one
 * of the relay poses, or null. Scale-free: thresholds are relative to shoulder width.
 */
export function classifyPose(lm: readonly Landmark[]): PoseId | null {
  if (!upperBodyVisible(lm)) return null;
  const sw = Math.abs(lm[L_SHOULDER].x - lm[R_SHOULDER].x);
  if (sw < 0.05) return null; // too far away or side-on
  const left = armState(lm, L_SHOULDER, L_ELBOW, L_WRIST, sw);
  const right = armState(lm, R_SHOULDER, R_ELBOW, R_WRIST, sw);
  if (left === 'UP' && right === 'UP') return 'both_hands_up';
  if (left === 'SIDE' && right === 'SIDE') return 't_pose';
  if ((left === 'UP' && right === 'DOWN') || (left === 'DOWN' && right === 'UP')) return 'one_hand_up_one_down';
  return null;
}

/**
 * Confirms a pose held continuously for `holdMs` (by frame timestamps), tolerating
 * dropouts shorter than `graceMs`. Each continuous hold confirms at most once.
 */
export function createPoseHold(opts: { holdMs?: number; graceMs?: number } = {}) {
  const holdMs = opts.holdMs ?? 1500;
  const graceMs = opts.graceMs ?? 300;
  let candidate: PoseId | null = null;
  let since = 0;
  let lastSeen = 0;
  let reported = false;

  return function update(pose: PoseId | null, t: number): { candidate: PoseId | null; heldMs: number; confirmed?: PoseId } {
    if (pose !== null && pose === candidate) {
      lastSeen = t;
    } else if (candidate !== null && t - lastSeen <= graceMs) {
      // Jitter: keep the current hold alive briefly.
    } else {
      candidate = pose;
      since = t;
      lastSeen = t;
      reported = false;
    }
    const heldMs = candidate ? lastSeen - since : 0;
    if (candidate && !reported && heldMs >= holdMs) {
      reported = true;
      return { candidate, heldMs, confirmed: candidate };
    }
    return { candidate, heldMs };
  };
}
