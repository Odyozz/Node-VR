// src/lib/firebase.ts
import { initializeApp, getApps, getApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";

const firebaseConfig = {

  apiKey: "AIzaSyCF3hbNXdVaqEeU9Lp_9q6geLBs6l-OAio",
  authDomain: "node-battle.firebaseapp.com",
  projectId: "node-battle",
  storageBucket: "node-battle.firebasestorage.app",
  messagingSenderId: "316369913711",
  appId: "1:316369913711:web:74ddfdfd45100061c4ca9a",
  measurementId: "G-QHP6HDB84D"

};


const app = getApps().length ? getApp() : initializeApp(firebaseConfig);

export const db = getFirestore(app);
export const auth = getAuth(app);
