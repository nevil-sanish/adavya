import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { User } from '../types/auth.js';
import {
  authenticateWithGoogle,
  authenticateWithMockGoogle,
  getCurrentSession,
  logoutSession,
  createTeamTaskspace,
  joinTeamTaskspace,
  AuthApiError,
} from '../services/api.js';
import { signInWithFirebaseGoogle, signOutFirebase } from '../services/firebase.js';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  authError: string | null;
  loginWithGoogleToken: (idToken: string) => Promise<boolean>;
  loginWithFirebaseGoogle: () => Promise<boolean>;
  loginWithDemo: (options?: { email?: string; name?: string; rejectNonGmail?: boolean }) => Promise<boolean>;
  createTeam: (teamName: string) => Promise<boolean>;
  joinTeam: (teamId: string) => Promise<boolean>;
  logout: () => Promise<void>;
  clearError: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [authError, setAuthError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    async function initSession() {
      try {
        const sessionUser = await getCurrentSession();
        if (isMounted) setUser(sessionUser);
      } catch {
        if (isMounted) setUser(null);
      } finally {
        if (isMounted) setLoading(false);
      }
    }
    initSession();
    return () => {
      isMounted = false;
    };
  }, []);

  const clearError = useCallback(() => {
    setAuthError(null);
  }, []);

  const loginWithGoogleToken = useCallback(async (idToken: string): Promise<boolean> => {
    setLoading(true);
    setAuthError(null);
    try {
      const response = await authenticateWithGoogle(idToken);
      setUser(response.user);
      return true;
    } catch (err: unknown) {
      const message =
        err instanceof AuthApiError
          ? err.message
          : err instanceof Error
          ? err.message
          : 'Authentication failed.';
      setAuthError(message);
      return false;
    } finally {
      setLoading(false);
    }
  }, []);

  const loginWithDemo = useCallback(
    async (options?: { email?: string; name?: string; rejectNonGmail?: boolean }): Promise<boolean> => {
      setLoading(true);
      setAuthError(null);
      try {
        const response = await authenticateWithMockGoogle(options);
        setUser(response.user);
        return true;
      } catch (err: unknown) {
        const message =
          err instanceof AuthApiError
            ? err.message
            : err instanceof Error
            ? err.message
            : 'Authentication failed.';
        setAuthError(message);
        return false;
      } finally {
        setLoading(false);
      }
    },
    []
  );

  const createTeam = useCallback(async (teamName: string): Promise<boolean> => {
    setLoading(true);
    setAuthError(null);
    try {
      const response = await createTeamTaskspace({ teamName });
      setUser(response.user);
      return true;
    } catch (err: unknown) {
      const message =
        err instanceof AuthApiError
          ? err.message
          : err instanceof Error
          ? err.message
          : 'Failed to create team taskspace.';
      setAuthError(message);
      return false;
    } finally {
      setLoading(false);
    }
  }, []);

  const joinTeam = useCallback(async (teamId: string): Promise<boolean> => {
    setLoading(true);
    setAuthError(null);
    try {
      const response = await joinTeamTaskspace({ teamId });
      setUser(response.user);
      return true;
    } catch (err: unknown) {
      const message =
        err instanceof AuthApiError
          ? err.message
          : err instanceof Error
          ? err.message
          : 'Failed to join team taskspace.';
      setAuthError(message);
      return false;
    } finally {
      setLoading(false);
    }
  }, []);

  const logout = useCallback(async () => {
    setLoading(true);
    try {
      await logoutSession();
      setUser(null);
      setAuthError(null);
    } finally {
      setLoading(false);
    }
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        authError,
        loginWithGoogleToken,
        loginWithDemo,
        createTeam,
        joinTeam,
        logout,
        clearError,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
