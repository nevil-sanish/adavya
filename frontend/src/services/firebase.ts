import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut } from 'firebase/auth';
import { User, AuthResponse } from '../types/auth.js';

const firebaseConfig = {
  apiKey:
    import.meta.env.REACT_APP_FIREBASE_API_KEY ||
    import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain:
    import.meta.env.REACT_APP_FIREBASE_AUTH_DOMAIN ||
    import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId:
    import.meta.env.REACT_APP_FIREBASE_PROJECT_ID ||
    import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket:
    import.meta.env.REACT_APP_FIREBASE_STORAGE_BUCKET ||
    import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId:
    import.meta.env.REACT_APP_FIREBASE_MESSAGING_SENDER_ID ||
    import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId:
    import.meta.env.REACT_APP_FIREBASE_APP_ID ||
    import.meta.env.VITE_FIREBASE_APP_ID,
};

// Initialize Firebase safely
const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();

// Force account picker prompt
googleProvider.setCustomParameters({
  prompt: 'select_account',
});

const STORAGE_KEY_USER = 'adavya_auth_user';
const STORAGE_KEY_TOKEN = 'adavya_auth_token';

/**
 * Sign in using Firebase Google OAuth Popup with Gmail domain restriction
 */
export async function signInWithFirebaseGoogle(): Promise<AuthResponse> {
  const result = await signInWithPopup(auth, googleProvider);
  const fbUser = result.user;

  const email = fbUser.email?.toLowerCase().trim();
  if (!email) {
    await signOut(auth);
    throw new Error('Google account does not contain a verified email address.');
  }

  // Gmail domain restriction
  const isGmail = email.endsWith('@gmail.com') || email.endsWith('@googlemail.com');
  if (!isGmail) {
    await signOut(auth);
    throw new Error(
      `Access restricted: Only @gmail.com accounts are permitted. (${email} is not allowed).`
    );
  }

  const idToken = await fbUser.getIdToken();

  // Check if existing user in storage
  const existingRaw = localStorage.getItem(STORAGE_KEY_USER);
  let existingUser: User | null = null;
  if (existingRaw) {
    try {
      const parsed = JSON.parse(existingRaw) as User;
      if (parsed.email === email || parsed.googleId === fbUser.uid) {
        existingUser = parsed;
      }
    } catch {
      // ignore
    }
  }

  const isNewUser = !existingUser;
  const user: User = existingUser
    ? {
        ...existingUser,
        name: fbUser.displayName || existingUser.name,
        avatarUrl: fbUser.photoURL || existingUser.avatarUrl,
        updatedAt: new Date().toISOString(),
      }
    : {
        id: `usr_${fbUser.uid.substring(0, 10)}`,
        email,
        name: fbUser.displayName || email.split('@')[0],
        avatarUrl: fbUser.photoURL || undefined,
        googleId: fbUser.uid,
        hasOnboarded: false,
        createdAt: new Date().toISOString(),
      };

  localStorage.setItem(STORAGE_KEY_USER, JSON.stringify(user));
  localStorage.setItem(STORAGE_KEY_TOKEN, idToken);

  return {
    user,
    isNewUser,
    token: idToken,
  };
}

export async function signOutFirebase(): Promise<void> {
  await signOut(auth);
}
