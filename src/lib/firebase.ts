import { initializeApp, getApps, getApp } from "firebase/app";
import { getFirestore, enableIndexedDbPersistence } from "firebase/firestore";

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
export const db = getFirestore(app);

// Enable offline IndexedDb persistence where supported in browser / webview
if (typeof window !== "undefined") {
  try {
    enableIndexedDbPersistence(db).catch((err) => {
      if (err.code === "failed-precondition") {
        // Multiple tabs open, persistence can only be enabled in one tab at a time.
        console.info("Firestore persistence limited: multiple tabs open");
      } else if (err.code === "unimplemented") {
        // The current browser does not support all of the features required to enable persistence
        console.info("Firestore persistence not supported in this browser environment");
      }
    });
  } catch (e) {
    // Ignore persistence initialization error in non-browser or sandbox environments
  }
}
