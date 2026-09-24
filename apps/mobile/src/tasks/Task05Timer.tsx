import React, { useRef, useState } from 'react';
import { Banner, errorText } from '../ui.js';
import type { TaskProps } from '../screens/PlayerApp.js';

type Phase = 'ready' | 'running' | 'sending' | 'recorded' | 'failed';

/**
 * Blind stopwatch. Duration is the difference of two performance.now() readings
 * taken in the Start and Stop taps — no timer drives the measurement and no
 * running time is shown. Each attempt is sent under a dedupe key, so resending
 * after a network failure cannot count it twice.
 */
export const Task05Timer: React.FC<TaskProps> = ({ view, send, paused, online }) => {
  const [phase, setPhase] = useState<Phase>('ready');
  const [measured, setMeasured] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const startedAt = useRef(0);
  const used = view.attemptsUsed ?? 0;
  const max = view.maxAttempts ?? 3;
  const blocked = paused || !online;

  const submit = async (durationMs: number, attemptNumber: number) => {
    setPhase('sending');
    setError(null);
    try {
      await send('attempt', { durationMs }, { dedupeKey: `attempt-${attemptNumber}` });
      setPhase('recorded');
    } catch (err) {
      setError(errorText(err, 'Could not record the attempt.'));
      setPhase('failed');
    }
  };

  const lockIn = async () => {
    setError(null);
    try {
      await send('lock', {}, { dedupeKey: 'lock' });
    } catch (err) {
      setError(errorText(err, 'Could not lock in.'));
    }
  };

  if (view.finalized) {
    return (
      <div className="card center">
        <h2>Locked in</h2>
        <p className="muted">Your result is final. Your captain has the score.</p>
      </div>
    );
  }

  return (
    <div className="card">
      <p className="muted">Attempt {Math.min(used + (phase === 'recorded' ? 0 : 1), max)} of {max}. Every retry costs points.</p>

      {phase === 'ready' && (
        <button
          type="button"
          className="btn big"
          disabled={blocked || used >= max}
          onClick={() => {
            startedAt.current = performance.now();
            setMeasured(null);
            setPhase('running');
          }}
        >
          Start
        </button>
      )}

      {phase === 'running' && (
        <>
          <p className="big-number" aria-live="polite">● ● ●</p>
          <button
            type="button"
            className="btn big"
            onClick={() => {
              const duration = performance.now() - startedAt.current;
              setMeasured(duration);
              void submit(Math.round(duration), used + 1);
            }}
          >
            Stop
          </button>
        </>
      )}

      {phase === 'sending' && <p aria-live="polite">Recording…</p>}

      {phase === 'failed' && measured !== null && (
        <>
          <Banner tone="error">{error}</Banner>
          <button type="button" className="btn" disabled={!online} onClick={() => submit(Math.round(measured), used + 1)}>
            Send again
          </button>
        </>
      )}

      {phase === 'recorded' && measured !== null && (
        <>
          <p className="center muted">You stopped at</p>
          <p className="big-number">{(measured / 1000).toFixed(2)}<span className="muted"> s</span></p>
          <p className="muted center">Ask your captain: retry or lock in?</p>
          <div className="row">
            <button type="button" className="btn secondary" disabled={blocked || used >= max} onClick={() => setPhase('ready')}>
              Retry ({max - used} left)
            </button>
            <button type="button" className="btn" disabled={blocked} onClick={lockIn}>
              Lock in
            </button>
          </div>
          {error && <Banner tone="error">{error}</Banner>}
        </>
      )}
    </div>
  );
};
