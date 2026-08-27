import { initializeApp, getApps, getApp } from "firebase/app";
import { 
  initializeFirestore, 
  getFirestore, 
  persistentLocalCache, 
  persistentMultipleTabManager 
} from "firebase/firestore";

export const firebaseConfig = {
  apiKey: "AIzaSyDbLHlj2yEDQVxm2LRJjY8OMpuBab-TxEk",
  authDomain: "ronpay-7fc69.firebaseapp.com",
  projectId: "ronpay-7fc69",
  storageBucket: "ronpay-7fc69.firebasestorage.app",
  messagingSenderId: "807189818533",
  appId: "1:807189818533:web:2ab29ad49be78f9824b14c",
  measurementId: "G-P29J9QMYK6"
};

export const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();

let firestoreInstance;
try {
  firestoreInstance = initializeFirestore(app, {
    localCache: persistentLocalCache({
      tabManager: persistentMultipleTabManager()
    })
  });
} catch {
  // If Firestore is already initialized or persistence fails in iframe/sandbox
  firestoreInstance = getFirestore(app);
}

export const db = firestoreInstance;

