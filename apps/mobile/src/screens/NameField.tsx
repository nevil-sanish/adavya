import React, { useState } from 'react';
import { api } from '../services/api.js';
import { useAuth } from '../session.js';
import { errorText } from '../ui.js';

/** Display name, editable until the captain starts. */
export const NameField: React.FC<{ name: string }> = ({ name }) => {
  const { refresh } = useAuth();
  const [value, setValue] = useState(name);
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  return (
    <form
      className="card"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setStatus(null);
        try {
          await api.updateDisplayName(value);
          await refresh();
          setStatus('Saved.');
        } catch (err) {
          setStatus(errorText(err, 'Could not save.'));
        } finally {
          setBusy(false);
        }
      }}
    >
      <label className="muted" htmlFor="name">Your name</label>
      <div className="row">
        <input id="name" className="text" value={value} maxLength={40} onChange={(e) => setValue(e.target.value)} />
        <button type="submit" className="btn secondary" style={{ flex: '0 0 auto' }} disabled={busy || value.trim() === name}>
          Save
        </button>
      </div>
      {status && <p className="muted" role="status">{status}</p>}
    </form>
  );
};
