# Update Vercel Environment Variables - Quick Guide

## Step-by-Step Instructions

### 1. Go to Vercel Dashboard
- Open: https://vercel.com/dashboard
- Sign in with your GitHub account
- Find your project (**"ali"** or **"appttt"**)
- Click on the project

### 2. Navigate to Environment Variables
- Click **Settings** (in the top navigation)
- Click **Environment Variables** (in the left sidebar)

### 3. Add/Update Each Variable

For each of the 6 variables below, either:
- **If it exists**: Click the **Edit** button (pencil icon) → Update the value → Save
- **If it doesn't exist**: Click **Add New** → Enter the variable name and value → Save

**Important**: Select **"All Environments"** (Production, Preview, Development) for each variable.

---

## Copy-Paste These Exact Values

### Variable 1:
**Name:** `NEXT_PUBLIC_FIREBASE_API_KEY`  
**Value:** `AIzaSyDPzRqV-_hGNedZoeGNtorLTGWTBMmqdkc`

### Variable 2:
**Name:** `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`  
**Value:** `prj-adc-gcp-coop-test.firebaseapp.com`

### Variable 3:
**Name:** `NEXT_PUBLIC_FIREBASE_PROJECT_ID`  
**Value:** `prj-adc-gcp-coop-test`

### Variable 4:
**Name:** `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET`  
**Value:** `prj-adc-gcp-coop-test.firebasestorage.app`

### Variable 5:
**Name:** `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID`  
**Value:** `472242813268`

### Variable 6:
**Name:** `NEXT_PUBLIC_FIREBASE_APP_ID`  
**Value:** `1:472242813268:web:a4777a8929637bfcd4f0c1`

---

## After Adding All Variables

1. Go to **Deployments** tab
2. Find the latest deployment
3. Click the **three dots** (⋯) menu → **Redeploy**
4. Confirm the redeployment
5. Wait for deployment to complete (usually 1-2 minutes)

## Verify It Worked

After redeployment:
- Open your deployed app
- Try to access the login page
- Firebase should initialize without errors
- Email/password login should work

---

## Quick Copy-Paste Format (for bulk update)

If Vercel supports bulk import, use this format:

```
NEXT_PUBLIC_FIREBASE_API_KEY=AIzaSyDPzRqV-_hGNedZoeGNtorLTGWTBMmqdkc
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=prj-adc-gcp-coop-test.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=prj-adc-gcp-coop-test
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=prj-adc-gcp-coop-test.firebasestorage.app
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=472242813268
NEXT_PUBLIC_FIREBASE_APP_ID=1:472242813268:web:a4777a8929637bfcd4f0c1
```

---

**Note**: These are the same values that are working in your local `.env.local` file.

