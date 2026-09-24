import React, { useState } from 'react';
import { ApiError } from '@adavya/shared';
import { useAuth } from '../context/AuthContext.js';
import { api, PLAYER_APP_URL } from '../services/api.js';
import { Banner, Button, Card } from '../components/ui.js';
import { NameEditor } from '../components/NameEditor.js';

/** A signed-in user without a team: set a name and create a team (becoming its captain). */
export const OnboardingPage: React.FC = () => {
  const { session, refresh, logout } = useAuth();
  const [teamName, setTeamName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api.createTeam(teamName);
      await refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not create the team.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-100 flex items-center justify-center px-6 py-10">
      <div className="w-full max-w-md space-y-4">
        <header className="flex items-center justify-between">
          <div>
            <p className="text-[11px] uppercase tracking-[0.2em] text-zinc-500">Team Challenge</p>
            <h1 className="text-2xl font-semibold tracking-tight">Welcome</h1>
          </div>
          <button type="button" onClick={logout} className="text-xs text-zinc-500 hover:text-zinc-200">
            Sign out
          </button>
        </header>

        <Card title="Your display name">
          <NameEditor name={session!.user.displayName} />
          <p className="mt-2 text-xs text-zinc-500">Teammates see this name. You can change it until your captain starts.</p>
        </Card>

        <Card title="Create a team">
          <form onSubmit={create} className="space-y-3">
            <p className="text-sm text-zinc-400">
              Whoever creates the team is its <strong className="text-zinc-200">captain for the whole competition</strong> and plays from
              this laptop. Your team needs exactly three players, who join from their phones with the four-digit code.
            </p>
            <input
              aria-label="Team name"
              placeholder="Team name"
              value={teamName}
              maxLength={40}
              onChange={(e) => setTeamName(e.target.value)}
              className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm"
            />
            {error && <Banner tone="error">{error}</Banner>}
            <Button type="submit" busy={busy} disabled={teamName.trim().length < 2} className="w-full">
              Create team and become captain
            </Button>
          </form>
        </Card>

        <Card title="Joining a team?">
          <p className="text-sm text-zinc-400">
            Players join on their phone at <a className="text-sky-300 underline" href={PLAYER_APP_URL}>{PLAYER_APP_URL}</a> using the
            code from their captain.
          </p>
        </Card>
      </div>
    </main>
  );
};
