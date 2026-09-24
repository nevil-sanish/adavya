import React from 'react';
import type { Task01CaptainView } from '@adavya/shared';
import { Card } from '../../components/ui.js';
import { CaptainLog, type PanelProps } from '../Monitor.js';

/** Orientation: sequence slots fill in as bits are accepted; the next player is highlighted. */
export const Task01Panel: React.FC<PanelProps<Task01CaptainView>> = ({ view }) => (
  <div className="grid gap-4 lg:grid-cols-[2fr_1fr]">
    <Card title="Hidden sequence" aside={`${view.currentStep} / ${view.length}`}>
      <ol className="flex flex-wrap gap-2" aria-label="Sequence">
        {Array.from({ length: view.length }, (_, i) => {
          const bit = view.revealed[i];
          const current = i === view.currentStep;
          return (
            <li
              key={i}
              aria-current={current ? 'step' : undefined}
              className={`flex h-16 w-14 flex-col items-center justify-center rounded-lg border font-mono ${
                bit !== undefined ? 'border-emerald-600/60 bg-emerald-950/40 text-emerald-200' : current ? 'border-white/70 bg-zinc-800 text-white' : 'border-zinc-800 text-zinc-600'
              }`}
            >
              <span className="text-2xl">{bit ?? '?'}</span>
              <span className="text-[10px] opacity-70">{bit === undefined ? '' : bit ? 'right' : 'left'}</span>
            </li>
          );
        })}
      </ol>
      {view.currentPlayerName && (
        <p className="mt-4 text-sm text-zinc-300">
          Step {view.currentStep + 1}: <strong className="text-white">{view.currentPlayerName}</strong> must tilt. Left = 0, right = 1.
        </p>
      )}
    </Card>
    <CaptainLog log={view.log} />
  </div>
);
