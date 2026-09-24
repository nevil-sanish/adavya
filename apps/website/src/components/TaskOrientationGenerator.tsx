import React, { useState, useEffect } from 'react';
import {
  Layers,
  Clock,
  CheckCircle2,
  XCircle,
} from 'lucide-react';
import { Round1CodeEntry } from './Round1CodeEntry.js';
import { doc, setDoc, collection, getDocs, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '../services/firebase.js';
import { useAuth } from '../context/AuthContext.js';
import { RoundInstance } from '../types/auth.js';

type Orientation = 'clockwise' | 'anticlockwise' | null;

interface PlayerState {
  id: string;
  name: string;
  orientation: Orientation;
}

interface TaskOrientationGeneratorProps {
  onStartTimer?: () => void;
  teamId?: string;
  onRound1Complete?: () => void;
}

/**
 * Tabler Outline: rotate (counterclockwise arrow)
 * Used for Anticlockwise state.
 */
const TablerRotate: React.FC<{ className?: string }> = ({ className = '' }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="28"
    height="28"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
  >
    <path stroke="none" d="M0 0h24v24H0z" fill="none" />
    <path d="M19.95 11a8 8 0 1 0 -.5 4m.5 5v-5h-5" />
  </svg>
);

/**
 * Tabler Outline: rotate-clockwise (clockwise arrow)
 * Used for Clockwise state.
 */
const TablerRotateClockwise: React.FC<{ className?: string }> = ({ className = '' }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="28"
    height="28"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
  >
    <path stroke="none" d="M0 0h24v24H0z" fill="none" />
    <path d="M4.05 11a8 8 0 1 1 .5 4m-.5 5v-5h5" />
  </svg>
);

const INITIAL_PLAYERS: PlayerState[] = [
  { id: 'player-1', name: 'Player 1', orientation: null },
  { id: 'player-2', name: 'Player 2', orientation: null },
  { id: 'player-3', name: 'Player 3', orientation: null },
];

export const TaskOrientationGenerator: React.FC<TaskOrientationGeneratorProps> = ({
  onStartTimer,
  teamId: propTeamId,
  onRound1Complete,
}) => {
  const { user } = useAuth();
  const activeTeamId = propTeamId || user?.teamId || 'TEAM-ALPHA';

  // 1. Orientation Task State
  const [players, setPlayers] = useState<PlayerState[]>(INITIAL_PLAYERS);
  const [generationKey, setGenerationKey] = useState<number>(0);
  const [hasGenerated, setHasGenerated] = useState<boolean>(false);

  // Round Document & Real-time Reported Player Values (null until updated in Firestore)
  const [currentRoundDocId, setCurrentRoundDocId] = useState<string | null>(null);
  const [reportedPlayers, setReportedPlayers] = useState<{
    player1: number | null;
    player2: number | null;
    player3: number | null;
  }>({
    player1: null,
    player2: null,
    player3: null,
  });

  // Round Timer State
  const [roundTimer, setRoundTimer] = useState<number>(0);
  const [isTimerRunning, setIsTimerRunning] = useState<boolean>(false);
  const [activeRoundNumber, setActiveRoundNumber] = useState<number>(1);
  const [isSavingRound, setIsSavingRound] = useState<boolean>(false);

  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;
    if (isTimerRunning) {
      interval = setInterval(() => {
        setRoundTimer((prev) => prev + 1);
      }, 1000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isTimerRunning]);

  const formatTimer = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Helper to extract reported player1, player2, player3 from Firestore document
  const extractReported = (data: any) => {
    let p1: number | null = typeof data.player1 === 'number' ? data.player1 : null;
    let p2: number | null = typeof data.player2 === 'number' ? data.player2 : null;
    let p3: number | null = typeof data.player3 === 'number' ? data.player3 : null;

    // Fallback: check orientations array or map if player1/2/3 aren't directly numbers
    if (Array.isArray(data.orientations)) {
      if (p1 === null && typeof data.orientations[0] === 'number') p1 = data.orientations[0];
      if (p2 === null && typeof data.orientations[1] === 'number') p2 = data.orientations[1];
      if (p3 === null && typeof data.orientations[2] === 'number') p3 = data.orientations[2];
    } else if (typeof data.orientations === 'object' && data.orientations !== null) {
      if (p1 === null && typeof data.orientations.player1 === 'number') p1 = data.orientations.player1;
      if (p2 === null && typeof data.orientations.player2 === 'number') p2 = data.orientations.player2;
      if (p3 === null && typeof data.orientations.player3 === 'number') p3 = data.orientations.player3;
    }

    return { player1: p1, player2: p2, player3: p3 };
  };

  // --------------------------------------------------------------------------
  // Real-time Firestore Sync: Listen to rounds collection for active team
  // --------------------------------------------------------------------------
  useEffect(() => {
    if (!activeTeamId) return;

    const roundsQuery = query(
      collection(db, 'rounds'),
      where('teamId', '==', activeTeamId)
    );

    const unsub = onSnapshot(
      roundsQuery,
      (snapshot) => {
        if (snapshot.empty) return;

        let latestDoc: any = null;
        let maxRound = -1;

        snapshot.forEach((d) => {
          const data = d.data();
          const rNum = data.roundNumber || 0;
          if (rNum > maxRound) {
            maxRound = rNum;
            latestDoc = { id: d.id, ...data };
          }
        });

        if (latestDoc) {
          setActiveRoundNumber(latestDoc.roundNumber || 1);
          setCurrentRoundDocId(latestDoc.id);

          if (latestDoc.players && Array.isArray(latestDoc.players)) {
            setPlayers(
              latestDoc.players.map((p: any) => ({
                id: p.id,
                name: p.name,
                orientation:
                  p.orientationLabel ||
                  (p.orientation === 1
                    ? 'clockwise'
                    : p.orientation === 0
                    ? 'anticlockwise'
                    : null),
              }))
            );
            setHasGenerated(true);
          }

          // Extract reported values (null until updated)
          setReportedPlayers(extractReported(latestDoc));
        }
      },
      (err) => {
        console.warn('[Firestore] Rounds collection listener error:', err);
      }
    );

    return () => unsub();
  }, [activeTeamId]);

  // Direct listener to the active round document for instantaneous field updates
  useEffect(() => {
    if (!currentRoundDocId) return;

    const unsub = onSnapshot(
      doc(db, 'rounds', currentRoundDocId),
      (snap) => {
        if (!snap.exists()) return;
        const data = snap.data();
        if (!data) return;

        // Extract live reported values whenever document updates
        setReportedPlayers(extractReported(data));
      },
      (err) => {
        console.warn('[Firestore] Round doc listener error:', err);
      }
    );

    return () => unsub();
  }, [currentRoundDocId]);

  // --------------------------------------------------------------------------
  // Orientation generator trigger with Timer & Firestore Round recording
  // --------------------------------------------------------------------------
  const handleGenerate = async () => {
    if (hasGenerated || isSavingRound) return;

    // 1. Generate player orientations: Clockwise = 1, Anticlockwise = 0
    const p1Ori: 'clockwise' | 'anticlockwise' = Math.random() < 0.5 ? 'clockwise' : 'anticlockwise';
    const p2Ori: 'clockwise' | 'anticlockwise' = Math.random() < 0.5 ? 'clockwise' : 'anticlockwise';
    const p3Ori: 'clockwise' | 'anticlockwise' = Math.random() < 0.5 ? 'clockwise' : 'anticlockwise';

    const p1Val: 0 | 1 = p1Ori === 'clockwise' ? 1 : 0;
    const p2Val: 0 | 1 = p2Ori === 'clockwise' ? 1 : 0;
    const p3Val: 0 | 1 = p3Ori === 'clockwise' ? 1 : 0;

    const newPlayers: PlayerState[] = [
      { id: 'player-1', name: 'Player 1', orientation: p1Ori },
      { id: 'player-2', name: 'Player 2', orientation: p2Ori },
      { id: 'player-3', name: 'Player 3', orientation: p3Ori },
    ];

    setPlayers(newPlayers);
    setHasGenerated(true);
    setGenerationKey((prev) => prev + 1);

    // 2. Start the timer immediately
    setIsTimerRunning(true);
    onStartTimer?.();

    // 3. Create round instance in Firestore collection 'rounds'
    // Target assigned orientations are in 'orientation: { player1, player2, player3 }'
    // 'player1', 'player2', 'player3', and 'orientations' are initially null until updated
    setIsSavingRound(true);
    setReportedPlayers({ player1: null, player2: null, player3: null });
    const now = new Date().toISOString();

    let computedRoundNumber = activeRoundNumber;
    try {
      const roundsQuery = query(collection(db, 'rounds'), where('teamId', '==', activeTeamId));
      const snap = await getDocs(roundsQuery);
      computedRoundNumber = snap.size + 1;
      setActiveRoundNumber(computedRoundNumber);
    } catch {
      computedRoundNumber = 1;
    }

    const roundDocId = `${activeTeamId}_round_${computedRoundNumber}_${Date.now()}`;
    setCurrentRoundDocId(roundDocId);

    const roundData: RoundInstance = {
      roundId: roundDocId,
      roundNumber: computedRoundNumber,
      teamId: activeTeamId,
      orientation: {
        player1: p1Val,
        player2: p2Val,
        player3: p3Val,
      },
      orientations: null, // Initially null
      player1: null,      // Initially null until updated!
      player2: null,      // Initially null until updated!
      player3: null,      // Initially null until updated!
      players: [
        { id: 'player-1', name: 'Player 1', orientation: p1Val, orientationLabel: p1Ori },
        { id: 'player-2', name: 'Player 2', orientation: p2Val, orientationLabel: p2Ori },
        { id: 'player-3', name: 'Player 3', orientation: p3Val, orientationLabel: p3Ori },
      ],
      timerStarted: true,
      createdAt: now,
      updatedAt: now,
    };

    // Direct Client-side Firestore persistence
    try {
      await setDoc(doc(db, 'rounds', roundDocId), roundData, { merge: true });
      console.log(`[Firestore Client] Round saved with player1, player2, player3 as null in 'rounds/${roundDocId}'`);
    } catch (fsErr) {
      console.warn('[Firestore Client] Error writing round to Firestore:', fsErr);
    }

    // Backend API persistence
    const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';
    try {
      await fetch(`${API_URL}/api/tasks/round`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          roundId: roundDocId,
          teamId: activeTeamId,
          roundNumber: computedRoundNumber,
          player1: p1Val,
          player2: p2Val,
          player3: p3Val,
        }),
      });
      console.log(`[Backend API] Round synced via backend API`);
    } catch (apiErr) {
      console.warn('[Backend API] Round sync API warning:', apiErr);
    } finally {
      setIsSavingRound(false);
    }
  };

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-[12px] p-5 shadow-sm space-y-4 min-h-[460px] flex flex-col justify-between">
      {/* Header row: "Task" label on left, primary action on right */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-zinc-800/80">
        <h2 className="text-sm font-semibold tracking-tight text-zinc-100">
          Task
        </h2>

        {/* Action Button & Active Round Timer Badge */}
        <div className="flex items-center space-x-2">
          {isTimerRunning && (
            <div className="flex items-center space-x-1.5 px-2.5 py-1 rounded-md bg-blue-950/60 border border-blue-800/50 text-blue-400 font-mono text-xs">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />
              <span>Round {activeRoundNumber}</span>
              <span className="text-zinc-600">|</span>
              <Clock className="w-3 h-3 text-blue-400" />
              <span>{formatTimer(roundTimer)}</span>
            </div>
          )}

          <button
            type="button"
            onClick={handleGenerate}
            disabled={hasGenerated || isSavingRound}
            className="px-3.5 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 active:bg-zinc-750 border border-zinc-700 text-zinc-200 text-xs font-medium transition-colors shadow-sm disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-zinc-800 select-none"
          >
            {isSavingRound ? 'Starting...' : hasGenerated ? 'Generated' : 'Generate'}
          </button>
        </div>
      </div>

      {/* -------------------------------------------------------------
          ORIENTATION GENERATOR CARDS (Reactive Blue / Red on verification)
      -------------------------------------------------------------- */}
      <div
        className="grid gap-3 flex-1 items-center content-center py-4"
        style={{
          gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
        }}
      >
        {players.map((player, idx) => {
          const isClockwise = player.orientation === 'clockwise';
          const isAnticlockwise = player.orientation === 'anticlockwise';
          const hasResult = player.orientation !== null;

          // Assigned orientation: 1 for Clockwise, 0 for Anticlockwise
          const assignedVal = isClockwise ? 1 : isAnticlockwise ? 0 : null;

          // Reported value for this player from Firestore (null until updated!)
          const playerKey = `player${idx + 1}` as 'player1' | 'player2' | 'player3';
          const reportedVal = reportedPlayers[playerKey];

          // Comparison:
          // - matched: reportedVal === assignedVal -> BLUE card
          // - mismatched: reportedVal !== assignedVal -> RED card
          // - idle: reportedVal === null -> Default dark card
          let matchStatus: 'idle' | 'matched' | 'mismatched' = 'idle';
          if (hasResult && reportedVal !== null && assignedVal !== null) {
            matchStatus = reportedVal === assignedVal ? 'matched' : 'mismatched';
          }

          // Card theme styling
          const cardThemeClass =
            matchStatus === 'matched'
              ? 'bg-blue-950/40 border-blue-500 shadow-[0_0_24px_rgba(59,130,246,0.35)] ring-1 ring-blue-500/50'
              : matchStatus === 'mismatched'
              ? 'bg-red-950/40 border-red-500 shadow-[0_0_24px_rgba(239,68,68,0.35)] ring-1 ring-red-500/50'
              : 'bg-zinc-950/70 border-zinc-800/80 shadow-sm';

          // Icon and text accent colors
          const iconColorClass =
            matchStatus === 'matched'
              ? 'text-blue-400 drop-shadow-[0_0_12px_rgba(59,130,246,0.5)]'
              : matchStatus === 'mismatched'
              ? 'text-red-400 drop-shadow-[0_0_12px_rgba(239,68,68,0.5)]'
              : isClockwise
              ? 'text-emerald-400 drop-shadow-[0_0_10px_rgba(52,211,153,0.35)]'
              : isAnticlockwise
              ? 'text-amber-400 drop-shadow-[0_0_10px_rgba(251,191,36,0.35)]'
              : 'text-zinc-600';

          const labelColorClass =
            matchStatus === 'matched'
              ? 'text-blue-400 font-semibold'
              : matchStatus === 'mismatched'
              ? 'text-red-400 font-semibold'
              : isClockwise
              ? 'text-emerald-400 font-semibold'
              : isAnticlockwise
              ? 'text-amber-400 font-semibold'
              : 'text-zinc-600';

          return (
            <div
              key={player.id}
              className={`rounded-[12px] border py-7 px-4 flex flex-col items-center justify-between gap-3 text-center transition-all duration-300 min-h-[220px] ${cardThemeClass}`}
            >
              {/* Header row inside card */}
              <div className="flex items-center justify-between w-full">
                <span className="text-[13px] font-medium text-zinc-300 select-none">
                  {player.name}
                </span>

                {matchStatus === 'matched' && (
                  <span className="flex items-center space-x-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-blue-500/20 text-blue-300 border border-blue-500/40 animate-pulse">
                    <CheckCircle2 className="w-3 h-3 text-blue-400" />
                    <span>Matched</span>
                  </span>
                )}

                {matchStatus === 'mismatched' && (
                  <span className="flex items-center space-x-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-red-500/20 text-red-300 border border-red-500/40">
                    <XCircle className="w-3 h-3 text-red-400" />
                    <span>Mismatch</span>
                  </span>
                )}

                {matchStatus === 'idle' && hasResult && (
                  <span className="text-[10px] font-mono text-zinc-500">
                    {reportedVal === null ? 'Waiting...' : ''}
                  </span>
                )}
              </div>

              {/* Main Icon & Assigned Label */}
              {hasResult ? (
                <div className="flex flex-col items-center justify-center space-y-2 my-auto">
                  <div
                    key={`${player.id}-${generationKey}`}
                    className={`transition-all duration-300 transform scale-100 ${iconColorClass}`}
                  >
                    {isClockwise ? <TablerRotateClockwise /> : <TablerRotate />}
                  </div>

                  <span className={`text-[13px] transition-colors select-none ${labelColorClass}`}>
                    {isClockwise ? 'Clockwise (1)' : isAnticlockwise ? 'Anticlockwise (0)' : ''}
                  </span>
                </div>
              ) : (
                <div className="my-auto">
                  <span className="text-[13px] font-medium text-zinc-600 select-none">
                    —
                  </span>
                </div>
              )}

              {/* Footer readout inside card */}
              <div className="w-full text-center text-[10px] font-mono border-t border-zinc-800/40 pt-1.5">
                {reportedVal !== null ? (
                  <span className={matchStatus === 'matched' ? 'text-blue-300 font-semibold' : 'text-red-300 font-semibold'}>
                    Reported: {reportedVal} {reportedVal === 1 ? '(CW)' : '(CCW)'}
                  </span>
                ) : (
                  <span className="text-zinc-600">
                    {hasResult ? 'Waiting for update (null)' : 'Standby'}
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Round 1: code revealed on the field phones after a correct rotation sequence */}
      <Round1CodeEntry onVerified={onRound1Complete} />

      {/* Bottom subtle indicator */}
      <div className="pt-2 text-center border-t border-zinc-800/60 flex items-center justify-between text-[11px] text-zinc-500">
        <div className="flex items-center space-x-2">
          <Layers className="w-3.5 h-3.5 text-zinc-400" />
          <span>
            Reported values:{' '}
            <span className="font-mono text-zinc-300">
              P1: {reportedPlayers.player1 === null ? 'null' : reportedPlayers.player1} |{' '}
              P2: {reportedPlayers.player2 === null ? 'null' : reportedPlayers.player2} |{' '}
              P3: {reportedPlayers.player3 === null ? 'null' : reportedPlayers.player3}
            </span>
          </span>
        </div>
        <span className="font-mono text-zinc-400 uppercase text-[10px]">
          {hasGenerated ? `Round ${activeRoundNumber} Active` : 'Ready'}
        </span>
      </div>
    </div>
  );
};
