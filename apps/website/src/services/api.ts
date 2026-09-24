import { browserSeqStore, createApi, createEventSender } from '@adavya/shared';
import { auth } from './firebase.js';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

export const api = createApi(API_BASE_URL, async () => (auth.currentUser ? auth.currentUser.getIdToken() : null));
export const sendEvent = createEventSender(api, browserSeqStore());

/** Public URL of the player app, shown to players who open the captain site. */
export const PLAYER_APP_URL = import.meta.env.VITE_PLAYER_APP_URL || 'http://localhost:5174';
