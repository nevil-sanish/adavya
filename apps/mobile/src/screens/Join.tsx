import React, { useState } from 'react';
import { useAuth } from '../session.js';
import { api } from '../services/api.js';
import { Banner, errorText } from '../ui.js';
import { NameField } from './NameField.js';

/** Join a lobby with the captain's four-digit code. The slot is permanent. */
export const Join: React.FC = () => {
  const { session, refresh, logout } = useAuth();
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const join = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api.joinTeam(code);
      await refresh();
    } catch (err) {
      setError(errorText(err, 'Could not join.'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <main>
      <div className="topbar">
        <p className="eyebrow">Team Challenge</p>
        <button type="button" className="btn link" onClick={logout}>Sign out</button>
      </div>
      <h1>Join your team</h1>
      <NameField name={session!.user.displayName} />
      <form className="card" onSubmit={join}>
        <label className="muted" htmlFor="code">Four-digit team code from your captain</label>
        <input
          id="code"
          className="text code"
          inputMode="numeric"
          autoComplete="off"
          pattern="\d{4}"
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 4))}
        />
        {error && <Banner tone="error">{error}</Banner>}
        <button type="submit" className="btn" disabled={busy || code.length !== 4}>
          {busy ? 'Joining…' : 'Join team'}
        </button>
        <p className="muted">Once you join you cannot leave or switch teams.</p>
      </form>
      <p className="muted center">Captains create their team on the captain website from a laptop.</p>
    </main>
  );
};
