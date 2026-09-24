import React, { useState } from 'react';
import { ApiError, isMemberOnline, SLOT_LABEL, type Member, type Slot, type Team } from '@adavya/shared';
import { api, PLAYER_APP_URL } from '../services/api.js';
import { useAuth } from '../context/AuthContext.js';
import { useNow } from '../hooks/usePresence.js';
import { Banner, Button, Card } from '../components/ui.js';
import { NameEditor } from '../components/NameEditor.js';

const SLOTS: Slot[] = ['captain', 'player1', 'player2', 'player3'];

/** Realtime roster; the captain starts task01 once all four members have joined. */
export const Lobby: React.FC<{ team: Team; members: Member[] }> = ({ team, members }) => {
  const { session } = useAuth();
  const now = useNow();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bySlot = new Map(members.map((m) => [m.slot, m]));
  const full = members.length === team.requiredMembers;

  const start = async () => {
    setBusy(true);
    setError(null);
    try {
      await api.startCompetition();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not start.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Card title="Team code">
        <p className="font-mono text-6xl tracking-[0.3em] text-white">{team.teamCode}</p>
        <p className="mt-3 text-sm text-zinc-400">
          Players open <span className="text-zinc-200">{PLAYER_APP_URL}</span> on their phones, sign in, and enter this code.
        </p>
        <div className="mt-4 text-sm text-zinc-400">
          Your name: <NameEditor name={session!.user.displayName} />
        </div>
      </Card>

      <Card title="Lobby" aside={`${members.length} / ${team.requiredMembers}`}>
        <ul className="space-y-2">
          {SLOTS.map((slot) => {
            const m = bySlot.get(slot);
            return (
              <li key={slot} className="flex items-center justify-between rounded-lg border border-zinc-800 bg-zinc-950/60 px-3 py-2">
                <span className="text-xs uppercase tracking-wider text-zinc-500">{SLOT_LABEL[slot]}</span>
                {m ? (
                  <span className="flex items-center gap-2 text-sm">
                    {m.displayName}
                    <span aria-hidden="true" className={`h-2 w-2 rounded-full ${isMemberOnline(m, now) ? 'bg-emerald-400' : 'bg-zinc-600'}`} />
                  </span>
                ) : (
                  <span className="text-sm text-zinc-600">Waiting…</span>
                )}
              </li>
            );
          })}
        </ul>
        <p className="mt-4 text-xs text-zinc-500">
          Members and slots are permanent: nobody can leave or be removed once joined. Starting locks the team and begins Task 1;
          every later task starts automatically.
        </p>
        {error && <div className="mt-3"><Banner tone="error">{error}</Banner></div>}
        <Button className="mt-4 w-full" onClick={start} busy={busy} disabled={!full}>
          {full ? 'Start Task 1' : `Waiting for ${team.requiredMembers - members.length} more`}
        </Button>
      </Card>
    </div>
  );
};
