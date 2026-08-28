# Google OAuth Production Setup Guide

## Problem
Google sign-in may fail with: "You can't sign in to this app because it doesn't comply with Google's OAuth 2.0 policy."

This happens when the redirect URI is not registered in the Google Cloud Console.

## Current Configuration
- **Supabase Project:** `wdvhraurmpvncrgnmmbf`
- **Supabase URL:** `https://wdvhraurmpvncrgnmmbf.supabase.co`
- **Callback URL:** `https://wdvhraurmpvncrgnmmbf.supabase.co/auth/v1/callback`

## Step-by-Step Setup

### 1. Google Cloud Console

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Select or create a project
3. Navigate to **APIs & Services → Credentials**
4. Find your **OAuth 2.0 Client ID** (Web application type)
5. Under **Authorized redirect URIs**, add ALL of these:

```
https://wdvhraurmpvncrgnmmbf.supabase.co/auth/v1/callback
http://localhost:3000/auth/callback
http://localhost:3001/auth/callback
https://capital-os-nine.vercel.app/auth/callback
```

6. Under **Authorized JavaScript origins**, add:

```
https://wdvhraurmpvncrgnmmbf.supabase.co
http://localhost:3000
http://localhost:3001
https://capital-os-nine.vercel.app
```

7. Click **Save**

### 2. Supabase Dashboard

1. Go to [Supabase Dashboard](https://supabase.com/dashboard/project/wdvhraurmpvncrgnmmbf/auth/providers)
2. Navigate to **Authentication → Providers → Google**
3. Ensure **Enable Sign in with Google** is toggled ON
4. Enter your **Client ID** from Google Cloud Console
5. Enter your **Client Secret** from Google Cloud Console
6. Click **Save**

### 3. Vercel Environment Variables

Ensure these are set in your Vercel project settings:

```
NEXT_PUBLIC_SUPABASE_URL=https://wdvhraurmpvncrgnmmbf.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<your-anon-key>
SUPABASE_SERVICE_ROLE_KEY=<your-service-role-key>
NEXT_PUBLIC_APP_URL=https://capital-os-nine.vercel.app
```

### 4. Test the Flow

1. Go to `https://capital-os-nine.vercel.app/login`
2. Click "Sign in with Google"
3. You should be redirected to Google's consent screen
4. After approving, you should be redirected back to the dashboard

## Troubleshooting

### "redirect_uri_mismatch" Error
- The redirect URI in Google Cloud Console must exactly match the callback URL
- No trailing slashes
- Must use https in production

### "Access Blocked" Error
- The OAuth consent screen must be published (not in testing mode)
- Go to **APIs & Services → OAuth consent screen** and publish it

### Redirect Goes to Wrong Supabase Project
- Check that `NEXT_PUBLIC_SUPABASE_URL` is set to `https://wdvhraurmpvncrgnmmbf.supabase.co`
- Check that the Supabase project has Google provider enabled

### Session Not Persisting After Redirect
- Ensure cookies are not blocked by browser settings
- Check that `NEXT_PUBLIC_SUPABASE_ANON_KEY` matches the project
- Verify the middleware is not interfering with the callback route

## Security Notes
- Never expose `SUPABASE_SERVICE_ROLE_KEY` to the client
- The anon key is safe to expose (it's public by design)
- RLS policies protect data even if the anon key is exposed
- Always use HTTPS in production
