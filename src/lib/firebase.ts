import { initializeApp, type FirebaseApp } from 'firebase/app';
import {
  GoogleAuthProvider,
  browserLocalPersistence,
  getAuth,
  setPersistence,
  type Auth,
} from 'firebase/auth';
import { initializeFirestore, type Firestore } from 'firebase/firestore';

const config = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

if (!config.apiKey || !config.projectId || !config.appId) {
  throw new Error(
    'Firebase configuration is missing. Ensure VITE_FIREBASE_* values are present in .env.'
  );
}

const app: FirebaseApp = initializeApp(config);
const auth: Auth = getAuth(app);
// Strokes routinely carry optional fields (marker, layer, doubled, radiusMm) that
// remain `undefined`; without this flag Firestore's setDoc rejects the whole write.
const db: Firestore = initializeFirestore(app, { ignoreUndefinedProperties: true });

// Persist session across reloads and browser restarts.
setPersistence(auth, browserLocalPersistence).catch(() => {
  /* persistence already set or unsupported environment */
});

export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });

export { app, auth, db };
