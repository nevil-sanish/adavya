import React from 'react';
import { LogOut } from 'lucide-react';
import { teamTasks, type CaptainSummary, type Member, type Team } from '@adavya/shared';
import { useAuth } from '../context/AuthContext.js';
import { useCollection, useDoc } from '../hooks/useFirestore.js';
import { useOnline, usePresence } from '../hooks/usePresence.js';
import { paths } from '../services/paths.js';
import { Banner, FullScreenMessage } from '../components/ui.js';
import { Lobby } from './Lobby.js';
import { Monitor } from './Monitor.js';
import { Finished } from './Finished.js';
import { MemberStrip } from './MemberStrip.js';

export interface TeamProps {
  cid: string;
  teamId: string;
  uid: string;
}

/**
 * Captain shell. Everything is driven by live Firestore state, so a refresh or
 * re-login lands on the same screen: lobby, current task, or final results.
 */
export const CaptainApp: React.FC<TeamProps> = ({ cid, teamId, uid }) => {
  const { logout } = useAuth();
  usePresence(cid, teamId, uid);
  const online = useOnline();
  const team = useDoc<Team>(paths.team(cid, teamId));
  const members = useCollection<Member>(paths.members(cid, teamId));
  const summary = useDoc<CaptainSummary>(paths.summary(cid, teamId));

  if (team.loading) return <FullScreenMessage title="Loading your team…" spinner />;
  if (team.error) return <FullScreenMessage title="Cannot load your team">{team.error}</FullScreenMessage>;
  if (!team.data) return <FullScreenMessage title="Team not found">Your team no longer exists. Contact the organizers.</FullScreenMessage>;

  const t = team.data;
  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <header className="border-b border-zinc-800 bg-zinc-950/80 backdrop-blur sticky top-0 z-10">
        <div className="mx-auto max-w-6xl px-6 py-3 flex flex-wrap items-center gap-x-6 gap-y-2">
          <div>
            <p className="text-[11px] uppercase tracking-[0.2em] text-zinc-500">Captain</p>
            <h1 className="text-lg font-semibold tracking-tight">{t.teamName}</h1>
          </div>
          <div className="text-sm text-zinc-400">
            Code <span className="font-mono text-zinc-100 tracking-widest">{t.teamCode}</span>
          </div>
          {t.status !== 'LOBBY' && (
            <div className="text-sm text-zinc-400">
              Score <span className="font-semibold text-zinc-100">{summary.data?.totalScore ?? 0}</span>
            </div>
          )}
          <MemberStrip members={members.data} className="ml-auto" />
          <button type="button" onClick={logout} aria-label="Sign out" className="text-zinc-500 hover:text-zinc-200">
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-6 space-y-4">
        {!online ? (
          <Banner tone="warning">You are offline. The game is paused for your team until you reconnect.</Banner>
        ) : team.fromCache ? (
          <Banner tone="info">Reconnecting to the game server…</Banner>
        ) : null}

        {t.status === 'LOBBY' && <Lobby team={t} members={members.data} />}
        {t.status === 'IN_PROGRESS' && t.currentTaskId && (
          <Monitor key={t.currentTaskId} cid={cid} teamId={teamId} uid={uid} taskId={t.currentTaskId} tasks={teamTasks(t)} members={members.data} summary={summary.data} />
        )}
        {t.status === 'COMPLETED' && <Finished summary={summary.data} teamId={teamId} tasks={teamTasks(t)} />}
      </main>
    </div>
  );
};
