import React, { useState } from 'react';
import { AlertCircle, CheckCircle2, Loader2 } from 'lucide-react';
import { verifyRound1Code } from '../services/api.js';

type Status = { kind: 'idle' } | { kind: 'error'; message: string } | { kind: 'success'; message: string };

/** HQ enters the code the field phones reveal once the rotation sequence is correct. */
export const Round1CodeEntry: React.FC<{ onVerified?: () => void }> = ({ onVerified }) => {
  const [code, setCode] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);
  const [status, setStatus] = useState<Status>({ kind: 'idle' });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim() || isVerifying) return;
    setIsVerifying(true);
    setStatus({ kind: 'idle' });
    try {
      const result = await verifyRound1Code(code);
      setStatus({ kind: result.correct ? 'success' : 'error', message: result.message });
      if (result.correct) onVerified?.();
    } catch (err) {
      setStatus({ kind: 'error', message: err instanceof Error ? err.message : 'Code verification failed.' });
    } finally {
      setIsVerifying(false);
    }
  };

  const isDone = status.kind === 'success';

  return (
    <form onSubmit={handleSubmit} className="p-3.5 rounded-lg bg-zinc-950/60 border border-zinc-800/80 space-y-2.5">
      <div>
        <label htmlFor="round1-code" className="text-xs font-semibold text-zinc-200">
          Enter the code
        </label>
        <p className="text-[11px] text-zinc-400 mt-0.5">
          When your field players complete the rotation sequence, their phones show a code. Type it here.
        </p>
      </div>

      <div className="flex gap-2">
        <input
          id="round1-code"
          type="text"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          disabled={isDone}
          autoComplete="off"
          spellCheck={false}
          placeholder="e.g. ORBIT42"
          className="flex-1 min-w-0 rounded-lg bg-zinc-900 border border-zinc-700 px-3 py-1.5 font-mono text-sm uppercase tracking-wider text-white placeholder:text-zinc-600 placeholder:normal-case focus:outline-none focus:border-blue-500 disabled:opacity-60"
        />
        <button
          type="submit"
          disabled={!code.trim() || isVerifying || isDone}
          className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {isVerifying && <Loader2 aria-hidden="true" className="w-3.5 h-3.5 animate-spin" />}
          {isDone ? 'Verified' : isVerifying ? 'Checking…' : 'Verify'}
        </button>
      </div>

      {status.kind !== 'idle' && (
        <p
          role="status"
          className={`flex items-center gap-1.5 text-[11px] ${
            status.kind === 'success' ? 'text-emerald-400' : 'text-red-300'
          }`}
        >
          {status.kind === 'success' ? (
            <CheckCircle2 aria-hidden="true" className="w-3.5 h-3.5" />
          ) : (
            <AlertCircle aria-hidden="true" className="w-3.5 h-3.5" />
          )}
          {status.message}
        </p>
      )}
    </form>
  );
};
