import React from 'react';
import type { PoseId } from '@adavya/shared';

/** Arm end points (x, y) for each pose, drawn from shoulders at (38,34) and (62,34). */
const POSE_ARMS: Record<PoseId, [number, number, number, number]> = {
  t_pose: [10, 34, 90, 34],
  both_hands_up: [30, 6, 70, 6],
  one_hand_up_one_down: [30, 6, 70, 62],
};

/** Reference stick figure for the captain. */
export const PoseFigure: React.FC<{ pose: PoseId; className?: string }> = ({ pose, className = '' }) => {
  const [lx, ly, rx, ry] = POSE_ARMS[pose];
  return (
    <svg viewBox="0 0 100 110" aria-hidden="true" className={className} fill="none" stroke="currentColor" strokeWidth="5" strokeLinecap="round">
      <circle cx="50" cy="18" r="9" />
      <line x1="50" y1="28" x2="50" y2="68" />
      <line x1="38" y1="34" x2="62" y2="34" />
      <line x1="38" y1="34" x2={lx} y2={ly} />
      <line x1="62" y1="34" x2={rx} y2={ry} />
      <line x1="50" y1="68" x2="38" y2="102" />
      <line x1="50" y1="68" x2="62" y2="102" />
    </svg>
  );
};
