import React, { useState } from 'react';
import { useAuth } from '../session.js';
import { EMAIL_DOMAIN } from '../services/firebase.js';
import { Banner } from '../ui.js';

export const SignIn: React.FC = () => {
  const { login, authError } = useAuth();
  const [busy, setBusy] = useState(false);
  return (
    <main style={{ justifyContent: 'center' }}>
      <p className="eyebrow">Team Challenge · Player</p>
      <h1>Sign in</h1>
      <p className="muted">Use your institute Google account (@{EMAIL_DOMAIN}). You stay signed in on this phone.</p>
      {authError && <Banner tone="error">{authError}</Banner>}
      <button
        type="button"
        className="btn"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          await login();
          setBusy(false);
        }}
      >
        {busy ? 'Signing in…' : 'Continue with Google'}
      </button>
    </main>
  );
};
