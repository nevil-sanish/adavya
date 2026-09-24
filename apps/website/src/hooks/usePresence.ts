import { useEffect, useState } from 'react';
import { doc, serverTimestamp, updateDoc } from 'firebase/firestore';
import { HEARTBEAT_MS } from '@adavya/shared';
import { db } from '../services/firebase.js';
import { paths } from '../services/paths.js';

/**
 * Heartbeat on the caller's own member document while this page is open.
 * Closing the page marks the member disconnected immediately; otherwise the
 * server treats a heartbeat older than 45 s as disconnected.
 */
export function usePresence(cid: string | null, teamId: string | null, uid: string | null): void {
  useEffect(() => {
    if (!cid || !teamId || !uid) return;
    const ref = doc(db, paths.member(cid, teamId, uid));
    const beat = (isConnected: boolean) => updateDoc(ref, { isConnected, lastSeenAt: serverTimestamp() }).catch(() => {});
    void beat(true);
    const timer = window.setInterval(() => void beat(true), HEARTBEAT_MS);
    const onVisible = () => document.visibilityState === 'visible' && void beat(true);
    const onHide = () => void beat(false);
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('pagehide', onHide);
    window.addEventListener('online', onVisible);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('pagehide', onHide);
      window.removeEventListener('online', onVisible);
    };
  }, [cid, teamId, uid]);
}

/** Browser online state. */
export function useOnline(): boolean {
  const [online, setOnline] = useState(typeof navigator === 'undefined' ? true : navigator.onLine);
  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => {
      window.removeEventListener('online', on);
      window.removeEventListener('offline', off);
    };
  }, []);
  return online;
}

/** Re-renders every `ms` so presence ages stay current. */
export function useNow(ms = 5000): number {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), ms);
    return () => window.clearInterval(t);
  }, [ms]);
  return now;
}
