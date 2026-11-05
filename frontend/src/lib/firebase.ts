/**
 * Firebase app initialization.
 *
 * Config values come from Vite env vars (see .env.example) so the same
 * built bundle can point at different Firebase projects without a code
 * change. When VITE_USE_FIREBASE_EMULATOR=true, every service connects to
 * the local Firebase Emulator Suite instead of the real cloud project --
 * this is what lets the whole app run (and be developed/tested) with zero
 * real Firebase project at all. See README-FIREBASE.md.
 */
import { initializeApp, type FirebaseOptions } from "firebase/app";
import { getAuth, connectAuthEmulator } from "firebase/auth";
import { getFirestore, connectFirestoreEmulator } from "firebase/firestore";
import { getStorage, connectStorageEmulator } from "firebase/storage";

const firebaseConfig: FirebaseOptions = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);

const USE_EMULATOR = import.meta.env.VITE_USE_FIREBASE_EMULATOR === "true";

if (USE_EMULATOR) {
  const host = import.meta.env.VITE_EMULATOR_HOST || "localhost";
  connectAuthEmulator(auth, `http://${host}:9099`, { disableWarnings: true });
  connectFirestoreEmulator(db, host, 8080);
  connectStorageEmulator(storage, host, 9199);
  // eslint-disable-next-line no-console
  console.info(`[firebase] Connected to local emulators on ${host}`);
}
