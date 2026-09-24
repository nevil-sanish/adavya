import React, { useState } from 'react';
import { Check, Pencil } from 'lucide-react';
import { ApiError } from '@adavya/shared';
import { api } from '../services/api.js';
import { useAuth } from '../context/AuthContext.js';

/** Inline display-name editor. The server rejects edits once the team is locked. */
export const NameEditor: React.FC<{ name: string }> = ({ name }) => {
  const { refresh } = useAuth();
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(name);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api.updateDisplayName(value);
      await refresh();
      setEditing(false);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not save your name.');
    } finally {
      setBusy(false);
    }
  };

  if (!editing) {
    return (
      <button
        type="button"
        onClick={() => {
          setValue(name);
          setEditing(true);
        }}
        className="inline-flex items-center gap-1.5 text-sm text-zinc-200 hover:text-white"
      >
        {name} <Pencil aria-label="Edit name" className="h-3.5 w-3.5 text-zinc-500" />
      </button>
    );
  }
  return (
    <form onSubmit={save} className="inline-flex flex-col gap-1">
      <span className="inline-flex items-center gap-2">
        <input
          autoFocus
          aria-label="Display name"
          value={value}
          maxLength={40}
          onChange={(e) => setValue(e.target.value)}
          className="rounded-md border border-zinc-700 bg-zinc-950 px-2 py-1 text-sm text-zinc-100"
        />
        <button type="submit" disabled={busy} aria-label="Save name" className="rounded-md bg-zinc-800 p-1.5 hover:bg-zinc-700">
          <Check className="h-4 w-4" />
        </button>
      </span>
      {error && <span className="text-xs text-red-300">{error}</span>}
    </form>
  );
};
