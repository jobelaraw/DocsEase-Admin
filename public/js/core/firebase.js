// Firebase setup for the whole admin panel. Import { auth, db, functions } from here;
// never call initializeApp anywhere else.
import { initializeApp } from './sdk/app.js';
import { getAuth, connectAuthEmulator, GoogleAuthProvider } from './sdk/auth.js';
import {
  initializeFirestore, persistentLocalCache, persistentMultipleTabManager,
  connectFirestoreEmulator, terminate, clearIndexedDbPersistence
} from './sdk/firestore.js';
import { getFunctions, connectFunctionsEmulator } from './sdk/functions.js';

const config = {
  apiKey: 'AIzaSyBMUAgw21SQFZXnzxijqthz1usHxT_DYtA',
  authDomain: 'docsease-efacc.firebaseapp.com',
  projectId: 'docsease-efacc',
  storageBucket: 'docsease-efacc.firebasestorage.app',
  messagingSenderId: '553281725931',
  appId: '1:553281725931:web:ead49444d796802c2aa5ae',
  measurementId: 'G-DP5SQGZQTG'
};

// Region of the admin Cloud Functions (same as Firestore).
export const FUNCTIONS_REGION = 'asia-southeast1';

// Local testing: open any page on localhost with ?emulators to use the Firebase
// emulators (demo project, never production). Remembered for the browser tab.
function wantsEmulators() {
  const local = location.hostname === 'localhost' || location.hostname === '127.0.0.1';
  if (!local) return false;
  try {
    if (new URLSearchParams(location.search).has('emulators')) sessionStorage.setItem('gabayan_emulators', '1');
    return sessionStorage.getItem('gabayan_emulators') === '1';
  } catch {
    return false;
  }
}

export const usingEmulators = wantsEmulators();

const app = initializeApp(usingEmulators ? { ...config, projectId: 'demo-gabayan' } : config);

export const auth = getAuth(app);

// Firestore keeps a copy of what it has read in IndexedDB, so revisited pages
// can show data immediately and listeners start from the cache.
export const db = initializeFirestore(app, {
  localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() })
});

export const functions = getFunctions(app, FUNCTIONS_REGION);

export const googleProvider = new GoogleAuthProvider();

if (usingEmulators) {
  connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
  connectFirestoreEmulator(db, '127.0.0.1', 8080);
  connectFunctionsEmulator(functions, '127.0.0.1', 5001);
  console.info('[firebase] using local emulators (demo-gabayan)');
}

// Removes the local Firestore cache (called on sign-out; admin PCs may be shared).
export async function clearLocalData() {
  try {
    await terminate(db);
    await clearIndexedDbPersistence(db);
  } catch (error) {
    console.warn('[firebase] could not clear the local cache:', error);
  }
}
