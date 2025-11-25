import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

// Get Firebase environment variables
const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
const authDomain = process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN;
const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
const storageBucket = process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET;
const messagingSenderId = process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID;
const appId = process.env.NEXT_PUBLIC_FIREBASE_APP_ID;

// Validate Firebase environment variables
const missingVars: string[] = [];
const isPlaceholder = (value: string | undefined): boolean => {
  if (!value) return true;
  return value.includes("your-") || 
         value.includes("placeholder") || 
         value === "" ||
         value.length < 10;
};

if (!apiKey || isPlaceholder(apiKey)) {
  missingVars.push("NEXT_PUBLIC_FIREBASE_API_KEY");
}
if (!authDomain || isPlaceholder(authDomain)) {
  missingVars.push("NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN");
}
if (!projectId || isPlaceholder(projectId)) {
  missingVars.push("NEXT_PUBLIC_FIREBASE_PROJECT_ID");
}
if (!storageBucket || isPlaceholder(storageBucket)) {
  missingVars.push("NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET");
}
if (!messagingSenderId || isPlaceholder(messagingSenderId)) {
  missingVars.push("NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID");
}
if (!appId || isPlaceholder(appId)) {
  missingVars.push("NEXT_PUBLIC_FIREBASE_APP_ID");
}

// Check if we have valid credentials (not placeholders)
const hasValidCredentials = missingVars.length === 0;

if (!hasValidCredentials) {
  const errorMessage = 
    `⚠️ Firebase Configuration: Missing or invalid environment variables:\n` +
    `   ${missingVars.join(", ")}\n\n` +
    `📝 To fix this:\n` +
    `   1. Open your .env.local file in the project root\n` +
    `   2. Replace the placeholder values with your actual Firebase credentials\n` +
    `   3. Get credentials from: https://vercel.com/dashboard → Settings → Environment Variables\n` +
    `   4. Or from: https://console.firebase.google.com/ → Project Settings\n\n` +
    `📖 See FIREBASE_SETUP.md for detailed instructions.\n\n` +
    `💡 Note: Some features (like Auto-Presentation) require Firebase to work properly.`;
  
  // Only log warnings, don't throw errors to prevent build failures
  if (typeof window === "undefined") {
    // Server-side: warn but don't throw (allows build to continue)
    console.warn("⚠️ Firebase not configured:", errorMessage);
  } else {
    // Client-side: log warning (don't throw to prevent app crash)
    console.warn(errorMessage);
  }
}

// Initialize Firebase with available values (even if placeholders)
// This allows the app to run, but Firebase operations will fail gracefully
const firebaseConfig = {
  apiKey: apiKey || "dummy-key",
  authDomain: authDomain || "dummy.firebaseapp.com",
  projectId: projectId || "dummy-project",
  storageBucket: storageBucket || "dummy-project.appspot.com",
  messagingSenderId: messagingSenderId || "123456789",
  appId: appId || "1:123456789:web:dummy",
};

// Only initialize if we're not in a build context or if we have valid credentials
let app: ReturnType<typeof initializeApp>;
let authInstance: ReturnType<typeof getAuth>;
let dbInstance: ReturnType<typeof getFirestore>;
let storageInstance: ReturnType<typeof getStorage>;

try {
  app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
  authInstance = getAuth(app);
  dbInstance = getFirestore(app);
  storageInstance = getStorage(app);
} catch (error) {
  // If initialization fails, create dummy instances to prevent crashes
  console.error("Failed to initialize Firebase:", error);
  // Re-throw only in production with valid credentials expected
  if (process.env.NODE_ENV === "production" && hasValidCredentials) {
    throw error;
  }
  // In development or with invalid credentials, continue with dummy config
  app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
  authInstance = getAuth(app);
  dbInstance = getFirestore(app);
  storageInstance = getStorage(app);
}

export const auth = authInstance;
export const db = dbInstance;
export const storage = storageInstance;
