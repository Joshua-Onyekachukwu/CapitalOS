# Environment Setup — Capital-OS

## Prerequisites

### Required

| Tool | Version | Install |
|------|---------|---------|
| Node.js | 20+ | [Download](https://nodejs.org/) |
| pnpm | 9+ | `npm install -g pnpm` |
| Git | Latest | [Download](https://git-scm.com/) |
| Supabase CLI | Latest | `brew install supabase/tap/supabase` |

### Optional (but recommended)

| Tool | Purpose |
|------|---------|
| VS Code | IDE |
| Docker Desktop | Required by Supabase CLI |
| Postman/Insomnia | API testing |

---

## Quick Start

```bash
# 1. Clone repository
git clone https://github.com/Joshua-Onyekachukwu/CapitalOS.git
cd CapitalOS

# 2. Install dependencies
pnpm install

# 3. Set up environment variables
cp .env.example .env.local
# Edit .env.local with your credentials (see below)

# 4. Start Supabase (requires Docker)
supabase start

# 5. Apply database migrations
supabase db reset

# 6. Start development server
pnpm dev
```

Open [http://localhost:3456](http://localhost:3456).

---

## Environment Variables

### Required Variables

```env
# Supabase (local development)
NEXT_PUBLIC_SUPABASE_URL=http://localhost:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=<from supabase start output>
SUPABASE_SERVICE_ROLE_KEY=<from supabase start output>

# NVIDIA AI
NVIDIA_API_KEY=<your-nvidia-api-key>
NVIDIA_BASE_URL=https://integrate.api.nvidia.com/v1

# App
NEXT_PUBLIC_APP_URL=http://localhost:3456

# AI Mock Mode (set to true to skip NVIDIA API calls)
AI_MOCK_MODE=true
```

### Getting NVIDIA API Key

1. Go to [build.nvidia.com](https://build.nvidia.com/)
2. Create an account
3. Navigate to API keys
4. Generate a new API key
5. Copy to `.env.local`

### Supabase Keys (Local)

When you run `supabase start`, it outputs:

```
API URL: http://localhost:54321
ANON KEY: eyJhbGc...
SERVICE ROLE KEY: eyJhbGc...
```

Copy these to `.env.local`.

---

## Supabase Local Development

### Starting Supabase

```bash
# Start all services
supabase start

# Check status
supabase status

# View logs
supabase logs
```

### Services (Local)

| Service | Port | URL |
|---------|------|-----|
| API Gateway | 54321 | `http://localhost:54321` |
| Studio | 54323 | `http://localhost:54323` |
| PostgreSQL | 54322 | `localhost:54322` |
| Inbucket (email) | 54324 | `http://localhost:54324` |

### Database Management

```bash
# Reset database (applies all migrations)
supabase db reset

# Create new migration
supabase migration new <migration_name>

# Push migrations to remote
supabase db push --db-url <remote-db-url>

# Pull remote schema changes
supabase db diff --db-url <remote-db-url>
```

### Supabase Studio

Local dashboard at [http://localhost:54323](http://localhost:54323):
- Browse tables
- Run SQL queries
- Manage auth users
- View storage
- Check logs

---

## Development Commands

```bash
# Development
pnpm dev                    # Start dev server
pnpm build                  # Production build
pnpm start                  # Start production server

# Code Quality
pnpm lint                   # Run ESLint
pnpm lint:fix               # Fix lint issues
pnpm typecheck              # Run TypeScript check
pnpm format                 # Format with Prettier

# Testing
pnpm test                   # Run unit tests
pnpm test:watch             # Watch mode
pnpm test:coverage          # With coverage
pnpm test:e2e               # E2E tests

# Database
supabase start              # Start local Supabase
supabase stop               # Stop local Supabase
supabase db reset           # Reset database
supabase migration new <name>  # New migration

# Build & Deploy
pnpm build                  # Build for production
vercel                      # Deploy preview
vercel --prod               # Deploy production
```

---

## IDE Setup (VS Code)

### Recommended Extensions

- ESLint
- Prettier
- Tailwind CSS IntelliSense
- TypeScript Importer
- Supabase (by Supabase)
- GitLens

### VS Code Settings

```json
{
  "editor.formatOnSave": true,
  "editor.defaultFormatter": "esbenp.prettier-vscode",
  "editor.codeActionsOnSave": {
    "source.fixAll.eslint": true
  },
  "typescript.tsdk": "node_modules/typescript/lib"
}
```

---

## Troubleshooting

### Supabase won't start

```bash
# Stop and restart
supabase stop
supabase start

# If still failing, reset Docker
docker system prune -f
supabase start
```

### Database migrations fail

```bash
# Full reset
supabase db reset
```

### Environment variables not loading

- Ensure file is named `.env.local` (not `.env`)
- Restart dev server after changes
- Check `NEXT_PUBLIC_` prefix for client-side variables

### Port conflicts

```bash
# Check what's using the port
lsof -i :3000

# Kill the process
kill -9 <PID>

# Or use a different port
PORT=3001 pnpm dev
```

### pnpm install fails

```bash
# Clear cache
pnpm store prune
rm -rf node_modules
rm pnpm-lock.yaml
pnpm install
```

---

## Production Environment

### Vercel

```bash
# Install Vercel CLI
npm i -g vercel

# Login
vercel login

# Link project
vercel link

# Set environment variables
vercel env add NEXT_PUBLIC_SUPABASE_URL production
# ... repeat for all variables
```

### Supabase Production

1. Create project at [supabase.com](https://supabase.com)
2. Note project URL and keys
3. Set as Vercel environment variables
4. Apply migrations: `supabase db push`
5. Enable RLS on all tables

### DNS Configuration

For custom domain:

```
Type    Name    Value
A       @       76.76.21.21
CNAME   www     cname.vercel-dns.com
```

### SSL

Vercel provides automatic SSL certificates for custom domains.

---

## AI Mock Mode

When developing without NVIDIA API access:

```env
AI_MOCK_MODE=true
```

This returns pre-defined mock responses for:
- Text generation
- Embeddings (random vectors)
- Reranking (shuffled results)
- Classification (rule-based)

No NVIDIA API key required in mock mode.
