import React from 'react';
import { SLOT_LABEL, type Task05CaptainView } from '@adavya/shared';
import { Card } from '../../components/ui.js';
import { CaptainLog, type PanelProps } from '../Monitor.js';

const sec = (ms: number) => `${(ms / 1000).toFixed(2)} s`;

/** Response-time relay: targets, every attempt, retries and scores. */
export const Task05Panel: React.FC<PanelProps<Task05CaptainView>> = ({ view }) => (
  <div className="grid gap-4 lg:grid-cols-[2fr_1fr]">
    <Card title="Executors" aside={`${view.finalizedCount} / ${view.executors.length} locked · total ${view.totalScore}`}>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-left text-xs text-zinc-500">
            <tr>
              <th className="py-1">Player</th>
              <th>Target</th>
              <th>Attempts (actual · error · score)</th>
              <th>Retries</th>
              <th>Final</th>
            </tr>
          </thead>
          <tbody>
            {view.executors.map((e) => (
              <tr key={e.uid} className="border-t border-zinc-800 align-top">
                <td className="py-2">
                  {e.name}
                  <span className="block text-[10px] text-zinc-500">{SLOT_LABEL[e.slot]}</span>
                </td>
                <td className="py-2 font-mono text-lg text-white">{sec(e.targetMs)}</td>
                <td className="py-2">
                  {e.attempts.length === 0 ? (
                    <span className="text-zinc-600">—</span>
                  ) : (
                    <ol className="space-y-0.5 font-mono text-xs">
                      {e.attempts.map((a) => (
                        <li key={a.attemptId}>
                          #{a.attemptId}: {sec(a.durationMs)} · {a.durationMs >= e.targetMs ? '+' : '−'}{sec(a.errorMs)} · {a.score}
                        </li>
                      ))}
                    </ol>
                  )}
                  <span className="text-[10px] text-zinc-500">{view.maxAttempts - e.attempts.length} left</span>
                </td>
                <td className="py-2">{Math.max(0, e.attempts.length - 1)}</td>
                <td className="py-2">{e.finalized ? <span className="font-semibold text-emerald-300">{e.finalScore}</span> : <span className="text-zinc-600">open</span>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-3 text-xs text-zinc-500">Tell each player their target. Each retry costs points. The task completes when all three have locked in.</p>
    </Card>
    <CaptainLog log={view.log} />
  </div>
);
