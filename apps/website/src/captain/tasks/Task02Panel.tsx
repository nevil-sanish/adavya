import React, { useState } from 'react';
import { ApiError, type AssignedHint, type Discovery, type Member, type Task02CaptainView, type WordAttempt } from '@adavya/shared';
import { sendEvent } from '../../services/api.js';
import { paths } from '../../services/paths.js';
import { useCollection } from '../../hooks/useFirestore.js';
import { Banner, Button, Card } from '../../components/ui.js';
import { CaptainLog, type PanelProps } from '../Monitor.js';

const time = (d: Discovery) => (d.discoveredAt ? new Date(d.discoveredAt.toMillis()).toLocaleTimeString() : '…');

/**
 * Level 02 captain dashboard: the team's five riddles, letters as players
 * discover them (who, when), progress, and — in captain-submits mode — the word.
 * Listens only to this team's run; correct/decoy is never shown unless the
 * admin configured it to be revealed after discovery.
 */
export const Task02Panel: React.FC<PanelProps<Task02CaptainView>> = ({ cid, teamId, uid, run, view, members }) => {
  const hints = useCollection<AssignedHint>(paths.runCollection(cid, teamId, 'task02', 'assignedLocations'), 'order');
  const discoveries = useCollection<Discovery>(paths.runCollection(cid, teamId, 'task02', 'discoveries'));
  const attempts = useCollection<WordAttempt>(paths.runCollection(cid, teamId, 'task02', 'wordAttempts'), 'at');
  const [letters, setLetters] = useState('');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ tone: 'error' | 'success'; text: string } | null>(null);
  const byLocation = new Map(discoveries.data.map((d) => [d.locationId, d]));
  const players = members.filter((m) => m.role === 'PLAYER').sort((a, b) => a.slot.localeCompare(b.slot));
  const captainSubmits = view.completionMode === 'CAPTAIN_SUBMITS_WORD';

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setResult(null);
    try {
      const res = await sendEvent<{ correct: boolean }>({
        taskId: 'task02',
        action: 'word',
        runId: run.runId,
        uid,
        knownSeq: view.lastSeq,
        payload: { letters },
        dedupeKey: `word:${letters}`,
      });
      setResult(res.correct ? { tone: 'success', text: 'Correct word!' } : { tone: 'error', text: `${letters.toUpperCase()} is not the word. Discoveries are kept.` });
      if (!res.correct) setLetters('');
    } catch (err) {
      setResult({ tone: 'error', text: err instanceof ApiError ? err.message : 'Could not submit.' });
    } finally {
      setBusy(false);
    }
  };

  const progress =
    view.correctFound !== null
      ? `${view.correctFound} / ${view.correctRequired} correct letters`
      : `${view.discoveredCount} / ${view.hintCount} locations found · ${view.correctRequired} correct letters needed`;

  return (
    <div className="grid gap-4 lg:grid-cols-[2fr_1fr]">
      <div className="space-y-4">
        <Card title="Location riddles" aside={progress}>
          {hints.error && <Banner tone="error">{hints.error}</Banner>}
          <ol className="space-y-2">
            {hints.data.map((h) => {
              const found = byLocation.get(h.locationId);
              return (
                <li key={h.locationId} className="flex items-center gap-3 rounded-lg border border-zinc-800 bg-zinc-950/60 px-3 py-2">
                  <span className="font-mono text-xs text-zinc-500">#{h.order}</span>
                  <span className="flex-1 text-sm text-zinc-200">{h.hint}</span>
                  {found ? (
                    <span className="text-right">
                      <span
                        className={`block font-mono text-2xl ${
                          found.resultType === 'DECOY' ? 'text-red-300 line-through' : found.resultType === 'CORRECT' ? 'text-emerald-300' : 'text-white'
                        }`}
                      >
                        {found.letter}
                      </span>
                      <span className="block text-[10px] text-zinc-500">
                        {found.discoveredByName} · {time(found)}
                      </span>
                    </span>
                  ) : (
                    <span className="font-mono text-2xl text-zinc-700" aria-label="Not found yet">?</span>
                  )}
                </li>
              );
            })}
          </ol>
          <p className="mt-3 text-xs text-zinc-500">
            Two of the five locations are decoys. {view.revealClassification ? 'Decoys are crossed out once found.' : 'You are not told which.'}
          </p>
        </Card>

        {captainSubmits ? (
          <Card title="Submit the word">
            <form onSubmit={submit} className="flex flex-wrap items-center gap-3">
              <input
                aria-label="Three-letter word"
                value={letters}
                onChange={(e) => setLetters(e.target.value.replace(/[^a-z]/gi, '').slice(0, 3).toUpperCase())}
                placeholder="ABC"
                className="w-32 rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-center font-mono text-2xl tracking-[0.4em]"
              />
              <Button type="submit" busy={busy} disabled={letters.length !== 3}>
                Submit
              </Button>
              <p className="basis-full text-xs text-zinc-500">
                Three of the letters form a meaningful word{view.acceptAnyOrder ? ' (any order is accepted).' : '.'} The word counts only after all
                three of its letters have been found.
              </p>
            </form>
            {result && <div className="mt-3"><Banner tone={result.tone}>{result.text}</Banner></div>}
            {attempts.data.length > 0 && (
              <ul className="mt-3 flex flex-wrap gap-2 text-xs">
                {attempts.data.map((a, i) => (
                  <li key={i} className={`rounded px-2 py-1 font-mono ${a.correct ? 'bg-emerald-900/50 text-emerald-200' : 'bg-red-900/40 text-red-200'}`}>
                    {a.letters}
                  </li>
                ))}
              </ul>
            )}
          </Card>
        ) : (
          <Card title="Completion">
            <p className="text-sm text-zinc-400">The level completes automatically when your team has found the three correct letters.</p>
          </Card>
        )}
      </div>

      <div className="space-y-4">
        <Card title="Discoveries by player">
          <ul className="space-y-2 text-sm">
            {players.map((p: Member) => {
              const mine = discoveries.data.filter((d) => d.discoveredByUid === p.uid).sort((a, b) => a.order - b.order);
              return (
                <li key={p.uid} className="flex items-center justify-between gap-2">
                  <span className="text-zinc-300">{p.displayName}</span>
                  <span className="font-mono text-zinc-100">{mine.length ? mine.map((d) => `${d.letter} (#${d.order})`).join(', ') : '—'}</span>
                </li>
              );
            })}
          </ul>
        </Card>
        <CaptainLog log={view.log} />
      </div>
    </div>
  );
};
