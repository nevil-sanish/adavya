import React, { useState } from 'react';

type Orientation = 'clockwise' | 'anticlockwise' | null;

interface PlayerState {
  id: string;
  name: string;
  orientation: Orientation;
}

/**
 * Tabler Outline: rotate (counterclockwise arrow)
 * Used for Default (muted) and Anticlockwise states.
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

export const TaskOrientationGenerator: React.FC = () => {
  const [players, setPlayers] = useState<PlayerState[]>(INITIAL_PLAYERS);
  const [generationKey, setGenerationKey] = useState<number>(0);

  const handleGenerate = () => {
    // Re-randomize each player independently (50/50 clockwise vs. anticlockwise)
    setGenerationKey((prev) => prev + 1);
    setPlayers((prev) =>
      prev.map((player) => ({
        ...player,
        orientation: Math.random() < 0.5 ? 'clockwise' : 'anticlockwise',
      }))
    );
  };

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-[12px] p-5 shadow-sm space-y-4 min-h-[420px] flex flex-col justify-between">
      {/* Header row: "Task" label on the left, Generate button on the right */}
      <div className="flex items-center justify-between pb-3 border-b border-zinc-800/80">
        <h2 className="text-sm font-semibold tracking-tight text-zinc-200">
          Task
        </h2>

        {/* Standard secondary button styling, no special state (always enabled) */}
        <button
          type="button"
          onClick={handleGenerate}
          className="px-3.5 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 active:bg-zinc-750 border border-zinc-700 text-zinc-200 text-xs font-medium transition-colors shadow-sm cursor-pointer select-none"
        >
          Generate
        </button>
      </div>

      {/* Grid below: 3 player cards, grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)), 12px gap */}
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

          return (
            <div
              key={player.id}
              className="bg-zinc-950/70 border border-zinc-800/80 rounded-[12px] py-6 px-4 flex flex-col items-center justify-center gap-[10px] text-center transition-all shadow-sm"
            >
              {/* Player name — 13px, medium weight, secondary text color */}
              <span className="text-[13px] font-medium text-zinc-400 select-none">
                {player.name}
              </span>

              {/* Orientation icon — 28px, plays 0.6s ease spin in resolved direction */}
              <div
                key={`${player.id}-${generationKey}`}
                className={`w-7 h-7 flex items-center justify-center transition-colors ${
                  isClockwise
                    ? 'animate-spin-cw text-blue-400'
                    : isAnticlockwise
                    ? 'animate-spin-ccw text-blue-400'
                    : 'text-zinc-600'
                }`}
              >
                {isClockwise ? (
                  <TablerRotateClockwise />
                ) : (
                  <TablerRotate />
                )}
              </div>

              {/* Orientation label — 13px */}
              <span
                className={`text-[13px] font-medium transition-colors select-none ${
                  hasResult ? 'text-blue-400 font-semibold' : 'text-zinc-600'
                }`}
              >
                {isClockwise
                  ? 'Clockwise'
                  : isAnticlockwise
                  ? 'Anticlockwise'
                  : '—'}
              </span>
            </div>
          );
        })}
      </div>

      {/* Bottom subtle indicator */}
      <div className="pt-2 text-center">
        <p className="text-[11px] text-zinc-500 font-mono">
          Agent Pipeline • Orientation Generator
        </p>
      </div>
    </div>
  );
};
