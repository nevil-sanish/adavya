import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.js';
import { LoadingSpinner } from './LoadingSpinner.js';

interface GuardProps {
  children: React.ReactNode;
}

/**
 * Protects workspace and internal application routes.
 * Requires an authenticated user who has completed onboarding.
 */
export const ProtectedRoute: React.FC<GuardProps> = ({ children }) => {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <LoadingSpinner label="Validating Workspace Session..." size="lg" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (!user.hasOnboarded) {
    return <Navigate to="/onboarding" replace />;
  }

  return <>{children}</>;
};

/**
 * Protects the onboarding step.
 * Only accessible to authenticated users who have NOT completed onboarding yet.
 */
export const OnboardingRoute: React.FC<GuardProps> = ({ children }) => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <LoadingSpinner label="Preparing Onboarding..." size="lg" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (user.hasOnboarded) {
    return <Navigate to="/workspace" replace />;
  }

  return <>{children}</>;
};

/**
 * Protects login page from already-authenticated users.
 */
export const PublicOnlyRoute: React.FC<GuardProps> = ({ children }) => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <LoadingSpinner label="Checking Session..." size="sm" />
      </div>
    );
  }

  if (user) {
    if (!user.hasOnboarded) {
      return <Navigate to="/onboarding" replace />;
    }
    return <Navigate to="/workspace" replace />;
  }

  return <>{children}</>;
};
