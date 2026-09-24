import React, { useEffect, useRef, useState, useCallback } from "react";
import { useParams, Navigate } from "react-router-dom";
import {
  Task4Session,
  PlayerSlot,
  FIRESTORE_WRITE_THROTTLE_MS,
  CORRECT_HOLD_DURATION_MS,
} from "../types/task4.js";
import { subscribeToSession, updatePlayerLevel } from "../services/task4Service.js";

// Mic calibration offset â€” adjust so silence ~= 30 dB and conversation ~= 60â€“70 dB
const DB_OFFSET = 90;
const METER_UPDATE_MS = 120;

type MicState = "idle" | "requesting" | "active" | "denied";

function clamp(val: number, min: number, max: number) {
  return Math.max(min, Math.min(max, val));
}

function computeDB(analyser: AnalyserNode): number {
  const buf = new Float32Array(analyser.fftSize);
  analyser.getFloatTimeDomainData(buf);
  let sum = 0;
  for (let i = 0; i < buf.length; i++) sum += buf[i] * buf[i];
  const rms = Math.sqrt(sum / buf.length);
  if (rms < 1e-10) return 0;
  return clamp(20 * Math.log10(rms) + DB_OFFSET, 0, 120);
}

const VALID_SLOTS: PlayerSlot[] = ["b", "c", "d"];
const SLOT_NAMES: Record<PlayerSlot, string> = { b: "Player B", c: "Player C", d: "Player D" };

