import React, { useEffect, useState } from 'react';
import { ApiError, formatDuration, TASK_META, type Leaderboards, type TaskId } from '@adavya/shared';
import { api } from '../services/api.js';
import { Banner } from '../ui.js';

const REFRESH_MS = 15_000;

/** Both final leaderboards, shown once the team has completed all six tasks. Refreshes while others finish. */
export const FinalLeaderboards: React.FC<{ teamId: string }> = ({ teamId }) => {
  const [boards, setBoards] = useState<Leaderboards | null>(null);
  const [tab, setTab] = useState<'points' | 'finish'>('points');
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

  if (error) return <Banner tone="error">{error}</Banner>;
  if (!boards) return <p className="muted center">Loading leaderboard…</p>;

  const mine = (id: string) => (id === teamId ? { fontWeight: 700, color: '#fde68a' } : undefined);
  return (
    <div className="card">
      <div className="row">
        <button type="button" className={`btn ${tab === 'points' ? '' : 'secondary'}`} onClick={() => setTab('points')}>Points</button>
        <button type="button" className={`btn ${tab === 'finish' ? '' : 'secondary'}`} onClick={() => setTab('finish')}>First to finish</button>
      </div>
      {tab === 'points' ? (
        <>
          <ol className="roster" aria-label="Points leaderboard">
            {boards.points.map((s) => (
              <li key={s.teamId} style={mine(s.teamId)}>
                <span>#{s.rank} {s.teamName}</span>
                <span>{s.totalScore} pts</span>
              </li>
            ))}
          </ol>
          <p className="muted">Equal points are ranked by who finished first.</p>
        </>
      ) : (
        <>
          <ol className="roster" aria-label="Finish-order leaderboard">
            {boards.finishOrder.map((s) => (
              <li key={s.teamId} style={mine(s.teamId)}>
                <span>{s.rank ? `#${s.rank}` : '—'} {s.teamName}</span>
                <span>{s.finished ? formatDuration(s.durationMs) : `on ${s.currentTaskId ? TASK_META[s.currentTaskId as TaskId].short : '…'}`}</span>
              </li>
            ))}
          </ol>
          <p className="muted">Total time from Task 1 to Task 6. Updates as other teams finish.</p>
        </>
      )}
    </div>
  );
};
