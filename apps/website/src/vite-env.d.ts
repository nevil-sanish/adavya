/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly REACT_APP_FIREBASE_API_KEY?: string;
  readonly REACT_APP_FIREBASE_AUTH_DOMAIN?: string;
  readonly REACT_APP_FIREBASE_PROJECT_ID?: string;
  readonly REACT_APP_FIREBASE_STORAGE_BUCKET?: string;
  readonly REACT_APP_FIREBASE_MESSAGING_SENDER_ID?: string;
  readonly REACT_APP_FIREBASE_APP_ID?: string;

  readonly VITE_FIREBASE_API_KEY?: string;
  readonly VITE_FIREBASE_AUTH_DOMAIN?: string;
  readonly VITE_FIREBASE_PROJECT_ID?: string;
  readonly VITE_FIREBASE_STORAGE_BUCKET?: string;
  readonly VITE_FIREBASE_MESSAGING_SENDER_ID?: string;
  readonly VITE_FIREBASE_APP_ID?: string;

  readonly VITE_GOOGLE_CLIENT_ID?: string;
  readonly VITE_API_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
