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

// Debug: Log environment variable status (always log to help diagnose)
if (typeof window === "undefined") {
  console.log("🔍 Firebase Environment Variables Check (Server-side):");
  console.log("  NEXT_PUBLIC_FIREBASE_API_KEY:", apiKey ? `${apiKey.substring(0, 15)}... (${apiKey.length} chars)` : "❌ MISSING or undefined");
  console.log("  NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN:", authDomain || "❌ MISSING or undefined");
  console.log("  NEXT_PUBLIC_FIREBASE_PROJECT_ID:", projectId || "❌ MISSING or undefined");
  console.log("  NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET:", storageBucket || "❌ MISSING or undefined");
  console.log("  NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID:", messagingSenderId || "❌ MISSING or undefined");
  console.log("  NEXT_PUBLIC_FIREBASE_APP_ID:", appId || "❌ MISSING or undefined");
  console.log("  NODE_ENV:", process.env.NODE_ENV);
  console.log("  All vars loaded:", !!(apiKey && authDomain && projectId && storageBucket && messagingSenderId && appId));
}

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

// Validate that all required environment variables are present and not empty
const isEmpty = (value: string | undefined): boolean => {
  if (!value) return true;
  const trimmed = value.trim();
  return trimmed === "" || trimmed.length < 3;
};

const missing = [];
if (isEmpty(apiKey)) missing.push("NEXT_PUBLIC_FIREBASE_API_KEY");
if (isEmpty(authDomain)) missing.push("NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN");
if (isEmpty(projectId)) missing.push("NEXT_PUBLIC_FIREBASE_PROJECT_ID");
if (isEmpty(storageBucket)) missing.push("NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET");
if (isEmpty(messagingSenderId)) missing.push("NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID");
if (isEmpty(appId)) missing.push("NEXT_PUBLIC_FIREBASE_APP_ID");

// Enhanced debug logging to see what's actually loaded
if (typeof window === "undefined" && process.env.NODE_ENV === "development") {
  console.log("🔍 Firebase Environment Variable Validation:");
  console.log("  API Key present:", !!apiKey, apiKey ? `(${apiKey.length} chars)` : "(empty)");
  console.log("  Auth Domain present:", !!authDomain, authDomain ? `(${authDomain})` : "(empty)");
  console.log("  Project ID present:", !!projectId, projectId ? `(${projectId})` : "(empty)");
  console.log("  Missing vars:", missing.length > 0 ? missing.join(", ") : "none");
}

const hasAllRequiredVars = missing.length === 0;

if (!hasAllRequiredVars) {
  // Only log warning, don't error - allow app to continue
  const warningMsg = `⚠️ Firebase not configured: Missing environment variables: ${missing.join(", ")}\n` +
    `Add credentials to .env.local (see FIREBASE_SETUP.md)`;
  
  if (typeof window === "undefined") {
    // Server-side: only warn, never throw
    console.warn(warningMsg);
  } else {
    // Client-side: only warn, never error
    console.warn(warningMsg);
  }
}

// Initialize Firebase using ONLY environment variables
// Only create config if we have all required values
const firebaseConfig = hasAllRequiredVars ? {
  apiKey: apiKey!,
  authDomain: authDomain!,
  projectId: projectId!,
  storageBucket: storageBucket!,
  messagingSenderId: messagingSenderId!,
  appId: appId!,
} : null;

// Validate Firebase credential formats before initialization
const validateFirebaseConfig = (config: typeof firebaseConfig): string[] => {
  const errors: string[] = [];
  
  if (!config) {
    errors.push("Firebase config is null");
    return errors;
  }
  
  // Validate API Key format (should start with AIza and be ~39 chars)
  if (!config.apiKey || !config.apiKey.startsWith("AIza") || config.apiKey.length < 35) {
    errors.push(`Invalid API Key format. Should start with "AIza" and be ~39 characters. Current: ${config.apiKey ? `${config.apiKey.substring(0, 10)}...` : "empty"}`);
  }
  
  // Validate authDomain format (should end with .firebaseapp.com)
  if (!config.authDomain || !config.authDomain.endsWith(".firebaseapp.com")) {
    errors.push(`Invalid authDomain format. Should end with ".firebaseapp.com". Current: ${config.authDomain || "empty"}`);
  }
  
  // Validate projectId (should not be empty and match authDomain)
  if (!config.projectId || config.projectId.length < 3) {
    errors.push(`Invalid projectId. Should be at least 3 characters. Current: ${config.projectId || "empty"}`);
  }
  
  // Validate storageBucket (should end with .appspot.com or .firebasestorage.app)
  if (!config.storageBucket || (!config.storageBucket.endsWith(".appspot.com") && !config.storageBucket.endsWith(".firebasestorage.app"))) {
    errors.push(`Invalid storageBucket format. Should end with ".appspot.com" or ".firebasestorage.app". Current: ${config.storageBucket || "empty"}`);
  }
  
  // Validate messagingSenderId (should be numeric)
  if (!config.messagingSenderId || !/^\d+$/.test(config.messagingSenderId)) {
    errors.push(`Invalid messagingSenderId. Should be numeric. Current: ${config.messagingSenderId || "empty"}`);
  }
  
  // Validate appId (should match pattern: 1:numbers:web:letters)
  if (!config.appId || !/^1:\d+:web:[a-zA-Z0-9]+$/.test(config.appId)) {
    errors.push(`Invalid appId format. Should match pattern "1:numbers:web:letters". Current: ${config.appId || "empty"}`);
  }
  
  return errors;
};

