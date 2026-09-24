import React, { useEffect, useRef, useState } from 'react';
import type { PoseLandmarker } from '@mediapipe/tasks-vision';
import { classifyPose, createPoseHold } from '@adavya/shared';
import { Banner, errorText } from '../ui.js';
import type { TaskProps } from '../screens/PlayerApp.js';

const MODEL_URL =
  import.meta.env.VITE_POSE_MODEL_URL ||
  'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task';
const WASM_PATH = `${import.meta.env.BASE_URL}mediapipe/wasm`;

type Stage = 'idle' | 'starting' | 'running' | 'camera-denied' | 'error';

/**
 * Camera preview only: no pose name, skeleton or verification feedback. The phone
 * classifies whatever pose is held for 1.5 s and reports only that result; the
 * server decides whether it was this player's pose. No video or landmarks leave the phone.
 */
export const Task03Pose: React.FC<TaskProps> = ({ send, paused, online }) => {
  const [stage, setStage] = useState<Stage>('idle');
  const [error, setError] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const blockedRef = useRef(paused || !online);
  blockedRef.current = paused || !online;
  const sendRef = useRef(send);
  sendRef.current = send;

  // The camera session spans starting → running; an error or denial ends it.
  const active = stage === 'starting' || stage === 'running';
  useEffect(() => {
    if (!active) return;
    let stream: MediaStream | null = null;
    let landmarker: PoseLandmarker | null = null;
    let frame = 0;
    let cancelled = false;

    (async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } }, audio: false });
      } catch (err) {
        if (!cancelled) {
          const denied = err instanceof DOMException && (err.name === 'NotAllowedError' || err.name === 'SecurityError');
          setStage(denied ? 'camera-denied' : 'error');
          setError(denied ? null : errorText(err, 'Could not open the camera.'));
        }
        return;
      }
      const video = videoRef.current!;
      video.srcObject = stream;
      await video.play().catch(() => {});

      try {
        const { FilesetResolver, PoseLandmarker } = await import('@mediapipe/tasks-vision');
        const vision = await FilesetResolver.forVisionTasks(WASM_PATH);
        landmarker = await PoseLandmarker.createFromOptions(vision, {
          baseOptions: { modelAssetPath: MODEL_URL, delegate: 'GPU' },
          runningMode: 'VIDEO',
          numPoses: 2,
        });
      } catch (err) {
        if (!cancelled) {
          setStage('error');
          setError(`Pose detection could not load: ${errorText(err, 'unknown error')}`);
        }
        return;
      }
      if (cancelled) return;
      setStage('running');

      const hold = createPoseHold({ holdMs: 1500, graceMs: 300 });
      let lastVideoTime = -1;
      const loop = () => {
        if (cancelled) return;
        if (video.readyState >= 2 && video.currentTime !== lastVideoTime) {
          lastVideoTime = video.currentTime;
          const t = performance.now();
          const result = landmarker!.detectForVideo(video, t);
          // Exactly one person in frame.
          const pose = result.landmarks.length === 1 ? classifyPose(result.landmarks[0]) : null;
          const state = hold(pose, t);
          if (state.confirmed && !blockedRef.current) {
            sendRef.current('pose', { poseId: state.confirmed, holdMs: Math.round(state.heldMs) }).catch(() => {
              /* retried by the sender; no feedback is shown to players */
            });
          }
        }
        frame = requestAnimationFrame(loop);
      };
      frame = requestAnimationFrame(loop);
    })();

    return () => {
      cancelled = true;
      cancelAnimationFrame(frame);
      stream?.getTracks().forEach((t) => t.stop());
      landmarker?.close();
    };
  }, [active]);

  return (
    <div className="card">
      <div className="camera">
        <video ref={videoRef} playsInline muted aria-label="Camera preview" />
      </div>
      {stage === 'idle' && <button type="button" className="btn big" onClick={() => setStage('starting')}>Start camera</button>}
      {stage === 'starting' && <p className="muted">Starting camera…</p>}
      {stage === 'running' && <p className="muted">Camera on. Stand back so your head, shoulders and arms are visible.</p>}
      {stage === 'camera-denied' && <Banner tone="error">Camera access was denied. Allow the camera for this site in your browser settings, then reload.</Banner>}
      {stage === 'error' && (
        <>
          <Banner tone="error">{error}</Banner>
          <button type="button" className="btn secondary" onClick={() => setStage('starting')}>Try again</button>
        </>
      )}
    </div>
  );
};
