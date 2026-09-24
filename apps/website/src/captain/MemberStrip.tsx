import React from 'react';
import { isMemberOnline, SLOT_LABEL, type Member } from '@adavya/shared';
import { useNow } from '../hooks/usePresence.js';

const ORDER = ['captain', 'player1', 'player2', 'player3'];

/** The four fixed members with live connection dots. */
export const MemberStrip: React.FC<{ members: Member[]; className?: string }> = ({ members, className = '' }) => {
  const now = useNow();
  const sorted = [...members].sort((a, b) => ORDER.indexOf(a.slot) - ORDER.indexOf(b.slot));
  return (
    <ul className={`flex flex-wrap gap-3 ${className}`} aria-label="Team members">
      {sorted.map((m) => {
        const online = isMemberOnline(m, now);
        return (
          <li key={m.uid} className="flex items-center gap-1.5 text-xs text-zinc-300" title={`${SLOT_LABEL[m.slot]} · ${online ? 'connected' : 'disconnected'}`}>
            <span aria-hidden="true" className={`h-2 w-2 rounded-full ${online ? 'bg-emerald-400' : 'bg-zinc-600'}`} />
            <span>{m.displayName}</span>
            <span className="sr-only">{online ? 'connected' : 'disconnected'}</span>
          </li>
        );
      })}
    </ul>
  );
};

export function offlineMembers(members: Member[], now: number): Member[] {
  return members.filter((m) => !isMemberOnline(m, now));
}
