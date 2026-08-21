# Development Plan — Capital-OS

## Current State

### What Exists
- ✅ Next.js 16 + React 19 + Tailwind CSS 4 project
- ✅ Sales Landing template adapted (Hero, About, Features, Dashboard, Users, FAQ, CTA)
- ✅ Navbar, Footer, GoTop layout components
- ✅ Supabase client/server/middleware layer
- ✅ Auth middleware (route protection, redirects)
- ✅ All dependencies installed (Supabase, Zod, React Query, testing tools)
- ✅ Build compiles successfully

### What Needs Building
- Reusable UI component library
- Auth pages (login, signup, password reset)
- Dashboard layout (sidebar + content area)
- Dashboard pages (home, startup, investors, campaigns, outreach, analytics, settings)
- Database schema (SQL migrations — pending Supabase access)
- API/server actions (pending Supabase access)

---

## Phase 1 — Reusable UI Components

Build a component library that the entire app uses. These must be consistent, accessible, and follow the Sales Landing design system.

### 1.1 Button Component
- Variants: primary (lime), secondary (dark green), outline, ghost, danger
- Sizes: sm, md, lg
- States: default, hover, active, disabled, loading
- Icon support (left/right)
- Full width option

### 1.2 Input Component
- Text, email, password, textarea
- Label + helper text
- Error state with message
- Required indicator
- Disabled state
- Icon prefix/suffix

### 1.3 Card Component
- Variants: default, bordered, elevated
- Header, body, footer slots
- Consistent padding and border radius

### 1.4 Modal/Dialog Component
- Open/close controlled
- Title, description, content, actions
- Close on backdrop click
- Close on escape key
- Focus trap
- Accessible (aria attributes)

### 1.5 Badge Component
- Variants: primary, success, warning, danger, info
- Sizes: sm, md

### 1.6 Avatar Component
- Image, initials, icon
- Sizes: sm, md, lg
- Online/status indicator

### 1.7 Table Component
- Header, body, footer
- Sortable columns
- Pagination
- Empty state
- Loading skeleton

### 1.8 Skeleton/Loading Components
- Text skeleton
- Card skeleton
- Table skeleton
- Page skeleton

### 1.9 Alert Component
- Variants: info, success, warning, error
- Dismissible
- Icon

### 1.10 Tabs Component
- Tab list + tab panels
- Active state
- Keyboard navigation

### 1.11 Dropdown Component
- Trigger + menu items
- Icons on items
- Dividers
- Keyboard navigation

### 1.12 Tooltip Component
- Position: top, bottom, left, right
- Delay

---

## Phase 2 — Authentication Pages

### 2.1 Auth Layout
- Centered card layout
- Capital OS branding
- Consistent with landing page design

### 2.2 Login Page
- Email + password form
- "Remember me" checkbox
- "Forgot password?" link
- "Sign up" link
- Google OAuth button (placeholder)
- Error handling
- Loading state
- Form validation with Zod

### 2.3 Signup Page
- Full name + email + password + confirm password
- Terms acceptance checkbox
- "Log in" link
- Google OAuth button (placeholder)
- Error handling
- Loading state
- Form validation with Zod
- Password strength indicator

### 2.4 Password Reset
- Request reset: email form
- Reset password: new password + confirm
- Success confirmation

### 2.5 Auth Callback
- Handle OAuth callback
- Handle email confirmation
- Error handling

---

## Phase 3 — Dashboard

### 3.1 Dashboard Layout
- Sidebar navigation (collapsible on mobile)
- Top header with user menu
- Main content area
- Responsive behavior

### 3.2 Sidebar Navigation
- Logo/brand
- Nav items with icons:
  - Dashboard (home)
  - My Startup
  - Investors
  - Campaigns
  - Outreach
  - Analytics
  - Settings
- Active state
- Collapsible on mobile (hamburger)
- User info at bottom

### 3.3 Dashboard Home Page
- Welcome message with user name
- Startup status card
- Quick actions
- Recent activity
- Empty state (no startup yet)

### 3.4 Startup Profile Page
- Profile completeness indicator
- Edit form for all startup fields
- AI confidence indicators (placeholder)
- Document upload area

