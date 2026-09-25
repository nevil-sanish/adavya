import React, { useCallback, useEffect, useRef, useState } from 'react';
import { isMemberOnline, SLOT_LABEL, TASK_META, TASK_ORDER, type Member, type PlayerView, type TaskId, type TaskRun, type Team } from '@adavya/shared';
import { useAuth } from '../session.js';
import { useCollection, useDoc } from '../hooks/useFirestore.js';
import { useNow, useOnline, usePresence } from '../hooks/usePresence.js';
import { paths } from '../services/paths.js';
import { sendEvent } from '../services/api.js';
import { Banner, Loading } from '../ui.js';
import { NameField } from './NameField.js';
import { FinalLeaderboards } from './FinalLeaderboards.js';
import { Task01Orientation } from '../tasks/Task01Orientation.js';
import { Task02Gps } from '../tasks/Task02Gps.js';
import { Task03Pose } from '../tasks/Task03Pose.js';
import { Task04Sound } from '../tasks/Task04Sound.js';
import { Task05Timer } from '../tasks/Task05Timer.js';
import { Task06Morse } from '../tasks/Task06Morse.js';

interface TeamProps {
  cid: string;
  teamId: string;
  uid: string;
}

export type Send = <T = Record<string, unknown>>(
  action: string,
  payload?: Record<string, unknown>,
  options?: { dedupeKey?: string }
) => Promise<T & { duplicate: boolean }>;

export interface TaskProps {
  run: TaskRun;
  view: PlayerView;
  send: Send;
  /** The captain is disconnected: the server will reject input until they return. */
  paused: boolean;
  online: boolean;
}

const TASKS: Record<TaskId, React.FC<TaskProps>> = {
  task01: Task01Orientation,
  task02: Task02Gps,
  task03: Task03Pose,
  task04: Task04Sound,
  task05: Task05Timer,
  task06: Task06Morse,
};

/** Player shell: lobby, the current task, or done. Follows live team state, so refresh resumes in place. */
export const PlayerApp: React.FC<TeamProps> = ({ cid, teamId, uid }) => {
  usePresence(cid, teamId, uid);
  const online = useOnline();
  const now = useNow();
  const team = useDoc<Team>(paths.team(cid, teamId));
  const members = useCollection<Member>(paths.members(cid, teamId));

  if (team.loading) return <Loading label="Loading your team…" />;
  if (team.error || !team.data) return <main><Banner tone="error">{team.error ?? 'Your team no longer exists.'}</Banner></main>;

  const t = team.data;
  const captain = members.data.find((m) => m.role === 'CAPTAIN');
  const captainOnline = captain ? isMemberOnline(captain, now) : false;
  const me = members.data.find((m) => m.uid === uid);

  return (
    <main>
      <div className="topbar">
        <span>{t.teamName} · {me ? SLOT_LABEL[me.slot] : ''}</span>
        <span><span className={`dot ${online && !team.fromCache ? 'on' : ''}`} />{online ? (team.fromCache ? 'Syncing' : 'Online') : 'Offline'}</span>
      </div>
      {!online && <Banner tone="warn">You are offline. Reconnect to continue; your progress is saved.</Banner>}
      <CompletedBanner currentTaskId={t.currentTaskId} />

      {t.status === 'LOBBY' && <Lobby team={t} members={members.data} />}
      {t.status === 'IN_PROGRESS' && t.currentTaskId && (
        <CurrentTask key={t.currentTaskId} cid={cid} teamId={teamId} uid={uid} taskId={t.currentTaskId} paused={!captainOnline} online={online} />
      )}
      {t.status === 'COMPLETED' && (
        <>
          <div className="card center">
            <h1>All tasks complete</h1>
            <p className="muted">Great work! Here is how everyone did.</p>
          </div>
          <FinalLeaderboards teamId={teamId} />
        </>
      )}
    </main>
  );
};

/** Announces "Task N complete" for a few seconds when the team moves to the next task. */
const CompletedBanner: React.FC<{ currentTaskId: TaskId | null }> = ({ currentTaskId }) => {
  const previous = useRef(currentTaskId);
  const [done, setDone] = useState<TaskId | null>(null);
  useEffect(() => {
    const before = previous.current;
    previous.current = currentTaskId;
    if (!before || before === currentTaskId) return;
    setDone(before);
    const t = window.setTimeout(() => setDone(null), 8000);
    return () => window.clearTimeout(t);
  }, [currentTaskId]);
  return done ? <Banner tone="ok">Task {TASK_ORDER.indexOf(done) + 1} · {TASK_META[done].title} complete!</Banner> : null;
};

const Lobby: React.FC<{ team: Team; members: Member[] }> = ({ team, members }) => {
  const { session } = useAuth();
  const bySlot = new Map(members.map((m) => [m.slot, m]));
  return (
    <>
      <h1>Lobby</h1>
      <div className="card">
        <p className="muted">Waiting for your captain to start. Keep this page open.</p>
        <ul className="roster">
          {(['captain', 'player1', 'player2', 'player3'] as const).map((slot) => (
            <li key={slot}>
              <span className="muted">{SLOT_LABEL[slot]}</span>
              <span>{bySlot.get(slot)?.displayName ?? '…'}</span>
            </li>
          ))}
        </ul>
        <p className="muted">{members.length} / {team.requiredMembers} joined</p>
      </div>
      <NameField name={session!.user.displayName} />
    </>
  );
};

const CurrentTask: React.FC<TeamProps & { taskId: TaskId; paused: boolean; online: boolean }> = ({ cid, teamId, uid, taskId, paused, online }) => {
  const run = useDoc<TaskRun>(paths.run(cid, teamId, taskId));
  const view = useDoc<PlayerView>(paths.playerView(cid, teamId, taskId, uid));
  const runId = run.data?.runId;
  const knownSeq = view.data?.lastSeq;

  const send = useCallback<Send>(
    (action, payload, options) => {
      if (!runId) return Promise.reject(new Error('The task is still loading.'));
      return sendEvent({ taskId, action, runId, uid, knownSeq, payload, dedupeKey: options?.dedupeKey });
    },
    [taskId, runId, uid, knownSeq]
  );

  if (run.loading || view.loading) return <Loading label="Loading task…" />;
  if (run.error || view.error) return <Banner tone="error">{run.error ?? view.error}</Banner>;
  if (!run.data || !view.data) return <Loading label="Starting the next task…" />;

  const Task = TASKS[taskId];
  return (
    <>
      <div>
        <p className="eyebrow">Task {TASK_ORDER.indexOf(taskId) + 1} of 6</p>
        <h1>{TASK_META[taskId].title}</h1>
      </div>
      <p className="muted">{TASK_META[taskId].player}</p>
      {paused && <Banner tone="warn">Paused: waiting for your captain to reconnect.</Banner>}
      <Task run={run.data} view={view.data} send={send} paused={paused} online={online} />
    </>
  );
};
