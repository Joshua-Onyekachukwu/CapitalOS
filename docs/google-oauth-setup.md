# Google OAuth Setup Guide — Capital OS

## Why Google Sign-In Shows an Error

The error "This app doesn't comply with Google's OAuth 2.0 policy" means the Google Cloud Console project doesn't have the correct redirect URIs registered.

## Step 1: Google Cloud Console

1. Go to [Google Cloud Console → Credentials](https://console.cloud.google.com/apis/credentials)
2. Click your **OAuth 2.0 Client ID**
3. Under **Authorized redirect URIs**, add ALL of these:
   ```
   http://localhost:3001/api/auth/google/callback
   https://capital-os-nine.vercel.app/api/auth/google/callback
   https://keepilpdaphpkofqgcae.supabase.co/auth/v1/callback
   ```
4. Under **Authorized JavaScript origins**, add:
   ```
   http://localhost:3001
   https://capital-os-nine.vercel.app
   ```
5. Click **Save**

## Step 2: Supabase Dashboard

1. Go to [Supabase Dashboard → Authentication → Providers → Google](https://supabase.com/dashboard/project/wdvhraurmpvncrgnmmbf/auth/providers)
2. **Enable** the Google provider
3. Enter your **Google Client ID** and **Google Client Secret** (from Google Cloud Console)
4. Set **Redirect URL** to: `https://capital-os-nine.vercel.app/auth/callback`

## Step 3: Vercel Environment Variables

Make sure these are set in Vercel project settings:

```
GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-client-secret
NEXT_PUBLIC_APP_URL=https://capital-os-nine.vercel.app
```

## Step 4: Test

1. Go to https://capital-os-nine.vercel.app/login
2. Click "Sign in with Google"
3. You should see Google consent screen
4. After approving, you should be redirected to the dashboard

## Two Separate OAuth Flows

The app has TWO Google OAuth flows:

### Flow 1: Sign In (Supabase Auth)
- User clicks "Sign in with Google" on login page
- Supabase handles the OAuth flow
- Redirect: `/auth/callback`
- Creates a Supabase session

### Flow 2: Connect Gmail (Direct Google OAuth)
- User goes to Settings → Email Accounts → Connect Gmail
- App redirects to Google for Gmail send/read permissions
- Redirect: `/api/auth/google/callback`
- Stores encrypted tokens in `email_accounts` table
- Both flows need redirect URIs registered in Google Cloud Console
