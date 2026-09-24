import { browserSeqStore, createApi, createEventSender } from '@adavya/shared';
import { auth } from './firebase.js';

// Empty means same origin: Firebase Hosting forwards /api to Cloud Run in production,
// and the dev server proxies /api to the local API (also from a phone on the LAN).
const API_BASE_URL = import.meta.env.VITE_API_URL || '';

export const api = createApi(API_BASE_URL, async () => (auth.currentUser ? auth.currentUser.getIdToken() : null));
export const sendEvent = createEventSender(api, browserSeqStore());
