# Capital OS — Frontend & Backend Architecture

## Frontend Architecture

### Application Structure

```
src/app/
├── (auth)/                    # Authentication pages
│   ├── auth/callback/         # OAuth callback handler
│   ├── forgot-password/       # Password reset request
│   ├── login/                 # Sign in
│   ├── reset-password/        # Password reset form
│   └── signup/                # Sign up
├── admin/                     # Admin dashboard
│   ├── data-sources/          # Import, scrape, Apollo
│   ├── investor-firms/        # Firm management
│   ├── investors/             # Investor management
│   ├── review/duplicates/     # Duplicate review queue
│   └── audit-logs/            # Audit log viewer
├── api/                       # API routes
│   ├── admin/                 # Admin APIs (import, scrape, qualify)
│   ├── auth/                  # OAuth routes (Google, Microsoft)
│   ├── copilot/               # AI copilot chat
│   ├── investors/             # Investor search + research
│   └── outreach/              # Email draft + send
├── dashboard/                 # Main application
│   ├── ai-activity/           # AI usage history
│   ├── analytics/             # Metrics dashboard (shell)
│   ├── campaigns/             # Campaign management
│   ├── copilot/               # AI copilot chat
│   ├── documents/             # Document management (shell)
│   ├── investors/             # Investor database + detail + discover
│   ├── meetings/              # Meeting scheduling (shell)
│   ├── outreach/              # Email outreach
│   ├── pipeline/              # Kanban pipeline view
│   ├── settings/              # User settings + email connection
│   └── startup/               # Company profile (shell)
├── onboarding/                # 7-step onboarding flow
├── page.tsx                   # Landing page
├── layout.tsx                 # Root layout
├── globals.css                # Global styles
└── not-found.tsx              # 404 page
```

### Components

```
src/components/
├── Dashboard/                 # Dashboard-specific components
│   ├── DashboardHeader.tsx
│   ├── DashboardShell.tsx
│   ├── DataHistory.tsx
│   ├── PageHeader.tsx
│   ├── PageLoader.tsx
│   ├── QualificationCard.tsx
│   └── Sidebar.tsx
├── Landing/                   # Landing page sections
│   ├── About.tsx
│   ├── Benefits.tsx
│   ├── FAQ.tsx
│   ├── Features.tsx
│   ├── HeroBanner.tsx
│   ├── Pricing.tsx
│   ├── Testimonials.tsx
│   ├── WhyCapitalOS.tsx
│   └── WorkingProcess.tsx
├── Layout/                    # Shared layout components
│   ├── Footer.tsx
│   ├── GoTop.tsx
│   └── Navbar.tsx
└── ui/                        # Reusable UI primitives
    ├── Alert.tsx
    ├── Avatar.tsx
    ├── Badge.tsx
    ├── Button.tsx
    ├── Card.tsx
    ├── EmptyState.tsx
    ├── Input.tsx
    ├── Modal.tsx
    ├── Skeleton.tsx
    ├── Table.tsx
    └── Tabs.tsx
```

### Navigation

| Route | Access | Description |
|-------|--------|-------------|
| `/` | Public | Landing page |
| `/login` | Public | Sign in |
| `/signup` | Public | Sign up |
| `/onboarding` | Authenticated | Company setup |
| `/dashboard` | Authenticated | Main dashboard |
| `/dashboard/investors` | Authenticated | Investor database |
| `/dashboard/investors/[id]` | Authenticated | Investor detail |
| `/dashboard/investors/discover` | Authenticated | AI investor discovery |
| `/dashboard/pipeline` | Authenticated | Kanban pipeline |
| `/dashboard/campaigns` | Authenticated | Campaign management |
| `/dashboard/outreach` | Authenticated | Email outreach |
| `/dashboard/copilot` | Authenticated | AI copilot |
| `/dashboard/settings` | Authenticated | Settings + email |
| `/admin/*` | Authenticated | Admin dashboard |

### Design System

The UI uses a consistent design system built on Tailwind CSS:

- **Colors:** Lime primary (#84cc16), Dark (#06201b), Gray scale
- **Typography:** System font stack
- **Spacing:** 4px base unit (multiples of 4)
- **Border radius:** 8px (small), 10px (medium), 12px (large)
- **Shadows:** Minimal, subtle elevation
- **Components:** Card, Button, Badge, Modal, Tabs, Alert, EmptyState

## Backend Architecture

### Server Actions

Server actions are defined in `src/lib/actions/` and called from both server components and API routes.

| Action File | Purpose |
|-------------|---------|
| `auth.ts` | Sign in, sign up, sign out, session |
| `company.ts` | Company profile CRUD, readiness score |
| `copilot.ts` | AI copilot chat with investor context |
| `campaigns.ts` | Campaign CRUD, pipeline stage updates |
| `dashboard.ts` | Dashboard stats, recent investors, pipeline |
| `data-history.ts` | Investor change history |
| `email.ts` | Email account management |
| `email-sequences.ts` | AI email sequence generation |
| `investor-research.ts` | AI investor research summaries |
| `matching.ts` | Investor-startup fit scoring |
| `search.ts` | Investor search with filters |
| `user.ts` | User profile management |

### API Routes

| Route | Method | Purpose |
|-------|--------|---------|
| `/api/copilot` | POST | AI copilot chat |
| `/api/investors` | GET | Search investors with filters |
| `/api/investors/[id]/research` | POST | Generate AI research |
| `/api/outreach/draft` | POST | AI email drafting |
| `/api/outreach/send` | POST | Send email via OAuth |
| `/api/admin/import` | POST | CSV bulk import |
| `/api/admin/import/apollo` | POST | Apollo bulk import |
| `/api/admin/scrape/edgar` | POST | SEC EDGAR scrape |
| `/api/admin/scrape/process` | POST | Process raw records |
| `/api/admin/qualify` | POST | Batch qualification |
| `/api/auth/google` | GET | Google OAuth initiation |
| `/api/auth/google/callback` | GET | Google OAuth callback |
| `/api/auth/microsoft` | GET | Microsoft OAuth initiation |
| `/api/auth/microsoft/callback` | GET | Microsoft OAuth callback |

### Client vs Server Boundary

| Code | Location | Can Import |
|------|----------|-----------|
| Server Components | `src/app/` (default) | Server actions, Supabase server client |
| Client Components | `"use client"` directive | API routes (via fetch), client Supabase |
| Server Actions | `"use server"` directive | Supabase server client, AI client |
| API Routes | `src/app/api/` | Server actions, AI client, Supabase service role |

**Rule:** Client components cannot import server-side modules (AI client, service role Supabase). They must call API routes instead.

---

*Last updated: August 22, 2026*
