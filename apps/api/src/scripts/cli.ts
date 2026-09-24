import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { getDb, initializeFirebaseAdmin } from '../config/firebase.js';

/** Loads apps/api/.env and the Admin SDK for operator scripts. Honors FIRESTORE_EMULATOR_HOST. */
export function scriptDb() {
  dotenv.config({ path: fileURLToPath(new URL('../../.env', import.meta.url)) });
  initializeFirebaseAdmin();
  return getDb();
}

export function flag(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  if (i === -1) return undefined;
  const value = process.argv[i + 1];
  return value && !value.startsWith('--') ? value : 'true';
}

export function target(): string {
  return process.env.FIRESTORE_EMULATOR_HOST ? `emulator ${process.env.FIRESTORE_EMULATOR_HOST}` : `project ${process.env.FIREBASE_PROJECT_ID}`;
}
