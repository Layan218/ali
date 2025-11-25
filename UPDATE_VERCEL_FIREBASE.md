# Update Firebase Environment Variables in Vercel

## Quick Steps to Fix Firebase API Key Error

### Step 1: Get Your Firebase Credentials

1. Go to **Firebase Console**: https://console.firebase.google.com/
2. Select your Firebase project
3. Click the **gear icon** (⚙️) → **Project settings**
4. Scroll down to **"Your apps"** section
5. Click on the **Web app** icon (</>)
6. You'll see a `firebaseConfig` object like this:

```javascript
const firebaseConfig = {
  apiKey: "AIzaSy...",
  authDomain: "your-project.firebaseapp.com",
  projectId: "your-project-id",
  storageBucket: "your-project.appspot.com",
  messagingSenderId: "123456789012",
  appId: "1:123456789012:web:abcdef123456"
};
```

### Step 2: Update Vercel Environment Variables

1. Go to **Vercel Dashboard**: https://vercel.com/dashboard
2. Sign in with your GitHub account
3. Find your project (**"ali"** or **"appttt"**)
4. Click on the project
5. Go to **Settings** → **Environment Variables**
6. For each Firebase variable, click **Edit** or **Add**:

   - **NEXT_PUBLIC_FIREBASE_API_KEY**
     - Value: Copy from Firebase Console `apiKey`
     - Example: `AIzaSy...`
   
   - **NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN**
     - Value: Copy from Firebase Console `authDomain`
     - Example: `your-project.firebaseapp.com`
   
   - **NEXT_PUBLIC_FIREBASE_PROJECT_ID**
     - Value: Copy from Firebase Console `projectId`
     - Example: `your-project-id`
   
   - **NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET**
     - Value: Copy from Firebase Console `storageBucket`
     - Example: `your-project.appspot.com`
   
   - **NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID**
     - Value: Copy from Firebase Console `messagingSenderId`
     - Example: `123456789012`
   
   - **NEXT_PUBLIC_FIREBASE_APP_ID**
     - Value: Copy from Firebase Console `appId`
     - Example: `1:123456789012:web:abcdef123456`

7. Make sure to select **All Environments** (Production, Preview, Development)
8. Click **Save** for each variable

### Step 3: Redeploy

After updating all environment variables:

1. Go to **Deployments** tab in Vercel
2. Click **Redeploy** on the latest deployment
3. Or push a new commit to trigger automatic deployment

### Step 4: Verify

After redeployment, check:
- The login page should work without `auth/api-key-not-valid` error
- Firebase Auth should initialize correctly
- Check browser console for Firebase initialization success message

## Important Notes

- **Environment variables take effect after redeployment**
- Make sure all 6 variables are set correctly
- Values must match **exactly** what's in Firebase Console
- No extra spaces or quotes around values
- All variables must start with `NEXT_PUBLIC_` to be available in the browser

## Troubleshooting

If you still get errors after updating:

1. **Verify values match exactly** - Copy/paste directly from Firebase Console
2. **Check for typos** - Especially in API key (should start with `AIza`)
3. **Redeploy** - Environment variables only apply to new deployments
4. **Clear browser cache** - Hard refresh (Ctrl+Shift+R or Cmd+Shift+R)
5. **Check Vercel logs** - Go to Deployments → Click deployment → View Function Logs

## Alternative: Update .env.local for Local Development

For local development, also update `.env.local`:

```env
NEXT_PUBLIC_FIREBASE_API_KEY=AIzaSy...your-actual-key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your-project-id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=123456789012
NEXT_PUBLIC_FIREBASE_APP_ID=1:123456789012:web:abcdef123456
```

Then restart your dev server: `npm run dev`

