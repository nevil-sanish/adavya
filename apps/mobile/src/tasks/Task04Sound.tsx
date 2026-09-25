import React, { useEffect, useRef, useState } from 'react';
import { createPlateauDetector, median, rmsDb } from '@adavya/shared';
import { Banner, errorText } from '../ui.js';
import type { TaskProps } from '../screens/PlayerApp.js';

type Stage = 'idle' | 'calibrating' | 'listening' | 'denied' | 'error';

const CALIBRATION_MS = 3000;
/** A hold must be this much louder than the calibrated room noise. */
const AMBIENT_MARGIN_DB = 6;
const DISPLAY_EVERY_MS = 120;
/** With no hold required, report new levels at most this often. */
const MIN_REPORT_INTERVAL_MS = 150;

/**
 * Live approximate loudness. Each new level above room noise (held for the
 * task's hold time, if one is configured) is sent as a hit event. The phone never knows
 * its target; the server checks the level, the player and the required order.
 */
export const Task04Sound: React.FC<TaskProps> = ({ view, send, paused, online }) => {
  const [stage, setStage] = useState<Stage>('idle');
  const [level, setLevel] = useState(0);
  const [floor, setFloor] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lastHold, setLastHold] = useState<number | null>(null);
  const audio = useRef<{ ctx: AudioContext; stream: MediaStream; analyser: AnalyserNode } | null>(null);
  const blockedRef = useRef(paused || !online);
  blockedRef.current = paused || !online;
  const sendRef = useRef(send);
  sendRef.current = send;
  // A small margin over the server's hold requirement; 0 means a target counts the moment it is reached.
  const holdMs = view.holdMs ? view.holdMs + 100 : 0;

  const start = async () => {
    setError(null);
    try {
      // Created inside the tap so iOS allows audio processing.
      const ctx = new AudioContext();
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
      });
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 2048;
      ctx.createMediaStreamSource(stream).connect(analyser);
      await ctx.resume();
      audio.current = { ctx, stream, analyser };
      setStage('calibrating');
    } catch (err) {
      const denied = err instanceof DOMException && (err.name === 'NotAllowedError' || err.name === 'SecurityError');
      setStage(denied ? 'denied' : 'error');
      setError(denied ? null : errorText(err, 'Could not open the microphone.'));
    }
  };

  // Release the microphone when the task ends or the screen changes.
  useEffect(
    () => () => {
      audio.current?.stream.getTracks().forEach((t) => t.stop());
      void audio.current?.ctx.close();
      audio.current = null;
    },
    []
  );

  useEffect(() => {
    if ((stage !== 'calibrating' && stage !== 'listening') || !audio.current) return;
    const { analyser } = audio.current;
    const samples = new Float32Array(analyser.fftSize);
    const read = () => {
      analyser.getFloatTimeDomainData(samples);
      return rmsDb(samples);
    };
    let frame = 0;
    let lastDisplay = 0;

    if (stage === 'calibrating') {
      const readings: number[] = [];
      const began = performance.now();
      const loop = () => {
        const t = performance.now();
        readings.push(read());
        if (t - began >= CALIBRATION_MS) {
          setFloor(Math.round(median(readings) + AMBIENT_MARGIN_DB));
          setStage('listening');
          return;
        }
        frame = requestAnimationFrame(loop);
      };
      frame = requestAnimationFrame(loop);
      return () => cancelAnimationFrame(frame);
    }

    const detector = createPlateauDetector({ bandDb: 2.5, holdMs, floorDb: floor ?? 0, minIntervalMs: MIN_REPORT_INTERVAL_MS });
    const loop = () => {
      const t = performance.now();
      const db = read();
      if (t - lastDisplay >= DISPLAY_EVERY_MS) {
        lastDisplay = t;
        setLevel(db);
      }
      const hit = detector.update(db, t);
      if (hit && !blockedRef.current) {
        setLastHold(Math.round(hit.levelDb));
        sendRef.current('hit', { levelDb: hit.levelDb, holdMs: hit.holdMs, ageMs: Math.round(performance.now() - hit.endedAt) }).catch((err) =>
          setError(errorText(err, 'Could not send.'))
        );
      }
      frame = requestAnimationFrame(loop);
    };
    frame = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(frame);
  }, [stage, floor, holdMs]);

  return (
    <div className="card">
      {stage === 'idle' && <button type="button" className="btn big" onClick={start}>Start microphone</button>}
      {stage === 'denied' && <Banner tone="error">Microphone access was denied. Allow the microphone for this site in your browser settings, then reload.</Banner>}
      {stage === 'error' && (
        <>
          <Banner tone="error">{error}</Banner>
          <button type="button" className="btn secondary" onClick={start}>Try again</button>
        </>
      )}
      {stage === 'calibrating' && (
        <>
          <p aria-live="polite">Calibrating… stay quiet for 3 seconds.</p>
          <div className="spinner" aria-hidden="true" />
        </>
      )}
      {stage === 'listening' && (
        <>
          <p className="muted">Approximate level</p>
          <p className="big-number" aria-live="off">{Math.round(level)}<span className="muted"> dB</span></p>
          <div className="meter" aria-hidden="true"><span style={{ width: `${Math.min(100, Math.max(0, ((level - 30) / 70) * 100))}%` }} /></div>
          <p className="muted">Room noise ≈ {floor !== null ? floor - AMBIENT_MARGIN_DB : '…'} dB.{' '}
            {holdMs ? `Hold a steady sound for ${(holdMs / 1000).toFixed(1)} s.` : 'Make a sound at the loudness your captain calls out.'}</p>
          {lastHold !== null && <Banner tone="info">~{lastHold} dB sent.</Banner>}
          {error && <Banner tone="error">{error}</Banner>}
          <button type="button" className="btn secondary" onClick={() => setStage('calibrating')}>Recalibrate</button>
        </>
      )}
    </div>
  );
};
