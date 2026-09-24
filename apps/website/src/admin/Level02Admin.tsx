import React, { useEffect, useState } from 'react';
import { ApiError } from '@adavya/shared';
import { api } from '../services/api.js';
import { Banner, Button, Card } from '../components/ui.js';

export interface LocationRow {
  locationId: string;
  name: string;
  latitude: number | '';
  longitude: number | '';
  radiusMeters: number | '';
  letter: string;
  hint: string;
}

export interface AssignmentConfig {
  locationIds: string[];
  correctLocationIds: string[];
  word: string;
}

export interface TeamReadiness {
  teamId: string;
  teamName: string;
  status: string;
  currentTaskId: string | null;
  task02: { source: 'TEAM' | 'DEFAULT' | 'NONE'; problem: string | null };
}

const DEFAULT_KEY = '_default';
const IDS = Array.from({ length: 10 }, (_, i) => `L${String(i + 1).padStart(2, '0')}`);

function blankRows(): LocationRow[] {
  return IDS.map((locationId) => ({ locationId, name: '', latitude: '', longitude: '', radiusMeters: 25, letter: '', hint: '' }));
}

const errorOf = (err: unknown) => (err instanceof ApiError || err instanceof Error ? err.message : 'Failed.');

/* --------------------------------- locations -------------------------------- */

/**
 * The ten global locations: coordinates, geofence radius, letter and the
 * riddle the captain reads. Correct/decoy is set per team in the assignments.
 */
export const LocationsEditor: React.FC<{ locations: LocationRow[]; problem: string | null; onSaved: () => void }> = ({ locations, problem, onSaved }) => {
  const [rows, setRows] = useState<LocationRow[]>(locations.length === 10 ? locations : blankRows());
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<{ tone: 'error' | 'success'; text: string } | null>(null);
  useEffect(() => {
    if (!dirty) setRows(locations.length === 10 ? locations : blankRows());
  }, [locations, dirty]);

  const update = (i: number, field: keyof LocationRow, value: string) => {
    setDirty(true);
    setRows((rs) =>
      rs.map((r, j) => {
        if (j !== i) return r;
        const numeric = field === 'latitude' || field === 'longitude' || field === 'radiusMeters';
        return { ...r, [field]: numeric ? (value === '' ? '' : Number(value)) : field === 'letter' ? value.toUpperCase().slice(0, 1) : value };
      })
    );
  };

  const fillFromGps = (i: number) => {
    navigator.geolocation?.getCurrentPosition(
      (pos) => {
        setDirty(true);
        setRows((rs) => rs.map((r, j) => (j === i ? { ...r, latitude: Number(pos.coords.latitude.toFixed(6)), longitude: Number(pos.coords.longitude.toFixed(6)) } : r)));
      },
      (err) => setStatus({ tone: 'error', text: `Location unavailable: ${err.message}` }),
      { enableHighAccuracy: true }
    );
  };

  const save = async () => {
    setBusy(true);
    setStatus(null);
    try {
      await api.admin.setLocations(rows);
      setDirty(false);
      setStatus({ tone: 'success', text: 'Locations saved.' });
      onSaved();
    } catch (err) {
      setStatus({ tone: 'error', text: errorOf(err) });
    } finally {
      setBusy(false);
    }
  };

  const cell = 'w-full rounded border border-zinc-700 bg-zinc-950 px-2 py-1 text-xs';
  return (
    <Card title="Level 02 · Locations and riddles (exactly 10)" aside={problem ? 'incomplete' : 'valid'}>
      {problem && !dirty && <div className="mb-3"><Banner tone="warning">{problem}</Banner></div>}
      <div className="overflow-x-auto">
        <table className="w-full min-w-[980px] text-xs">
          <thead className="text-left text-zinc-500">
            <tr>
              <th className="py-1">ID</th><th>Name</th><th>Latitude</th><th>Longitude</th><th>Radius m</th><th>Letter</th><th className="w-[36%]">Riddle / hint (shown to the captain)</th><th />
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={r.locationId} className="align-top">
                <td className="py-1 pr-2 font-mono text-zinc-400">{r.locationId}</td>
                <td className="pr-2"><input aria-label={`${r.locationId} name`} className={cell} value={r.name} onChange={(e) => update(i, 'name', e.target.value)} /></td>
                <td className="pr-2"><input aria-label={`${r.locationId} latitude`} className={cell} type="number" step="0.000001" value={r.latitude} onChange={(e) => update(i, 'latitude', e.target.value)} /></td>
                <td className="pr-2"><input aria-label={`${r.locationId} longitude`} className={cell} type="number" step="0.000001" value={r.longitude} onChange={(e) => update(i, 'longitude', e.target.value)} /></td>
                <td className="pr-2"><input aria-label={`${r.locationId} radius`} className={`${cell} w-16`} type="number" min={5} value={r.radiusMeters} onChange={(e) => update(i, 'radiusMeters', e.target.value)} /></td>
                <td className="pr-2"><input aria-label={`${r.locationId} letter`} className={`${cell} w-10 text-center font-mono`} value={r.letter} onChange={(e) => update(i, 'letter', e.target.value)} /></td>
                <td className="pr-2"><textarea aria-label={`${r.locationId} riddle`} rows={2} className={cell} value={r.hint} onChange={(e) => update(i, 'hint', e.target.value)} /></td>
                <td><button type="button" className="whitespace-nowrap text-sky-300 hover:underline" onClick={() => fillFromGps(i)}>Use my position</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-xs text-zinc-500">
        Editing a riddle changes nothing else. Teams already playing Level 02 keep the configuration they started with. Tip: stand at a spot with this page open on a
        phone and press “Use my position”.
      </p>
      <div className="mt-3 flex items-center gap-3">
        <Button onClick={save} busy={busy} disabled={!dirty}>Save locations</Button>
        {status && <span className={`text-xs ${status.tone === 'error' ? 'text-red-300' : 'text-emerald-300'}`}>{status.text}</span>}
      </div>
    </Card>
  );
};

