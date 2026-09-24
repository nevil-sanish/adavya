import React, { useEffect, useState } from 'react';
import { AlertCircle, CheckCircle2, Loader2, MapPin, Trophy } from 'lucide-react';
import { getRound2State, verifyRound2Words } from '../services/api.js';

type Words = [string, string, string];
type Status = { kind: 'idle' } | { kind: 'error'; message: string } | { kind: 'success'; message: string };

/**
 * Round 2 (HQ side): shows the campus clues and takes the three words the field team
 * discovers at each geofence, in order. The geofence itself runs in the field phone app.
 */
export const Round2WordEntry: React.FC<{ alreadyCompleted?: boolean; onCompleted?: () => void }> = ({
  alreadyCompleted = false,
  onCompleted,
}) => {
  const [clues, setClues] = useState<string[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [words, setWords] = useState<Words>(['', '', '']);
  const [isVerifying, setIsVerifying] = useState(false);
  const [status, setStatus] = useState<Status>(
    alreadyCompleted ? { kind: 'success', message: 'Round 2 is already complete.' } : { kind: 'idle' }
  );

  useEffect(() => {
    getRound2State()
      .then((state) => setClues(state.clues))
      .catch((err) => setLoadError(err instanceof Error ? err.message : 'Could not load the clues.'))
      .finally(() => setIsLoading(false));
  }, []);

  const isDone = status.kind === 'success';
  const canSubmit = words.every((w) => w.trim()) && !isVerifying && !isDone;

  const handleWordChange = (index: number, value: string) => {
    setWords((prev) => prev.map((w, i) => (i === index ? value : w)) as Words);
    if (status.kind === 'error') setStatus({ kind: 'idle' });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    setIsVerifying(true);
    try {
      const result = await verifyRound2Words(words);
      setStatus({ kind: result.correct ? 'success' : 'error', message: result.message });
      if (result.correct) onCompleted?.();
    } catch (err) {
      setStatus({ kind: 'error', message: err instanceof Error ? err.message : 'Verification failed.' });
    } finally {
      setIsVerifying(false);
    }
  };

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-[12px] p-5 shadow-sm space-y-4 min-h-[460px] flex flex-col">
      <div className="flex items-center justify-between pb-3 border-b border-zinc-800/80">
        <h2 className="text-sm font-semibold tracking-tight text-zinc-100">Round 2 · Geofence Hunt</h2>
        <span className="text-[11px] text-zinc-500">Field team: keep your phone screens on</span>
      </div>

      {/* Clues */}
      <section aria-labelledby="round2-clues" className="space-y-2">
        <h3 id="round2-clues" className="text-xs font-semibold text-zinc-300">
          Clues
        </h3>
        {isLoading ? (
          <p className="flex items-center gap-2 text-xs text-zinc-500">
            <Loader2 aria-hidden="true" className="w-3.5 h-3.5 animate-spin" /> Loading clues…
          </p>
        ) : loadError ? (
          <p className="flex items-center gap-2 text-xs text-red-300">
            <AlertCircle aria-hidden="true" className="w-3.5 h-3.5" /> {loadError}
          </p>
        ) : clues.length === 0 ? (
          <p className="text-xs text-zinc-500">No clues have been set for your team yet.</p>
        ) : (
          <ol className="grid gap-2 sm:grid-cols-3">
            {clues.map((clue, i) => (
              <li key={i} className="p-3 rounded-lg bg-zinc-950/70 border border-zinc-800/80 space-y-1.5">
                <span className="flex items-center gap-1 text-[10px] font-mono uppercase tracking-wider text-blue-400">
                  <MapPin aria-hidden="true" className="w-3 h-3" /> Location {i + 1}
                </span>
                <p className="text-[13px] text-zinc-200 leading-snug">{clue}</p>
              </li>
            ))}
          </ol>
        )}
      </section>

      {/* Word sequence */}
      <form onSubmit={handleSubmit} className="flex-1 flex flex-col justify-center gap-3 p-4 rounded-lg bg-zinc-950/60 border border-zinc-800/80">
        <div>
          <p className="text-xs font-semibold text-zinc-200">Final password</p>
          <p className="text-[11px] text-zinc-400 mt-0.5">
            Type the words your field team reads out to you, in the correct order.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center gap-2">
          {words.map((word, i) => (
            <React.Fragment key={i}>
              {i > 0 && <span aria-hidden="true" className="hidden sm:block text-zinc-600">—</span>}
              <input
                type="text"
                value={word}
                onChange={(e) => handleWordChange(i, e.target.value)}
                disabled={isDone}
                aria-label={`Word ${i + 1}`}
                placeholder={`Word ${i + 1}`}
                autoComplete="off"
                spellCheck={false}
                className="flex-1 min-w-0 rounded-lg bg-zinc-900 border border-zinc-700 px-3 py-2 text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:border-blue-500 disabled:opacity-60"
              />
            </React.Fragment>
          ))}
        </div>

        <div className="flex items-center justify-between gap-3">
          {status.kind === 'idle' ? (
            <span />
          ) : (
            <p
              role="status"
              className={`flex items-center gap-1.5 text-[12px] ${
                status.kind === 'success' ? 'text-emerald-400' : 'text-red-300'
              }`}
            >
              {status.kind === 'success' ? (
                <Trophy aria-hidden="true" className="w-4 h-4" />
              ) : (
                <AlertCircle aria-hidden="true" className="w-3.5 h-3.5" />
              )}
              {status.message}
            </p>
          )}
          <button
            type="submit"
            disabled={!canSubmit}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
          >
            {isVerifying && <Loader2 aria-hidden="true" className="w-3.5 h-3.5 animate-spin" />}
            {isDone && <CheckCircle2 aria-hidden="true" className="w-3.5 h-3.5" />}
            {isDone ? 'Completed' : isVerifying ? 'Checking…' : 'Submit'}
          </button>
        </div>
      </form>
    </div>
  );
};
