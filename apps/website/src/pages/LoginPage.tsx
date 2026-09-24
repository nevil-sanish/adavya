import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext.js';
import { useNavigate } from 'react-router-dom';
import { AlertCircle, Loader2, X } from 'lucide-react';
import { EMAIL_DOMAIN } from '../services/firebase.js';

export const LoginPage: React.FC = () => {
  const { login, authError, clearError } = useAuth();
  const [isVerifying, setIsVerifying] = useState(false);
  const navigate = useNavigate();

  const handleGoogleSignIn = async () => {
    if (isVerifying) return;
    clearError();
    setIsVerifying(true);
    try {
      if (await login()) navigate('/', { replace: true });
    } finally {
      setIsVerifying(false);
    }
  };

  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-100 flex items-center justify-center px-6">
      <div className="w-full max-w-xs">
        <header className="mb-6 text-center">
          <p className="text-[11px] uppercase tracking-[0.2em] text-zinc-500">Team Challenge · Captain</p>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight">Log in</h1>
          <p className="mt-2 text-sm text-zinc-400">
            Use your institute account (<span className="text-zinc-300">@{EMAIL_DOMAIN}</span>)
          </p>
        </header>
        {authError && (
          <div role="alert" className="mb-4 flex items-start gap-2.5 rounded-lg border border-red-400/20 bg-red-400/5 p-3 text-sm text-red-200">
            <AlertCircle aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" />
            <p className="flex-1 leading-5">{authError}</p>
            <button type="button" aria-label="Dismiss error" onClick={clearError} className="rounded text-red-300 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2">
              <X aria-hidden="true" className="h-4 w-4" />
            </button>
          </div>
        )}
        <button
          type="button"
          onClick={handleGoogleSignIn}
          disabled={isVerifying}
          aria-busy={isVerifying}
          className="flex w-full items-center justify-center gap-3 rounded-lg bg-white px-4 py-3 text-sm font-medium text-zinc-950 transition-colors hover:bg-zinc-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white disabled:cursor-wait disabled:opacity-70"
        >
          {isVerifying ? <Loader2 aria-hidden="true" className="h-5 w-5 animate-spin" /> : (
            <svg aria-hidden="true" className="w-5 h-5 shrink-0" viewBox="0 0 24 24">
                <path
                  fill="#4285F4"
                  d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.8-2.4 3.66v3.05h3.87c2.27-2.09 3.67-5.17 3.67-9.15z"
                />
                <path
                  fill="#34A853"
                  d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.87-3.05c-1.08.72-2.45 1.16-4.06 1.16-3.13 0-5.78-2.11-6.73-4.96H1.24v3.15C3.26 21.36 7.34 24 12 24z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.27 14.24c-.25-.72-.38-1.49-.38-2.24s.13-1.52.38-2.24V6.61H1.24C.45 8.18 0 9.94 0 12s.45 3.82 1.24 5.39l4.03-3.15z"
                />
                <path
                  fill="#EA4335"
                  d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.34 0 3.26 2.64 1.24 6.61l4.03 3.15c.95-2.85 3.6-4.96 6.73-4.96z"
                />
              </svg>
          )}
          <span aria-live="polite">{isVerifying ? 'Signing in…' : 'Continue with Google'}</span>
        </button>
      </div>
    </main>
  );
};
