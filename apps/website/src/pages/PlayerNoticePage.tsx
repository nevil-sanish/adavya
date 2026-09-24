import React from 'react';
import { SLOT_LABEL } from '@adavya/shared';
import { useAuth } from '../context/AuthContext.js';
import { PLAYER_APP_URL } from '../services/api.js';
import { FullScreenMessage } from '../components/ui.js';

/** Players play on their phones; the captain site shows nothing about the task. */
export const PlayerNoticePage: React.FC = () => {
  const { session, logout } = useAuth();
  const slot = session?.user.slot;
  return (
    <FullScreenMessage title="Use your phone to play">
      <p>
        You are {slot ? SLOT_LABEL[slot] : 'a player'} in your team. Open the player app on your phone and sign in with the same
        account:
      </p>
      <p>
        <a className="text-sky-300 underline" href={PLAYER_APP_URL}>{PLAYER_APP_URL}</a>
      </p>
      <button type="button" onClick={logout} className="text-xs text-zinc-500 hover:text-zinc-200">
        Sign out
      </button>
    </FullScreenMessage>
  );
};
