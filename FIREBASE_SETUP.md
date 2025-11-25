# Firebase Setup Guide

## How to Get Your Firebase Credentials

### Option 1: Check Vercel Dashboard (RECOMMENDED)
1. Go to https://vercel.com/dashboard
2. Sign in with your GitHub account
3. Find the project "ali" or "appttt"
4. Click on the project
5. Go to **Settings** → **Environment Variables**
6. Look for variables starting with `NEXT_PUBLIC_FIREBASE_`
7. Copy all the values

### Option 2: Firebase Console
1. Go to https://console.firebase.google.com/
2. Select your Firebase project (likely related to "Aramco Digital")
3. Click the **gear icon** → **Project settings**
4. Scroll down to **"Your apps"** section
5. Click on the **Web app** icon (</>)
6. You'll see a `firebaseConfig` object with all the values
7. Copy each value to your `.env.local` file

### Option 3: Ask Your Team
- Contact the person who set up the Firebase project
- They can either:
  - Share the credentials with you
  - Add you to the Firebase project so you can access them
  - Provide access to the Vercel project

## .env.local File Format

Once you have the credentials, create/update `.env.local` in the project root:

```bash
NEXT_PUBLIC_FIREBASE_API_KEY=your-api-key-here
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your-project-id.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your-project-id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your-project-id.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your-messaging-sender-id
NEXT_PUBLIC_FIREBASE_APP_ID=your-app-id
```

## After Setting Up

1. Save the `.env.local` file
2. Restart your dev server:
   ```bash
   # Stop current server (Ctrl+C)
   npm run dev
   ```
3. Open http://localhost:3000 in your browser

## Finding the Live Deployment URL

### Check Vercel Dashboard
1. Go to https://vercel.com/dashboard
2. Find your project
3. The deployment URL will be shown (e.g., `https://ali-xxxxx.vercel.app`)

### Check GitHub Repository
- If connected to Vercel, there may be a deployment badge
- Check the repository's "Environments" section

### Ask Your Team
- They should have the deployment URL documented

