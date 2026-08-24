# Google OAuth + Gmail Setup Guide

## Part 1: Google OAuth (Sign in with Google)

### Step 1: Create Google Cloud Project

1. Go to https://console.cloud.google.com
2. Click **Select a project** → **New Project**
3. Name: `capital-os`
4. Click **Create**

### Step 2: Enable Google OAuth API

1. In your new project, go to **APIs & Services** → **Library**
2. Search for "Google+ API" or "People API"
3. Click **Enable**

### Step 3: Configure OAuth Consent Screen

1. Go to **APIs & Services** → **OAuth consent screen**
2. Select **External** (for public use)
3. Fill in:
   - App name: `Capital OS`
   - User support email: your email
   - Developer contact: your email
4. Click **Save and Continue**
5. Add scopes: `email`, `profile`, `openid`
6. Click **Save and Continue**
7. Add test users (your email) if in testing mode

### Step 4: Create OAuth Credentials

1. Go to **APIs & Services** → **Credentials**
2. Click **Create Credentials** → **OAuth client ID**
3. Application type: **Web application**
4. Name: `Capital OS Web`
5. Authorized redirect URIs:
   ```
   https://wdvhraurmpvncrgnmmbf.supabase.co/auth/v1/callback
   ```
6. Click **Create**
7. **Copy the Client ID and Client Secret**

### Step 5: Add to Supabase

1. Go to https://supabase.com/dashboard
2. Select your project
3. Go to **Authentication** → **Providers**
4. Find **Google** and click **Enable**
5. Paste:
   - **Client ID** (from Google Cloud)
   - **Client Secret** (from Google Cloud)
6. Click **Save**

---

## Part 2: Gmail API (Send Emails)

### Step 1: Enable Gmail API

1. Go to https://console.cloud.google.com
2. Select your `capital-os` project
3. Go to **APIs & Services** → **Library**
4. Search for "Gmail API"
5. Click **Enable**

### Step 2: Create Service Account (for sending)

1. Go to **APIs & Services** → **Credentials**
2. Click **Create Credentials** → **Service account**
3. Name: `capital-os-email`
4. Click **Create and Continue**
5. Role: **Editor** (or custom with Gmail send permission)
6. Click **Done**

### Step 3: Create Service Account Key

1. Click on the service account you just created
2. Go to **Keys** tab
3. Click **Add Key** → **Create new key**
4. Select **JSON**
5. Click **Create**
6. **Save the JSON file securely**

### Step 4: Set Up Gmail Delegation (for sending as your email)

1. Go to https://myaccount.google.com
2. Go to **Security** → **Check for unsafe access** (or search "less secure apps")
3. Actually, better approach: Use **Gmail API with OAuth2** for sending

### Alternative: Use Gmail SMTP (Simpler)

1. Go to https://myaccount.google.com
2. Go to **Security** → **2-Step Verification** (enable if not already)
3. Go to **Security** → **App passwords**
4. Generate an app password for "Mail"
5. Copy the 16-character password

Then in your app:
```
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-16-char-app-password
```

---

## Environment Variables to Add

```bash
# Google OAuth
GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-client-secret

# Gmail SMTP (for sending emails)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-16-char-app-password
EMAIL_FROM=your-email@gmail.com
```

---

## Testing

1. Restart your dev server
2. Go to http://localhost:3456/login
3. Click "Sign in with Google"
4. Complete Google consent
5. You should be redirected back to dashboard

For email sending:
1. Go to dashboard
2. Create a campaign
3. Send a test email
4. Check inbox for the email
