# Implementation Plan — Capital-OS

## Trezo Template Analysis

### What We're Using From Trezo

**Design System (adapted):**
- Tailwind CSS 4 with custom `@theme` variables
- Inter font family
- Consistent spacing scale (`py-[70px] md:py-[90px] lg:py-[110px] xl:py-[130px] 2xl:py-[160px]`)
- Container system (`sm:max-w-[540px] md:max-w-[720px] lg:max-w-[960px] xl:max-w-[1308px]`)
- Dark mode support (class-based)
- RTL support foundation

**Color Palette (to adapt):**
- Primary: Indigo (#605dff) — keep, works for trust/intelligence
- Secondary: Blue (#3584fc)
- Success: Green (#37d80a)
- Gray scale for text/borders
- Full palette of semantic colors

**Component Patterns (to reuse/adapt):**
- Fixed floating navbar with scroll behavior
- Hero with badge + heading + subtext + CTAs
- Section pattern: badge → heading → description → content
- Stats/metrics pattern (FunFacts with animated counters)
- Checklist items pattern (green circles with checkmarks)
- Testimonial cards
- Pricing tier cards
- CTA section at bottom
- Footer with columns
- Go-to-top button
- Dark mode toggle

**Layout Patterns:**
- Page wrapper with proper padding
- Grid layouts (2-col, 3-col, 4-col)
- Responsive card grids
- Image + text side-by-side layouts

### What We're NOT Using From Trezo

- Partners carousel (we don't have partner logos yet)
- PricingPlans section (not applicable for V1)
- SidebarSettings panel (RTL toggle not needed)
- Trezo branding/content
- Free trial section (adapt to our CTA)
- Use cases grid (adapt to our target users)
- Dashboard section (will build our own)

---

## Landing Page Structure for Capital-OS

### Section Order

```
1. Hero Banner          — What we do + primary CTA
2. Problem Statement    — The founder's pain
3. How It Works         — 4-step flow
4. Key Features         — Core capabilities grid
5. AI Intelligence      — The AI layer showcase
6. Fundraising Pipeline — Kanban visual
7. Metrics/Trust        — Animated stats
8. Who It's For         — Target user cards
9. CTA Section          — Final push
10. Footer              — Links + copyright
```

### Section Details

#### 1. Hero Banner
- Badge: "AI-Powered Fundraising"
- Heading: "Your AI Fundraising Department" (primary color highlight)
- Subheading: Clear product promise
- Primary CTA: "Start Fundraising" → /signup
- Secondary CTA: "See How It Works" → scroll to How It Works
- No video modal (no demo video yet)
- No background image (clean design)

#### 2. Problem Statement
- Badge: "The Problem"
- Heading: "Fundraising Is Broken for Founders"
- 4 pain points with icons
- Empathetic tone, not salesy

#### 3. How It Works
- Badge: "How It Works"
- Heading: "From Pitch Deck to Funded"
- 4 steps with numbers/icons:
  1. Upload your pitch deck
  2. AI finds the right investors
  3. Personalized outreach
  4. Manage your pipeline

#### 4. Key Features
- Badge: "Features"
- Heading: "Everything You Need to Raise"
- 6 feature cards in 3x2 grid:
  - Investor Discovery
  - AI Matching & Scoring
  - Personalized Outreach
  - Fundraising Pipeline
  - Reply Intelligence
  - Meeting Management

#### 5. AI Intelligence
- Badge: "AI-Powered"
- Heading: "Intelligence, Not Just Data"
- Checklist of AI capabilities
- Dashboard preview image

#### 6. Fundraising Pipeline
- Badge: "Pipeline"
- Heading: "Manage Your Fundraising"
- Visual pipeline representation
- Key metrics

#### 7. Metrics/Trust
- Animated counters (adapted from FunFacts):
  - Investors researched
  - Emails personalized
  - Meetings booked
  - Founder satisfaction

#### 8. Who It's For
- Badge: "Built For Founders"
- Heading: "Whether You're Raising Pre-Seed or Series A"
- 3 target user cards

#### 9. CTA Section
- Heading: "Ready to Fundraise Smarter?"
- Subtext: Product promise
- Primary CTA: "Get Started Free"
- Trust signal: "No credit card required"

#### 10. Footer
- Logo + description
- Product links
- Company links
- Legal links
- Social links
- Copyright

---

## Design Adaptations

### Color Changes
- Primary stays indigo (#605dff) — works for trust/intelligence
- Add a subtle blue-green accent for growth/success
- Background: white (light) / near-black (dark)
- Section backgrounds: alternate white/very-light-gray

### Typography
- Keep Inter font
- Adjust heading sizes slightly for readability
- Ensure proper hierarchy

### Spacing
- Keep Trezo's responsive spacing scale
- Consistent section padding

### Buttons
- Primary: filled indigo, rounded-[7px]
- Secondary: outlined indigo, rounded-[7px]
- Hover: darken + transition

### Cards
- White background, border, rounded-[15px] to [25px]
- Subtle shadow on hover
- Consistent padding

---

## Phase 1: Frontend Implementation

### Step 1: Project Initialization
- Create Next.js 15 project
- Install dependencies: tailwindcss, swiper, remixicon
- Set up tsconfig, postcss, next.config
- Create globals.css with Trezo design tokens
- Create directory structure

### Step 2: Layout Components
- Navbar (adapted for Capital-OS)
- Footer (adapted for Capital-OS)
- GoTop
- Root layout

### Step 3: Landing Page Sections
- Hero Banner
- Problem Statement
- How It Works
- Key Features
- AI Intelligence
- Pipeline Preview
- Metrics
- Target Users
- CTA Section

### Step 4: Auth Page Structure
- Login page
- Signup page
- Auth layout

### Step 5: Dashboard Structure
- Dashboard layout (sidebar + content area)
- Placeholder pages

---

## Dependencies

```json
{
  "next": "15.3.2",
  "react": "^19.0.0",
  "react-dom": "^19.0.0",
  "swiper": "^11.0.0",
  "remixicon": "^4.0.0",
  "material-symbols": "^0.0.0",
  "tailwindcss": "^4.0.0",
  "@tailwindcss/postcss": "^4.0.0"
}
```

---

## File Structure (After Implementation)

```
app/
  layout.tsx              — Root layout (Navbar + Footer + GoTop)
  page.tsx                — Landing page
  globals.css             — Design system
  not-found.tsx           — 404 page
  (auth)/
    layout.tsx            — Auth layout (centered)
    login/page.tsx
    signup/page.tsx
  (dashboard)/
    layout.tsx            — Dashboard layout (sidebar)
    page.tsx              — Dashboard home
components/
  Layout/
    Navbar.tsx
    Footer.tsx
    GoTop.tsx
  Landing/
    HeroBanner.tsx
    ProblemStatement.tsx
    HowItWorks.tsx
    KeyFeatures.tsx
    AiIntelligence.tsx
    PipelinePreview.tsx
    Metrics.tsx
    TargetUsers.tsx
    CtaSection.tsx
  Auth/
    LoginForm.tsx
    SignupForm.tsx
  Dashboard/
    Sidebar.tsx
    DashboardHeader.tsx
public/
  images/
    logo.svg
    icons/
    ...
```
