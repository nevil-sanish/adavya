import React, { useEffect, useRef, useState } from 'react';
import { AlertCircle, CheckCircle2, Hourglass, Loader2, Trophy } from 'lucide-react';
import { completeRound3, getRound3State, type Round3State } from '../services/api.js';
import { subscribeRound } from '../services/firestore.js';
import type { PoseId, PoseSlot } from '../types/firestore.js';

const SLOTS: PoseSlot[] = ['B', 'C', 'D'];

const POSE_INFO: Record<PoseId, { name: string; description: string }> = {
  t_pose: {
    name: 'T-Pose',
    description: 'Stand straight with both arms stretched out sideways at shoulder height.',
  },
  both_hands_up: {
    name: 'Both Hands Up',
    description: 'Stand straight and raise both arms straight up above your head.',
  },
  one_hand_up_one_down: {
    name: 'One Hand Up, One Down',
    description: 'Raise one arm straight up and keep the other arm straight down by your side.',
  },
};

/** Arm end points (x, y) for each pose, drawn from shoulders at (38,34) and (62,34). */
const POSE_ARMS: Record<PoseId, [number, number, number, number]> = {
  t_pose: [10, 34, 90, 34],
  both_hands_up: [30, 6, 70, 6],
  one_hand_up_one_down: [30, 6, 70, 62],
};

const PoseFigure: React.FC<{ pose: PoseId; className?: string }> = ({ pose, className = '' }) => {
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

type Status = { kind: 'idle' } | { kind: 'error'; message: string } | { kind: 'success'; message: string };

/**
 * Round 3 (HQ side): shows which pose each performer must hold and ticks them off live
 * as the phone app marks them verified in Firestore. Pose detection runs on the phones.
 */
export const Round3PoseRelay: React.FC<{ alreadyCompleted?: boolean; onCompleted?: () => void }> = ({
  alreadyCompleted = false,
  onCompleted,
}) => {
  const [state, setState] = useState<Round3State | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [verified, setVerified] = useState<Partial<Record<PoseSlot, boolean>>>({});
  const [status, setStatus] = useState<Status>(
    alreadyCompleted ? { kind: 'success', message: 'Round 3 is already complete.' } : { kind: 'idle' }
  );
  const isCompleting = useRef(false);

  useEffect(() => {
    getRound3State()
      .then(setState)
      .catch((err) => setLoadError(err instanceof Error ? err.message : 'Could not load the poses.'));
  }, []);

  // Live verification results written by the phone app.
  useEffect(() => {
    if (!state) return;
    return subscribeRound('round3', state.teamId, (entry) => setVerified(entry?.verified ?? {}));
  }, [state]);

  const verifiedCount = SLOTS.filter((slot) => verified[slot]).length;
  const allVerified = verifiedCount === SLOTS.length;

  const finishRound = async () => {
    if (isCompleting.current) return;
    isCompleting.current = true;
    try {
      const result = await completeRound3();
      setStatus({ kind: result.correct ? 'success' : 'error', message: result.message });
      if (result.correct) setTimeout(() => onCompleted?.(), 1500);
    } catch (err) {
      setStatus({ kind: 'error', message: err instanceof Error ? err.message : 'Could not complete Round 3.' });
    } finally {
      isCompleting.current = false;
    }
  };

  useEffect(() => {
    if (allVerified && status.kind === 'idle') void finishRound();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allVerified]);

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-[12px] p-5 shadow-sm space-y-4 min-h-[460px] flex flex-col">
      <div className="flex items-center justify-between pb-3 border-b border-zinc-800/80">
        <h2 className="text-sm font-semibold tracking-tight text-zinc-100">Round 3 · Pose Relay</h2>
        <span className="text-[11px] text-zinc-500 font-mono">
          {verifiedCount} / {SLOTS.length} verified
        </span>
      </div>

      <p className="text-[12px] text-zinc-400">
        Describe each pose to the right teammate. They hold it in front of their phone camera until it is verified.
      </p>

      {loadError ? (
        <p className="flex items-center gap-2 text-xs text-red-300">
          <AlertCircle aria-hidden="true" className="w-3.5 h-3.5" /> {loadError}
        </p>
      ) : !state ? (
        <p className="flex items-center gap-2 text-xs text-zinc-500">
          <Loader2 aria-hidden="true" className="w-3.5 h-3.5 animate-spin" /> Loading poses…
        </p>
      ) : (
        <ul className="grid gap-3 flex-1 sm:grid-cols-3">
          {SLOTS.map((slot) => {
            const pose = state.assignments[slot];
            const info = POSE_INFO[pose];
            const isDone = verified[slot] === true;
            return (
              <li
                key={slot}
                className={`rounded-[12px] border p-4 flex flex-col items-center text-center gap-2 transition-colors ${
                  isDone ? 'bg-emerald-950/30 border-emerald-700/60' : 'bg-zinc-950/70 border-zinc-800/80'
                }`}
              >
                <span className="text-[13px] font-medium text-zinc-400">Player {slot}</span>
                {info ? (
                  <>
                    <PoseFigure pose={pose} className={`w-20 h-24 ${isDone ? 'text-emerald-400' : 'text-zinc-200'}`} />
                    <span className="text-sm font-semibold text-white">{info.name}</span>
                    <span className="text-[11px] text-zinc-400 leading-snug">{info.description}</span>
                  </>
                ) : (
                  <span className="text-xs text-zinc-500">Unknown pose "{pose}"</span>
                )}
                <span
                  className={`mt-auto flex items-center gap-1 text-[11px] font-medium ${
                    isDone ? 'text-emerald-400' : 'text-zinc-500'
                  }`}
                >
                  {isDone ? (
                    <>
                      <CheckCircle2 aria-hidden="true" className="w-3.5 h-3.5" /> Verified
                    </>
                  ) : (
                    <>
                      <Hourglass aria-hidden="true" className="w-3.5 h-3.5" /> Waiting
                    </>
                  )}
                </span>
              </li>
            );
          })}
        </ul>
      )}

      {status.kind !== 'idle' && (
        <div
          role="status"
          className={`flex items-center justify-between gap-2 text-[12px] ${
            status.kind === 'success' ? 'text-emerald-400' : 'text-red-300'
          }`}
        >
          <span className="flex items-center gap-1.5">
            {status.kind === 'success' ? (
              <Trophy aria-hidden="true" className="w-4 h-4" />
            ) : (
              <AlertCircle aria-hidden="true" className="w-3.5 h-3.5" />
            )}
            {status.message}
          </span>
          {status.kind === 'error' && (
            <button
              type="button"
              onClick={() => {
                setStatus({ kind: 'idle' });
                void finishRound();
              }}
              className="px-3 py-1 rounded-md bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-zinc-200 text-[11px]"
            >
              Try again
            </button>
          )}
        </div>
      )}
    </div>
  );
};
