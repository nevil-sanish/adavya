import { useEffect, useState } from 'react';
import { collection, doc, onSnapshot, orderBy, query } from 'firebase/firestore';
import { db } from '../services/firebase.js';

export interface Live<T> {
  data: T;
  loading: boolean;
  error: string | null;
  /** True while the data came from the local cache and has not been confirmed by the server. */
  fromCache: boolean;
}

function describe(err: { code?: string; message: string }): string {
  if (err.code === 'permission-denied') return 'You do not have access to this data.';
  if (err.code === 'unavailable') return 'Connection lost. Reconnecting…';
  return err.message;
}

/**
 * Live document. Listeners detach on unmount or when the path changes, so a
 * route/task change never leaves a listener on the previous task.
 */
export function useDoc<T>(path: string | null): Live<T | null> {
  const [state, setState] = useState<Live<T | null>>({ data: null, loading: Boolean(path), error: null, fromCache: false });
  useEffect(() => {
    if (!path) {
      setState({ data: null, loading: false, error: null, fromCache: false });
      return;
    }
    setState((s) => ({ ...s, loading: true, error: null }));
    return onSnapshot(
      doc(db, path),
      { includeMetadataChanges: true },
      (snap) =>
        setState({
          data: snap.exists() ? (snap.data({ serverTimestamps: 'estimate' }) as T) : null,
          loading: false,
          error: null,
          fromCache: snap.metadata.fromCache,
        }),
      (err) => setState({ data: null, loading: false, error: describe(err), fromCache: false })
    );
  }, [path]);
  return state;
}

/** Live collection, optionally ordered by one field. */
export function useCollection<T>(path: string | null, orderField?: string): Live<T[]> {
  const [state, setState] = useState<Live<T[]>>({ data: [], loading: Boolean(path), error: null, fromCache: false });
  useEffect(() => {
    if (!path) {
      setState({ data: [], loading: false, error: null, fromCache: false });
      return;
    }
    setState((s) => ({ ...s, loading: true, error: null }));
    const ref = orderField ? query(collection(db, path), orderBy(orderField)) : collection(db, path);
    return onSnapshot(
      ref,
      { includeMetadataChanges: true },
      (snap) =>
        setState({
          data: snap.docs.map((d) => d.data({ serverTimestamps: 'estimate' }) as T),
          loading: false,
          error: null,
          fromCache: snap.metadata.fromCache,
        }),
      (err) => setState({ data: [], loading: false, error: describe(err), fromCache: false })
    );
  }, [path, orderField]);
  return state;
}
