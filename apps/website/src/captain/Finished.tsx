import React from 'react';
import { Trophy } from 'lucide-react';
import { TASK_META, TASK_ORDER, type CaptainSummary } from '@adavya/shared';
import { Card } from '../components/ui.js';

export const Finished: React.FC<{ summary: CaptainSummary | null }> = ({ summary }) => (
  <Card title="All six tasks complete" aside={<Trophy className="h-4 w-4 text-amber-300" />}>
    <p className="text-4xl font-semibold">{summary?.totalScore ?? 0} <span className="text-base text-zinc-400">points</span></p>
    <table className="mt-4 w-full text-sm">
      <thead className="text-left text-xs text-zinc-500">
        <tr><th className="py-1">Task</th><th>Rank</th><th>Points</th></tr>
      </thead>
      <tbody>
        {TASK_ORDER.map((id) => (
          <tr key={id} className="border-t border-zinc-800">
            <td className="py-1.5">{TASK_META[id].title}</td>
            <td>{summary?.tasks[id]?.rank ?? '—'}</td>
            <td>{summary?.tasks[id]?.points ?? '—'}</td>
          </tr>
        ))}
      </tbody>
    </table>
  </Card>
);
