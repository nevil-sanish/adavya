import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { AuthResponse } from '../types/auth.js';
import { authenticateWithGoogle } from './api.js';

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
  hd: 'iiitkottayam.ac.in',
});

export async function signInWithFirebaseGoogle(): Promise<AuthResponse> {
  try {
    const result = await signInWithPopup(auth, googleProvider);
    const fbUser = result.user;

    const email = fbUser.email?.toLowerCase().trim();
    if (!email) {
      await signOut(auth);
      throw new Error('Google account does not contain a verified email address.');
    }

    if (!fbUser.emailVerified || !/^[^@\s]+@iiitkottayam\.ac\.in$/.test(email)) {
      throw new Error('Please sign in with your verified @iiitkottayam.ac.in Google account.');
    }

    return await authenticateWithGoogle(await fbUser.getIdToken());
  } catch (error: unknown) {
    localStorage.removeItem('adavya_auth_user');
    localStorage.removeItem('adavya_auth_token');
    await signOut(auth).catch(() => {});
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
