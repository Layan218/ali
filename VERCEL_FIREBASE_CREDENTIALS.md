# Firebase Credentials for Vercel

## Update These Environment Variables in Vercel

Go to: **Vercel Dashboard → Your Project → Settings → Environment Variables**

Add/Update these 6 variables with these **exact** values:

```
NEXT_PUBLIC_FIREBASE_API_KEY=AIzaSyDPzRqV-_hGNedZoeGNtorLTGWTBMmqdkc

NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=prj-adc-gcp-coop-test.firebaseapp.com

NEXT_PUBLIC_FIREBASE_PROJECT_ID=prj-adc-gcp-coop-test

NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=prj-adc-gcp-coop-test.firebasestorage.app

NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=472242813268

NEXT_PUBLIC_FIREBASE_APP_ID=1:472242813268:web:a4777a8929637bfcd4f0c1
```

## Important Notes

- Copy values **exactly** as shown (no extra spaces, quotes, or line breaks)
- Select **"All Environments"** when adding/updating
- **Redeploy** after updating (or push a new commit to trigger auto-deploy)

## After Updating

1. Go to **Deployments** tab
2. Click **Redeploy** on the latest deployment
3. Wait for deployment to complete
4. Test the login page - Firebase should initialize correctly

