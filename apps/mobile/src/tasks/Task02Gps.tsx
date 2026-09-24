import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ApiError } from '@adavya/shared';
import { Banner, errorText } from '../ui.js';
import type { TaskProps } from '../screens/PlayerApp.js';

type Watch = 'idle' | 'requesting' | 'watching' | 'denied' | 'unavailable';
type Status = 'SEARCHING' | 'MOVE_CLOSER' | 'POOR_ACCURACY' | 'STALE_POSITION' | 'LOCATION_DETECTED' | 'FOUND';

interface GpsResult {
  status: Status;
  letter?: string;
  order?: number;
  alreadyDiscovered?: boolean;
  /** For an already-discovered location: whether this player was the one who found it. */
  byYou?: boolean;
  resultType?: 'CORRECT' | 'DECOY';
  distanceMeters?: number;
  confirmations?: number;
  required?: number;
  maxAccuracyMeters?: number;
}

interface Fix {
  latitude: number;
  longitude: number;
  accuracy: number;
  positionTimestamp: number;
}

const CHECK_EVERY_MS = 4000;
/** Readings worse than this are not worth sending or queueing; the server threshold is stricter. */
const LOCAL_ACCURACY_CUTOFF_M = 150;
const QUEUE_LIMIT = 20;
/** A standing phone may not report new fixes; older than this, ask for a fresh one (confirmation needs newer readings). */
const REFRESH_FIX_AFTER_MS = 3000;
const QUEUE_SPACING_MS = 3000;

function toFix(pos: GeolocationPosition): Fix {
  return {
    latitude: pos.coords.latitude,
    longitude: pos.coords.longitude,
    accuracy: pos.coords.accuracy,
    positionTimestamp: Math.round(pos.timestamp),
  };
}

function freshFix(): Promise<Fix | null> {
  return new Promise((resolve) =>
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve(toFix(pos)),
      () => resolve(null),
      { enableHighAccuracy: true, maximumAge: 0, timeout: 5_000 }
    )
  );
}

const STATUS_TEXT: Record<Exclude<Status, 'FOUND'>, string> = {
  SEARCHING: 'Searching… no riddle location here.',
  MOVE_CLOSER: 'Getting close — move closer.',
  POOR_ACCURACY: 'GPS is not accurate enough. Stay still in the open for a moment.',
  STALE_POSITION: 'Waiting for a fresh GPS fix…',
  LOCATION_DETECTED: 'Location detected — hold still while it is confirmed…',
};

/** Offline readings survive a reload; they are validated by the server on reconnect, never locally. */
function useOfflineQueue(key: string) {
  const load = (): Fix[] => {
    try {
      return JSON.parse(localStorage.getItem(key) ?? '[]') as Fix[];
    } catch {
      return [];
    }
  };
  const [queue, setQueue] = useState<Fix[]>(load);
  const save = useCallback(
    (next: Fix[]) => {
      setQueue(next);
      try {
        if (next.length) localStorage.setItem(key, JSON.stringify(next));
        else localStorage.removeItem(key);
      } catch {
        /* private mode: memory only */
      }
    },
    [key]
  );
  return { queue, save };
}

/**
 * Level 02 player screen. Watches GPS only while this task is open and checks
 * the position with the server every few seconds. The server decides whether
 * the player is inside an assigned geofence and returns the letter; the phone
 * knows nothing about locations. Offline, good readings are queued and sent
 * when the connection returns.
 */
