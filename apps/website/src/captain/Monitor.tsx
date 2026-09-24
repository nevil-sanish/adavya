import React from 'react';
import { CheckCircle2 } from 'lucide-react';
import { TASK_META, TASK_ORDER, type CaptainLogEntry, type CaptainSummary, type CaptainView, type Member, type TaskId, type TaskRun } from '@adavya/shared';
import { useDoc } from '../hooks/useFirestore.js';
import { useNow } from '../hooks/usePresence.js';
import { paths } from '../services/paths.js';
import { Banner, Card, FullScreenMessage } from '../components/ui.js';
import { offlineMembers } from './MemberStrip.js';
import type { TeamProps } from './CaptainApp.js';
import { Task01Panel } from './tasks/Task01Panel.js';
import { Task02Panel } from './tasks/Task02Panel.js';
import { Task03Panel } from './tasks/Task03Panel.js';
import { Task04Panel } from './tasks/Task04Panel.js';
import { Task05Panel } from './tasks/Task05Panel.js';
import { Task06Panel } from './tasks/Task06Panel.js';

export interface PanelProps<V extends CaptainView = CaptainView> extends TeamProps {
  run: TaskRun;
  view: V;
  members: Member[];
}

const PANELS: Record<TaskId, React.FC<PanelProps<any>>> = {
  task01: Task01Panel,
  task02: Task02Panel,
  task03: Task03Panel,
  task04: Task04Panel,
  task05: Task05Panel,
  task06: Task06Panel,
};

/** Captain monitor for the current task. Mounted per task id, so listeners follow the task. */
export const Monitor: React.FC<TeamProps & { taskId: TaskId; members: Member[]; summary: CaptainSummary | null }> = ({
  taskId,
  members,
  summary,
  ...team
}) => {
  const now = useNow();
  const run = useDoc<TaskRun>(paths.run(team.cid, team.teamId, taskId));
  const view = useDoc<CaptainView>(paths.captainView(team.cid, team.teamId, taskId));
  const index = TASK_ORDER.indexOf(taskId);
  const previous = index > 0 ? summary?.tasks[TASK_ORDER[index - 1]] : undefined;
  const offline = offlineMembers(members, now).filter((m) => m.uid !== team.uid);
  const Panel = PANELS[taskId];

  if (run.loading || view.loading) return <FullScreenMessage title="Loading task…" spinner />;
  if (run.error || view.error) return <Banner tone="error">{run.error ?? view.error}</Banner>;
  if (!run.data || !view.data) return <FullScreenMessage title="Starting task…" spinner />;

  return (
    <div className="space-y-4">
      <ol className="grid grid-cols-6 gap-2" aria-label="Task progress">
        {TASK_ORDER.map((id, i) => {
          const done = summary?.tasks[id];
          const current = id === taskId;
          return (
            <li
              key={id}
              aria-current={current ? 'step' : undefined}
              className={`rounded-lg border px-3 py-2 text-xs ${
                current ? 'border-white/60 bg-zinc-800 text-white' : done ? 'border-emerald-700/50 bg-emerald-950/30 text-emerald-200' : 'border-zinc-800 text-zinc-500'
              }`}
            >
              <span className="block font-mono text-[10px] opacity-70">Task {i + 1}</span>
              <span className="flex items-center gap-1">
                {done && <CheckCircle2 aria-hidden="true" className="h-3 w-3" />}
                {TASK_META[id].short}
              </span>
              {done && <span className="block text-[10px] opacity-80">Rank {done.rank} · +{done.points}</span>}
            </li>
          );
        })}
      </ol>

      {previous && index > 0 && Date.now() - previous.completedAtMs < 20_000 && (
        <Banner tone="success">
          {TASK_META[TASK_ORDER[index - 1]].title} complete — rank {previous.rank}, +{previous.points} points. {TASK_META[taskId].title} has started.
        </Banner>
      )}
      {offline.length > 0 && (
        <Banner tone="warning">
          Waiting for {offline.map((m) => m.displayName).join(', ')} to reconnect. Their part of the task is paused; nothing is lost.
        </Banner>
      )}

      <Card title={`Task ${index + 1} · ${TASK_META[taskId].title}`}>
        <p className="text-sm text-zinc-400">{TASK_META[taskId].captain}</p>
      </Card>

      <Panel {...team} run={run.data} view={view.data} members={members} />
    </div>
  );
};

/** Shared captain log (newest first). */
export const CaptainLog: React.FC<{ log: CaptainLogEntry[] | undefined }> = ({ log }) => (
  <Card title="Activity">
    {!log?.length ? (
      <p className="text-sm text-zinc-500">Nothing yet.</p>
    ) : (
      <ul className="space-y-1.5 text-sm" aria-live="polite">
        {[...log].reverse().map((e, i) => (
          <li key={`${e.at}-${i}`} className="flex gap-2">
            <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${e.kind === 'ACCEPTED' ? 'bg-emerald-400' : e.kind === 'REJECTED' ? 'bg-red-400' : 'bg-sky-400'}`} />
            <span className="text-zinc-300">{e.message}</span>
            <span className="ml-auto shrink-0 font-mono text-[11px] text-zinc-600">{new Date(e.at).toLocaleTimeString()}</span>
          </li>
        ))}
      </ul>
    )}
  </Card>
);
