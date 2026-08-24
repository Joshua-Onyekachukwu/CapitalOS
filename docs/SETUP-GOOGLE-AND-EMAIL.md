# Capital OS — Google OAuth & Gmail SMTP Setup

## Step 1: Enable Google OAuth in Supabase

1. Go to https://supabase.com/dashboard
2. Select your project (`capitalos`)
3. Go to **Authentication** → **Providers**
4. Find **Google** and click **Enable**
5. Paste these values from your `.env.local`:
   - **Client ID**: The `GOOGLE_CLIENT_ID` value
   - **Client Secret**: The `GOOGLE_CLIENT_SECRET` value
6. Click **Save**

## Step 2: Add Redirect URIs in Google Cloud Console

1. Go to https://console.cloud.google.com/apis/credentials
2. Click on your OAuth 2.0 Client ID (`324877566455...`)
3. Under **Authorized redirect URIs**, add BOTH of these:
   ```
   https://wdvhraurmpvncrgnmmbf.supabase.co/auth/v1/callback
   http://localhost:65134/auth/callback
   ```
4. Click **Save**

## Step 3: Configure OAuth Consent Screen

1. Go to https://console.cloud.google.com/apis/credentials/consent
2. Select **External** user type
3. Fill in:
   - **App name**: `Capital OS`
   - **User support email**: Your email
   - **Developer contact**: Your email
4. Add scopes: `email`, `profile`, `openid`
5. Add your email as a **test user**
6. Click **Save and Continue**

## Step 4: Fix Gmail SMTP

The app password needs to match your **actual Gmail address**, not `semek@capitalOS.io`.

### If you use Gmail (not Google Workspace):

1. Go to https://myaccount.google.com
2. Enable **2-Step Verification** (required)
3. Go to **Security** → **App passwords**
4. Generate password for "Mail" app
5. Copy the 16-character password

Then update `.env.local`:
```bash
SMTP_USER=your-actual-gmail@gmail.com
SMTP_PASS=your-16-char-app-password
EMAIL_FROM=your-actual-gmail@gmail.com
```

### If you use Google Workspace (semek@capitalOS.io):

1. Go to https://admin.google.com
2. Go to **Security** → **App passwords**
3. Generate password for "Mail" app
4. Copy the 16-character password

The SMTP_USER should be `semek@capitalOS.io` and the app password must be generated FROM that Google Workspace account.

## Step 5: Test

After setup, test with:
```bash
# Test Google OAuth
node -e "require('dotenv').config({path:'.env.local'}); console.log(process.env.GOOGLE_CLIENT_ID)"

# Test Gmail SMTP
node scripts/test-email.js
```