export const Task02Gps: React.FC<TaskProps> = ({ run, view, send, paused, online }) => {
  const [watch, setWatch] = useState<Watch>('idle');
  const [accuracy, setAccuracy] = useState<number | null>(null);
  const [result, setResult] = useState<GpsResult | null>(null);
  const [validating, setValidating] = useState(false);
  const [syncState, setSyncState] = useState<'idle' | 'syncing' | 'synced'>('idle');
  const [error, setError] = useState<string | null>(null);
  const position = useRef<Fix | null>(null);
  const inFlight = useRef(false);
  const { queue, save } = useOfflineQueue(`adavya:gpsq:${run.runId}`);
  const queueRef = useRef(queue);
  queueRef.current = queue;
  const onlineRef = useRef(online);
  onlineRef.current = online;

  const start = () => {
    setError(null);
    if (!('geolocation' in navigator)) setWatch('unavailable');
    else setWatch('requesting');
  };

  // One geolocation watch spans requesting → watching; it ends on denial or when the task closes.
  const wantsWatch = watch === 'requesting' || watch === 'watching';
  useEffect(() => {
    if (!wantsWatch) return;
    const id = navigator.geolocation.watchPosition(
      (pos) => {
        const fix = toFix(pos);
        position.current = fix;
        setAccuracy(Math.round(fix.accuracy));
        setWatch('watching');
        // Offline: keep good readings, spaced out, for validation later.
        const q = queueRef.current;
        if (!onlineRef.current && fix.accuracy <= LOCAL_ACCURACY_CUTOFF_M && (!q.length || fix.positionTimestamp - q[q.length - 1].positionTimestamp >= QUEUE_SPACING_MS)) {
          save([...q, fix].slice(-QUEUE_LIMIT));
        }
      },
      (err) => {
        // Denied at the prompt or revoked later.
        if (err.code === err.PERMISSION_DENIED) setWatch('denied');
        else if (!position.current) {
          setError(err.code === err.TIMEOUT ? 'GPS is taking too long. Move outdoors.' : err.message || 'Location is unavailable.');
          setWatch('unavailable');
        }
      },
      { enableHighAccuracy: true, maximumAge: 2000, timeout: 30_000 }
    );
    return () => navigator.geolocation.clearWatch(id);
  }, [wantsWatch, save]);

  const handle = useCallback((res: GpsResult) => {
    setResult((prev) => (res.status === 'FOUND' || prev?.status !== 'FOUND' || res.status === 'LOCATION_DETECTED' ? res : prev));
    setError(null);
  }, []);

  // Reconnected: send the queued readings (oldest first) for validation.
  useEffect(() => {
    if (!online || paused || queue.length === 0 || inFlight.current) return;
    inFlight.current = true;
    setSyncState('syncing');
    (async () => {
      let remaining = [...queueRef.current];
      try {
        while (remaining.length) {
          const fix = remaining[0];
          handle(await send<GpsResult>('gps', { ...fix, queued: true }, { dedupeKey: `q-${fix.positionTimestamp}` }));
          remaining = remaining.slice(1);
          save(remaining);
        }
        setSyncState('synced');
      } catch (err) {
        // Game rejections (e.g. the task already moved on) make the queue meaningless; network errors keep it.
        if (err instanceof ApiError && !err.retryable) save([]);
        setError(errorText(err, 'Could not synchronize.'));
        setSyncState('idle');
      } finally {
        inFlight.current = false;
      }
    })();
  }, [online, paused, queue.length, send, save, handle]);

  // Live checks while online.
  useEffect(() => {
    if (watch !== 'watching' || paused || !online) return;
    const check = async () => {
      if (!position.current || inFlight.current || queueRef.current.length) return;
      inFlight.current = true;
      setValidating(true);
      try {
        let fix = position.current;
        if (Date.now() - fix.positionTimestamp > REFRESH_FIX_AFTER_MS) {
          const fresh = await freshFix();
          if (fresh) {
            fix = fresh;
            position.current = fresh;
            setAccuracy(Math.round(fresh.accuracy));
          }
        }
        if (fix.accuracy > LOCAL_ACCURACY_CUTOFF_M) return;
        handle(await send<GpsResult>('gps', { ...fix, queued: false }));
      } catch (err) {
        setError(errorText(err, 'Could not check your location.'));
      } finally {
        inFlight.current = false;
        setValidating(false);
      }
    };
    void check();
    const timer = window.setInterval(check, CHECK_EVERY_MS);
    return () => window.clearInterval(timer);
  }, [watch, paused, online, send, handle]);

  const found = [...(view.discoveries ?? [])].sort((a, b) => a.order - b.order);
  const isDecoy = result?.status === 'FOUND' && result.resultType === 'DECOY';

  return (
    <>
      <div className="card">
        {watch === 'idle' && (
          <>
            <p className="muted">Your captain will read you a riddle. Walk to that place; your letter appears when you arrive.</p>
            <button type="button" className="btn big" onClick={start}>Start GPS</button>
          </>
        )}
        {watch === 'requesting' && <p aria-live="polite">Requesting location permission… allow it when your browser asks.</p>}
        {watch === 'denied' && (
          <>
            <Banner tone="error">Location permission was denied. Allow location for this site in your browser settings, then try again.</Banner>
            <button type="button" className="btn secondary" onClick={start}>Try again</button>
          </>
        )}
        {watch === 'unavailable' && (
          <>
            <Banner tone="error">{error ?? 'GPS is unavailable on this device or browser.'}</Banner>
            <button type="button" className="btn secondary" onClick={start}>Try again</button>
          </>
        )}

        {watch === 'watching' && (
          <>
            <p className="muted">GPS accuracy: <strong>{accuracy !== null ? `±${accuracy} m` : '…'}</strong></p>

            {!online && (
              <Banner tone="warn">
                Network disconnected. {queue.length ? `${queue.length} reading(s) waiting to synchronize.` : 'Keep walking; readings are saved and checked when you reconnect.'}
              </Banner>
            )}
            {online && syncState === 'syncing' && <Banner tone="info">Synchronizing {queue.length} saved reading(s)…</Banner>}
            {online && syncState === 'synced' && <Banner tone="ok">Saved readings synchronized.</Banner>}

            {result?.status === 'FOUND' ? (
              <div className="center" aria-live="polite">
                <p className="muted">
                  {result.alreadyDiscovered && !result.byYou ? 'Already discovered by your team' : isDecoy ? 'Decoy discovered' : 'Letter found'} · riddle {result.order}
                </p>
                <p className="big-number" style={isDecoy ? { textDecoration: 'line-through', opacity: 0.6 } : undefined}>{result.letter}</p>
                <p className="muted">✓ Saved. Tell your captain, then head to the next riddle.</p>
              </div>
            ) : online && !paused ? (
              <p aria-live="polite">
                {validating && !result
                  ? 'Validating…'
                  : result
                    ? result.status === 'MOVE_CLOSER' && result.distanceMeters !== undefined
                      ? `Move closer — about ${result.distanceMeters} m away.`
                      : result.status === 'LOCATION_DETECTED'
                        ? `${STATUS_TEXT.LOCATION_DETECTED} (${result.confirmations}/${result.required})`
                        : STATUS_TEXT[result.status]
                    : 'Searching for location…'}
              </p>
            ) : null}
            {error && <Banner tone="error">{error}</Banner>}
          </>
        )}
      </div>

      {found.length > 0 && (
        <div className="card">
          <h2>Your letters</h2>
          <ul className="roster">
            {found.map((d) => (
              <li key={d.locationId}>
                <span className="muted">Riddle {d.order}{d.resultType === 'DECOY' ? ' · decoy' : ''}</span>
                <strong>{d.letter}</strong>
              </li>
            ))}
          </ul>
        </div>
      )}
    </>
  );
};