### 3.5 Investors Page
- Search bar
- Filter controls (stage, sector, geography)
- Investor table/cards
- Pagination
- Empty state

### 3.6 Campaigns Page
- Campaign list
- Create campaign button
- Campaign cards with stats
- Empty state

### 3.7 Outreach Page
- Email drafts tab
- Sent tab
- Replies tab
- Follow-ups tab

### 3.8 Analytics Page
- Fundraising metrics
- Placeholder charts

### 3.9 Settings Page
- Profile settings
- Account settings
- Notification preferences

---

## File Structure (After Implementation)

```
src/
├── app/
│   ├── (auth)/
│   │   ├── layout.tsx              — Auth layout
│   │   ├── login/page.tsx          — Login page
│   │   ├── signup/page.tsx         — Signup page
│   │   ├── forgot-password/page.tsx
│   │   ├── reset-password/page.tsx
│   │   └── auth/callback/page.tsx
│   ├── (dashboard)/
│   │   ├── layout.tsx              — Dashboard layout
│   │   ├── page.tsx                — Dashboard home
│   │   ├── startup/page.tsx
│   │   ├── investors/page.tsx
│   │   ├── campaigns/page.tsx
│   │   ├── outreach/page.tsx
│   │   ├── analytics/page.tsx
│   │   └── settings/page.tsx
│   ├── (marketing)/
│   │   ├── layout.tsx              — Landing layout
│   │   └── page.tsx                — Landing page
│   ├── layout.tsx                  — Root layout
│   ├── globals.css
│   ├── not-found.tsx
│   └── page.tsx                    — Redirect to / or landing
├── components/
│   ├── ui/                         — Reusable primitives
│   │   ├── Button.tsx
│   │   ├── Input.tsx
│   │   ├── Card.tsx
│   │   ├── Modal.tsx
│   │   ├── Badge.tsx
│   │   ├── Avatar.tsx
│   │   ├── Table.tsx
│   │   ├── Skeleton.tsx
│   │   ├── Alert.tsx
│   │   ├── Tabs.tsx
│   │   ├── Dropdown.tsx
│   │   └── Tooltip.tsx
│   ├── Layout/
│   │   ├── Navbar.tsx
│   │   ├── Footer.tsx
│   │   ├── GoTop.tsx
│   │   ├── Sidebar.tsx             — Dashboard sidebar
│   │   └── DashboardHeader.tsx     — Dashboard top bar
│   ├── Landing/                    — Landing page sections
│   │   └── ...existing files
│   ├── Auth/                       — Auth form components
│   │   ├── LoginForm.tsx
│   │   ├── SignupForm.tsx
│   │   └── AuthFormWrapper.tsx
│   └── Dashboard/                  — Dashboard components
│       ├── WelcomeCard.tsx
│       ├── StartupStatusCard.tsx
│       └── QuickActions.tsx
├── lib/
│   ├── supabase/
│   │   ├── client.ts
│   │   ├── server.ts
│   │   └── middleware.ts
│   ├── utils.ts
│   └── validators/
│       └── auth.ts                 — Zod schemas for auth
└── types/
    └── database.ts                 — Database types (generated later)
```

---

## Build Order

```
1. Create reusable UI components
2. Create auth layout
3. Build login page
4. Build signup page
5. Build password reset flow
6. Build auth callback
7. Create dashboard layout (sidebar + header)
8. Build dashboard home
9. Build startup profile page
10. Build investors page
11. Build campaigns page
12. Build remaining dashboard pages
13. Verify build
14. Test auth flow (manual)
```

---

## Dependencies Between Phases

```
Phase 1 (UI Components)
    ↓
Phase 2 (Auth Pages)  ← depends on UI components
    ↓
Phase 3 (Dashboard)   ← depends on Auth + UI components
```

---

## What Requires Supabase Access

- Database schema creation
- RLS policies
- Server actions for CRUD
- Real API authentication
- File storage

## What Can Be Built Without Supabase

- All UI components
- All page layouts
- All forms with client-side validation
- Auth pages (UI only, wired to Supabase client)
- Dashboard layout and pages
- Navigation and routing

**Strategy: Build everything as UI-first, wire to Supabase when access is available.**
