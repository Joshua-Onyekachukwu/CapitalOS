# Deployment — Capital-OS

## Overview

Capital-OS deploys on Vercel (frontend + API) with Supabase (database + backend services). GitHub is the source of truth.

---

## Environments

| Environment | URL | Purpose | Database |
|-------------|-----|---------|----------|
| Local | `localhost:3000` | Development | Supabase local |
| Preview | `*.vercel.app` | PR previews | Supabase staging |
| Staging | `staging.capitalos.com` | Pre-production testing | Supabase staging |
| Production | `capitalos.com` | Live application | Supabase production |

---

## Local Development

### Prerequisites

- Node.js 20+
- pnpm
- Supabase CLI
- Git

### Setup

```bash
# Install dependencies
pnpm install

# Environment
cp .env.example .env.local
# Fill in credentials

# Start Supabase
supabase start

# Apply migrations
supabase db reset

# Start dev server
pnpm dev
```

### Local Supabase

| Service | URL |
|---------|-----|
| API | `http://localhost:54321` |
| Studio | `http://localhost:54323` |
| DB | `postgresql://postgres:postgres@localhost:54322/postgres` |

---

## Vercel Deployment

### Initial Setup

```bash
# Install Vercel CLI
npm i -g vercel

# Link project
vercel link

# Set environment variables
vercel env add NEXT_PUBLIC_SUPABASE_URL
vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY
vercel env add SUPABASE_SERVICE_ROLE_KEY
vercel env add NVIDIA_API_KEY
vercel env add NVIDIA_BASE_URL
```

### Environment Variables on Vercel

Set via Vercel dashboard or CLI:

```bash
# Production
vercel env add VARIABLE_NAME production

# Preview (staging)
vercel env add VARIABLE_NAME preview

# All environments
vercel env add VARIABLE_NAME
```

### Deploy Commands

```bash
# Deploy to preview (automatic on PR)
git push origin feature/my-feature

# Deploy to production
git push origin main

# Manual deploy
vercel --prod
```

### Vercel Configuration

```json
// vercel.json (if needed)
{
  "framework": "nextjs",
  "buildCommand": "pnpm build",
  "installCommand": "pnpm install"
}
```

### Build Settings

- **Framework Preset:** Next.js
- **Build Command:** `pnpm build`
- **Output Directory:** `.next`
- **Install Command:** `pnpm install`
- **Node.js Version:** 20.x

---

## Supabase Deployment

### Production Setup

1. Create project on [supabase.com](https://supabase.com)
2. Note the project URL and keys
3. Set environment variables in Vercel

### Applying Migrations

```bash
# Link to remote project
supabase link --project-ref YOUR_PROJECT_REF

# Push migrations
supabase db push

# Or apply specific migration
supabase migration up
```

### Database Backups

Supabase Pro plan includes:
- Daily automatic backups
- 7-day retention
- Point-in-time recovery

### Storage Buckets

Create via Supabase dashboard or CLI:

```bash
# Create storage bucket for documents
supabase storage create-docs-bucket

# Set bucket policy (private)
supabase storage update docs-bucket --public=false
```

---

## CI/CD Pipeline

### GitHub Actions

```yaml
# .github/workflows/ci.yml
name: CI

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main, develop]

jobs:
  checks:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: pnpm/action-setup@v2
        with:
          version: 9

      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: 'pnpm'

      - run: pnpm install --frozen-lockfile

      - name: Lint
        run: pnpm lint

      - name: Typecheck
        run: pnpm typecheck

      - name: Test
        run: pnpm test

      - name: Build
        run: pnpm build
        env:
          NEXT_PUBLIC_SUPABASE_URL: ${{ secrets.STAGING_SUPABASE_URL }}
          NEXT_PUBLIC_SUPABASE_ANON_KEY: ${{ secrets.STAGING_SUPABASE_ANON_KEY }}

  deploy-preview:
    needs: checks
    if: github.event_name == 'pull_request'
    runs-on: ubuntu-latest
    steps:
      - uses: amondnet/vercel-action@v25
        with:
          vercel-token: ${{ secrets.VERCEL_TOKEN }}
          vercel-org-id: ${{ secrets.VERCEL_ORG_ID }}
          vercel-project-id: ${{ secrets.VERCEL_PROJECT_ID }}

  deploy-production:
    needs: checks
    if: github.ref == 'refs/heads/main'
    runs-on: ubuntu-latest
    steps:
      - uses: amondnet/vercel-action@v25
        with:
          vercel-token: ${{ secrets.VERCEL_TOKEN }}
          vercel-org-id: ${{ secrets.VERCEL_ORG_ID }}
          vercel-project-id: ${{ secrets.VERCEL_PROJECT_ID }}
          vercel-args: '--prod'
```

---

## Post-Deployment Checklist

### Every Deploy

- [ ] Build succeeds
- [ ] No type errors
- [ ] No lint errors
- [ ] Tests pass

### Production Deploy

- [ ] Database migrations applied
- [ ] Environment variables set
- [ ] Sentry configured
- [ ] DNS configured (if custom domain)
- [ ] SSL certificate active
- [ ] Supabase RLS policies active
- [ ] Email provider configured
- [ ] NVIDIA API key valid

### Smoke Test

1. Visit landing page
2. Sign up / log in
3. Create a startup
4. Navigate dashboard
5. Check investor discovery
6. Verify real-time updates work

---

## Monitoring

### Sentry (Error Tracking)

```typescript
// sentry.client.config.ts
Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  tracesSampleRate: 0.1,
  environment: process.env.VERCEL_ENV,
});
```

### Better Stack (Uptime)

Monitor critical endpoints:
- `/api/health`
- `/api/startup`
- Landing page

### Vercel Analytics

Enable in Vercel dashboard for:
- Web Vitals
- Traffic
- Performance

### PostHog (Product Analytics)

```typescript
// lib/analytics.ts
if (typeof window !== 'undefined') {
  posthog.init(process.env.NEXT_PUBLIC_POSTHOG_KEY!, {
    api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST,
  });
}
```

---

## Rollback

### Vercel Rollback

```bash
# Rollback to previous deployment
vercel rollback

# Or promote a specific deployment
vercel promote <deployment-url>
```

### Database Rollback

```bash
# Apply rollback migration
supabase migration up --db-url $PRODUCTION_URL

# Or restore from backup (see DISASTER_RECOVERY.md)
```

---

## Environment Variable Management

### Naming Convention

| Prefix | Access | Example |
|--------|--------|---------|
| `NEXT_PUBLIC_` | Client + Server | `NEXT_PUBLIC_SUPABASE_URL` |
| (none) | Server only | `SUPABASE_SERVICE_ROLE_KEY` |

### Rotation

1. Generate new key
2. Update in Vercel dashboard
3. Redeploy
4. Verify working
5. Revoke old key

### Secrets Checklist

Never commit:
- [ ] API keys
- [ ] Service role keys
- [ ] OAuth secrets
- [ ] Database passwords
- [ ] Webhook secrets
