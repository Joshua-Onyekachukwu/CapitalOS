# Capital OS — Pitch Deck Engine

## Status: 🟣 Planned (Architecture Defined)

## Overview

The Pitch Deck Engine generates **company-specific, professionally designed investor pitch decks** using AI and a composable design system. This is not a fixed-template generator — it produces unique presentations tailored to each company's industry, stage, and brand.

## Architecture Decision

**Decision:** Hybrid approach — curated template library (MVP) + composable design primitives (differentiation).

**Reasoning:**
- Template library is shippable in 2-3 weeks
- Composable system takes 6-8 weeks but becomes the differentiator
- Templates work as safety net if AI composition produces weak results
- Every company gets a visually distinct deck

## Generation Pipeline

```
Company Intelligence
     +
Onboarding Data
     +
Documents
     +
Website Analysis
     +
Existing Deck (if uploaded)
        ↓
┌─────────────────────────────┐
│  1. ASSESS                  │
│  What data exists?          │
│  What's missing?            │
│  What quality is it?        │
└──────────────┬──────────────┘
               ↓
┌─────────────────────────────┐
│  2. RESEARCH                │
│  Website extraction         │
│  Document parsing           │
│  Market context             │
│  Competitive landscape      │
└──────────────┬──────────────┘
               ↓
┌─────────────────────────────┐
│  3. NARRATIVE               │
│  AI determines story        │
│  structure based on company │
│  Not a fixed slide order    │
└──────────────┬──────────────┘
               ↓
┌─────────────────────────────┐
│  4. DESIGN DIRECTION        │
│  Industry → color palette   │
│  Stage → typography mood    │
│  Brand → visual tone        │
└──────────────┬──────────────┘
               ↓
┌─────────────────────────────┐
│  5. COMPOSE                 │
│  Select layout primitives   │
│  Apply typography system    │
│  Apply color system         │
│  Generate data visualizations│
│  Compose each slide         │
└──────────────┬──────────────┘
               ↓
┌─────────────────────────────┐
│  6. QUALITY CHECK           │
│  Typography consistency     │
│  Color harmony              │
│  Data accuracy              │
│  Story coherence            │
└──────────────┬──────────────┘
               ↓
┌─────────────────────────────┐
│  7. RENDER                  │
│  PPTX (primary)            │
│  PDF (for email)           │
│  Online preview            │
└──────────────┬──────────────┘
               ↓
┌─────────────────────────────┐
│  8. FOUNDER REVIEW          │
│  View in browser           │
│  Request changes           │
│  Regenerate slides         │
│  Approve                   │
└──────────────┬──────────────┘
               ↓
┌─────────────────────────────┐
│  9. VERSIONING              │
│  v1 → AI generated         │
│  v2 → Founder edits        │
│  v3 → AI revision          │
│  v4 → Final approved       │
└─────────────────────────────┘
```

## Slide Structure (AI-Selected)

The AI determines which slides to include and in what order:

| Slide | When Included |
|-------|--------------|
| Cover | Always |
| Problem | Always |
| Solution | Always |
| Market Size | Always |
| Product | Always |
| Traction | If data exists |
| Business Model | Always |
| Competition | Always |
| Go-to-Market | If GTM strategy provided |
| Team | If team data exists |
| Financials | If financial data provided |
| The Ask | Always (fundraising slides) |
| Vision | Always |
| Appendix | Optional |

## Design Primitives (Phase 2)

### Typography Systems
- Heading scales (H1-H4)
- Body text styles
- Emphasis treatments
- Caption styles

### Color Systems
- Primary, secondary, accent
- Background colors
- Text colors
- Chart colors
- Gradient definitions

### Layout Primitives
- Split layouts (50/50, 60/40, 70/30)
- Full-bleed layouts
- Editorial layouts
- Metric-focused layouts
- Comparison layouts
- Timeline layouts

### Component Libraries
- Metric cards
- Chart containers
- Image treatments
- Icon compositions
- Quote blocks
- Call-out boxes

## Output Formats

| Format | Use Case | Status |
|--------|----------|--------|
| PPTX | Editable in PowerPoint/Google Slides | 🔵 Planned |
| PDF | Email attachments | 🔵 Planned |
| Online Preview | In-app deck viewer | 🔵 Planned |

## Versioning

Every deck has versions:
- **v1** — AI generated (initial)
- **v2** — Founder edits
- **v3** — AI revision (based on feedback)
- **v4** — Final approved

Previous versions are never deleted.

## Credit Costs

| Operation | Credits |
|-----------|---------|
| Pitch deck generation | 25 |
| Pitch deck revision | 10 |
| Deck analysis (existing) | 5 |

## Implementation Plan

### MVP (Template Library)
- 15-20 curated slide templates
- AI selects appropriate style
- AI generates content for each slide
- Founder reviews and requests changes
- PPTX export via PptxGenJS

### Differentiation (Composable System)
- Build primitive library
- AI generates slide compositions
- Each company gets unique visual direction
- Templates remain as fallback

## Technical Stack

| Component | Technology |
|-----------|-----------|
| Content generation | NVIDIA NIM (Llama 3.3 Nemotron) |
| PPTX generation | PptxGenJS (server-side) |
| PDF generation | pdf-lib |
| Design composition | Custom engine (planned) |
| File storage | Supabase Storage |
| Preview | In-app viewer (planned) |

---

*Last updated: August 22, 2026*
