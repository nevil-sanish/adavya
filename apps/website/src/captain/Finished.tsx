import React, { useEffect, useState } from 'react';
import { Flag, Trophy } from 'lucide-react';
import { ApiError, formatDuration, TASK_META, type CaptainSummary, type Leaderboards, type TaskId } from '@adavya/shared';
import { api } from '../services/api.js';
import { Banner, Card } from '../components/ui.js';

const REFRESH_MS = 15_000;

/** Final leaderboards; refreshed while other teams are still finishing. */
function useLeaderboards(): { boards: Leaderboards | null; error: string | null } {
  const [boards, setBoards] = useState<Leaderboards | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    const load = () =>
      api
        .leaderboard()
        .then((b) => alive && (setBoards(b), setError(null)))
        .catch((err) => alive && setError(err instanceof ApiError ? err.message : 'Could not load the leaderboard.'));
    void load();
    const t = window.setInterval(load, REFRESH_MS);
    return () => {
      alive = false;
      window.clearInterval(t);
    };
  }, []);
  return { boards, error };
}

const rowClass = (mine: boolean) => `border-t border-zinc-800 ${mine ? 'bg-amber-400/10 text-amber-100' : ''}`;

export const Finished: React.FC<{ summary: CaptainSummary | null; teamId: string; tasks: readonly TaskId[] }> = ({ summary, teamId, tasks }) => {
  const { boards, error } = useLeaderboards();
  const myPoints = boards?.points.find((s) => s.teamId === teamId);
  const myFinish = boards?.finishOrder.find((s) => s.teamId === teamId);

  return (
    <div className="space-y-4">
      <Card title="All tasks complete" aside={<Trophy className="h-4 w-4 text-amber-300" />}>
        <div className="flex flex-wrap items-end gap-x-10 gap-y-2">
          <p className="text-4xl font-semibold">
            {summary?.totalScore ?? 0} <span className="text-base text-zinc-400">points</span>
          </p>
          {myPoints && <p className="text-sm text-zinc-300">#{myPoints.rank} on points</p>}
          {myFinish?.rank && (
            <p className="text-sm text-zinc-300">
              #{myFinish.rank} to finish · {formatDuration(myFinish.durationMs)}
            </p>
          )}
        </div>
        <table className="mt-4 w-full text-sm">
          <thead className="text-left text-xs text-zinc-500">
            <tr><th className="py-1">Task</th><th>Rank</th><th>Points</th></tr>
          </thead>
          <tbody>
            {tasks.map((id) => (
              <tr key={id} className="border-t border-zinc-800">
                <td className="py-1.5">{TASK_META[id].title}</td>
                <td>{summary?.tasks[id]?.rank ?? '—'}</td>
                <td>{summary?.tasks[id]?.points ?? '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      {error && <Banner tone="error">{error}</Banner>}
      {boards && (
        <div className="grid gap-4 lg:grid-cols-2">
          <Card title="Leaderboard · points" aside={<Trophy className="h-4 w-4 text-amber-300" />}>
            <table className="w-full text-sm">
              <thead className="text-left text-xs text-zinc-500">
                <tr><th className="py-1">#</th><th>Team</th><th className="text-right">Points</th><th className="text-right">Tasks</th></tr>
              </thead>
              <tbody>
                {boards.points.map((s) => (
                  <tr key={s.teamId} className={rowClass(s.teamId === teamId)}>
                    <td className="py-1.5 font-mono">{s.rank}</td>
                    <td>{s.teamName}{s.teamId === teamId && <span className="ml-2 text-[10px] uppercase text-amber-300">you</span>}</td>
                    <td className="text-right font-semibold">{s.totalScore}</td>
                    <td className="text-right text-zinc-400">{s.tasksCompleted}/6</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="mt-2 text-xs text-zinc-500">Equal points are ranked by who finished first.</p>
          </Card>

          <Card title="Leaderboard · first to finish" aside={<Flag className="h-4 w-4 text-sky-300" />}>
            <table className="w-full text-sm">
              <thead className="text-left text-xs text-zinc-500">
                <tr><th className="py-1">#</th><th>Team</th><th className="text-right">Finished</th><th className="text-right">Total time</th></tr>
              </thead>
              <tbody>
                {boards.finishOrder.map((s) => (
                  <tr key={s.teamId} className={rowClass(s.teamId === teamId)}>
                    <td className="py-1.5 font-mono">{s.rank ?? '—'}</td>
                    <td>{s.teamName}{s.teamId === teamId && <span className="ml-2 text-[10px] uppercase text-amber-300">you</span>}</td>
                    <td className="text-right text-zinc-300">
                      {s.finished && s.completedAtMs
                        ? new Date(s.completedAtMs).toLocaleTimeString()
                        : `playing ${s.currentTaskId ? TASK_META[s.currentTaskId as TaskId].short : ''}`}
                    </td>
                    <td className="text-right font-mono">{formatDuration(s.durationMs)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="mt-2 text-xs text-zinc-500">Time from starting the first task to completing the last. Updates as other teams finish.</p>
          </Card>
        </div>
      )}
    </div>
  );
};