// Only initialize Firebase if we have all required environment variables
let app: ReturnType<typeof initializeApp> | null = null;
let authInstance: ReturnType<typeof getAuth> | null = null;
let dbInstance: ReturnType<typeof getFirestore> | null = null;
let storageInstance: ReturnType<typeof getStorage> | null = null;

if (firebaseConfig && hasAllRequiredVars) {
  // Validate credential formats before attempting initialization
  const validationErrors = validateFirebaseConfig(firebaseConfig);
  
  if (validationErrors.length > 0) {
    console.error("❌ Firebase Configuration Validation Failed:");
    validationErrors.forEach(error => console.error(`   - ${error}`));
    console.error("\n📝 Please verify your Firebase credentials match exactly what's shown in:");
    console.error("   Firebase Console → Project Settings → Your apps → Web app");
    console.error("   Or Vercel Dashboard → Settings → Environment Variables");
  } else {
    try {
      app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
      authInstance = getAuth(app);
      dbInstance = getFirestore(app);
      storageInstance = getStorage(app);
      
      // Verify that auth was actually initialized (not null)
      // Check if auth instance exists and has required properties
      if (!authInstance) {
        throw new Error("Firebase Auth returned null. Credentials may be invalid or project settings don't match.");
      }
      
      // CRITICAL: Verify auth.app exists - this is the root cause of "null is not an object (evaluating 'auth.app')"
      if (!authInstance.app) {
        const errorDetails = 
          `Firebase Auth.app is null. This means your credentials don't match any valid Firebase project.\n\n` +
          `Current credentials:\n` +
          `  API Key: ${apiKey ? `${apiKey.substring(0, 15)}...` : "empty"}\n` +
          `  Auth Domain: ${authDomain || "empty"}\n` +
          `  Project ID: ${projectId || "empty"}\n` +
          `  Storage Bucket: ${storageBucket || "empty"}\n` +
          `  Sender ID: ${messagingSenderId || "empty"}\n` +
          `  App ID: ${appId || "empty"}\n\n` +
          `Please verify ALL values match EXACTLY what's shown in:\n` +
          `Firebase Console → Project Settings → Your apps → Web app\n\n` +
          `Common issues:\n` +
          `- Credentials are from a different Firebase project\n` +
          `- API Key doesn't match the project\n` +
          `- Project ID is incorrect\n` +
          `- Values have extra spaces or quotes`;
        throw new Error(errorDetails);
      }
      
      // Verify the app matches
      if (authInstance.app !== app) {
        throw new Error("Firebase Auth app mismatch - initialization error");
      }
      
      console.log("✅ Firebase initialized successfully");
      console.log(`   Project: ${firebaseConfig.projectId}`);
      console.log(`   Auth Domain: ${firebaseConfig.authDomain}`);
    } catch (error) {
      console.error("❌ Failed to initialize Firebase:", error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      if (errorMessage.includes("invalid-api-key") || errorMessage.includes("auth/invalid-api-key")) {
        console.error("\n❌ Firebase API key is invalid.");
        console.error("   Please verify NEXT_PUBLIC_FIREBASE_API_KEY in .env.local matches Firebase Console.");
        console.error(`   Current value: ${apiKey ? `${apiKey.substring(0, 15)}...` : "empty"}`);
      } else if (errorMessage.includes("null") || errorMessage.includes("returned null") || errorMessage.includes("app property is missing")) {
        console.error("\n❌ Firebase Auth returned null - credentials are invalid or don't match.");
        console.error("   This means the credentials exist but don't match a valid Firebase project.");
        console.error("   Please verify ALL Firebase credentials match EXACTLY what's in Firebase Console:");
        console.error(`   • API Key: ${apiKey ? `${apiKey.substring(0, 15)}...` : "empty"} (should start with AIza)`);
        console.error(`   • Auth Domain: ${authDomain || "empty"} (should end with .firebaseapp.com)`);
        console.error(`   • Project ID: ${projectId || "empty"}`);
        console.error(`   • Storage Bucket: ${storageBucket || "empty"} (should end with .appspot.com)`);
        console.error(`   • Messaging Sender ID: ${messagingSenderId || "empty"} (should be numeric)`);
        console.error(`   • App ID: ${appId || "empty"} (should match pattern 1:numbers:web:letters)`);
      } else {
        console.error("\n❌ Firebase initialization error:", errorMessage);
        console.error("   Please verify all Firebase credentials in .env.local are correct.");
      }
      
      // Reset instances to null on error
      authInstance = null;
      dbInstance = null;
      storageInstance = null;
    }
  }
} else {
  console.warn("⚠️ Firebase not initialized: Missing required environment variables");
}

// Export Firebase instances with runtime validation
// This prevents reCAPTCHA and other internal method errors
// Only export if properly initialized, otherwise throw helpful error
const requireAuth = () => {
  if (!authInstance) {
    throw new Error(
      "Firebase Auth is not initialized. Please add valid Firebase credentials to .env.local (see FIREBASE_SETUP.md). " +
      "The app needs valid Firebase configuration to enable authentication."
    );
  }
  
  // CRITICAL: Check if auth.app exists - this prevents "null is not an object (evaluating 'auth.app')" errors
  if (!authInstance.app) {
    const errorMsg = 
      "Firebase Auth.app is null. This means your credentials don't match any valid Firebase project.\n\n" +
      "This error occurs when:\n" +
      "1. API Key doesn't match the Firebase project\n" +
      "2. Project ID is incorrect\n" +
      "3. Auth Domain doesn't match\n" +
      "4. Credentials are from a different Firebase project\n" +
      "5. One or more values have extra spaces or quotes\n\n" +
      "Please verify ALL Firebase environment variables match EXACTLY what's shown in:\n" +
      "Firebase Console → Project Settings → Your apps → Web app\n\n" +
      "Current values (first 15 chars of API key shown):\n" +
      `  API Key: ${apiKey ? `${apiKey.substring(0, 15)}...` : "empty"}\n` +
      `  Auth Domain: ${authDomain || "empty"}\n` +
      `  Project ID: ${projectId || "empty"}\n` +
      `  Storage Bucket: ${storageBucket || "empty"}\n` +
      `  Sender ID: ${messagingSenderId || "empty"}\n` +
      `  App ID: ${appId || "empty"}\n\n` +
      "See FIREBASE_SETUP.md or UPDATE_VERCEL_FIREBASE.md for detailed instructions.";
    throw new Error(errorMsg);
  }
  
  // Additional check for app property existence
  if (!('app' in authInstance)) {
    const errorMsg = 
      "Firebase Auth instance is missing app property. This usually means:\n" +
      "1. Firebase credentials in .env.local don't match Firebase Console exactly\n" +
      "2. One or more environment variables are incorrect\n" +
      "3. Project settings in Firebase Console don't match the provided values\n\n" +
      "Please verify ALL Firebase environment variables match exactly what's shown in:\n" +
      "• Firebase Console → Project Settings → Your apps → Web app\n" +
      "• Or Vercel Dashboard → Settings → Environment Variables\n\n" +
      "See FIREBASE_SETUP.md for detailed instructions.";
    throw new Error(errorMsg);
  }
  
  return authInstance;
};

const requireDb = () => {
  if (!dbInstance) {
    throw new Error(
      "Firebase Firestore is not initialized. Please add valid Firebase credentials to .env.local (see FIREBASE_SETUP.md)."
    );
  }
  return dbInstance;
};

const requireStorage = () => {
  if (!storageInstance) {
    throw new Error(
      "Firebase Storage is not initialized. Please add valid Firebase credentials to .env.local (see FIREBASE_SETUP.md)."
    );
  }
  return storageInstance;
};

// Export getters that validate on access (prevents reCAPTCHA errors)
export const auth = new Proxy({} as ReturnType<typeof getAuth>, {
  get(_target, prop) {
    const auth = requireAuth();
    const value = (auth as any)[prop];
    if (typeof value === 'function') {
      return value.bind(auth);
    }
    return value;
  }
});

export const db = new Proxy({} as ReturnType<typeof getFirestore>, {
  get(_target, prop) {
    const db = requireDb();
    const value = (db as any)[prop];
    if (typeof value === 'function') {
      return value.bind(db);
    }
    return value;
  }
});

export const storage = new Proxy({} as ReturnType<typeof getStorage>, {
  get(_target, prop) {
    const storage = requireStorage();
    const value = (storage as any)[prop];
    if (typeof value === 'function') {
      return value.bind(storage);
    }
    return value;
  }
});

// Helper to check if Firebase is properly initialized
export const isFirebaseInitialized = (): boolean => {
  return !!(authInstance && authInstance.app && dbInstance && storageInstance);
};
