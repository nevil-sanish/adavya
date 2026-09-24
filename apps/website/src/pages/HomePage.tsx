import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.js';
import { FullScreenMessage } from '../components/ui.js';
import { OnboardingPage } from './OnboardingPage.js';
import { PlayerNoticePage } from './PlayerNoticePage.js';
import { CaptainApp } from '../captain/CaptainApp.js';

/** Restores the right screen from the stored profile: onboarding, captain app, or the player notice. */
export const HomePage: React.FC = () => {
  const { session, loading } = useAuth();
  if (loading) return <FullScreenMessage title="Restoring your session…" spinner />;
  if (!session) return <Navigate to="/login" replace />;

  const { user } = session;
  if (!user.teamId || !user.competitionId) return <OnboardingPage />;
  if (user.role !== 'CAPTAIN') return <PlayerNoticePage />;
  return <CaptainApp cid={user.competitionId} teamId={user.teamId} uid={user.uid} />;
};
