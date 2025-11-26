import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyDPzRqV-_hGNedZoeGNtorLTGWTBMmqdkc",
  authDomain: "prj-adc-gcp-coop-test.firebaseapp.com",
  projectId: "prj-adc-gcp-coop-test",
  storageBucket: "prj-adc-gcp-coop-test.firebasestorage.app",
  messagingSenderId: "472242813268",
  appId: "1:472242813268:web:a4777a8929637bfcd4f0c1",
  measurementId: "G-8BT623KMNR",
};

const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();

export const auth = getAuth(app);
export const db = getFirestore(app);