/* -------------------------------- assignments ------------------------------- */

const empty: AssignmentConfig = { locationIds: [], correctLocationIds: [], word: '' };

const AssignmentForm: React.FC<{
  keyName: string;
  label: string;
  locations: LocationRow[];
  initial: AssignmentConfig | undefined;
  removable: boolean;
  onSaved: () => void;
}> = ({ keyName, label, locations, initial, removable, onSaved }) => {
  const [value, setValueRaw] = useState<AssignmentConfig>(initial ?? empty);
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<{ tone: 'error' | 'success'; text: string } | null>(null);
  const byId = new Map(locations.map((l) => [l.locationId, l]));
  const setValue: typeof setValueRaw = (v) => {
    setDirty(true);
    setValueRaw(v);
  };
  // The overview is re-polled; only adopt the saved value when the admin is not editing.
  const saved = JSON.stringify(initial ?? empty);
  useEffect(() => {
    if (!dirty) setValueRaw(JSON.parse(saved) as AssignmentConfig);
  }, [saved, dirty]);

  const toggleAssigned = (id: string) =>
    setValue((v) =>
      v.locationIds.includes(id)
        ? { ...v, locationIds: v.locationIds.filter((x) => x !== id), correctLocationIds: v.correctLocationIds.filter((x) => x !== id) }
        : v.locationIds.length < 5
          ? { ...v, locationIds: [...v.locationIds, id] }
          : v
    );
  const toggleCorrect = (id: string) =>
    setValue((v) =>
      v.correctLocationIds.includes(id)
        ? { ...v, correctLocationIds: v.correctLocationIds.filter((x) => x !== id) }
        : v.correctLocationIds.length < 3
          ? { ...v, correctLocationIds: [...v.correctLocationIds, id] }
          : v
    );

  const correctLetters = value.correctLocationIds.map((id) => byId.get(id)?.letter ?? '?').join('');

  const save = async () => {
    setBusy(true);
    setStatus(null);
    try {
      await api.admin.setAssignment(keyName, value);
      setDirty(false);
      setStatus({ tone: 'success', text: 'Saved.' });
      onSaved();
    } catch (err) {
      setStatus({ tone: 'error', text: errorOf(err) });
    } finally {
      setBusy(false);
    }
  };
  const remove = async () => {
    setBusy(true);
    try {
      await api.admin.deleteAssignment(keyName);
      setDirty(false);
      setStatus({ tone: 'success', text: 'Removed: this team now uses the default.' });
      onSaved();
    } catch (err) {
      setStatus({ tone: 'error', text: errorOf(err) });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rounded-lg border border-zinc-800 p-3">
      <h3 className="mb-2 text-sm font-semibold text-zinc-200">{label}</h3>
      <p className="mb-2 text-xs text-zinc-500">
        Tick five locations in the order the captain should see their riddles, then mark the three correct ones. The other two are decoys.
      </p>
      <ul className="grid gap-1 sm:grid-cols-2">
        {locations.map((l) => {
          const pos = value.locationIds.indexOf(l.locationId);
          const assigned = pos !== -1;
          return (
            <li key={l.locationId} className={`flex items-center gap-2 rounded px-2 py-1 text-xs ${assigned ? 'bg-zinc-800' : ''}`}>
              <input type="checkbox" aria-label={`Assign ${l.locationId}`} checked={assigned} onChange={() => toggleAssigned(l.locationId)} />
              <span className="w-6 font-mono text-zinc-500">{assigned ? `#${pos + 1}` : ''}</span>
              <span className="font-mono">{l.locationId}</span>
              <span className="font-mono text-zinc-300">{l.letter || '·'}</span>
              <span className="flex-1 truncate text-zinc-400">{l.name}</span>
              {assigned && (
                <label className="flex items-center gap-1 text-emerald-300">
                  <input type="checkbox" checked={value.correctLocationIds.includes(l.locationId)} onChange={() => toggleCorrect(l.locationId)} /> correct
                </label>
              )}
            </li>
          );
        })}
      </ul>
      <div className="mt-2 flex flex-wrap items-center gap-3 text-xs">
        <span className="text-zinc-400">{value.locationIds.length}/5 assigned · {value.correctLocationIds.length}/3 correct · letters <span className="font-mono text-zinc-200">{correctLetters || '—'}</span></span>
        <label className="flex items-center gap-2">
          Word
          <input
            aria-label={`${label} word`}
            value={value.word}
            onChange={(e) => setValue((v) => ({ ...v, word: e.target.value.replace(/[^a-z]/gi, '').slice(0, 3).toUpperCase() }))}
            className="w-20 rounded border border-zinc-700 bg-zinc-950 px-2 py-1 text-center font-mono tracking-widest"
          />
        </label>
        <Button onClick={save} busy={busy}>Save</Button>
        {removable && <Button variant="secondary" onClick={remove} disabled={busy}>Use default</Button>}
        {status && <span className={status.tone === 'error' ? 'text-red-300' : 'text-emerald-300'}>{status.text}</span>}
      </div>
    </div>
  );
};

/**
 * Per-team assignment: five of the ten locations, three correct (their letters
 * form the word) and two decoys. `_default` covers every team without its own.
 * A team cannot start until its assignment is valid.
 */
export const AssignmentsEditor: React.FC<{
  locations: LocationRow[];
  assignments: Record<string, AssignmentConfig>;
  teams: TeamReadiness[];
  onSaved: () => void;
}> = ({ locations, assignments, teams, onSaved }) => {
  const [openTeam, setOpenTeam] = useState<string | null>(null);
  const ready = teams.filter((t) => !t.task02.problem).length;
  return (
    <Card title="Level 02 · Team assignments" aside={`${ready} / ${teams.length} teams ready`}>
      {locations.length !== 10 ? (
        <Banner tone="warning">Configure the ten locations first.</Banner>
      ) : (
        <div className="space-y-4">
          <AssignmentForm keyName={DEFAULT_KEY} label="Default (every team without its own)" locations={locations} initial={assignments[DEFAULT_KEY]} removable={false} onSaved={onSaved} />
          <table className="w-full text-xs">
            <thead className="text-left text-zinc-500">
              <tr><th className="py-1">Team</th><th>Uses</th><th>Level 02 readiness</th><th /></tr>
            </thead>
            <tbody>
              {teams.map((t) => (
                <React.Fragment key={t.teamId}>
                  <tr className="border-t border-zinc-800">
                    <td className="py-1.5">{t.teamName}</td>
                    <td>{t.task02.source === 'TEAM' ? 'own assignment' : t.task02.source === 'DEFAULT' ? 'default' : '—'}</td>
                    <td className={t.task02.problem ? 'text-red-300' : 'text-emerald-300'}>{t.task02.problem ?? 'ready'}</td>
                    <td className="text-right">
                      <button type="button" className="text-sky-300 hover:underline" onClick={() => setOpenTeam(openTeam === t.teamId ? null : t.teamId)}>
                        {openTeam === t.teamId ? 'Close' : 'Assign'}
                      </button>
                    </td>
                  </tr>
                  {openTeam === t.teamId && (
                    <tr>
                      <td colSpan={4} className="py-2">
                        <AssignmentForm
                          keyName={t.teamId}
                          label={`${t.teamName}${t.currentTaskId && t.currentTaskId !== 'task01' ? ' (already past Level 01: changes apply only if Level 02 has not started)' : ''}`}
                          locations={locations}
                          initial={assignments[t.teamId] ?? assignments[DEFAULT_KEY]}
                          removable={t.task02.source === 'TEAM'}
                          onSaved={onSaved}
                        />
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
};
