import type { Session, TaskId } from './model.ts';

export class ApiError extends Error {
  code: string;
  status: number;

  constructor(message: string, code: string, status: number) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.status = status;
  }

  /** Network failures and busy servers are safe to retry with the same idempotency key. */
  get retryable(): boolean {
    return this.code === 'NETWORK_ERROR' || this.code === 'BUSY' || this.status >= 500;
  }
}

export interface EventEnvelope {
  runId: string;
  clientEventId: string;
  clientSeq: number;
  payload: Record<string, unknown>;
}

/** Typed client for apps/api. `getToken` returns the current Firebase ID token. */
export function createApi(baseUrl: string, getToken: () => Promise<string | null>) {
  async function request<T>(path: string, init: { method?: string; body?: unknown; token?: string } = {}): Promise<T> {
    const token = init.token ?? (await getToken());
    let response: Response;
    try {
      response = await fetch(`${baseUrl}/api${path}`, {
        method: init.method ?? 'GET',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: init.body === undefined ? undefined : JSON.stringify(init.body),
      });
    } catch {
      throw new ApiError('Cannot reach the game server. Check your connection.', 'NETWORK_ERROR', 0);
    }
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new ApiError(data.message || `Request failed (${response.status}).`, data.error || 'REQUEST_FAILED', response.status);
    }
    return data as T;
  }

  return {
    login: (idToken: string) => request<Session>('/auth/google', { method: 'POST', body: { idToken }, token: '' }),
    session: () => request<Session>('/auth/me'),
    updateDisplayName: (displayName: string) => request<{ displayName: string }>('/auth/me', { method: 'PATCH', body: { displayName } }),
    createTeam: (teamName: string) =>
      request<{ teamId: string; teamCode: string; competitionId: string }>('/teams/create', { method: 'POST', body: { teamName } }),
    joinTeam: (code: string) => request<{ teamId: string; slot: string; competitionId: string }>('/teams/join', { method: 'POST', body: { code } }),
    startCompetition: () => request<{ started: boolean }>('/teams/start', { method: 'POST' }),
    submit: <T = Record<string, unknown>>(taskId: TaskId, action: string, envelope: EventEnvelope) =>
      request<T & { duplicate: boolean }>(`/tasks/${taskId}/${action}`, { method: 'POST', body: envelope }),
    admin: {
      overview: <T>() => request<T>('/admin/overview'),
      updateCompetition: (patch: Record<string, unknown>) => request('/admin/competition', { method: 'PUT', body: patch }),
      setLocations: (locations: unknown) => request('/admin/locations', { method: 'PUT', body: { locations } }),
      /** `key` is a team id, or `_default` for teams without their own assignment. */
      setAssignment: (key: string, assignment: { locationIds: string[]; correctLocationIds: string[]; word: string }) =>
        request(`/admin/assignments/${encodeURIComponent(key)}`, { method: 'PUT', body: assignment }),
      deleteAssignment: (key: string) => request(`/admin/assignments/${encodeURIComponent(key)}`, { method: 'DELETE' }),
      setTaskConfig: (taskId: TaskId, config: unknown) => request(`/admin/tasks/${taskId}/config`, { method: 'PUT', body: { config } }),
    },
  };
}

export type Api = ReturnType<typeof createApi>;
