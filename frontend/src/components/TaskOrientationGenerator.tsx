import React, { useState } from 'react';
import {
  ShieldCheck,
  Rocket,
  Check,
  Layers,
} from 'lucide-react';
import { TaskType } from '../types/auth.js';

type Orientation = 'clockwise' | 'anticlockwise' | null;

interface PlayerState {
  id: string;
  name: string;
  orientation: Orientation;
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

export const TaskOrientationGenerator: React.FC = () => {
  // Active task type switcher
  const [activeTaskType, setActiveTaskType] = useState<TaskType>('orientation');

  // 1. Orientation Task State
  const [players, setPlayers] = useState<PlayerState[]>(INITIAL_PLAYERS);
  const [generationKey, setGenerationKey] = useState<number>(0);
  const [hasGenerated, setHasGenerated] = useState<boolean>(false);

  // 2. Sprint Spec Checklist State
  const [specChecklist, setSpecChecklist] = useState([
    { id: 'chk-1', label: 'Define WebSocket session & timer synchronization protocol', done: true },
    { id: 'chk-2', label: 'Enforce verified @gmail.com OAuth domain restrictions', done: true },
    { id: 'chk-3', label: 'Establish Agent Pipeline task state machine & orientation rules', done: true },
    { id: 'chk-4', label: 'Verify production edge deployment health check probes', done: false },
  ]);

  // 3. QA Code Review State
  const [testsApproved, setTestsApproved] = useState<boolean>(false);

  // 4. Deployment State
  const [deployState, setDeployState] = useState<'ready' | 'deploying' | 'live'>('ready');

  // Orientation generator trigger
  const handleGenerate = () => {
    if (hasGenerated) return;

    setHasGenerated(true);
    setGenerationKey((prev) => prev + 1);
    setPlayers((prev) =>
      prev.map((player) => ({
        ...player,
        orientation: Math.random() < 0.5 ? 'clockwise' : 'anticlockwise',
      }))
    );
  };

  // Toggle spec checklist
  const handleToggleChecklist = (id: string) => {
    setSpecChecklist((prev) =>
      prev.map((item) => (item.id === id ? { ...item, done: !item.done } : item))
    );
  };

  // Trigger canary deployment
  const handleDeploy = () => {
    if (deployState === 'deploying') return;
    setDeployState('deploying');
    setTimeout(() => {
      setDeployState('live');
    }, 1200);
  };

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-[12px] p-5 shadow-sm space-y-4 min-h-[460px] flex flex-col justify-between">
      {/* Header row: "Task" label & dynamic task tabs on left, primary action on right */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-zinc-800/80">
        <div className="flex items-center space-x-3">
          <h2 className="text-sm font-semibold tracking-tight text-zinc-100 flex items-center space-x-1.5">
            <span>Task</span>
          </h2>

          <span className="text-zinc-700 text-xs">/</span>

          {/* Task Type Switcher Tabs */}
          <div className="flex items-center space-x-1 bg-zinc-950 p-0.5 rounded-lg border border-zinc-800/80 text-[11px]">
            <button
              type="button"
              onClick={() => setActiveTaskType('orientation')}
              className={`px-2.5 py-1 rounded-md transition-colors font-medium ${
                activeTaskType === 'orientation'
                  ? 'bg-zinc-800 text-white shadow-sm'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              Orientation
            </button>
            <button
              type="button"
              onClick={() => setActiveTaskType('spec_review')}
              className={`px-2.5 py-1 rounded-md transition-colors font-medium ${
                activeTaskType === 'spec_review'
                  ? 'bg-zinc-800 text-white shadow-sm'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              Sprint Spec
            </button>
            <button
              type="button"
              onClick={() => setActiveTaskType('code_review')}
              className={`px-2.5 py-1 rounded-md transition-colors font-medium ${
                activeTaskType === 'code_review'
                  ? 'bg-zinc-800 text-white shadow-sm'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              QA Review
            </button>
            <button
              type="button"
              onClick={() => setActiveTaskType('deployment')}
              className={`px-2.5 py-1 rounded-md transition-colors font-medium ${
                activeTaskType === 'deployment'
                  ? 'bg-zinc-800 text-white shadow-sm'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              Deployment
            </button>
          </div>
        </div>

        {/* Action Button tailored to current task */}
        <div>
          {activeTaskType === 'orientation' && (
            <button
              type="button"
              onClick={handleGenerate}
              disabled={hasGenerated}
              className="px-3.5 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 active:bg-zinc-750 border border-zinc-700 text-zinc-200 text-xs font-medium transition-colors shadow-sm disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-zinc-800 select-none"
            >
              {hasGenerated ? 'Generated' : 'Generate'}
            </button>
          )}

          {activeTaskType === 'spec_review' && (
            <span className="text-[11px] font-mono text-emerald-400 bg-emerald-950/40 px-2 py-1 rounded border border-emerald-800/40">
              Spec v2.4.1 Active
            </span>
          )}

          {activeTaskType === 'code_review' && (
            <button
              type="button"
              onClick={() => setTestsApproved(true)}
              disabled={testsApproved}
              className="px-3.5 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-zinc-200 text-xs font-medium transition-colors shadow-sm disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {testsApproved ? 'Approved' : 'Approve QA'}
            </button>
          )}

          {activeTaskType === 'deployment' && (
            <button
              type="button"
              onClick={handleDeploy}
              disabled={deployState === 'live'}
              className="px-3.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium transition-colors shadow-sm disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {deployState === 'deploying'
                ? 'Deploying...'
                : deployState === 'live'
                ? 'Deployed Live'
                : 'Deploy to Canary'}
            </button>
          )}
        </div>
      </div>

      {/* -------------------------------------------------------------
          1. ORIENTATION GENERATOR TASK VIEW
      -------------------------------------------------------------- */}
      {activeTaskType === 'orientation' && (
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
                    {/* Orientation icon — 28px with vibrant color & 0.6s ease spin */}
                    <div
                      key={`${player.id}-${generationKey}`}
                      className={`w-7 h-7 flex items-center justify-center transition-all ${
                        isClockwise ? 'animate-spin-cw' : 'animate-spin-ccw'
                      } ${iconColorClass}`}
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
      )}

      {/* -------------------------------------------------------------
          2. SPRINT SPECIFICATION TASK VIEW
      -------------------------------------------------------------- */}
      {activeTaskType === 'spec_review' && (
        <div className="flex-1 flex flex-col justify-center py-2 space-y-3">
          <div className="p-3.5 rounded-lg bg-zinc-950/60 border border-zinc-800/80 flex items-start justify-between">
            <div>
              <h3 className="text-xs font-semibold text-zinc-200">
                Multi-Agent Coordination & Schema Spec
              </h3>
              <p className="text-[11px] text-zinc-400 mt-0.5">
                Verify architecture requirements, data contracts, and pipeline state constraints.
              </p>
            </div>
            <span className="text-[10px] font-mono text-zinc-400 bg-zinc-900 px-2 py-0.5 rounded border border-zinc-800">
              Stage 1 of 4
            </span>
          </div>

          <div className="space-y-2">
            {specChecklist.map((item) => (
              <div
                key={item.id}
                onClick={() => handleToggleChecklist(item.id)}
                className={`p-3 rounded-lg border transition-all cursor-pointer flex items-center space-x-3 ${
                  item.done
                    ? 'bg-zinc-950/40 border-zinc-800/60 text-zinc-200'
                    : 'bg-zinc-950/80 border-zinc-800 text-zinc-400 hover:border-zinc-700'
                }`}
              >
                <div
                  className={`w-4 h-4 rounded-[4px] border flex items-center justify-center shrink-0 ${
                    item.done
                      ? 'bg-blue-600 border-blue-500 text-white'
                      : 'border-zinc-700 bg-zinc-900'
                  }`}
                >
                  {item.done && <Check className="w-3 h-3 stroke-[3]" />}
                </div>
                <span className={`text-xs ${item.done ? 'text-zinc-200' : 'text-zinc-400'}`}>
                  {item.label}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* -------------------------------------------------------------
          3. AUTOMATED QA CODE REVIEW TASK VIEW
      -------------------------------------------------------------- */}
      {activeTaskType === 'code_review' && (
        <div className="flex-1 flex flex-col justify-center py-2 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="p-4 rounded-xl bg-zinc-950/70 border border-zinc-800/80 text-center space-y-1">
              <span className="text-[11px] text-zinc-400 uppercase tracking-wider">Test Suite</span>
              <p className="text-2xl font-bold font-mono text-emerald-400">52 / 52</p>
              <span className="text-[10px] text-emerald-500 font-medium">100% Passing</span>
            </div>

            <div className="p-4 rounded-xl bg-zinc-950/70 border border-zinc-800/80 text-center space-y-1">
              <span className="text-[11px] text-zinc-400 uppercase tracking-wider">Coverage</span>
              <p className="text-2xl font-bold font-mono text-blue-400">94.8%</p>
              <span className="text-[10px] text-blue-500 font-medium">Target &gt; 85%</span>
            </div>

            <div className="p-4 rounded-xl bg-zinc-950/70 border border-zinc-800/80 text-center space-y-1">
              <span className="text-[11px] text-zinc-400 uppercase tracking-wider">Vulnerabilities</span>
              <p className="text-2xl font-bold font-mono text-zinc-200">0</p>
              <span className="text-[10px] text-emerald-500 font-medium">Clean Audit</span>
            </div>
          </div>

          <div className="p-3.5 rounded-lg bg-zinc-950/50 border border-zinc-800/80 flex items-center justify-between text-xs text-zinc-300">
            <div className="flex items-center space-x-2">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <span>Automated Static Analysis &amp; Security Verification complete.</span>
            </div>
            <span className="text-emerald-400 font-mono text-[11px]">Ready for Approval</span>
          </div>
        </div>
      )}

      {/* -------------------------------------------------------------
          4. CANARY DEPLOYMENT TASK VIEW
      -------------------------------------------------------------- */}
      {activeTaskType === 'deployment' && (
        <div className="flex-1 flex flex-col justify-center py-2 space-y-4">
          <div className="p-4 rounded-xl bg-zinc-950/70 border border-zinc-800/80 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Rocket className="w-4 h-4 text-amber-400" />
                <span className="text-xs font-semibold text-zinc-200">
                  Target Environment: production-primary
                </span>
              </div>
              <span
                className={`text-[10px] font-mono px-2 py-0.5 rounded border ${
                  deployState === 'live'
                    ? 'bg-emerald-950/50 text-emerald-400 border-emerald-800/60'
                    : deployState === 'deploying'
                    ? 'bg-blue-950/50 text-blue-400 border-blue-800/60'
                    : 'bg-zinc-900 text-zinc-400 border-zinc-800'
                }`}
              >
                {deployState.toUpperCase()}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2 text-[11px] text-zinc-400 pt-1">
              <div>
                <span className="text-zinc-500">Version: </span>
                <span className="text-zinc-200 font-mono">v1.1.0-release</span>
              </div>
              <div>
                <span className="text-zinc-500">Edge Health: </span>
                <span className="text-emerald-400 font-mono">100% Operational</span>
              </div>
            </div>
          </div>

          <div className="p-3 rounded-lg bg-zinc-950/50 border border-zinc-800/80 flex items-center justify-between text-xs text-zinc-400">
            <span>Automated rollback gates enabled across all clusters</span>
            <span className="text-zinc-500 font-mono text-[10px]">Zero Downtime</span>
          </div>
        </div>
      )}

      {/* Bottom subtle indicator */}
      <div className="pt-2 text-center border-t border-zinc-800/60 flex items-center justify-between text-[11px] text-zinc-500">
        <div className="flex items-center space-x-1.5">
          <Layers className="w-3.5 h-3.5 text-zinc-400" />
          <span>Adavya Multi-Task Workspace Pipeline</span>
        </div>
        <span className="font-mono text-zinc-400 uppercase text-[10px]">
          {activeTaskType.replace('_', ' ')}
        </span>
      </div>
    </div>
  );
};
