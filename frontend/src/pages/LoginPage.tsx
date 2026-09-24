import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext.js';
import { useNavigate } from 'react-router-dom';
import { ShieldAlert, Sparkles, CheckCircle2, AlertCircle, ArrowRight, UserCheck } from 'lucide-react';

export const LoginPage: React.FC = () => {
  const { loginWithFirebaseGoogle, loginWithDemo, authError, clearError } = useAuth();
  const [isVerifying, setIsVerifying] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const navigate = useNavigate();

  const handleGoogleSignIn = async () => {
    clearError();
    setLocalError(null);
    setIsVerifying(true);

    try {
      const success = await loginWithFirebaseGoogle();
      if (success) {
        navigate('/onboarding');
      }
    } catch (err: unknown) {
      if (err instanceof Error) {
        setLocalError(err.message);
      } else {
        setLocalError('Authentication failed. Please try again.');
      }
    } finally {
      setIsVerifying(false);
    }
  };

  // Demo Sign-in for immediate verification (valid Gmail)
  const handleDemoSignIn = async (email: string, name: string) => {
    clearError();
    setLocalError(null);
    setIsVerifying(true);

    const success = await loginWithDemo({ email, name });
    setIsVerifying(false);

    if (success) {
      navigate('/onboarding');
    }
  };

  // Demonstration of Gmail restriction error
  const handleTestNonGmail = async () => {
    clearError();
    setLocalError(null);
    setIsVerifying(true);

    await loginWithDemo({ email: 'alex.chen@corporate.io', name: 'Alex Chen', rejectNonGmail: true });
    setIsVerifying(false);
  };

  const displayedError = localError || authError;

  return (
    <div className="min-h-screen bg-zinc-950 flex flex-col justify-center items-center px-4 sm:px-6 lg:px-8 relative overflow-hidden">
      {/* Subtle background glow effects matching zinc/black aesthetic */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-zinc-800/20 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -top-10 -right-10 w-72 h-72 bg-blue-600/10 rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-md z-10 space-y-8">
        {/* Header / Brand */}
        <div className="text-center space-y-3">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-zinc-900 border border-zinc-800 shadow-inner">
            <svg
              className="w-6 h-6 text-zinc-100"
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
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-zinc-100 sm:text-3xl">
              Adavya
            </h1>
            <p className="text-xs uppercase tracking-widest text-zinc-400 mt-0.5">
              Workspace & Agentic Intelligence
            </p>
          </div>
          <p className="text-sm text-zinc-400 max-w-xs mx-auto pt-1">
            Sign in with your Google account to access your workspace and team environment.
          </p>
        </div>

        {/* Auth Card */}
        <div className="bg-zinc-900/80 backdrop-blur-xl border border-zinc-800 rounded-2xl p-6 sm:p-8 shadow-2xl shadow-black/60 space-y-6">
          {/* Restriction Notice */}
          <div className="flex items-start space-x-3 p-3 rounded-lg bg-zinc-950/60 border border-zinc-800/80 text-xs text-zinc-300">
            <ShieldAlert className="w-4 h-4 text-zinc-400 shrink-0 mt-0.5" />
            <div>
              <span className="font-semibold text-zinc-200">Gmail-Restricted Access:</span> Only{' '}
              <code className="text-zinc-200 font-mono bg-zinc-800 px-1 py-0.5 rounded">@gmail.com</code>{' '}
              accounts are permitted.
            </div>
          </div>

          {/* Error Alert */}
          {displayedError && (
            <div className="p-3.5 rounded-lg bg-red-950/40 border border-red-800/60 flex items-start space-x-3 text-red-200 text-xs animate-in fade-in duration-200">
              <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
              <div className="flex-1 leading-relaxed">{displayedError}</div>
              <button
                onClick={() => {
                  setLocalError(null);
                  clearError();
                }}
                className="text-red-400 hover:text-red-300 font-bold ml-1 text-sm"
              >
                &times;
              </button>
            </div>
          )}

          {/* Google Login Section */}
          <div className="space-y-4">
            <button
              type="button"
              onClick={handleGoogleSignIn}
              disabled={isVerifying}
              className="w-full flex items-center justify-center space-x-3 py-3 px-4 rounded-xl bg-zinc-900 hover:bg-zinc-800 active:bg-zinc-850 border border-zinc-700/80 hover:border-zinc-500 text-zinc-100 font-medium text-sm transition-all duration-150 shadow-lg shadow-black/40 group disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {isVerifying ? (
                <>
                  <div className="w-4 h-4 border-2 border-zinc-500 border-t-zinc-100 rounded-full animate-spin" />
                  <span>Connecting to Google...</span>
                </>
              ) : (
                <>
                  <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24">
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
                  <span className="font-semibold tracking-wide">Continue with Google</span>
                </>
              )}
            </button>

            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-zinc-800" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-zinc-900 px-3 text-zinc-500 font-medium tracking-wider">
                  Or Test Flows Directly
                </span>
              </div>
            </div>

            {/* Quick Demo Logins for Testing OAuth Logic */}
            <div className="space-y-2 pt-1">
              <button
                type="button"
                onClick={() => handleDemoSignIn('shubham.adavya@gmail.com', 'Shubham Biswal')}
                disabled={isVerifying}
                className="w-full flex items-center justify-between px-3.5 py-2.5 rounded-lg bg-zinc-800/80 hover:bg-zinc-800 border border-zinc-700/80 text-zinc-200 text-xs font-medium transition-all group disabled:opacity-50"
              >
                <div className="flex items-center space-x-2.5">
                  <UserCheck className="w-4 h-4 text-emerald-400" />
                  <span>Sign in as <span className="text-zinc-100 font-semibold">shubham.adavya@gmail.com</span></span>
                </div>
                <ArrowRight className="w-3.5 h-3.5 text-zinc-400 group-hover:translate-x-0.5 transition-transform" />
              </button>

              <button
                type="button"
                onClick={handleTestNonGmail}
                disabled={isVerifying}
                className="w-full flex items-center justify-between px-3.5 py-2.5 rounded-lg bg-zinc-950/60 hover:bg-zinc-900 border border-zinc-800/80 text-zinc-400 hover:text-zinc-300 text-xs transition-all group disabled:opacity-50"
              >
                <div className="flex items-center space-x-2.5">
                  <ShieldAlert className="w-4 h-4 text-amber-500" />
                  <span>Test Non-Gmail Account <span className="text-zinc-500">(@corporate.io)</span></span>
                </div>
                <span className="text-[10px] text-amber-400/80 font-mono uppercase bg-amber-950/50 px-1.5 py-0.5 rounded border border-amber-800/40">
                  Tests Rejection
                </span>
              </button>
            </div>
          </div>

          {/* Footer note */}
          <div className="pt-2 border-t border-zinc-800/60 text-center">
            <p className="text-[11px] text-zinc-500">
              First-time users will be guided to connect their Team ID.
            </p>
          </div>
        </div>

        {/* Trust Badges */}
        <div className="flex items-center justify-center space-x-6 text-xs text-zinc-500">
          <div className="flex items-center space-x-1.5">
            <CheckCircle2 className="w-3.5 h-3.5 text-zinc-400" />
            <span>Firebase OAuth 2.0</span>
          </div>
          <div className="flex items-center space-x-1.5">
            <Sparkles className="w-3.5 h-3.5 text-zinc-400" />
            <span>Gmail Domain Verified</span>
          </div>
        </div>
      </div>
    </div>
  );
};
