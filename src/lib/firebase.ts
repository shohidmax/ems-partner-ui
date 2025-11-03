'use client';
// Import the functions you need from the SDKs you need
import { initializeApp, getApp, getApps } from "firebase/app";
import { getAnalytics, isSupported } from "firebase/analytics";
import { getAuth } from "firebase/auth";

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyBwIwoj_CgR_lWhFDMlUqOFZFOFIzJu92Q",
  authDomain: "pran-pos.firebaseapp.com",
  projectId: "pran-pos",
  storageBucket: "pran-pos.firebasestorage.app",
  messagingSenderId: "232805801170",
  appId: "1:232805801170:web:b2c1c82d95695c00b2e10b",
  measurementId: "G-11MCYPX70E"
};

// Initialize Firebase
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
const auth = getAuth(app);
const analytics = isSupported().then(yes => yes ? getAnalytics(app) : null);

export { app, auth, analytics };
