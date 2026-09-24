import React, { useCallback, useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { RefreshCw } from 'lucide-react';
import { ApiError, SLOT_LABEL, TASK_META, TASK_ORDER, type Slot, type TaskId } from '@adavya/shared';
import { useAuth } from '../context/AuthContext.js';
import { api } from '../services/api.js';
import { Banner, Button, Card, FullScreenMessage } from '../components/ui.js';
import { AssignmentsEditor, LocationsEditor, type AssignmentConfig, type LocationRow } from './Level02Admin.js';

interface Overview {
  competitionId: string;
  competition: { name: string; status: 'DRAFT' | 'ACTIVE' | 'CLOSED'; scoringPolicy: unknown; taskOrder: TaskId[] } | null;
  locations: LocationRow[];
  locationsProblem: string | null;
  assignments: Record<string, AssignmentConfig>;
  taskConfigs: Record<TaskId, unknown>;
  teams: Array<{
    teamId: string;
    teamName: string;
    teamCode: string;
    status: string;
    currentTaskId: TaskId | null;
    memberCount: number;
    totalScore: number;
    task02: { source: 'TEAM' | 'DEFAULT' | 'NONE'; problem: string | null };
    members: Array<{ uid: string; displayName: string; slot: Slot; lastSeenAtMs: number | null }>;
  }>;
  results: Record<TaskId, Array<{ teamName: string; rank: number; points: number; completedAtMs: number; durationMs: number }>>;
}

const json = (v: unknown) => JSON.stringify(v, null, 2);

/** Operator console: competition status, scoring, Task 2 locations, task configs, teams and rankings. */
export const AdminPage: React.FC = () => {
  const { session, loading } = useAuth();
  const [data, setData] = useState<Overview | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setData(await api.admin.overview<Overview>());
      setError(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not load the overview.');
    }
  }, []);

  useEffect(() => {
    if (!session?.isAdmin) return;
    void load();
    const t = window.setInterval(load, 10_000);
    return () => window.clearInterval(t);
  }, [session?.isAdmin, load]);

  if (loading) return <FullScreenMessage title="Loading…" spinner />;
  if (!session) return <Navigate to="/login" replace />;
  if (!session.isAdmin) return <FullScreenMessage title="Administrators only">Your account is not listed in ADMIN_EMAILS.</FullScreenMessage>;

  return (
    <main className="mx-auto max-w-6xl space-y-4 px-6 py-6 text-zinc-100">
      <header className="flex items-center justify-between">
        <div>
          <p className="text-[11px] uppercase tracking-[0.2em] text-zinc-500">Admin · {data?.competitionId}</p>
          <h1 className="text-2xl font-semibold">{data?.competition?.name ?? 'Competition'}</h1>
        </div>
        <Button variant="secondary" onClick={load}>
          <RefreshCw className="h-4 w-4" /> Refresh
        </Button>
      </header>
      {error && <Banner tone="error">{error}</Banner>}
      {data && !data.competition && <Banner tone="warning">The competition does not exist yet. Run <code>npm run setup</code> in apps/api.</Banner>}
      {data?.competition && (
        <>
          <StatusCard status={data.competition.status} onChange={load} />
          <TeamsCard teams={data.teams} />
          <ResultsCard results={data.results} />
          <LocationsEditor locations={data.locations} problem={data.locationsProblem} onSaved={load} />
          <AssignmentsEditor locations={data.locations} assignments={data.assignments} teams={data.teams} onSaved={load} />
          <JsonEditor
            title="Scoring policy"
            initial={json(data.competition.scoringPolicy)}
            onSave={(v) => api.admin.updateCompetition({ scoringPolicy: JSON.parse(v) })}
            onSaved={load}
            help="pointsByRank maps dense rank to points; tieWindowMs groups completions within that window of a group's first completion."
          />
          {TASK_ORDER.map((taskId) => (
            <JsonEditor
              key={taskId}
              title={`${taskId} · ${TASK_META[taskId].title} configuration`}
              initial={json(data.taskConfigs[taskId])}
              onSave={(v) => api.admin.setTaskConfig(taskId, JSON.parse(v))}
              onSaved={load}
              help="Applies to runs started after saving."
            />
          ))}
        </>
      )}
    </main>
  );
};

