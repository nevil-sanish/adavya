import React, { useState } from 'react';
import { GoogleLogin, CredentialResponse } from '@react-oauth/google';
import { useAuth } from '../context/AuthContext.js';
import { useNavigate } from 'react-router-dom';
import { ShieldAlert, Sparkles, CheckCircle2, AlertCircle, ArrowRight, UserCheck } from 'lucide-react';

export const LoginPage: React.FC = () => {
  const { loginWithGoogleToken, loginWithDemo, authError, clearError } = useAuth();
  const [isVerifying, setIsVerifying] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const navigate = useNavigate();

  const handleGoogleSuccess = async (credentialResponse: CredentialResponse) => {
    if (!credentialResponse.credential) {
      setLocalError('Google did not provide a valid ID token credential.');
      return;
    }

    clearError();
    setLocalError(null);
    setIsVerifying(true);

    const success = await loginWithGoogleToken(credentialResponse.credential);
    setIsVerifying(false);

    if (success) {
      navigate('/onboarding');
    }
  };

  const handleGoogleError = () => {
    setLocalError('Google OAuth popup was closed or authentication failed.');
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
            <div className="flex flex-col items-center justify-center min-h-[44px]">
              {isVerifying ? (
                <div className="flex items-center space-x-3 text-zinc-300 text-sm py-2">
                  <div className="w-4 h-4 border-2 border-zinc-600 border-t-zinc-200 rounded-full animate-spin" />
                  <span>Verifying Google token & session...</span>
                </div>
              ) : (
                <div className="w-full flex justify-center">
                  <GoogleLogin
                    onSuccess={handleGoogleSuccess}
                    onError={handleGoogleError}
                    theme="filled_black"
                    shape="pill"
                    size="large"
                    text="continue_with"
                    width="100%"
                  />
                </div>
              )}
            </div>

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
            <span>Encrypted Token Exchange</span>
          </div>
          <div className="flex items-center space-x-1.5">
            <Sparkles className="w-3.5 h-3.5 text-zinc-400" />
            <span>Multi-Agent Platform</span>
          </div>
        </div>
      </div>
    </div>
  );
};
