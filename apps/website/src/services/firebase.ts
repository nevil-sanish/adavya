import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  browserLocalPersistence,
  connectAuthEmulator,
  getAuth,
  GoogleAuthProvider,
  setPersistence,
  signInWithPopup,
  signOut,
} from 'firebase/auth';
import { connectFirestoreEmulator, getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey:
    import.meta.env.VITE_FIREBASE_API_KEY ||
    'AIzaSyCr-rQMekm9xGygaDJcD4ZPBD9y71KKqaU',
  authDomain:
    import.meta.env.VITE_FIREBASE_AUTH_DOMAIN ||
    'adavya-f796d.firebaseapp.com',
  projectId:
    import.meta.env.VITE_FIREBASE_PROJECT_ID ||
    'adavya-f796d',
  storageBucket:
    import.meta.env.VITE_FIREBASE_STORAGE_BUCKET ||
    'adavya-f796d.firebasestorage.app',
  messagingSenderId:
    import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID ||
    '252974229839',
  appId:
    import.meta.env.VITE_FIREBASE_APP_ID ||
    '1:252974229839:web:b4baf7abac197f7694fd3a',
};

export const EMAIL_DOMAIN = (import.meta.env.VITE_ALLOWED_EMAIL_DOMAIN || 'iiitkottayam.ac.in').toLowerCase();

const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);

if (import.meta.env.VITE_USE_EMULATORS === 'true') {
  connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
  connectFirestoreEmulator(db, '127.0.0.1', 8080);
}

// Keep the session across refresh and browser restarts.
void setPersistence(auth, browserLocalPersistence);

const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account', hd: EMAIL_DOMAIN });

export function isInstitutionEmail(email: string | null | undefined): boolean {
  const e = (email ?? '').trim().toLowerCase();
  const at = e.indexOf('@');
  return at > 0 && at === e.lastIndexOf('@') && e.slice(at + 1) === EMAIL_DOMAIN;
}

/** Google sign-in restricted to verified institutional accounts. Returns the ID token. */
export async function signInWithGoogle(): Promise<string> {
  try {
    const { user } = await signInWithPopup(auth, googleProvider);
    if (!user.emailVerified || !isInstitutionEmail(user.email)) {
      throw new Error(`Please sign in with your verified @${EMAIL_DOMAIN} Google account.`);
    }
    return await user.getIdToken();
  } catch (error: unknown) {
    await signOut(auth).catch(() => {});
    const code = typeof error === 'object' && error !== null && 'code' in error ? String((error as { code: string }).code) : '';
    const messages: Record<string, string> = {
      'auth/popup-closed-by-user': 'Google sign-in popup was closed before completion.',
      'auth/cancelled-popup-request': 'Google sign-in was cancelled.',
      'auth/popup-blocked': 'Sign-in popup was blocked by your browser. Please allow popups for this site.',
      'auth/unauthorized-domain': 'This domain is not authorized in Firebase Console (Authentication > Settings > Authorized domains).',
      'auth/operation-not-allowed': 'Google sign-in is not enabled in Firebase Console (Authentication > Sign-in method).',
    };
    if (messages[code]) throw new Error(messages[code]);
    throw error;
  }
}

export async function signOutFirebase(): Promise<void> {
  await signOut(auth);
}
