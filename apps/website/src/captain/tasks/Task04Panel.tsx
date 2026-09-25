import React from 'react';
import { CheckCircle2 } from 'lucide-react';
import type { Task04CaptainView } from '@adavya/shared';
import { Card } from '../../components/ui.js';
import { CaptainLog, type PanelProps } from '../Monitor.js';

/** Sound relay: ordered targets only; which player owns which target stays hidden. */
export const Task04Panel: React.FC<PanelProps<Task04CaptainView>> = ({ view }) => (
  <div className="grid gap-4 lg:grid-cols-[2fr_1fr]">
    <Card title="Targets, in required order" aside={`${view.completedCount} / ${view.targets.length}`}>
      <ol className="grid gap-3 sm:grid-cols-3">
        {view.targets.map((db, i) => {
          const done = i < view.completedCount;
          const current = i === view.completedCount;
          return (
            <li
              key={i}
              aria-current={current ? 'step' : undefined}
              className={`rounded-[12px] border p-4 text-center ${
                done ? 'border-emerald-700/60 bg-emerald-950/30' : current ? 'border-white/60 bg-zinc-800' : 'border-zinc-800 bg-zinc-950/70'
              }`}
            >
              <span className="block text-xs text-zinc-500">#{i + 1}</span>
              <span className="block text-4xl font-semibold text-white">{db}<span className="text-base text-zinc-400"> dB</span></span>
              {done && <CheckCircle2 aria-label="Hit" className="mx-auto mt-2 h-5 w-5 text-emerald-400" />}
            </li>
          );
        })}
      </ol>
      <p className="mt-3 text-xs text-zinc-500">
        A target counts when its owner {view.holdMs ? `holds within ±${view.toleranceDb} dB for ${(view.holdMs / 1000).toFixed(1)} s` : `reaches within ±${view.toleranceDb} dB`}. Phone readings are
        approximate.
      </p>
    </Card>
    <CaptainLog log={view.log} />
  </div>
);
