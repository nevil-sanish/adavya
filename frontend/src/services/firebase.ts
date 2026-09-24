import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut } from 'firebase/auth';
import { getFirestore, doc, setDoc } from 'firebase/firestore';
import { User, AuthResponse } from '../types/auth.js';

const firebaseConfig = {
  apiKey:
    import.meta.env.REACT_APP_FIREBASE_API_KEY ||
    import.meta.env.VITE_FIREBASE_API_KEY ||
    'AIzaSyCr-rQMekm9xGygaDJcD4ZPBD9y71KKqaU',
  authDomain:
    import.meta.env.REACT_APP_FIREBASE_AUTH_DOMAIN ||
    import.meta.env.VITE_FIREBASE_AUTH_DOMAIN ||
    'adavya-f796d.firebaseapp.com',
  projectId:
    import.meta.env.REACT_APP_FIREBASE_PROJECT_ID ||
    import.meta.env.VITE_FIREBASE_PROJECT_ID ||
    'adavya-f796d',
  storageBucket:
    import.meta.env.REACT_APP_FIREBASE_STORAGE_BUCKET ||
    import.meta.env.VITE_FIREBASE_STORAGE_BUCKET ||
    'adavya-f796d.firebasestorage.app',
  messagingSenderId:
    import.meta.env.REACT_APP_FIREBASE_MESSAGING_SENDER_ID ||
    import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID ||
    '252974229839',
  appId:
    import.meta.env.REACT_APP_FIREBASE_APP_ID ||
    import.meta.env.VITE_FIREBASE_APP_ID ||
    '1:252974229839:web:b4baf7abac197f7694fd3a',
};

// Initialize Firebase safely
const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const googleProvider = new GoogleAuthProvider();

// Force account picker prompt
googleProvider.setCustomParameters({
  prompt: 'select_account',
});

const STORAGE_KEY_USER = 'adavya_auth_user';
const STORAGE_KEY_TOKEN = 'adavya_auth_token';
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

/**
 * Sign in using Firebase Google OAuth Popup with Gmail domain restriction.
 * Persists user data to Firestore database both via client SDK and backend API.
 * Strict schema: no avatarUrl and no workspaceName.
 */
export async function signInWithFirebaseGoogle(): Promise<AuthResponse> {
  try {
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
    const now = new Date().toISOString();
    const userId = `usr_${fbUser.uid.substring(0, 10)}`;

    // Create fresh user instance on login with hasOnboarded: false
    const user: User = {
      id: userId,
      email,
      name: fbUser.displayName || email.split('@')[0],
      googleId: fbUser.uid,
      hasOnboarded: false, // Always initialize to false upon login
      createdAt: now,
      updatedAt: now,
    };

    // 1. Direct Client-side Firestore persistence (creates fresh user instance with hasOnboarded: false)
    try {
      await setDoc(
        doc(db, 'users', fbUser.uid),
        {
          ...user,
          lastLoginAt: now,
        }
      );
      console.log(`[Firestore Client] New user instance created for ${email} with hasOnboarded=false in 'users/${fbUser.uid}'`);
    } catch (clientFsErr) {
      console.warn('[Firestore Client] Direct write error (backend will persist):', clientFsErr);
    }

    // 2. Backend API call to verify token and persist via Firebase Admin
    try {
      const response = await fetch(`${API_URL}/api/auth/google`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken }),
      });
      if (response.ok) {
        const data = await response.json();
        if (data.user) {
          user.id = data.user.id || user.id;
        }
        console.log(`[Backend Auth] User verified and persisted by backend API with hasOnboarded=false`);
      } else {
        const errorData = await response.json().catch(() => ({}));
        console.warn('[Backend Auth] Server responded with error:', errorData);
      }
    } catch (apiErr) {
      console.warn('[Backend Auth] Server connection warning:', apiErr);
    }

    localStorage.setItem(STORAGE_KEY_USER, JSON.stringify(user));
    localStorage.setItem(STORAGE_KEY_TOKEN, idToken);

    return {
      user,
      isNewUser: true,
      token: idToken,
    };
  } catch (error: unknown) {
    if (typeof error === 'object' && error !== null && 'code' in error) {
      const fbErr = error as { code: string; message: string };
      if (fbErr.code === 'auth/popup-closed-by-user') {
        throw new Error('Google sign-in popup was closed before completion.');
      }
      if (fbErr.code === 'auth/cancelled-popup-request') {
        throw new Error('Google sign-in was cancelled.');
      }
      if (fbErr.code === 'auth/popup-blocked') {
        throw new Error('Sign-in popup was blocked by your browser. Please allow popups for this site.');
      }
      if (fbErr.code === 'auth/unauthorized-domain') {
        throw new Error(
          'This domain is not authorized in Firebase Console. Add your domain to Firebase Authentication > Settings > Authorized Domains.'
        );
      }
      if (fbErr.code === 'auth/operation-not-allowed') {
        throw new Error(
          'Google sign-in provider is not enabled in Firebase Console. Enable it in Firebase Authentication > Sign-in method.'
        );
      }
    }
    throw error;
  }
}

export async function signOutFirebase(): Promise<void> {
  await signOut(auth);
}
