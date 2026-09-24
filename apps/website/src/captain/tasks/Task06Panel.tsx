import React from 'react';
import { MORSE, type Task06CaptainView } from '@adavya/shared';
import { Card } from '../../components/ui.js';
import type { PanelProps } from '../Monitor.js';

const RESULT_TEXT = { ACCEPTED: 'accepted', WRONG_PLAYER: 'wrong player', WRONG_MORSE: 'wrong Morse' } as const;

/** Morse relay: the word, accepted Morse per position, and every submission in red/green. */
export const Task06Panel: React.FC<PanelProps<Task06CaptainView>> = ({ view }) => (
  <div className="grid gap-4 lg:grid-cols-[2fr_1fr]">
    <div className="space-y-4">
      <Card title="Target word" aside={`${view.currentPosition} / ${view.word.length}`}>
        <ol className="flex gap-3">
          {[...view.word].map((letter, i) => {
            const done = i < view.currentPosition;
            const current = i === view.currentPosition;
            return (
              <li
                key={i}
                aria-current={current ? 'step' : undefined}
                className={`w-24 rounded-[12px] border p-3 text-center ${
                  done ? 'border-emerald-700/60 bg-emerald-950/30' : current ? 'border-white/60 bg-zinc-800' : 'border-zinc-800 bg-zinc-950/70'
                }`}
              >
                <span className="block text-4xl font-semibold text-white">{letter}</span>
                <span className="block font-mono text-lg tracking-widest text-zinc-300">{MORSE[letter]}</span>
                <span className="block text-[10px] text-zinc-500">{done ? `✓ ${view.acceptedMorse[i]}` : current ? 'current' : ''}</span>
              </li>
            );
          })}
        </ol>
        <p className="mt-3 text-xs text-zinc-500">Each letter belongs to a different player. Wrong player or wrong Morse keeps the position; retries are unlimited.</p>
      </Card>

      <Card title="Morse reference">
        <ul className="grid grid-cols-6 gap-x-4 gap-y-1 font-mono text-xs text-zinc-400 sm:grid-cols-9">
          {Object.entries(MORSE).map(([l, m]) => (
            <li key={l}><span className="text-zinc-200">{l}</span> {m}</li>
          ))}
        </ul>
      </Card>
    </div>

    <Card title="Submissions">
      {view.attempts.length === 0 ? (
        <p className="text-sm text-zinc-500">Nothing yet.</p>
      ) : (
        <ul className="space-y-1.5 text-sm" aria-live="polite">
          {[...view.attempts].reverse().map((a, i) => (
            <li key={`${a.at}-${i}`} className={`flex items-center gap-2 rounded px-2 py-1 ${a.result === 'ACCEPTED' ? 'bg-emerald-900/40 text-emerald-100' : 'bg-red-900/40 text-red-100'}`}>
              <span className="font-mono text-base tracking-widest">{a.morse}</span>
              <span className="text-xs opacity-80">#{a.position + 1} · {a.byName}</span>
              <span className="ml-auto text-xs">{RESULT_TEXT[a.result]}</span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  </div>
);
