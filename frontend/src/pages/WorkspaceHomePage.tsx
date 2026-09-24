import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext.js';
import {
  Clock,
  Play,
  Pause,
  RotateCcw,
  Check,
  LogOut,
  ArrowRight,
  Sparkles,
  Users,
} from 'lucide-react';

interface PipelineStage {
  id: number;
  label: string;
  subtitle: string;
  status: 'completed' | 'active' | 'pending';
}

interface TeamMember {
  id: string;
  name: string;
  role: string;
  status: 'active' | 'focusing' | 'idle';
  avatarColor: string;
  initials: string;
}

export const WorkspaceHomePage: React.FC = () => {
  const { user, logout } = useAuth();

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

  const handleToggleTimer = () => setIsRunning(!isRunning);

  const handleResetTimer = () => {
    setIsRunning(false);
    setTimerSeconds(0);
  };

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60)
      .toString()
      .padStart(2, '0');
    const s = (secs % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  // ----------------------------------------------------
  // 1. PIPELINE PROGRESS STATE (Top-Right Box: Read-Only Pipeline)
  // ----------------------------------------------------
  const [stages] = useState<PipelineStage[]>([
    { id: 1, label: 'Sprint Spec', subtitle: 'Architecture', status: 'completed' },
    { id: 2, label: 'Agent Pipeline', subtitle: 'Synthesis', status: 'active' },
    { id: 3, label: 'Code Review', subtitle: 'Automated QA', status: 'pending' },
    { id: 4, label: 'Deployment', subtitle: 'Production', status: 'pending' },
  ]);

  // ----------------------------------------------------
  // 2. TEAM MEMBERS STATE (Left Sidebar Box)
  // ----------------------------------------------------
  const currentUserName = user?.name || 'Shubham Biswal';
  const teamMembers: TeamMember[] = [
    {
      id: 'm-1',
      name: `${currentUserName} (You)`,
      role: 'Lead Architect',
      status: 'active',
      avatarColor: '#097fe8',
      initials: currentUserName.substring(0, 2).toUpperCase(),
    },
    {
      id: 'm-2',
      name: 'Nevil Sanish',
      role: 'Platform Engineer',
      status: 'focusing',
      avatarColor: '#f64932',
      initials: 'NS',
    },
    {
      id: 'm-3',
      name: 'Aria Vance',
      role: 'AI Agent Specialist',
      status: 'active',
      avatarColor: '#ffb110',
      initials: 'AV',
    },
    {
      id: 'm-4',
      name: 'Devin Cole',
      role: 'QA & Verification',
      status: 'idle',
      avatarColor: '#62aef0',
      initials: 'DC',
    },
  ];

  const [selectedMemberId, setSelectedMemberId] = useState<string | null>(null);

  const currentTaskspaceName = user?.taskspaceName || user?.workspaceName || 'Core Intelligence';
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
            {/* 1. TIMER CARD (Initialized at 00:00, Idle on load) */}
            <div className="bg-zinc-900 border border-zinc-800 rounded-[12px] p-3 space-y-2 shadow-sm">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-1.5">
                  <Clock className="w-3.5 h-3.5 text-blue-400" />
                  <h2 className="text-xs font-semibold tracking-tight text-zinc-200">
                    Timer
                  </h2>
                </div>
                <span
                  className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full border ${
                    isRunning
                      ? 'bg-blue-950/70 text-blue-400 border-blue-800/40'
                      : 'bg-zinc-950 text-zinc-500 border-zinc-800'
                  }`}
                >
                  {isRunning ? 'Active' : 'Standby'}
                </span>
              </div>

              {/* Digital Display (Shows 00:00 on load) */}
              <div className="text-center py-1">
                <div className="font-mono text-3xl font-bold tracking-tight text-white">
                  {formatTime(timerSeconds)}
                </div>
                <p className="text-[10px] text-zinc-500 mt-0.5">
                  {isRunning ? 'Session in progress' : 'Waiting for host'}
                </p>
              </div>

              {/* Timer Controls */}
              <div className="flex items-center space-x-1.5 pt-0.5">
                <button
                  type="button"
                  onClick={handleToggleTimer}
                  className={`flex-1 flex items-center justify-center space-x-1.5 py-1.5 px-2 rounded-[6px] text-white text-[11px] font-medium transition-colors ${
                    isRunning
                      ? 'bg-amber-600 hover:bg-amber-500'
                      : 'bg-blue-600 hover:bg-blue-500'
                  }`}
                >
                  {isRunning ? (
                    <>
                      <Pause className="w-3 h-3" />
                      <span>Pause</span>
                    </>
                  ) : (
                    <>
                      <Play className="w-3 h-3 fill-current" />
                      <span>Start</span>
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={handleResetTimer}
                  className="p-1.5 rounded-[6px] bg-zinc-800 hover:bg-zinc-700 text-zinc-300 border border-zinc-700/80 transition-colors"
                  title="Reset timer to 00:00"
                >
                  <RotateCcw className="w-3 h-3" />
                </button>
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
                <div className="flex items-center space-x-2">
                  <span className="text-[10px] text-zinc-500 font-mono">
                    {teamMembers.length} active
                  </span>
                  {selectedMemberId && (
                    <button
                      type="button"
                      onClick={() => setSelectedMemberId(null)}
                      className="text-[10px] text-blue-400 hover:underline"
                    >
                      Reset
                    </button>
                  )}
                </div>
              </div>

              {/* Member Items */}
              <div className="space-y-1.5">
                {teamMembers.map((member) => {
                  const isSelected = selectedMemberId === member.id;

                  return (
                    <div
                      key={member.id}
                      onClick={() =>
                        setSelectedMemberId(isSelected ? null : member.id)
                      }
                      className={`flex items-center justify-between py-1.5 px-2 rounded-[6px] border transition-all cursor-pointer ${
                        isSelected
                          ? 'bg-blue-950/40 border-blue-600 text-white'
                          : 'bg-zinc-950/50 border-zinc-800/80 hover:bg-zinc-800/60'
                      }`}
                    >
                      <div className="flex items-center space-x-2 flex-1 min-w-0">
                        {/* Colored border character mark */}
                        <div
                          className="w-6 h-6 rounded-full bg-zinc-900 flex items-center justify-center text-[10px] font-bold shrink-0"
                          style={{
                            border: `2px solid ${member.avatarColor}`,
                            color: member.avatarColor,
                          }}
                        >
                          {member.initials}
                        </div>

                        <div className="text-left flex-1 min-w-0">
                          <p className="text-[11px] font-medium text-zinc-200 leading-tight truncate">
                            {member.name}
                          </p>
                          <p className="text-[9px] text-zinc-500 leading-none mt-0.5 truncate">
                            {member.role}
                          </p>
                        </div>
                      </div>

                      <span
                        className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                          member.status === 'active'
                            ? 'bg-emerald-400'
                            : member.status === 'focusing'
                            ? 'bg-[#ffb110]'
                            : 'bg-zinc-600'
                        }`}
                      />
                    </div>
                  );
                })}
              </div>

              <div className="pt-1.5 border-t border-zinc-800/80 text-[10px] text-zinc-500 flex justify-between">
                <span>Roster Filter</span>
                <span className="font-mono text-blue-400">All Online</span>
              </div>
            </div>
          </div>

          {/* --------------------------------------------------
              RIGHT MAIN AREA: PIPELINE + PLAIN TEXT 'TASK'
          --------------------------------------------------- */}
          <div className="flex-1 min-w-0 space-y-3">
            {/* 2. TOP-RIGHT CARD: WORKFLOW PIPELINE TRACKER */}
            <div className="bg-zinc-900 border border-zinc-800 rounded-[12px] px-4 py-3 shadow-sm">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center space-x-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                  <h2 className="text-xs font-semibold tracking-tight text-zinc-200">
                    Workflow Pipeline
                  </h2>
                </div>
              </div>

              {/* Connected Step Pipeline Nodes (✓) -> ( ) -> ( ) -> ( ) */}
              <div className="relative py-1">
                <div className="absolute left-4 right-4 top-4 h-[2px] bg-zinc-800 -z-0" />

                <div className="flex items-center justify-between relative z-10">
                  {stages.map((stage, idx) => {
                    const isCompleted = stage.status === 'completed';
                    const isActive = stage.status === 'active';

                    return (
                      <div
                        key={stage.id}
                        className="flex-1 flex flex-col items-center text-center select-none"
                      >
                        {/* Circular Node */}
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
                            <Check className="w-4 h-4 stroke-[2.5]" />
                          ) : isActive ? (
                            <span className="w-2 h-2 rounded-full bg-blue-400" />
                          ) : (
                            <span className="text-[10px] font-semibold">{stage.id}</span>
                          )}
                        </div>

                        {/* Stage Label */}
                        <p
                          className={`text-[11px] font-medium mt-1 tracking-tight truncate max-w-[120px] ${
                            isActive
                              ? 'text-blue-400 font-semibold'
                              : isCompleted
                              ? 'text-zinc-200'
                              : 'text-zinc-500'
                          }`}
                        >
                          {stage.label}
                        </p>

                        {/* Arrow separator */}
                        {idx < stages.length - 1 && (
                          <div className="hidden md:flex absolute -right-2 top-2 text-zinc-700 pointer-events-none">
                            <ArrowRight className="w-3.5 h-3.5 opacity-60" />
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* --------------------------------------------------
                4. BOTTOM-RIGHT: PLAIN TEXT TASK CARD (Black Theme)
            --------------------------------------------------- */}
            <div className="bg-zinc-900 border border-zinc-800 rounded-[12px] p-8 min-h-[480px] flex items-center justify-center shadow-sm">
              <span className="text-4xl sm:text-5xl md:text-6xl font-bold tracking-tight text-zinc-100 select-none">
                Task
              </span>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};
