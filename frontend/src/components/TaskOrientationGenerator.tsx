import React, { useState, useEffect } from 'react';
import {
  Layers,
  Clock,
} from 'lucide-react';
import { doc, setDoc, collection, getDocs, query, where } from 'firebase/firestore';
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
}) => {
  const { user } = useAuth();
  const activeTeamId = propTeamId || user?.teamId || 'TEAM-ALPHA';

  // 1. Orientation Task State
  const [players, setPlayers] = useState<PlayerState[]>(INITIAL_PLAYERS);
  const [generationKey, setGenerationKey] = useState<number>(0);
  const [hasGenerated, setHasGenerated] = useState<boolean>(false);

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

  // Orientation generator trigger with Timer & Firestore Round recording
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
    onStartTimer?.(); // Starts the Left Sidebar timer as well

    // 3. Create round instance in Firestore collection 'rounds'
    setIsSavingRound(true);
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

    const roundData: RoundInstance = {
      roundId: roundDocId,
      roundNumber: computedRoundNumber,
      teamId: activeTeamId,
      orientation: {
        player1: p1Val,
        player2: p2Val,
        player3: p3Val,
      },
      orientations: [p1Val, p2Val, p3Val],
      player1: p1Val,
      player2: p2Val,
      player3: p3Val,
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
      console.log(`[Firestore Client] Round instance saved to 'rounds/${roundDocId}' (Round ${computedRoundNumber})`);
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
          1. ORIENTATION GENERATOR TASK VIEW
      -------------------------------------------------------------- */}
      <div
        className="grid gap-3 flex-1 items-center content-center py-4"
        style={{
          gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
        }}
      >
        {players.map((player) => {
          const isClockwise = player.orientation === 'clockwise';
          const isAnticlockwise = player.orientation === 'anticlockwise';
          const hasResult = player.orientation !== null;

          // Vibrant emerald for Clockwise, vibrant amber for Anticlockwise
          const iconColorClass = isClockwise
            ? 'text-emerald-400 drop-shadow-[0_0_10px_rgba(52,211,153,0.35)]'
            : isAnticlockwise
            ? 'text-amber-400 drop-shadow-[0_0_10px_rgba(251,191,36,0.35)]'
            : 'text-zinc-600';

          const labelColorClass = isClockwise
            ? 'text-emerald-400 font-semibold'
            : isAnticlockwise
            ? 'text-amber-400 font-semibold'
            : 'text-zinc-600';

          return (
            <div
              key={player.id}
              className="bg-zinc-950/70 border border-zinc-800/80 rounded-[12px] py-10 px-5 flex flex-col items-center justify-center gap-3 text-center transition-all shadow-sm min-h-[220px]"
            >
              {/* Player name — 13px, medium weight, secondary text color */}
              <span className="text-[13px] font-medium text-zinc-400 select-none">
                {player.name}
              </span>

              {/* Only show icon and label AFTER generate is clicked */}
              {hasResult ? (
                <>
                  {/* Icon container */}
                  <div
                    key={`${player.id}-${generationKey}`}
                    className={`transition-all duration-300 transform scale-100 ${iconColorClass}`}
                  >
                    {isClockwise ? (
                      <TablerRotateClockwise />
                    ) : (
                      <TablerRotate />
                    )}
                  </div>

                  {/* Orientation label — 13px */}
                  <span className={`text-[13px] transition-colors select-none ${labelColorClass}`}>
                    {isClockwise
                      ? 'Clockwise'
                      : isAnticlockwise
                      ? 'Anticlockwise'
                      : ''}
                  </span>
                </>
              ) : (
                /* Before first generate: No icon below player name */
                <span className="text-[13px] font-medium text-zinc-600 select-none">
                  —
                </span>
              )}
            </div>
          );
        })}
      </div>

      {/* Bottom subtle indicator */}
      <div className="pt-2 text-center border-t border-zinc-800/60 flex items-center justify-between text-[11px] text-zinc-500">
        <div className="flex items-center space-x-1.5">
          <Layers className="w-3.5 h-3.5 text-zinc-400" />
          <span>Task Pipeline</span>
        </div>
        <span className="font-mono text-zinc-400 uppercase text-[10px]">
          {hasGenerated ? `Round ${activeRoundNumber} Active` : 'Ready'}
        </span>
      </div>
    </div>
  );
};
