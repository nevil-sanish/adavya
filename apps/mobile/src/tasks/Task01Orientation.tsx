import React, { useEffect, useRef, useState } from 'react';
import { createTiltLock, type Direction, type TiltState } from '@adavya/shared';
import { Banner, errorText } from '../ui.js';
import type { TaskProps } from '../screens/PlayerApp.js';

type Permission = 'checking' | 'needs-permission' | 'granted' | 'denied' | 'unsupported';

type OrientationEventWithPermission = typeof DeviceOrientationEvent & { requestPermission?: () => Promise<'granted' | 'denied'> };

/**
 * Tilt left (0) or right (1) and hold until it locks; each lock sends one event.
 * The player is only told the event was sent — the captain sees whether it counted.
 */
export const Task01Orientation: React.FC<TaskProps> = ({ send, paused, online }) => {
  const [permission, setPermission] = useState<Permission>('checking');
  const [tilt, setTilt] = useState<TiltState>({ leaning: null, progress: 0, armed: false });
  const [sent, setSent] = useState<Direction | null>(null);
  const [error, setError] = useState<string | null>(null);
  const blocked = paused || !online;
  const blockedRef = useRef(blocked);
  blockedRef.current = blocked;
  const sendRef = useRef(send);
  sendRef.current = send;

  useEffect(() => {
    const Ctor = (window as unknown as { DeviceOrientationEvent?: OrientationEventWithPermission }).DeviceOrientationEvent;
    if (!Ctor) setPermission('unsupported');
    else if (typeof Ctor.requestPermission === 'function') setPermission('needs-permission');
    else setPermission('granted');
  }, []);

  useEffect(() => {
    if (permission !== 'granted') return;
    const update = createTiltLock();
    let sawReading = false;
    let clearSent: number | undefined;
    const onOrientation = (e: DeviceOrientationEvent) => {
      if (e.gamma === null) return;
      sawReading = true;
      const state = update(e.gamma, performance.now());
      setTilt(state);
      if (state.locked && !blockedRef.current) {
        const direction = state.locked;
        setSent(direction);
        setError(null);
        window.clearTimeout(clearSent);
        clearSent = window.setTimeout(() => setSent(null), 1500);
        sendRef.current('orient', { direction }).catch((err) => setError(errorText(err, 'Could not send. Try again.')));
      }
    };
    window.addEventListener('deviceorientation', onOrientation);
    const noSensor = window.setTimeout(() => !sawReading && setPermission('unsupported'), 3000);
    return () => {
      window.removeEventListener('deviceorientation', onOrientation);
      window.clearTimeout(noSensor);
      window.clearTimeout(clearSent);
    };
  }, [permission]);

  const request = async () => {
    const Ctor = DeviceOrientationEvent as OrientationEventWithPermission;
    try {
      setPermission((await Ctor.requestPermission!()) === 'granted' ? 'granted' : 'denied');
    } catch {
      setPermission('denied');
    }
  };

  return (
    <div className="card">
      {permission === 'needs-permission' && (
        <button type="button" className="btn big" onClick={request}>Enable motion sensor</button>
      )}
      {permission === 'denied' && <Banner tone="error">Motion access was denied. Allow motion & orientation access for this site in your browser settings, then reload.</Banner>}
      {permission === 'unsupported' && <Banner tone="error">This device does not report orientation. Use a phone with a motion sensor (Chrome on Android or Safari on iOS).</Banner>}
      {permission === 'granted' && (
        <>
          <p className="muted">Hold the phone flat in front of you, screen up. Tilt it left or right and hold until it locks, then return it flat.</p>
          <div className="tilt" aria-live="polite">
            <div className={tilt.leaning === 'LEFT' ? 'active' : ''}>◀ Left</div>
            <div className={!tilt.leaning ? 'active' : ''}>{tilt.armed ? 'Ready' : 'Level'}</div>
            <div className={tilt.leaning === 'RIGHT' ? 'active' : ''}>Right ▶</div>
          </div>
          <div className="meter" aria-label="Lock progress"><span style={{ width: `${Math.round(tilt.progress * 100)}%` }} /></div>
          {sent && <Banner tone="info">Sent: {sent.toLowerCase()}. Return the phone flat.</Banner>}
        </>
      )}
      {blocked && <Banner tone="warn">Input is paused.</Banner>}
      {error && <Banner tone="error">{error}</Banner>}
      {import.meta.env.DEV && (
        <div className="row" aria-label="Development only">
          {(['LEFT', 'RIGHT'] as const).map((d) => (
            <button key={d} type="button" className="btn secondary" onClick={() => send('orient', { direction: d }).catch((err) => setError(errorText(err, 'Failed')))}>
              Dev: {d.toLowerCase()}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};
