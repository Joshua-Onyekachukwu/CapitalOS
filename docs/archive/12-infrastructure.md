# Capital OS — Infrastructure & Deployment

## Technology Stack

| Component | Technology | Purpose |
|-----------|-----------|---------|
| **Framework** | Next.js 14 (App Router) | React SSR/RSC, API routes |
| **Language** | TypeScript | Full-stack type safety |
| **Styling** | Tailwind CSS | Utility-first CSS |
| **Icons** | Remix Icon | Icon library |
| **Database** | Supabase (PostgreSQL 15+) | Data storage, auth, RLS |
| **Auth** | Supabase Auth | Email/password sessions |
| **AI** | NVIDIA NIM API | LLM inference |
| **AI Model** | Llama 3.3 Nemotron Super 49B | All AI tasks |
| **Email** | Gmail API + Microsoft Graph | OAuth email sending |
| **Hosting** | Vercel | Frontend + API deployment |
| **Storage** | Supabase Storage | File uploads |
| **Repo** | GitHub | Source control |
| **Package Manager** | npm | Dependencies |
| **Testing** | Vitest | Unit tests |

## Deployment

### Vercel (Frontend + API)

- **Production:** Auto-deploys from `main` branch on GitHub
- **Preview:** Auto-deploys from PRs
- **Build command:** `npm run build`
- **Framework:** Next.js (auto-detected)

### Supabase (Database + Auth)

- **Project:** Supabase cloud hosted
- **Migrations:** Run via SQL Editor (manual)
- **RLS:** Enabled on all tables
- **Auth:** Email/password enabled

### GitHub (Source Control)

- **Repository:** `github.com:Joshua-Onyekachukwu/CapitalOS.git`
- **Branch:** `main` (production)
- **Commits:** Conventional commits with Codebuff footer

## Environment Configuration

### Development

```bash
# Copy .env.example to .env.local
cp .env.example .env.local

# Fill in Supabase credentials
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# NVIDIA AI keys (5 keys for rotation)
NVIDIA_API_KEY_1=nvapi-...
NVIDIA_API_KEY_2=nvapi-...
NVIDIA_API_KEY_3=nvapi-...
NVIDIA_API_KEY_4=nvapi-...
NVIDIA_API_KEY_5=nvapi-...

# Optional: Apollo, Google OAuth, Microsoft OAuth
APOLLO_API_KEY=...
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
MICROSOFT_CLIENT_ID=...
MICROSOFT_CLIENT_SECRET=...
EMAIL_TOKEN_ENCRYPTION_KEY=...
```

### Production (Vercel)

Same variables set via Vercel Environment Variables panel.

## Build & Development

```bash
# Install dependencies
npm install

# Development server
npm run dev

# Type check
npx tsc --noEmit

# Build
npm run build

# Start production server
npm start
```

## Database Migrations

Migrations are stored in `supabase/migrations/` and applied via Supabase SQL Editor.

| Migration | File | Status |
|-----------|------|--------|
| 001 | `001_profiles_and_triggers.sql` | ✅ Applied |
| 002 | `002_investor_intelligence.sql` | ✅ Applied |
| 003 | `003_intelligence_pipeline.sql` | ✅ Applied |
| 004 | `004_company_intelligence_billing.sql` | ⏳ Ready to apply |

## Monitoring

| Area | Current | Planned |
|------|---------|---------|
| Error tracking | Console logs | Sentry |
| Performance | Vercel Analytics | — |
| Uptime | Vercel monitoring | — |
| Database | Supabase dashboard | — |
| AI usage | Credit ledger queries | Dashboard |

## Backups

- **Supabase:** Automatic daily backups (cloud plan)
- **GitHub:** Source code versioned in Git
- **Data:** Manual export via Supabase dashboard

---

*Last updated: August 22, 2026*
