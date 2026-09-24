import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { ApiError, type Session } from '@adavya/shared';
import { api } from '../services/api.js';
import { auth, isInstitutionEmail, signInWithGoogle, signOutFirebase } from '../services/firebase.js';

interface AuthContextType {
  session: Session | null;
  loading: boolean;
  authError: string | null;
  login: () => Promise<boolean>;
  logout: () => Promise<void>;
  /** Reloads the profile after a team or name change. */
  refresh: () => Promise<void>;
  clearError: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

function message(err: unknown, fallback: string): string {
  return err instanceof ApiError || err instanceof Error ? err.message : fallback;
}

/**
 * Firebase Auth persists the sign-in; on every load the server profile is
 * fetched again, restoring competition, team, role and slot.
 */
export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);

  useEffect(
    () =>
      onAuthStateChanged(auth, async (user) => {
        if (!user) {
          setSession(null);
          setLoading(false);
          return;
        }
        if (!user.emailVerified || !isInstitutionEmail(user.email)) {
          await signOutFirebase().catch(() => {});
          return;
        }
        try {
          setSession(await api.session());
        } catch (err) {
          setAuthError(message(err, 'Could not restore your session.'));
          setSession(null);
        } finally {
          setLoading(false);
        }
      }),
    []
  );

  const login = useCallback(async () => {
    setAuthError(null);
    try {
      const idToken = await signInWithGoogle();
      setSession(await api.login(idToken));
      return true;
    } catch (err) {
      setAuthError(message(err, 'Sign-in failed.'));
      await signOutFirebase().catch(() => {});
      return false;
    }
  }, []);

  const logout = useCallback(async () => {
    await signOutFirebase().catch(() => {});
    setSession(null);
  }, []);

  const refresh = useCallback(async () => {
    try {
      setSession(await api.session());
    } catch (err) {
      setAuthError(message(err, 'Could not refresh your profile.'));
    }
  }, []);

  const clearError = useCallback(() => setAuthError(null), []);

  return (
    <AuthContext.Provider value={{ session, loading, authError, login, logout, refresh, clearError }}>{children}</AuthContext.Provider>
  );
};

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
}