const StatusCard: React.FC<{ status: string; onChange: () => void }> = ({ status, onChange }) => {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const set = async (next: string) => {
    setBusy(true);
    setError(null);
    try {
      await api.admin.updateCompetition({ status: next });
      onChange();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed.');
    } finally {
      setBusy(false);
    }
  };
  return (
    <Card title="Status" aside={status}>
      <div className="flex flex-wrap gap-2">
        {(['DRAFT', 'ACTIVE', 'CLOSED'] as const).map((s) => (
          <Button key={s} variant={s === status ? 'primary' : 'secondary'} disabled={busy || s === status} onClick={() => set(s)}>
            {s}
          </Button>
        ))}
      </div>
      <p className="mt-2 text-xs text-zinc-500">Captains can start only while ACTIVE. CLOSED stops new team registration.</p>
      {error && <div className="mt-2"><Banner tone="error">{error}</Banner></div>}
    </Card>
  );
};

const TeamsCard: React.FC<{ teams: Overview['teams'] }> = ({ teams }) => (
  <Card title="Teams" aside={`${teams.length}`}>
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="text-left text-xs text-zinc-500">
          <tr><th className="py-1">Team</th><th>Code</th><th>Status</th><th>Task</th><th>Score</th><th>Members (last seen)</th></tr>
        </thead>
        <tbody>
          {teams.map((t) => (
            <tr key={t.teamId} className="border-t border-zinc-800 align-top">
              <td className="py-2">{t.teamName}</td>
              <td className="font-mono">{t.teamCode}</td>
              <td>{t.status}</td>
              <td>{t.currentTaskId ?? '—'}</td>
              <td className="font-semibold">{t.totalScore}</td>
              <td className="text-xs text-zinc-400">
                {t.members.map((m) => (
                  <div key={m.uid}>
                    {SLOT_LABEL[m.slot]}: {m.displayName}{' '}
                    <span className="text-zinc-600">{m.lastSeenAtMs ? `${Math.round((Date.now() - m.lastSeenAtMs) / 1000)} s ago` : ''}</span>
                  </div>
                ))}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  </Card>
);

const ResultsCard: React.FC<{ results: Overview['results'] }> = ({ results }) => (
  <Card title="Completion ranking by task">
    <div className="grid gap-4 md:grid-cols-3">
      {TASK_ORDER.map((taskId) => (
        <div key={taskId}>
          <h3 className="mb-1 text-xs font-semibold text-zinc-400">{taskId} · {TASK_META[taskId].short}</h3>
          {results[taskId]?.length ? (
            <ol className="space-y-0.5 text-xs">
              {results[taskId].map((r, i) => (
                <li key={i} className="flex justify-between gap-2">
                  <span>#{r.rank} {r.teamName}</span>
                  <span className="text-zinc-500">{(r.durationMs / 1000).toFixed(1)} s · +{r.points}</span>
                </li>
              ))}
            </ol>
          ) : (
            <p className="text-xs text-zinc-600">No completions.</p>
          )}
        </div>
      ))}
    </div>
  </Card>
);

const JsonEditor: React.FC<{ title: string; initial: string; help: string; onSave: (value: string) => Promise<unknown>; onSaved: () => void }> = ({
  title,
  initial,
  help,
  onSave,
  onSaved,
}) => {
  const [value, setValue] = useState(initial);
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<{ tone: 'error' | 'success'; text: string } | null>(null);
  useEffect(() => {
    if (!dirty) setValue(initial);
  }, [initial, dirty]);

  const save = async () => {
    setBusy(true);
    setStatus(null);
    try {
      await onSave(value);
      setDirty(false);
      setStatus({ tone: 'success', text: 'Saved.' });
      onSaved();
    } catch (err) {
      setStatus({ tone: 'error', text: err instanceof SyntaxError ? `Invalid JSON: ${err.message}` : err instanceof Error ? err.message : 'Failed.' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card title={title}>
      <details>
        <summary className="cursor-pointer text-xs text-zinc-400">Edit</summary>
        <p className="my-2 text-xs text-zinc-500">{help}</p>
        <textarea
          aria-label={title}
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
            setDirty(true);
          }}
          spellCheck={false}
          className="h-64 w-full rounded-lg border border-zinc-700 bg-zinc-950 p-3 font-mono text-xs"
        />
        <div className="mt-2 flex items-center gap-3">
          <Button onClick={save} busy={busy} disabled={!dirty}>Save</Button>
          {status && <span className={`text-xs ${status.tone === 'error' ? 'text-red-300' : 'text-emerald-300'}`}>{status.text}</span>}
        </div>
      </details>
    </Card>
  );
};
