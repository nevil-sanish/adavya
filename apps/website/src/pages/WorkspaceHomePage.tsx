import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext.js';
import {
  Clock,
  Check,
  LogOut,
  Sparkles,
  Users,
} from 'lucide-react';
import { TaskOrientationGenerator } from '../components/TaskOrientationGenerator.js';
import { Round2WordEntry } from '../components/Round2WordEntry.js';
import { Round3PoseRelay } from '../components/Round3PoseRelay.js';
import { devAdvanceTask, getTeamProgress, type TeamProgress } from '../services/api.js';

/** The six tasks of the game, in play order. Only the first two are built so far. */
const TASKS = [
  'Sensor Sequence',
  'Geofence Hunt',
  'Pose Relay',
  'Task 4',
  'Task 5',
  'Task 6',
];

/** How many tasks a team has finished, derived from its round status. */
const COMPLETED_TASKS: Record<TeamProgress['roundStatus'], number> = {
  not_started: 0,
  round1: 0,
  round2: 1,
  round3: 2,
  completed: 3,
};

const AVATAR_COLORS = ['#097fe8', '#f64932', '#ffb110', '#62aef0'];

const initialsOf = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase() || '?';

export const WorkspaceHomePage: React.FC = () => {
  const { user, logout } = useAuth();

  // Which round the team is on decides whether HQ sees Round 1 or Round 2.
  const [roundStatus, setRoundStatus] = useState<TeamProgress['roundStatus'] | null>(null);
  const [teamMembers, setTeamMembers] = useState<TeamProgress['members'] | null>(null);
  useEffect(() => {
    getTeamProgress()
      .then((progress) => {
        setRoundStatus(progress.roundStatus);
        setTeamMembers(progress.members);
      })
      .catch(() => {
        setRoundStatus('not_started');
        setTeamMembers([]);
      });
  }, []);

  // ----------------------------------------------------
  // 1. TIMER STATE (Initialized at 00:00, Idle on Page Load)
  // ----------------------------------------------------
  const [timerSeconds, setTimerSeconds] = useState(0);
  const [isRunning, setIsRunning] = useState(false);

  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;
    if (isRunning) {
      interval = setInterval(() => {
        setTimerSeconds((prev) => prev + 1);
      }, 1000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isRunning]);


  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60)
      .toString()
      .padStart(2, '0');
    const s = (secs % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  const completedTasks = COMPLETED_TASKS[roundStatus ?? 'not_started'];

  // Dev-only shortcut for testing later tasks without solving earlier ones.
  const [isAdvancing, setIsAdvancing] = useState(false);
  const [devError, setDevError] = useState<string | null>(null);
  const handleDevAdvance = async () => {
    setIsAdvancing(true);
    setDevError(null);
    try {
      const { roundStatus: next } = await devAdvanceTask();
      setRoundStatus(next);
    } catch (err) {
      setDevError(err instanceof Error ? err.message : 'Could not skip the task.');
    } finally {
      setIsAdvancing(false);
    }
  };

  const currentUserName = user?.name || 'Player';

  const currentTaskspaceName = user?.taskspaceName || 'Core Intelligence';
  const currentTeamId = user?.teamId || 'TEAM-ALPHA';

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 font-sans antialiased flex flex-col selection:bg-zinc-800 selection:text-white">
      {/* ----------------------------------------------------
          TOP NAVIGATION BAR (Black/Zinc Theme)
      ---------------------------------------------------- */}
      <header className="sticky top-0 z-40 bg-zinc-950/80 backdrop-blur-md border-b border-zinc-800 shadow-sm h-14">
        <div className="w-full px-4 sm:px-6 lg:px-8 h-full flex items-center justify-between">
          {/* Brand & Team Taskspace Indicator */}
          <div className="flex items-center space-x-3">
            <div className="flex items-center space-x-2">
              <div className="w-7 h-7 rounded-[6px] bg-zinc-900 border border-zinc-800 flex items-center justify-center">
                <svg
                  className="w-3.5 h-3.5 text-zinc-100"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <polygon points="12 2 2 7 12 12 22 7 12 2" />
                  <polyline points="2 17 12 22 22 17" />
                  <polyline points="2 12 12 17 22 12" />
                </svg>
              </div>
              <span className="font-semibold text-sm tracking-tight text-white">Adavya</span>
            </div>

            <span className="text-zinc-700 text-xs">/</span>

            {/* Team Taskspace Pill */}
            <div className="flex items-center space-x-1.5 px-2.5 py-0.5 rounded-full bg-zinc-900 border border-zinc-800 text-xs">
              <span className="w-1.5 h-1.5 rounded-full bg-[#ffb110]" />
              <span className="font-medium text-zinc-200">{currentTaskspaceName}</span>
              <span className="font-mono text-[10px] text-zinc-400 bg-zinc-950 px-1 py-0.2 rounded-[4px] border border-zinc-800/80">
                {currentTeamId}
              </span>
            </div>
          </div>

          {/* User Controls */}
          <div className="flex items-center space-x-2.5">
            <div className="hidden sm:flex items-center space-x-2 px-2 py-0.5 rounded-[6px] bg-zinc-900 border border-zinc-800">
              <div className="w-5 h-5 rounded-full border-2 border-[#097fe8] bg-zinc-950 flex items-center justify-center text-[9px] font-bold text-[#097fe8]">
                {currentUserName.charAt(0)}
              </div>
              <span className="text-xs font-medium text-zinc-200">{currentUserName}</span>
            </div>

            <button
              onClick={() => logout()}
              className="flex items-center space-x-1.5 px-2.5 py-1 rounded-[6px] bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-xs font-medium text-zinc-400 hover:text-white transition-colors"
            >
              <LogOut className="w-3 h-3" />
              <span className="hidden sm:inline">Sign Out</span>
            </button>
          </div>
        </div>
      </header>

      {/* ----------------------------------------------------
          MAIN OVERVIEW CANVAS (Black Theme)
          [ Team Members (Left) ]  [ Pipeline & Plain Text 'Task' (Right) ]
      ---------------------------------------------------- */}
      <main className="flex-1 w-full px-4 sm:px-6 lg:px-8 py-4 space-y-4">
        <div className="flex flex-col lg:flex-row gap-4 items-start w-full">
          {/* --------------------------------------------------
              LEFT SIDEBAR: TIMER + TEAM MEMBERS
              Slim, compact width (lg:w-[240px])
          --------------------------------------------------- */}
          <div className="w-full lg:w-[240px] shrink-0 space-y-3">
            {/* 1. TIMER CARD (Synchronized with Task Orientation Generator) */}
            <div className="bg-zinc-900 border border-zinc-800 rounded-[12px] p-3 space-y-2 shadow-sm">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-1.5">
                  <Clock className="w-3.5 h-3.5 text-blue-400" />
                  <h2 className="text-xs font-semibold tracking-tight text-zinc-200">
                    Timer
                  </h2>
                </div>
                <span
                  className={`text-[10px] font-medium px-2 py-0.5 rounded-full border inline-flex items-center space-x-1 ${
                    isRunning
                      ? 'bg-blue-950/70 text-blue-400 border-blue-800/40'
                      : 'bg-zinc-950 text-zinc-500 border-zinc-800'
                  }`}
                >
                  {isRunning && (
                    <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse mr-1" />
                  )}
                  <span>{isRunning ? 'Active' : 'Standby'}</span>
                </span>
              </div>

              {/* Digital Display (Starts at 00:00, starts ticking on Generate click) */}
              <div className="text-center py-2.5 bg-zinc-950/60 rounded-lg border border-zinc-800/60">
                <div className="font-mono text-3xl font-bold tracking-tight text-white tabular-nums">
                  {formatTime(timerSeconds)}
                </div>
                <p className="text-[10px] text-zinc-500 mt-1">
                  {isRunning ? 'Round session in progress' : 'Starts on task generation'}
                </p>
              </div>
            </div>

            {/* 2. TEAM MEMBERS */}
            <div className="bg-zinc-900 border border-zinc-800 rounded-[12px] p-3 space-y-2 shadow-sm">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-1.5">
                  <Users className="w-3.5 h-3.5 text-blue-400" />
                  <h2 className="text-xs font-semibold tracking-tight text-zinc-200">
                    Team Members
                  </h2>
                </div>
                {teamMembers && (
                  <span className="text-[10px] text-zinc-500 font-mono">
                    {teamMembers.length} {teamMembers.length === 1 ? 'member' : 'members'}
                  </span>
                )}
              </div>

              {teamMembers === null ? (
                <p className="text-[11px] text-zinc-500 py-1">Loading team…</p>
              ) : teamMembers.length === 0 ? (
                <p className="text-[11px] text-zinc-500 py-1">No team members found.</p>
              ) : (
                <ul className="space-y-1.5">
                  {teamMembers.map((member, idx) => {
                    const color = AVATAR_COLORS[idx % AVATAR_COLORS.length];
                    return (
                      <li
                        key={member.uid || member.email || idx}
                        className="flex items-center space-x-2 py-1.5 px-2 rounded-[6px] border bg-zinc-950/50 border-zinc-800/80"
                      >
                        <div
                          className="w-6 h-6 rounded-full bg-zinc-900 flex items-center justify-center text-[10px] font-bold shrink-0"
                          style={{ border: `2px solid ${color}`, color }}
                        >
                          {initialsOf(member.name)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-[11px] font-medium text-zinc-200 leading-tight truncate">
                            {member.name}
                            {member.isYou && <span className="text-zinc-500"> (You)</span>}
                          </p>
                          <p className="text-[9px] text-zinc-500 leading-none mt-0.5 truncate">
                            {member.isCaptain ? 'Captain' : 'Member'}
                          </p>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </div>

          {/* --------------------------------------------------
              RIGHT MAIN AREA: PIPELINE + PLAIN TEXT 'TASK'
          --------------------------------------------------- */}
          <div className="flex-1 min-w-0 space-y-3">
            {/* 2. TOP-RIGHT CARD: TASK PROGRESS */}
            <div className="bg-zinc-900 border border-zinc-800 rounded-[12px] px-4 py-3 shadow-sm">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center space-x-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                  <h2 className="text-xs font-semibold tracking-tight text-zinc-200">
                    Tasks
                  </h2>
                </div>
                <div className="flex items-center gap-2">
                  {import.meta.env.DEV && (
                    <>
                      {devError && <span className="text-[10px] text-red-300">{devError}</span>}
                      <button
                        type="button"
                        onClick={handleDevAdvance}
                        disabled={isAdvancing || roundStatus === null || roundStatus === 'completed'}
                        title="Development only: skip to the next task"
                        className="px-2 py-0.5 rounded-md border border-dashed border-amber-500/60 text-amber-400 hover:bg-amber-500/10 text-[10px] font-mono transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        {isAdvancing ? 'Skipping…' : 'DEV · Next task →'}
                      </button>
                    </>
                  )}
                  <span className="text-[10px] text-zinc-500 font-mono">
                    {completedTasks} / {TASKS.length} completed
                  </span>
                </div>
              </div>

              <ol className="relative flex items-start justify-between py-1">
                <div aria-hidden="true" className="absolute left-[8%] right-[8%] top-[18px] h-[2px] bg-zinc-800" />
                {TASKS.map((label, idx) => {
                  const isCompleted = idx < completedTasks;
                  const isActive = idx === completedTasks;
                  return (
                    <li
                      key={label}
                      aria-current={isActive ? 'step' : undefined}
                      className="relative flex-1 flex flex-col items-center text-center select-none min-w-0"
                    >
                      <div
                        className={`w-7 h-7 rounded-full flex items-center justify-center transition-all ${
                          isCompleted
                            ? 'bg-blue-600 text-white shadow-sm ring-2 ring-blue-500/20'
                            : isActive
                            ? 'bg-zinc-900 border-2 border-blue-500 text-blue-400 ring-2 ring-blue-500/30'
                            : 'bg-zinc-900 border-2 border-zinc-700 text-zinc-500'
                        }`}
                      >
                        {isCompleted ? (
                          <Check aria-label="Completed" className="w-4 h-4 stroke-[2.5]" />
                        ) : (
                          <span className="text-[10px] font-semibold">{idx + 1}</span>
                        )}
                      </div>
                      <p
                        className={`text-[11px] font-medium mt-1 tracking-tight truncate max-w-full px-1 ${
                          isActive ? 'text-blue-400 font-semibold' : isCompleted ? 'text-zinc-200' : 'text-zinc-500'
                        }`}
                      >
                        {label}
                      </p>
                    </li>
                  );
                })}
              </ol>
            </div>

            {roundStatus === 'round3' || roundStatus === 'completed' ? (
              <Round3PoseRelay
                key={roundStatus}
                alreadyCompleted={roundStatus === 'completed'}
                onCompleted={() => setRoundStatus('completed')}
              />
            ) : roundStatus === 'round2' ? (
              <Round2WordEntry onCompleted={() => setTimeout(() => setRoundStatus('round3'), 1500)} />
            ) : (
              <TaskOrientationGenerator
                onStartTimer={() => {
                  setTimerSeconds(0);
                  setIsRunning(true);
                }}
                teamId={currentTeamId}
                onRound1Complete={() => setTimeout(() => setRoundStatus('round2'), 1500)}
              />
            )}
          </div>
        </div>
      </main>
    </div>
  );
};
