import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.js';
import { validateTeamIdFormat, DEFAULT_TASKSPACES } from '../schemas/workspace.schema.js';
import { PlusCircle, LogIn, ArrowRight, AlertCircle, Sparkles } from 'lucide-react';

export const OnboardingPage: React.FC = () => {
  const { user, createTeam, joinTeam, authError, clearError, logout } = useAuth();
  const [mode, setMode] = useState<'create' | 'join'>('create');
  const [teamNameInput, setTeamNameInput] = useState('');
  const [teamIdInput, setTeamIdInput] = useState('');
  const [localError, setLocalError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const navigate = useNavigate();

  const handleModeSwitch = (newMode: 'create' | 'join') => {
    setMode(newMode);
    setLocalError(null);
    clearError();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError(null);
    clearError();

    if (mode === 'create') {
      const trimmedName = teamNameInput.trim();
      if (!trimmedName) {
        setLocalError('Please enter a team name.');
        return;
      }
      setIsSubmitting(true);
      const success = await createTeam(trimmedName);
      setIsSubmitting(false);
      if (success) {
        navigate('/workspace');
      }
    } else {
      const validation = validateTeamIdFormat(teamIdInput);
      if (!validation.isValid || !validation.normalizedValue) {
        setLocalError(validation.error || 'Please enter a valid Team ID.');
        return;
      }
      setIsSubmitting(true);
      const success = await joinTeam(validation.normalizedValue);
      setIsSubmitting(false);
      if (success) {
        navigate('/workspace');
      }
    }
  };

  const displayedError = localError || authError;

  return (
    <div className="min-h-screen bg-zinc-950 flex flex-col justify-center items-center px-4 py-12 relative selection:bg-zinc-800">
      {/* Subtle top account bar */}
      <div className="w-full max-w-sm flex justify-between items-center mb-8">
        <div className="flex items-center space-x-2.5">
          {user?.avatarUrl ? (
            <img
              src={user.avatarUrl}
              alt={user.name}
              className="w-7 h-7 rounded-full border border-zinc-800 object-cover"
            />
          ) : (
            <div className="w-7 h-7 rounded-full bg-zinc-900 border border-zinc-800 flex items-center justify-center text-[11px] text-zinc-300">
              {user?.name?.charAt(0) || 'U'}
            </div>
          )}
          <span className="text-xs text-zinc-400 font-medium truncate max-w-[140px]">
            {user?.name}
          </span>
        </div>

        <button
          type="button"
          onClick={() => logout()}
          className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
        >
          Sign out
        </button>
      </div>

      <div className="w-full max-w-sm space-y-6">
        {/* Minimal Header */}
        <div className="text-center space-y-1">
          <h1 className="text-xl font-semibold tracking-tight text-zinc-100">
            Team Taskspace
          </h1>
        </div>

        {/* Minimal Toggle */}
        <div className="grid grid-cols-2 p-1 bg-zinc-900 border border-zinc-800 rounded-xl">
          <button
            type="button"
            onClick={() => handleModeSwitch('create')}
            className={`flex items-center justify-center space-x-2 py-2 text-xs font-medium rounded-lg transition-all ${
              mode === 'create'
                ? 'bg-zinc-800 text-white shadow-sm'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <PlusCircle className="w-3.5 h-3.5" />
            <span>Create Team</span>
          </button>

          <button
            type="button"
            onClick={() => handleModeSwitch('join')}
            className={`flex items-center justify-center space-x-2 py-2 text-xs font-medium rounded-lg transition-all ${
              mode === 'join'
                ? 'bg-zinc-800 text-white shadow-sm'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <LogIn className="w-3.5 h-3.5" />
            <span>Join Team</span>
          </button>
        </div>

        {/* Error Alert */}
        {displayedError && (
          <div className="p-3 rounded-lg bg-red-950/40 border border-red-800/60 flex items-start space-x-2.5 text-red-200 text-xs">
            <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
            <div className="flex-1 leading-snug">{displayedError}</div>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {mode === 'create' ? (
            <div className="space-y-1.5">
              <label htmlFor="teamName" className="block text-xs text-zinc-400">
                Team Name
              </label>
              <input
                id="teamName"
                name="teamName"
                type="text"
                value={teamNameInput}
                onChange={(e) => {
                  setTeamNameInput(e.target.value);
                  if (localError) setLocalError(null);
                }}
                placeholder="e.g. Core Intelligence"
                disabled={isSubmitting}
                className="w-full px-3.5 py-2.5 rounded-lg bg-zinc-900 border border-zinc-800 focus:border-zinc-500 text-zinc-100 placeholder-zinc-600 text-sm outline-none transition-colors"
                autoFocus
                required
              />
              <div className="flex items-center space-x-1.5 pt-1 text-[11px] text-zinc-500">
                <Sparkles className="w-3 h-3 text-zinc-400" />
                <span>Team ID will be automatically generated</span>
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              <div className="space-y-1.5">
                <label htmlFor="teamId" className="block text-xs text-zinc-400">
                  Team ID
                </label>
                <input
                  id="teamId"
                  name="teamId"
                  type="text"
                  value={teamIdInput}
                  onChange={(e) => {
                    setTeamIdInput(e.target.value.toUpperCase());
                    if (localError) setLocalError(null);
                  }}
                  placeholder="e.g. TEAM-ALPHA"
                  disabled={isSubmitting}
                  className="w-full px-3.5 py-2.5 rounded-lg bg-zinc-900 border border-zinc-800 focus:border-zinc-500 font-mono text-zinc-100 placeholder-zinc-600 text-sm outline-none transition-colors"
                  autoFocus
                  required
                />
              </div>

              {/* Minimal quick chips */}
              <div className="flex items-center space-x-1.5 pt-1">
                <span className="text-[10px] text-zinc-500">Available:</span>
                {DEFAULT_TASKSPACES.map((ts) => (
                  <button
                    key={ts.teamId}
                    type="button"
                    onClick={() => {
                      setTeamIdInput(ts.teamId);
                      setLocalError(null);
                    }}
                    className="px-2 py-0.5 rounded text-[10px] font-mono bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 border border-zinc-800"
                  >
                    {ts.teamId}
                  </button>
                ))}
              </div>
            </div>
          )}

          <button
            type="submit"
            disabled={
              isSubmitting ||
              (mode === 'create' ? !teamNameInput.trim() : !teamIdInput.trim())
            }
            className="w-full flex items-center justify-center space-x-2 py-2.5 px-4 rounded-lg bg-zinc-100 hover:bg-white text-zinc-950 font-medium text-xs transition-all disabled:opacity-40 disabled:cursor-not-allowed group mt-2"
          >
            {isSubmitting ? (
              <div className="w-3.5 h-3.5 border-2 border-zinc-950 border-t-zinc-400 rounded-full animate-spin" />
            ) : (
              <>
                <span>{mode === 'create' ? 'Create Team Taskspace' : 'Join Team Taskspace'}</span>
                <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
};
