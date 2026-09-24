import admin from 'firebase-admin';
import fs from 'fs';
import path from 'path';

const projectId = process.env.FIREBASE_PROJECT_ID || 'adavya-f796d';
const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');

let isInitialized = false;

export function initializeFirebaseAdmin(): admin.app.App {
  if (admin.apps.length > 0) {
    return admin.app();
  }
  
  const serviceAccountPath = path.join(process.cwd(), 'serviceAccountKey.json');

  try {
    if (fs.existsSync(serviceAccountPath)) {
      const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        projectId: serviceAccount.project_id || projectId,
      });
      console.log(`[Firebase Admin] Initialized from serviceAccountKey.json for ${serviceAccount.project_id || projectId}`);
    } else if (clientEmail && privateKey) {
      admin.initializeApp({
        credential: admin.credential.cert({
          projectId,
          clientEmail,
          privateKey,
        }),
        projectId,
      });
      console.log(`[Firebase Admin] Initialized with Service Account for ${projectId}`);
    } else {
      admin.initializeApp({
        projectId,
      });
      console.log(`[Firebase Admin] Initialized with Project ID ${projectId}`);
    }
    isInitialized = true;
  } catch (err) {
    console.warn('[Firebase Admin] Warning during initialization:', err);
  }

  return admin.app();
}

export async function verifyFirebaseIdToken(idToken: string): Promise<admin.auth.DecodedIdToken> {
  if (!isInitialized && admin.apps.length === 0) {
    initializeFirebaseAdmin();
  }
  return await admin.auth().verifyIdToken(idToken);
}

let firestoreDb: admin.firestore.Firestore | null = null;

export function getDb(): admin.firestore.Firestore {
  if (!isInitialized && admin.apps.length === 0) {
    initializeFirebaseAdmin();
  }
  if (!firestoreDb) {
    firestoreDb = admin.firestore();
    firestoreDb.settings({ ignoreUndefinedProperties: true });
  }
  return firestoreDb;
}

export { admin };