export const Task4PlayerPage: React.FC = () => {
  const { slot } = useParams<{ slot: string }>();
  const playerSlot = slot?.toLowerCase() as PlayerSlot;

  // Validate slot
  if (!VALID_SLOTS.includes(playerSlot)) {
    return <Navigate to="/task4/player/b" replace />;
  }

  const [session, setSession] = useState<Task4Session | null>(null);
  const [loadingSession, setLoadingSession] = useState(true);
  const [micState, setMicState] = useState<MicState>("idle");
  const [liveDB, setLiveDB] = useState(0);
  const [justCorrect, setJustCorrect] = useState(false);

  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const meterIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const firestoreThrottleRef = useRef<number>(0);
  const correctHoldTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inWindowRef = useRef(false);
  const sessionRef = useRef<Task4Session | null>(null);
  const currentStatusRef = useRef<"waiting" | "listening" | "correct">("waiting");

  // Keep sessionRef in sync
  useEffect(() => {
    sessionRef.current = session;
  }, [session]);

  // Subscribe to Firestore
  useEffect(() => {
    const unsub = subscribeToSession((s) => {
      setSession(s);
      setLoadingSession(false);
      // If session was reset, clear correct state
      if (s && s.players[playerSlot]?.status !== "correct") {
        setJustCorrect(false);
        currentStatusRef.current = s.players[playerSlot]?.status ?? "waiting";
      }
    });
    return unsub;
  }, [playerSlot]);

  // Start mic
  const requestMic = useCallback(async () => {
    setMicState("requesting");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      const ctx = new AudioContext();
      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 2048;
      source.connect(analyser);

      audioCtxRef.current = ctx;
      analyserRef.current = analyser;
      setMicState("active");

      // Update meter every 120ms
      meterIntervalRef.current = setInterval(() => {
        if (!analyserRef.current) return;
        const db = computeDB(analyserRef.current);
        setLiveDB(db);
        tickGameLogic(db);
      }, METER_UPDATE_MS);
    } catch {
      setMicState("denied");
    }
  }, []);

  // Game logic tick â€” called on each meter update
  const tickGameLogic = useCallback((db: number) => {
    const sess = sessionRef.current;
    if (!sess || sess.status !== "running") return;
    if (sess.players[playerSlot]?.status === "correct") return; // already done

    const target = sess.targets[playerSlot];
    const tol = sess.tolerance;
    const inWindow = Math.abs(db - target) <= tol;
    const prevInWindow = inWindowRef.current;
    inWindowRef.current = inWindow;

    const now = Date.now();
    const shouldWriteFirestore = now - firestoreThrottleRef.current >= FIRESTORE_WRITE_THROTTLE_MS;

    if (inWindow) {
      // Start hold timer when entering window
      if (!prevInWindow) {
        if (correctHoldTimerRef.current) clearTimeout(correctHoldTimerRef.current);
        correctHoldTimerRef.current = setTimeout(() => {
          // Still in window after hold duration ? mark correct
          if (inWindowRef.current && currentStatusRef.current !== "correct") {
            currentStatusRef.current = "correct";
            setJustCorrect(true);
            updatePlayerLevel(playerSlot, db, "correct").catch(console.error);
          }
        }, CORRECT_HOLD_DURATION_MS);
      }
      if (shouldWriteFirestore && currentStatusRef.current !== "correct") {
        firestoreThrottleRef.current = now;
        currentStatusRef.current = "listening";
        updatePlayerLevel(playerSlot, db, "listening").catch(console.error);
      }
    } else {
      // Left window â€” cancel hold timer
      if (correctHoldTimerRef.current) {
        clearTimeout(correctHoldTimerRef.current);
        correctHoldTimerRef.current = null;
      }
      if (shouldWriteFirestore && currentStatusRef.current !== "correct") {
        firestoreThrottleRef.current = now;
        currentStatusRef.current = "listening";
        updatePlayerLevel(playerSlot, db, "listening").catch(console.error);
      }
    }
  }, [playerSlot]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (meterIntervalRef.current) clearInterval(meterIntervalRef.current);
      if (correctHoldTimerRef.current) clearTimeout(correctHoldTimerRef.current);
      audioCtxRef.current?.close();
    };
  }, []);

  // Derived state
  const isSessionRunning = session?.status === "running";
  const isSessionComplete = session?.status === "complete";
  const myStatus = session?.players[playerSlot]?.status ?? "waiting";
  const isCorrect = myStatus === "correct";
  const target = session?.targets[playerSlot] ?? 0;
  const tol = session?.tolerance ?? 5;
  const inWindow = micState === "active" && Math.abs(liveDB - target) <= tol && isSessionRunning;

  // Meter fill: 0-100 visual based on dB 0-100 range
  const meterFill = clamp(liveDB, 0, 100);
  // Color zones
  const meterColor = isCorrect
    ? "bg-emerald-500"
    : inWindow
    ? "bg-emerald-400"
    : liveDB > 80
    ? "bg-red-500"
    : liveDB > 60
    ? "bg-amber-400"
    : "bg-blue-500";

  // ------------------------------------------------
  // RENDER
  // ------------------------------------------------

  if (loadingSession) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <p className="text-zinc-400 text-sm animate-pulse">Connecting...</p>
      </div>
    );
  }

  // Task complete screen
  if (isSessionComplete || (isCorrect && isSessionRunning)) {
    return (
      <div className="min-h-screen bg-zinc-950 flex flex-col items-center justify-center p-6 text-center gap-6">
        <div className="text-6xl">??</div>
        <h1 className="text-3xl font-bold text-emerald-400">
          {isSessionComplete ? "TASK COMPLETE!" : "? Matched!"}
        </h1>
        <p className="text-zinc-400 text-lg">
          {isSessionComplete
            ? "All players matched their targets. Well done!"
            : "Your level was accepted. Waiting for others..."}
        </p>
        <div className="bg-zinc-900 border border-emerald-700/30 rounded-xl p-4 text-emerald-300 text-sm">
          {SLOT_NAMES[playerSlot]} â€” Level confirmed ?
        </div>
      </div>
    );
  }

  // Session not started
  if (!isSessionRunning) {
    return (
      <div className="min-h-screen bg-zinc-950 flex flex-col items-center justify-center p-6 text-center gap-4">
        <div className="text-5xl">???</div>
        <h1 className="text-2xl font-bold text-zinc-200">{SLOT_NAMES[playerSlot]}</h1>
        <p className="text-zinc-500 text-base">Waiting for HQ to start the task...</p>
        <div className="mt-4 px-4 py-2 rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-600 text-xs font-mono">
          {session ? `Session: ${session.status}` : "No session yet"}
        </div>
      </div>
    );
  }

  // Active gameplay
  return (
    <div className="min-h-screen bg-zinc-950 flex flex-col">
      {/* Header */}
      <header className="px-5 pt-8 pb-4 text-center border-b border-zinc-800">
        <div className="text-[11px] font-mono text-zinc-600 uppercase tracking-widest mb-1">Task 4 Â· Sound Relay</div>
        <h1 className="text-2xl font-bold text-zinc-100">{SLOT_NAMES[playerSlot]}</h1>
        <p className="text-zinc-500 text-sm mt-1">
          {isCorrect ? "Level confirmed ?" : "Match your target noise level"}
        </p>
      </header>

      <main className="flex-1 flex flex-col items-center justify-center px-6 gap-8 py-8">

        {/* Target reminder â€” NO number shown */}
        <div className="w-full max-w-sm bg-zinc-900 border border-zinc-800 rounded-2xl p-6 text-center space-y-2">
          <div className="text-xs text-zinc-600 uppercase tracking-wider">Your target was told to you verbally</div>
          <div className="text-zinc-300 text-sm mt-1">
            Match the dB level HQ told you â€” hold it steady.
          </div>
          <div className="text-[11px] text-zinc-600 mt-1">Tolerance: Â± {tol} dB</div>
        </div>

        {/* Mic request / denied state */}
        {micState === "idle" && (
          <button
            onClick={requestMic}
            className="w-full max-w-sm py-5 rounded-2xl bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white text-xl font-bold transition-colors shadow-lg shadow-blue-900/40"
          >
            ??? Enable Microphone
          </button>
        )}

        {micState === "requesting" && (
          <div className="text-zinc-400 text-sm animate-pulse">Requesting microphone access...</div>
        )}

        {micState === "denied" && (
          <div className="w-full max-w-sm bg-red-950/30 border border-red-800/40 rounded-2xl p-6 text-center space-y-4">
            <div className="text-3xl">??</div>
            <h2 className="text-red-400 font-semibold text-lg">Microphone Denied</h2>
            <p className="text-zinc-400 text-sm">
              Please allow microphone access in your browser settings, then reload this page.
            </p>
            <p className="text-zinc-600 text-xs">
              On iOS Safari: Settings ? Safari ? Microphone ? Allow.<br />
              On Chrome: Click the lock icon in the address bar ? Microphone ? Allow.
            </p>
            <button
              onClick={() => window.location.reload()}
              className="w-full py-3 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 font-medium text-sm transition-colors"
            >
              ? Retry
            </button>
          </div>
        )}

        {/* Live meter â€” shown when mic is active */}
        {micState === "active" && (
          <div className="w-full max-w-sm space-y-6">
            {/* Vertical meter */}
            <div className="flex flex-col items-center gap-3">
              <div className="w-full h-10 bg-zinc-800 rounded-full overflow-hidden border border-zinc-700">
                <div
                  className={`h-full rounded-full transition-all duration-100 ${meterColor}`}
                  style={{ width: `${meterFill}%` }}
                />
              </div>
              <div className={`text-4xl font-bold font-mono tabular-nums ${
                inWindow ? "text-emerald-400" : "text-zinc-200"
              }`}>
                {liveDB.toFixed(1)} <span className="text-xl font-normal text-zinc-500">dB</span>
              </div>
              {inWindow && (
                <div className="flex items-center gap-2 text-emerald-400 font-semibold text-sm animate-pulse">
                  <span className="inline-block w-2 h-2 rounded-full bg-emerald-400" />
                  In target window â€” hold steady!
                </div>
              )}
              {!inWindow && (
                <div className="text-zinc-600 text-sm">
                  {liveDB < (target - tol) ? "? Make more noise" : "? Quieter"}
                </div>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default Task4PlayerPage;
