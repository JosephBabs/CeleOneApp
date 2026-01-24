// src/configs/firebaseConfig.ts
import { initializeApp, getApps, getApp } from "firebase/app";
import { initializeAuth, getReactNativePersistence } from "firebase/auth";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";
// import { getAnalytics } from "firebase/analytics";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyBC3MTssV5lPRkkuf2Sct_UtGjWX1PfYzk",
  authDomain: "celeone-e5843.firebaseapp.com", 
  projectId: "celeone-e5843",
  storageBucket: "celeone-e5843.firebasestorage.app",
  messagingSenderId: "275960060318",
  appId: "1:275960060318:web:489485dc1e2be2c1eade8f",
  measurementId: "G-RC8WDYC6RB"
};

// Initialize Firebase

// --- Initialize app only once ---
const app = getApps().length ? getApp() : initializeApp(firebaseConfig);

// --- Initialize Auth with persistence ---
export const auth = initializeAuth(app, {
  persistence: getReactNativePersistence(AsyncStorage),
});

// --- Firestore instance ---
export const db = getFirestore(app);
export const storage = getStorage(app);