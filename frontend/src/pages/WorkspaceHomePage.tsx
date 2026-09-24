import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext.js';
import {
  Play,
  Pause,
  RotateCcw,
  Check,
  Plus,
  Trash2,
  LogOut,
  ArrowRight,
  Clock,
  Sparkles,
  Search,
  LayoutGrid,
  List,
} from 'lucide-react';

interface TaskItem {
  id: string;
  title: string;
  description: string;
  status: 'todo' | 'in_progress' | 'completed';
  priority: 'low' | 'medium' | 'high';
  assignee: string;
  assigneeAvatarColor: string;
  subtasks: { total: number; done: number };
}

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
  activeTaskCount: number;
}

export const WorkspaceHomePage: React.FC = () => {
  const { user, logout } = useAuth();

  // ----------------------------------------------------
  // 1. TIMER STATE (Top-Left Box: Streamlined & Compact)
  // ----------------------------------------------------
  const [timerSeconds, setTimerSeconds] = useState(25 * 60);
  const [isRunning, setIsRunning] = useState(false);
  const [timerMode, setTimerMode] = useState<'25' | '5' | '50'>('25');

  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;
    if (isRunning && timerSeconds > 0) {
      interval = setInterval(() => {
        setTimerSeconds((prev) => prev - 1);
      }, 1000);
    } else if (timerSeconds === 0) {
      setIsRunning(false);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isRunning, timerSeconds]);

  const handleToggleTimer = () => setIsRunning(!isRunning);

  const handleResetTimer = (minutes = 25) => {
    setIsRunning(false);
    setTimerSeconds(minutes * 60);
  };

  const handleSelectMode = (mode: '25' | '5' | '50') => {
    setTimerMode(mode);
    const mins = parseInt(mode, 10);
    handleResetTimer(mins);
  };

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60)
      .toString()
      .padStart(2, '0');
    const s = (secs % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  // ----------------------------------------------------
  // 2. PIPELINE PROGRESS STATE (Top-Right Box: Sleek & Compact)
  // ----------------------------------------------------
  const [stages, setStages] = useState<PipelineStage[]>([
    { id: 1, label: 'Sprint Spec', subtitle: 'Architecture', status: 'completed' },
    { id: 2, label: 'Agent Pipeline', subtitle: 'Synthesis', status: 'active' },
    { id: 3, label: 'Code Review', subtitle: 'Automated QA', status: 'pending' },
    { id: 4, label: 'Deployment', subtitle: 'Production', status: 'pending' },
  ]);

  const handleCycleStageStatus = (stageId: number) => {
    setStages((prev) =>
      prev.map((s) => {
        if (s.id !== stageId) return s;
        const nextStatus: Record<string, 'completed' | 'active' | 'pending'> = {
          pending: 'active',
          active: 'completed',
          completed: 'pending',
        };
        return { ...s, status: nextStatus[s.status] };
      })
    );
  };

  // ----------------------------------------------------
  // 3. TEAM MEMBERS STATE (Bottom-Left Box: Streamlined Roster)
  // ----------------------------------------------------
  const currentUserName = user?.name || 'Shubham Biswal';
  const teamMembers: TeamMember[] = [
    {
      id: 'm-1',
      name: `${currentUserName} (You)`,
      role: 'Lead Architect',
      status: 'active',
      avatarColor: '#097fe8', // Signal Blue (DESIGN.md)
      initials: currentUserName.substring(0, 2).toUpperCase(),
      activeTaskCount: 2,
    },
    {
      id: 'm-2',
      name: 'Nevil Sanish',
      role: 'Platform Engineer',
      status: 'focusing',
      avatarColor: '#f64932', // Coral (DESIGN.md)
      initials: 'NS',
      activeTaskCount: 3,
    },
    {
      id: 'm-3',
      name: 'Aria Vance',
      role: 'AI Agent Specialist',
      status: 'active',
      avatarColor: '#ffb110', // Marigold (DESIGN.md)
      initials: 'AV',
      activeTaskCount: 1,
    },
    {
      id: 'm-4',
      name: 'Devin Cole',
      role: 'QA & Verification',
      status: 'idle',
      avatarColor: '#62aef0', // Sky Wash (DESIGN.md)
      initials: 'DC',
      activeTaskCount: 2,
    },
  ];

  const [selectedMemberId, setSelectedMemberId] = useState<string | null>(null);

  // ----------------------------------------------------
  // 4. MAIN TASK AREA STATE (Bottom-Right Box: MAXIMUM SPACE)
  // ----------------------------------------------------
  const [tasks, setTasks] = useState<TaskItem[]>([
    {
      id: 't-1',
      title: 'Configure Google OAuth verify token flow',
      description: 'Implement token payload decoding, domain restriction, and secure cookie session.',
      status: 'completed',
      priority: 'high',
      assignee: `${currentUserName} (You)`,
      assigneeAvatarColor: '#097fe8',
      subtasks: { total: 3, done: 3 },
    },
    {
      id: 't-2',
      title: 'Design team taskspace onboarding step',
      description: 'Create & Join team selection with automated ID generation and schema validation.',
      status: 'in_progress',
      priority: 'high',
      assignee: `${currentUserName} (You)`,
      assigneeAvatarColor: '#097fe8',
      subtasks: { total: 4, done: 3 },
    },
    {
      id: 't-3',
      title: 'Notion style reference implementation',
      description: 'Align color tokens, hairline borders, typography scale, and analog paper canvas (#f6f5f4).',
      status: 'in_progress',
      priority: 'medium',
      assignee: 'Nevil Sanish',
      assigneeAvatarColor: '#f64932',
      subtasks: { total: 5, done: 4 },
    },
    {
      id: 't-4',
      title: 'Multi-agent test suite validation',
      description: 'Run automated end-to-end assertions against onboarding pipeline and session persistence.',
      status: 'todo',
      priority: 'medium',
      assignee: 'Devin Cole',
      assigneeAvatarColor: '#62aef0',
      subtasks: { total: 2, done: 0 },
    },
    {
      id: 't-5',
      title: 'Integrate team telemetry & audit logger',
      description: 'Pino structured JSON transport for operational telemetry and audit trail.',
      status: 'todo',
      priority: 'low',
      assignee: 'Aria Vance',
      assigneeAvatarColor: '#ffb110',
      subtasks: { total: 3, done: 1 },
    },
  ]);

  const [taskFilter, setTaskFilter] = useState<'all' | 'todo' | 'in_progress' | 'completed'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<'list' | 'grid'>('list');
  const [isAddingTask, setIsAddingTask] = useState(false);
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskDesc, setNewTaskDesc] = useState('');
  const [newTaskPriority, setNewTaskPriority] = useState<'low' | 'medium' | 'high'>('medium');

  const handleToggleTaskStatus = (taskId: string) => {
    setTasks((prev) =>
      prev.map((t) => {
        if (t.id !== taskId) return t;
        const nextStatus = t.status === 'completed' ? 'todo' : 'completed';
        const doneCount = nextStatus === 'completed' ? t.subtasks.total : 0;
        return {
          ...t,
          status: nextStatus,
          subtasks: { ...t.subtasks, done: doneCount },
        };
      })
    );
  };

  const handleCreateTask = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTaskTitle.trim()) return;

    const newTask: TaskItem = {
      id: `t-${Date.now()}`,
      title: newTaskTitle.trim(),
      description: newTaskDesc.trim() || 'No additional description provided.',
      status: 'todo',
      priority: newTaskPriority,
      assignee: `${currentUserName} (You)`,
      assigneeAvatarColor: '#097fe8',
      subtasks: { total: 2, done: 0 },
    };

    setTasks([newTask, ...tasks]);
    setNewTaskTitle('');
    setNewTaskDesc('');
    setIsAddingTask(false);
  };

  const handleDeleteTask = (taskId: string) => {
    setTasks(tasks.filter((t) => t.id !== taskId));
  };

  const filteredTasks = tasks.filter((t) => {
    if (selectedMemberId) {
      const targetMember = teamMembers.find((m) => m.id === selectedMemberId);
      if (targetMember && !t.assignee.includes(targetMember.name.replace(' (You)', ''))) {
        return false;
      }
    }
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      const matchTitle = t.title.toLowerCase().includes(query);
      const matchDesc = t.description.toLowerCase().includes(query);
      if (!matchTitle && !matchDesc) return false;
    }
    if (taskFilter === 'all') return true;
    return t.status === taskFilter;
  });

  const completedCount = tasks.filter((t) => t.status === 'completed').length;
  const inProgressCount = tasks.filter((t) => t.status === 'in_progress').length;
  const todoCount = tasks.filter((t) => t.status === 'todo').length;

  const currentTaskspaceName = user?.taskspaceName || user?.workspaceName || 'Core Intelligence';
  const currentTeamId = user?.teamId || 'TEAM-ALPHA';

  return (
    <div className="min-h-screen bg-[#f6f5f4] text-[#111111] font-sans antialiased flex flex-col selection:bg-[#e6f3fe] selection:text-[#0075de]">
      {/* ----------------------------------------------------
          NOTION-STYLE TOP NAVIGATION (DESIGN.md line 206)
          Hairline border: rgba(0, 0, 0, 0.08), Elevation: 0px 3px 9px rgba(0,0,0,0.03)
      ---------------------------------------------------- */}
      <header className="sticky top-0 z-40 bg-[#f6f5f4]/90 backdrop-blur-md border-b border-black/[0.08] shadow-[0px_0.7px_1.462px_0px_rgba(0,0,0,0.015),0px_3px_9px_0px_rgba(0,0,0,0.03)] h-14">
        <div className="w-full px-4 sm:px-6 lg:px-8 h-full flex items-center justify-between">
          {/* Brand & Team Taskspace Indicator */}
          <div className="flex items-center space-x-3">
            <div className="flex items-center space-x-2">
              <div className="w-7 h-7 rounded-[6px] bg-white border border-black/[0.08] flex items-center justify-center">
                <svg
                  className="w-3.5 h-3.5 text-[#111111]"
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
              <span className="font-semibold text-sm tracking-tight text-[#000000]">Adavya</span>
            </div>

            <span className="text-black/20 text-xs">/</span>

            {/* Team Taskspace Pill */}
            <div className="flex items-center space-x-1.5 px-2.5 py-0.5 rounded-full bg-white border border-black/[0.08] text-xs">
              <span className="w-1.5 h-1.5 rounded-full bg-[#ffb110]" />
              <span className="font-medium text-[#111111]">{currentTaskspaceName}</span>
              <span className="font-mono text-[10px] text-[#757575] bg-[#f6f5f4] px-1 py-0.2 rounded-[4px]">
                {currentTeamId}
              </span>
            </div>
          </div>

          {/* User Controls */}
          <div className="flex items-center space-x-2.5">
            <div className="hidden sm:flex items-center space-x-2 px-2 py-0.5 rounded-[6px] bg-white border border-black/[0.08]">
              {/* Character mark avatar with 2px colored border (DESIGN.md line 155) */}
              <div className="w-5 h-5 rounded-full border-2 border-[#097fe8] bg-white flex items-center justify-center text-[9px] font-bold text-[#097fe8]">
                {currentUserName.charAt(0)}
              </div>
              <span className="text-xs font-medium text-[#111111]">{currentUserName}</span>
            </div>

            <button
              onClick={() => logout()}
              className="flex items-center space-x-1.5 px-2.5 py-1 rounded-[6px] bg-white hover:bg-black/[0.03] border border-black/[0.08] text-xs font-medium text-[#615d59] hover:text-[#111111] transition-colors"
            >
              <LogOut className="w-3 h-3" />
              <span className="hidden sm:inline">Sign Out</span>
            </button>
          </div>
        </div>
      </header>

      {/* ----------------------------------------------------
          MAIN OVERVIEW CANVAS
          Task workspace receives maximum priority and space
          Timer, Pipeline, and Team members are made sleek and compact
      ---------------------------------------------------- */}
      <main className="flex-1 w-full px-4 sm:px-6 lg:px-8 py-4 space-y-4">

        {/* ====================================================
            THE WIREFRAME CONTAINER:
            Left Sidebar: w-[240px] (Timer + Team Members, compact)
            Right Main: flex-1 (Pipeline + Large Task Workspace)
        ==================================================== */}
        <div className="flex flex-col lg:flex-row gap-4 items-start w-full">
          {/* --------------------------------------------------
              LEFT SIDEBAR: TIMER + TEAM MEMBERS
              Slim, compact width (lg:w-[240px])
          --------------------------------------------------- */}
          <div className="w-full lg:w-[240px] shrink-0 space-y-3">
            {/* 1. TOP-LEFT CARD: TIMER (Compact Widget) */}
            <div className="bg-white rounded-[12px] border border-black/[0.08] p-3 space-y-2.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-1.5">
                  <Clock className="w-3.5 h-3.5 text-[#0075de]" />
                  <h2 className="text-xs font-semibold tracking-tight text-[#111111]">
                    Timer
                  </h2>
                </div>
                <span
                  className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${
                    isRunning
                      ? 'bg-[#e6f3fe] text-[#0075de]'
                      : 'bg-[#f6f5f4] text-[#757575]'
                  }`}
                >
                  {isRunning ? 'Active' : 'Paused'}
                </span>
              </div>

              {/* Compact Digital Display */}
              <div className="text-center py-0.5">
                <div className="font-mono text-2xl font-bold tracking-tight text-[#000000]">
                  {formatTime(timerSeconds)}
                </div>
              </div>

              {/* Mode Presets */}
              <div className="grid grid-cols-3 gap-1 p-0.5 bg-[#f6f5f4] rounded-[6px]">
                {(['25', '5', '50'] as const).map((mode) => (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => handleSelectMode(mode)}
                    className={`py-0.5 text-[11px] font-medium rounded-[4px] transition-colors ${
                      timerMode === mode
                        ? 'bg-white text-[#000000] shadow-[0px_1px_2px_rgba(0,0,0,0.05)] font-semibold'
                        : 'text-[#757575] hover:text-[#111111]'
                    }`}
                  >
                    {mode}m
                  </button>
                ))}
              </div>

              {/* Timer Controls */}
              <div className="flex items-center space-x-1.5 pt-0.5">
                <button
                  type="button"
                  onClick={handleToggleTimer}
                  className="flex-1 flex items-center justify-center space-x-1.5 py-1.5 px-2 rounded-[6px] bg-[#0075de] hover:bg-[#0062be] text-white text-[11px] font-medium transition-colors"
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
                  onClick={() => handleResetTimer(parseInt(timerMode, 10))}
                  className="p-1.5 rounded-[6px] bg-[#f6f5f4] hover:bg-[#eceae7] text-[#615d59] border border-black/[0.06] transition-colors"
                  title="Reset timer"
                >
                  <RotateCcw className="w-3 h-3" />
                </button>
              </div>
            </div>

            {/* 3. BOTTOM-LEFT CARD: TEAM MEMBERS (Compact Roster) */}
            <div className="bg-white rounded-[12px] border border-black/[0.08] p-3 space-y-2">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xs font-semibold tracking-tight text-[#111111]">
                    Team Members
                  </h2>
                  <p className="text-[10px] text-[#757575]">({teamMembers.length} active)</p>
                </div>

                {selectedMemberId && (
                  <button
                    type="button"
                    onClick={() => setSelectedMemberId(null)}
                    className="text-[10px] text-[#0075de] hover:underline"
                  >
                    Reset
                  </button>
                )}
              </div>

              {/* Compact Member Items */}
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
                          ? 'bg-[#e6f3fe]/60 border-[#0075de]'
                          : 'bg-white border-black/[0.05] hover:bg-[#f6f5f4]'
                      }`}
                    >
                      <div className="flex items-center space-x-2">
                        {/* 2px colored circle character mark */}
                        <div
                          className="w-6 h-6 rounded-full bg-white flex items-center justify-center text-[10px] font-bold shrink-0"
                          style={{
                            border: `2px solid ${member.avatarColor}`,
                            color: member.avatarColor,
                          }}
                        >
                          {member.initials}
                        </div>

                        <div className="text-left flex-1 min-w-0">
                          <p className="text-[11px] font-medium text-[#111111] leading-tight truncate">
                            {member.name}
                          </p>
                          <p className="text-[9px] text-[#757575] leading-none mt-0.5 truncate">
                            {member.role}
                          </p>
                        </div>
                      </div>

                      <span
                        className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                          member.status === 'active'
                            ? 'bg-emerald-500'
                            : member.status === 'focusing'
                            ? 'bg-[#ffb110]'
                            : 'bg-[#a09c97]'
                        }`}
                      />
                    </div>
                  );
                })}
              </div>

              <div className="pt-1.5 border-t border-black/[0.06] text-[10px] text-[#757575] flex justify-between">
                <span>Roster Filter</span>
                <span className="font-mono text-[#0075de]">All Online</span>
              </div>
            </div>
          </div>

          {/* --------------------------------------------------
              RIGHT MAIN AREA: PIPELINE + MASSIVE TASK WORKSPACE
              Takes all remaining space (flex-1)
          --------------------------------------------------- */}
          <div className="flex-1 min-w-0 space-y-3">
            {/* 2. TOP-RIGHT CARD: WORKFLOW PIPELINE TRACKER (Compact Ribbon) */}
            <div className="bg-white rounded-[12px] border border-black/[0.08] px-4 py-3">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center space-x-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-[#ffb110]" />
                  <h2 className="text-xs font-semibold tracking-tight text-[#111111]">
                    Workflow Pipeline
                  </h2>
                </div>
                <span className="text-[10px] text-[#757575]">
                  Click node to cycle status
                </span>
              </div>

              {/* Connected Step Pipeline Nodes (✓) -> ( ) -> ( ) -> ( ) */}
              <div className="relative py-1">
                <div className="absolute left-4 right-4 top-4 h-[2px] bg-[#e6e4e1] -z-0" />

                <div className="flex items-center justify-between relative z-10">
                  {stages.map((stage, idx) => {
                    const isCompleted = stage.status === 'completed';
                    const isActive = stage.status === 'active';

                    return (
                      <div
                        key={stage.id}
                        className="flex-1 flex flex-col items-center text-center cursor-pointer group"
                        onClick={() => handleCycleStageStatus(stage.id)}
                      >
                        {/* Circular Node */}
                        <div
                          className={`w-7 h-7 rounded-full flex items-center justify-center transition-all ${
                            isCompleted
                              ? 'bg-[#0075de] text-white shadow-xs'
                              : isActive
                              ? 'bg-white border-2 border-[#0075de] text-[#0075de] ring-2 ring-[#e6f3fe]'
                              : 'bg-white border-2 border-[#d0cdca] text-[#a09c97]'
                          }`}
                          title="Click to toggle"
                        >
                          {isCompleted ? (
                            <Check className="w-4 h-4 stroke-[2.5]" />
                          ) : isActive ? (
                            <span className="w-2 h-2 rounded-full bg-[#0075de]" />
                          ) : (
                            <span className="text-[10px] font-semibold">{stage.id}</span>
                          )}
                        </div>

                        {/* Stage Label */}
                        <p
                          className={`text-[11px] font-medium mt-1 tracking-tight truncate max-w-[120px] ${
                            isActive
                              ? 'text-[#0075de] font-semibold'
                              : isCompleted
                              ? 'text-[#111111]'
                              : 'text-[#757575]'
                          }`}
                        >
                          {stage.label}
                        </p>

                        {/* Arrow separator */}
                        {idx < stages.length - 1 && (
                          <div className="hidden md:flex absolute -right-2 top-2 text-[#a09c97] pointer-events-none">
                            <ArrowRight className="w-3.5 h-3.5 opacity-40" />
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* --------------------------------------------------
                4. BOTTOM-RIGHT: EXPANSIVE TASK WORKSPACE
                Takes dominant area with rich controls & large layout
            --------------------------------------------------- */}
            <div className="bg-white rounded-[12px] border border-black/[0.08] p-5 space-y-4 min-h-[560px] flex flex-col justify-between shadow-[0px_1px_3px_rgba(0,0,0,0.02)]">
              {/* Task Workspace Header Bar */}
              <div className="space-y-3 pb-3 border-b border-black/[0.06]">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center space-x-2.5">
                    <h2 className="text-base sm:text-lg font-semibold tracking-tight text-[#000000]">
                      Task Workspace
                    </h2>
                    <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-[#f6f5f4] text-[#615d59] border border-black/[0.06]">
                      {filteredTasks.length} active
                    </span>
                  </div>

                  {/* Primary New Task Button */}
                  <div className="flex items-center space-x-2">
                    {/* View mode toggle */}
                    <div className="flex items-center p-0.5 bg-[#f6f5f4] rounded-[6px] border border-black/[0.05]">
                      <button
                        type="button"
                        onClick={() => setViewMode('list')}
                        className={`p-1 rounded-[4px] transition-colors ${
                          viewMode === 'list'
                            ? 'bg-white text-[#111111] shadow-xs'
                            : 'text-[#757575] hover:text-[#111111]'
                        }`}
                        title="List View"
                      >
                        <List className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setViewMode('grid')}
                        className={`p-1 rounded-[4px] transition-colors ${
                          viewMode === 'grid'
                            ? 'bg-white text-[#111111] shadow-xs'
                            : 'text-[#757575] hover:text-[#111111]'
                        }`}
                        title="Grid View"
                      >
                        <LayoutGrid className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    <button
                      type="button"
                      onClick={() => setIsAddingTask(!isAddingTask)}
                      className="flex items-center space-x-1.5 py-1.5 px-3.5 rounded-[8px] bg-[#0075de] hover:bg-[#0062be] text-white text-xs font-medium transition-colors"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>New Task</span>
                    </button>
                  </div>
                </div>

                {/* Search & Filter Toolbar */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pt-1">
                  {/* Filter Pills */}
                  <div className="flex items-center p-0.5 bg-[#f6f5f4] rounded-[8px] text-xs">
                    <button
                      type="button"
                      onClick={() => setTaskFilter('all')}
                      className={`px-3 py-1 rounded-[6px] font-medium transition-colors ${
                        taskFilter === 'all'
                          ? 'bg-white text-[#111111] shadow-[0px_1px_2px_rgba(0,0,0,0.05)]'
                          : 'text-[#757575] hover:text-[#111111]'
                      }`}
                    >
                      All ({tasks.length})
                    </button>
                    <button
                      type="button"
                      onClick={() => setTaskFilter('todo')}
                      className={`px-3 py-1 rounded-[6px] font-medium transition-colors ${
                        taskFilter === 'todo'
                          ? 'bg-white text-[#111111] shadow-[0px_1px_2px_rgba(0,0,0,0.05)]'
                          : 'text-[#757575] hover:text-[#111111]'
                      }`}
                    >
                      To Do ({todoCount})
                    </button>
                    <button
                      type="button"
                      onClick={() => setTaskFilter('in_progress')}
                      className={`px-3 py-1 rounded-[6px] font-medium transition-colors ${
                        taskFilter === 'in_progress'
                          ? 'bg-white text-[#111111] shadow-[0px_1px_2px_rgba(0,0,0,0.05)]'
                          : 'text-[#757575] hover:text-[#111111]'
                      }`}
                    >
                      In Progress ({inProgressCount})
                    </button>
                    <button
                      type="button"
                      onClick={() => setTaskFilter('completed')}
                      className={`px-3 py-1 rounded-[6px] font-medium transition-colors ${
                        taskFilter === 'completed'
                          ? 'bg-white text-[#111111] shadow-[0px_1px_2px_rgba(0,0,0,0.05)]'
                          : 'text-[#757575] hover:text-[#111111]'
                      }`}
                    >
                      Done ({completedCount})
                    </button>
                  </div>

                  {/* Search Input */}
                  <div className="relative w-full sm:w-60">
                    <input
                      type="text"
                      placeholder="Search tasks..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full pl-8 pr-3 py-1 rounded-[6px] bg-[#f6f5f4] border border-black/[0.08] text-xs text-[#111111] placeholder-[#757575] outline-none focus:bg-white focus:border-[#0075de] transition-colors"
                    />
                    <Search className="w-3.5 h-3.5 text-[#757575] absolute left-2.5 top-2 pointer-events-none" />
                  </div>
                </div>
              </div>

              {/* Inline New Task Creation Form */}
              {isAddingTask && (
                <form
                  onSubmit={handleCreateTask}
                  className="p-4 rounded-[8px] bg-[#f6f5f4] border border-black/[0.08] space-y-3 animate-in fade-in duration-150"
                >
                  <div className="space-y-2">
                    <input
                      type="text"
                      placeholder="Task title (e.g. Build Google OAuth verification)"
                      value={newTaskTitle}
                      onChange={(e) => setNewTaskTitle(e.target.value)}
                      className="w-full px-3 py-2 rounded-[6px] bg-white border border-black/[0.1] text-xs text-[#111111] placeholder-[#757575] outline-none focus:border-[#0075de]"
                      autoFocus
                      required
                    />
                    <input
                      type="text"
                      placeholder="Task description and pipeline requirements..."
                      value={newTaskDesc}
                      onChange={(e) => setNewTaskDesc(e.target.value)}
                      className="w-full px-3 py-2 rounded-[6px] bg-white border border-black/[0.1] text-xs text-[#111111] placeholder-[#757575] outline-none focus:border-[#0075de]"
                    />
                  </div>

                  <div className="flex items-center justify-between pt-1">
                    <div className="flex items-center space-x-2 text-xs">
                      <span className="text-[#757575]">Priority:</span>
                      {(['low', 'medium', 'high'] as const).map((p) => (
                        <button
                          key={p}
                          type="button"
                          onClick={() => setNewTaskPriority(p)}
                          className={`px-2.5 py-0.5 rounded-full text-[10px] font-medium capitalize border ${
                            newTaskPriority === p
                              ? 'bg-white border-[#0075de] text-[#0075de] font-semibold'
                              : 'border-transparent text-[#757575] hover:text-[#111111]'
                          }`}
                        >
                          {p}
                        </button>
                      ))}
                    </div>

                    <div className="flex items-center space-x-2">
                      <button
                        type="button"
                        onClick={() => setIsAddingTask(false)}
                        className="px-3 py-1 text-xs text-[#757575] hover:text-[#111111]"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        className="px-3.5 py-1 bg-[#0075de] hover:bg-[#0062be] text-white text-xs font-medium rounded-[6px]"
                      >
                        Save Task
                      </button>
                    </div>
                  </div>
                </form>
              )}

              {/* Task Items List/Grid with Maximum Space */}
              <div className="flex-1 overflow-y-auto pr-1">
                {filteredTasks.length === 0 ? (
                  <div className="py-16 text-center text-[#757575] space-y-1">
                    <p className="text-sm font-medium">No tasks found.</p>
                    <p className="text-xs text-[#a09c97]">
                      Try changing your filter or click "+ New Task" to create one.
                    </p>
                  </div>
                ) : (
                  <div
                    className={
                      viewMode === 'grid'
                        ? 'grid grid-cols-1 md:grid-cols-2 gap-3'
                        : 'space-y-2.5'
                    }
                  >
                    {filteredTasks.map((task) => {
                      const isDone = task.status === 'completed';

                      return (
                        <div
                          key={task.id}
                          className={`p-3.5 rounded-[8px] border transition-all ${
                            isDone
                              ? 'bg-[#faf9f8] border-black/[0.04] opacity-75'
                              : 'bg-white border-black/[0.08] hover:border-black/[0.18] shadow-[0px_1px_2px_rgba(0,0,0,0.02)]'
                          }`}
                        >
                          <div className="flex items-start justify-between gap-3">
                            {/* Checkbox & Task Information */}
                            <div className="flex items-start space-x-3 flex-1">
                              <button
                                type="button"
                                onClick={() => handleToggleTaskStatus(task.id)}
                                className={`mt-0.5 w-4 h-4 rounded-[4px] border flex items-center justify-center transition-colors shrink-0 ${
                                  isDone
                                    ? 'bg-[#0075de] border-[#0075de] text-white'
                                    : 'bg-white border-black/[0.2] hover:border-[#0075de]'
                                }`}
                                title="Toggle status"
                              >
                                {isDone && <Check className="w-3 h-3 stroke-[3]" />}
                              </button>

                              <div className="space-y-1.5 flex-1">
                                <h3
                                  className={`text-xs sm:text-sm font-semibold leading-snug tracking-tight ${
                                    isDone
                                      ? 'line-through text-[#757575]'
                                      : 'text-[#111111]'
                                  }`}
                                >
                                  {task.title}
                                </h3>
                                <p className="text-xs text-[#615d59] leading-relaxed">
                                  {task.description}
                                </p>

                                {/* Subtask indicator */}
                                <div className="flex items-center space-x-2 pt-1 text-[11px] text-[#757575]">
                                  <span>
                                    Subtasks: {task.subtasks.done}/{task.subtasks.total}
                                  </span>
                                  <div className="w-16 h-1 bg-[#f6f5f4] rounded-full overflow-hidden border border-black/[0.06]">
                                    <div
                                      className="h-full bg-[#0075de]"
                                      style={{
                                        width: `${
                                          (task.subtasks.done / task.subtasks.total) * 100
                                        }%`,
                                      }}
                                    />
                                  </div>
                                </div>
                              </div>
                            </div>

                            {/* Tags, Assignee & Actions */}
                            <div className="flex flex-col sm:flex-row items-end sm:items-center space-y-1 sm:space-y-0 sm:space-x-2 shrink-0">
                              {/* Priority Pill */}
                              <span
                                className={`text-[10px] px-2 py-0.5 rounded-full font-medium uppercase tracking-wider ${
                                  task.priority === 'high'
                                    ? 'bg-[#f64932]/10 text-[#d32f1a]'
                                    : task.priority === 'medium'
                                    ? 'bg-[#ffb110]/15 text-[#965e00]'
                                    : 'bg-black/[0.05] text-[#615d59]'
                                }`}
                              >
                                {task.priority}
                              </span>

                              {/* Status Pill Tag */}
                              <span
                                className={`text-[11px] px-2.5 py-0.5 rounded-full font-medium ${
                                  task.status === 'completed'
                                    ? 'bg-emerald-50 text-emerald-700'
                                    : task.status === 'in_progress'
                                    ? 'bg-[#e6f3fe] text-[#0075de]'
                                    : 'bg-[#f6f5f4] text-[#615d59]'
                                }`}
                              >
                                {task.status === 'completed'
                                  ? 'Complete'
                                  : task.status === 'in_progress'
                                  ? 'In progress'
                                  : 'To do'}
                              </span>

                              {/* Assignee Avatar with 2px colored border */}
                              <div
                                className="w-5 h-5 rounded-full bg-white flex items-center justify-center text-[9px] font-bold"
                                style={{
                                  border: `2px solid ${task.assigneeAvatarColor}`,
                                  color: task.assigneeAvatarColor,
                                }}
                                title={`Assigned to ${task.assignee}`}
                              >
                                {task.assignee.charAt(0)}
                              </div>

                              {/* Delete button */}
                              <button
                                type="button"
                                onClick={() => handleDeleteTask(task.id)}
                                className="text-[#a09c97] hover:text-[#f64932] p-1 transition-colors"
                                title="Delete task"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Bottom Taskspace Summary Bar */}
              <div className="pt-3 border-t border-black/[0.06] flex items-center justify-between text-xs text-[#757575]">
                <span className="text-xs">
                  {completedCount} of {tasks.length} tasks completed ({todoCount} pending, {inProgressCount} active)
                </span>
                <div className="flex items-center space-x-2">
                  <div className="w-32 h-1.5 bg-[#f6f5f4] rounded-full overflow-hidden border border-black/[0.06]">
                    <div
                      className="h-full bg-[#0075de] transition-all duration-300"
                      style={{
                        width: `${tasks.length ? (completedCount / tasks.length) * 100 : 0}%`,
                      }}
                    />
                  </div>
                  <span className="text-[11px] font-mono text-[#111111] font-semibold">
                    {tasks.length ? Math.round((completedCount / tasks.length) * 100) : 0}%
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};
