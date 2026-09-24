import React from 'react';
import { AuthProvider, useAuth } from './session.js';
import { Loading } from './ui.js';
import { SignIn } from './screens/SignIn.js';
import { Join } from './screens/Join.js';
import { CaptainNotice } from './screens/CaptainNotice.js';
import { PlayerApp } from './screens/PlayerApp.js';

/** The player app has no routes: the screen always follows the stored profile and live team state. */
const Root: React.FC = () => {
  const { session, loading } = useAuth();
  if (loading) return <Loading label="Restoring your session…" />;
  if (!session) return <SignIn />;
  const { user } = session;
  if (!user.teamId || !user.competitionId) return <Join />;
  if (user.role === 'CAPTAIN') return <CaptainNotice />;
  return <PlayerApp cid={user.competitionId} teamId={user.teamId} uid={user.uid} />;
};

export const App: React.FC = () => (
  <AuthProvider>
    <Root />
  </AuthProvider>
);
