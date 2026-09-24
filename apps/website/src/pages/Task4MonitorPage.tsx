import React, { useEffect, useState, useCallback } from "react";
import {
  Task4Session,
  PlayerSlot,
  DEFAULT_TARGET_MIN,
  DEFAULT_TARGET_MAX,
  DEFAULT_TOLERANCE,
} from "../types/task4.js";
import {
  subscribeToSession,
  startTask4,
  resetTask4,
  completeTask4,
} from "../services/task4Service.js";

const SLOTS: PlayerSlot[] = ["b", "c", "d"];
const SLOT_LABELS: Record<PlayerSlot, string> = { b: "Player B", c: "Player C", d: "Player D" };

function dBBar(level: number, target: number, _tolerance: number): number {
  const distance = Math.abs(level - target);
  return Math.max(0, Math.round(((50 - distance) / 50) * 100));
}

function StatusDot({ status }: { status: string }) {
  if (status === "correct") return <span className="inline-block w-2.5 h-2.5 rounded-full bg-emerald-400" />;
  if (status === "listening") return <span className="inline-block w-2.5 h-2.5 rounded-full bg-blue-400 animate-pulse" />;
  return <span className="inline-block w-2.5 h-2.5 rounded-full bg-zinc-600" />;
}

export const Task4MonitorPage: React.FC = () => {
  const [session, setSession] = useState<Task4Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [fsError, setFsError] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [completionFired, setCompletionFired] = useState(false);

  useEffect(() => {
    let unsub: (() => void) | undefined;
    try {
      unsub = subscribeToSession((s) => {
        setSession(s);
        setLoading(false);
        setFsError(null);
      });
    } catch (e: unknown) {
      setLoading(false);
      setFsError(e instanceof Error ? e.message : "Firestore connection failed.");
    }
    return () => unsub?.();
  }, []);

  useEffect(() => {
    if (!session || session.status !== "running" || completionFired) return;
    const allCorrect = SLOTS.every((s) => session.players[s].status === "correct");
    if (allCorrect) {
      setCompletionFired(true);
      completeTask4().catch(console.error);
    }
  }, [session, completionFired]);

  useEffect(() => {
    if (session?.status === "running") setCompletionFired(false);
  }, [session?.status]);

  const handleStart = useCallback(async () => {
    setStarting(true);
    try {
      await startTask4(DEFAULT_TARGET_MIN, DEFAULT_TARGET_MAX, DEFAULT_TOLERANCE);
    } catch (e) { console.error(e); }
    finally { setStarting(false); }
  }, []);

  const handleReset = useCallback(async () => {
    setResetting(true);
    try { await resetTask4(); }
    catch (e) { console.error(e); }
    finally { setResetting(false); }
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <div className="text-zinc-400 text-sm animate-pulse">Connecting to Firebase...</div>
      </div>
    );
  }

  if (fsError) {
    return (
      <div className="min-h-screen bg-zinc-950 flex flex-col items-center justify-center gap-4 p-6 text-center">
        <div className="text-red-400 text-lg font-semibold">Firestore Error</div>
        <div className="text-zinc-400 text-sm max-w-md">{fsError}</div>
        <button onClick={() => window.location.reload()} className="px-4 py-2 rounded-lg bg-zinc-800 text-zinc-200 text-sm">Retry</button>
      </div>
    );
  }

  const isComplete = session?.status === "complete";
  const isRunning = session?.status === "running";
  const isIdle = !session || session.status === "idle";

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col">
      <header className="border-b border-zinc-800 bg-zinc-900/80 px-6 py-4 flex items-center justify-between">
        <div>
          <div className="text-[11px] font-mono text-zinc-500 uppercase tracking-widest mb-0.5">Task 4 &middot; Monitor</div>
          <h1 className="text-xl font-bold text-zinc-100">Sound Relay Challenge</h1>
        </div>
        <div className="flex items-center gap-3">
          {isRunning && (
            <button onClick={handleReset} disabled={resetting}
              className="px-4 py-2 rounded-lg border border-zinc-700 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-medium transition-colors disabled:opacity-40">
              {resetting ? "Resetting..." : "Restart Task 4"}
            </button>
          )}
          {(isIdle || isComplete) && (
            <button onClick={handleStart} disabled={starting}
              className="px-5 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold transition-colors disabled:opacity-40">
              {starting ? "Starting..." : isComplete ? "Play Again" : "Start Task 4"}
            </button>
          )}
        </div>
      </header>

      <main className="flex-1 p-6 space-y-6 max-w-5xl mx-auto w-full">

        {isComplete && (
          <div className="rounded-xl border border-emerald-600/40 bg-emerald-950/40 p-6 text-center space-y-2">
            <h2 className="text-2xl font-bold text-emerald-400">TASK COMPLETE</h2>
            <p className="text-emerald-300/70 text-sm">All three players matched their target levels.</p>
          </div>
        )}

        {isIdle && (
          <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-10 text-center space-y-3">
            <h2 className="text-lg font-semibold text-zinc-300">Ready to start</h2>
            <p className="text-zinc-500 text-sm">Press Start Task 4 to assign random dB targets to each player.</p>
          </div>
        )}

        {(isRunning || isComplete) && session && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {SLOTS.map((slot) => {
              const player = session.players[slot];
              const target = session.targets[slot];
              const tol = session.tolerance;
              const level = player.lastLevel;
              const isCorrect = player.status === "correct";
              const isListening = player.status === "listening";
              const fill = dBBar(level, target, tol);
              const inWindow = Math.abs(level - target) <= tol;

              return (
                <div key={slot} className={`rounded-xl border p-5 space-y-5 transition-all ${
                  isCorrect ? "border-emerald-600/50 bg-emerald-950/20"
                  : isListening ? "border-blue-700/40 bg-zinc-900"
                  : "border-zinc-800 bg-zinc-900"
                }`}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <StatusDot status={player.status} />
                      <span className="font-semibold text-zinc-200">{SLOT_LABELS[slot]}</span>
                    </div>
                    <span className={`text-[11px] font-mono px-2 py-0.5 rounded border ${
                      isCorrect ? "bg-emerald-950/50 text-emerald-400 border-emerald-700/40"
                      : isListening ? "bg-blue-950/50 text-blue-400 border-blue-700/40"
                      : "bg-zinc-950 text-zinc-500 border-zinc-800"
                    }`}>
                      {isCorrect ? "CORRECT" : isListening ? "LISTENING" : "WAITING"}
                    </span>
                  </div>

                  <div className="bg-zinc-950/70 border border-zinc-800 rounded-lg p-4 text-center">
                    <div className="text-[11px] text-zinc-500 mb-1 uppercase tracking-wider">Target</div>
                    <div className="text-3xl font-bold font-mono text-amber-400">{target}</div>
                    <div className="text-[11px] text-zinc-500 mt-1">dB +/- {tol}</div>
                    <div className="text-[10px] text-zinc-600 mt-0.5">Window: {target - tol} to {target + tol} dB</div>
                  </div>

                  <div className="space-y-2">
                    <div className="flex justify-between text-[11px] text-zinc-500">
                      <span>Live Level</span>
                      <span className={`font-mono ${inWindow && isListening ? "text-emerald-400" : "text-zinc-400"}`}>
                        {isListening || isCorrect ? `${level.toFixed(1)} dB` : "--"}
                      </span>
                    </div>
                    <div className="h-2 bg-zinc-800 rounded-full overflow-hidden">
                      <div className={`h-full rounded-full transition-all duration-300 ${
                        isCorrect ? "bg-emerald-500" : inWindow ? "bg-emerald-400" : "bg-blue-500"
                      }`} style={{ width: `${isListening || isCorrect ? fill : 0}%` }} />
                    </div>
                    <div className="text-[10px] text-zinc-600 text-right">
                      {isListening || isCorrect ? `${fill}% accuracy` : "Not started"}
                    </div>
                  </div>

                  {isCorrect && (
                    <div className="flex items-center justify-center gap-2 py-2 rounded-lg bg-emerald-950/40 border border-emerald-700/30">
                      <span className="text-emerald-300 text-sm font-semibold">Level matched!</span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {(isRunning || isComplete) && session && (
          <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-5 flex items-center justify-between">
            <div>
              <div className="text-[11px] text-zinc-500 uppercase tracking-wider mb-1">Overall Progress</div>
              <div className="text-2xl font-bold font-mono text-zinc-100">
                {SLOTS.filter((s) => session.players[s].status === "correct").length}
                <span className="text-zinc-600"> / 3</span>
              </div>
            </div>
            <div className="flex gap-1.5">
              {SLOTS.map((slot) => (
                <div key={slot} className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold border ${
                  session.players[slot].status === "correct" ? "bg-emerald-500/20 border-emerald-600/40 text-emerald-400"
                  : session.players[slot].status === "listening" ? "bg-blue-500/20 border-blue-600/40 text-blue-400"
                  : "bg-zinc-800 border-zinc-700 text-zinc-500"
                }`}>
                  {slot.toUpperCase()}
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="rounded-xl border border-zinc-800/60 bg-zinc-900/40 p-4 text-[12px] text-zinc-500 space-y-1">
          <p className="font-semibold text-zinc-400">Monitor Instructions</p>
          <p>1. Press <strong className="text-zinc-300">Start Task 4</strong> to assign random dB targets (70-110 dB) to each player.</p>
          <p>2. <strong className="text-zinc-300">Verbally tell</strong> each player their target -- do not show them this screen.</p>
          <p>3. Players open <code className="text-blue-400">/task4/player/b</code>, <code className="text-blue-400">/c</code>, or <code className="text-blue-400">/d</code> on their phone.</p>
          <p>4. They make noise until their meter hits their target. All 3 correct = Task Complete.</p>
        </div>
      </main>
    </div>
  );
};

export default Task4MonitorPage;