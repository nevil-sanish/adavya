import type { Firestore, Transaction } from 'firebase-admin/firestore';

/** Game transactions contend on shared documents (a team during joins, a task's ranking), so allow more retries. */
export function runGameTransaction<T>(db: Firestore, fn: (tx: Transaction) => Promise<T>): Promise<T> {
  return db.runTransaction(fn, { maxAttempts: 20 });
}
