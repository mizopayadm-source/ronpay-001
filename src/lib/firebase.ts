import { initializeApp, getApps, getApp } from "firebase/app";
import { 
  initializeFirestore, 
  getFirestore, 
  persistentLocalCache, 
  persistentMultipleTabManager,
  setLogLevel
} from "firebase/firestore";

export const firebaseConfig = {
  apiKey: (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_FIREBASE_API_KEY) || "AIzaSyDbLHlj2yEDQVxm2LRJjY8OMpuBab-TxEk",
  authDomain: (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_FIREBASE_AUTH_DOMAIN) || "ronpay-7fc69.firebaseapp.com",
  projectId: (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_FIREBASE_PROJECT_ID) || "ronpay-7fc69",
  storageBucket: (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_FIREBASE_STORAGE_BUCKET) || "ronpay-7fc69.firebasestorage.app",
  messagingSenderId: (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_FIREBASE_MESSAGING_SENDER_ID) || "807189818533",
  appId: (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_FIREBASE_APP_ID) || "1:807189818533:web:2ab29ad49be78f9824b14c",
  measurementId: (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_FIREBASE_MEASUREMENT_ID) || "G-P29J9QMYK6"
};

export const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();

// Suppress benign connection retry logs and offline warnings
try {
  setLogLevel('silent');
} catch {
  // Ignore in environments where setLogLevel is not permitted
}

let firestoreInstance;
try {
  firestoreInstance = initializeFirestore(app, {
    localCache: persistentLocalCache({
      tabManager: persistentMultipleTabManager()
    }),
    experimentalForceLongPolling: true
  });
} catch {
  // If Firestore is already initialized or persistence fails in iframe/sandbox
  try {
    firestoreInstance = initializeFirestore(app, {
      experimentalForceLongPolling: true
    });
  } catch {
    firestoreInstance = getFirestore(app);
  }
}

export const db = firestoreInstance;


