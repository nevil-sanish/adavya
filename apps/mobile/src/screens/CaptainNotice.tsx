import React from 'react';
import { useAuth } from '../session.js';

export const CaptainNotice: React.FC = () => {
  const { logout } = useAuth();
  return (
    <main style={{ justifyContent: 'center' }}>
      <p className="eyebrow">Captain</p>
      <h1>You are your team’s captain</h1>
      <p className="muted">Captains play from the captain website on a laptop. Your players use this app on their phones.</p>
      <button type="button" className="btn link" onClick={logout}>Sign out</button>
    </main>
  );
};
