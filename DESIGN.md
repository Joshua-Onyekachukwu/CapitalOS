# Capital OS — Design System (DESIGN.md)

Last updated: 2026-11-17. Authority: this file + `@theme` in
`src/app/globals.css`. The two legacy token sheets (`src/styles/design-tokens.css`,
`src/styles/design-system.css`) are **superseded and dead** (nothing imports
them; one contains invalid CSS) — they get deleted in T2 after any semantic
values are ported. Incumbent identity is **preserved**: dark forest green +
lime accent, Inter body. We refine, not redesign.

## 1. Register

- **Dashboard/app surfaces: Operate.** Scanability, consistency, real usage
  scenes. Brand lives in precise details (colors, the cockpit, stage tiles).
- **Landing: Persuade.** The hero must state the thesis: real filings data
  (24,379 active records from SEC 13F/Form D/IAPD, US only) with explainable
  fit — not generic startup marketing.

## 2. Color tokens (single source: `@theme` in `globals.css`)

Keep: `lime` scale (brand accent), `danger`, `warning`, `info`, `success`,
`gray` scales, dark-mode custom variant.

Add / formalize:

| Token | Value | Use |
|---|---|---|
| `--color-brand-dark` | `#06201b` | headers, footers, primary dark surfaces, Button primary/secondary — **replaces every hardcoded `#06201b`** (105 files) |
| `--color-brand-dark-soft` | `#0a2e26` | hover on brand-dark surfaces, dark card inner panels |
| `--color-brand-lime` | `#84cc16` (lime-500 default scale) | primary action, active nav, focus rings on dark |
| `--color-brand-lime-strong` | `#65a30d` | lime text on white (≥4.5:1 contrast) |

Rules:

- **Delete the unused purple `--color-primary-*` and blue `--color-secondary-*`
  ramps** (template leftovers) — only after grep-verifying zero usages; if
  some exist, migrate those usages to brand tokens first.
- **Never inline a hex in a component.** Any new color goes into `@theme`.
- Text on white: minimum `gray-600` for helper text (the `text-gray-300`
  instances fail contrast and get upgraded), `text-brand-lime-strong` for
  lime-colored links.
- Semantic usage only in components: success → confirmations, danger →
  destructive/loss, warning → data-availability caveats (the 14-cheque/26-thesis
  disclaimers), info → neutral notices.

## 3. Typography

- **Body/UI: Inter** (incumbent, `--font-body`). Dashboard stays Inter for
  density. Tabular numerals (`tabular-nums`) on all metrics/stats — no extra
  font needed.
- **Display: Instrument Serif** (`next/font/google`, `--font-display`) —
  landing hero + section headings, dashboard page titles (h1) only. Regular
  weight, no all-caps; italic reserved for single-word emphasis. This is the
  personality carrier; everything else stays quiet.
- Type scale (Tailwind defaults): hero `text-5xl`/`text-6xl` (display),
  page title `text-2xl`/`text-3xl` (display), card titles `text-base
  font-semibold`, body `text-sm`, helper `text-xs text-gray-500`+.
- Remove the bare-element base styles in `globals.css:109-172` (`p { … }`,
  `h3 { … }`) — they cause the 817 `!important` overrides. Base styles only
  for font-family inheritance and focus-visible ring.

## 4. Layout & spacing

- Tailwind default 4px scale. Page gutter `px-4 sm:px-6 lg:px-8`; dashboard
  content max-width ~`max-w-7xl`.
- Cards: `rounded-xl border border-gray-200 bg-white shadow-sm` (dark mode:
  tokens from the dark variant). Radii: cards 12, buttons/inputs 8, badges 999.
- Data tables: progressively hidden columns with `hidden sm:table-cell` /
  `xl:` (incumbent pattern — keep).

## 5. Components (kit is authoritative)

`src/components/ui/*` is the only source for Button, Input, Modal, Card,
Badge, Alert, Skeleton, Table, Tabs, EmptyState, Avatar. Pages must not
hand-roll these (current violations: ad-hoc dialogs in pipeline +
PipelineRound, 30+ custom empty states, hand-rolled pulse skeletons).

- **Button:** every variant uses tokens (`bg-brand-dark`, `bg-brand-lime`,
  `bg-danger-500`); `:active { transform: scale(0.97) }` + `transition:
  transform 160ms ease-out`; loading prop disables + swaps content.
- **Modal:** focus trap, initial focus, focus return, unique title id
  (replace hardcoded `"modal-title"`), Escape closes, no data loss on
  backdrop click when a form has edits (confirm first).
- **EmptyState:** every empty surface uses it — headline states what's
  absent, one sentence why, one action. Empty ≠ error ≠ loading (see §7).
- **Skeleton:** use the kit component, not bare `animate-pulse` divs.

## 6. Icon policy

**remixicon only** (`ri-*`). Remove `material-symbols` import from
`layout.tsx` and the dependency (zero usages). Never import a second icon
font again.

## 7. Interaction states (mandatory on every async surface)

1. **Loading:** kit Skeleton matching final layout; first paint never jumps.
2. **Empty:** EmptyState with a real next action; data-availability caveats
   where a field is sparse (cheque/thesis counts) — use `warning`, not gray.
3. **Error:** distinct from empty — `ui/Alert` (danger) + "Try again"
   button; never silently render a fresh-account view on failure. Errors
   from the API envelope's `{ error }` are shown verbatim when humanly
   worded.
4. **Mutation:** button loading state + sonner toast on success/failure;
   optimistic updates reconcile in background (pipeline pattern).
5. **Fake functionality is banned.** Any control without a backend is
   removed, not styled as if it works.

## 8. Motion (per design-engineering doctrine)

- Only `transform` + `opacity` animate. UI durations ≤ 250ms; entrance
  `ease-out` curve `cubic-bezier(0.23, 1, 0.32, 1)`; hover/color `ease`;
  on-screen morphs `ease-in-out`. Never `ease-in` on enter.
- Never animate from `scale(0)` — start `scale(0.95)` + opacity 0.
- Never animate keyboard-initiated actions (nav switching, palette toggles).
- Stagger lists 30–80ms, only on first mount.
- `prefers-reduced-motion`: keep opacity/color transitions, drop movement.
- Popovers/tooltips scale from their trigger (`transform-origin` var);
  modals stay center-origin.
- Sonner toasts are already the toast standard — don't introduce another.

## 9. Accessibility floor

- Wire `eslint-plugin-jsx-a11y` fully into `eslint.config.mjs` (T2) — every
  rule stays on.
- Icon-only buttons: `aria-label` (not `title`).
- Modals/drawers: focus trap + Escape + `inert`/`aria-hidden` off-canvas
  sidebar. FAQ accordions: `aria-expanded`/`aria-controls`.
- Forms: `<label htmlFor>` always; inline errors on blur; server errors in
  Alert. The login page is the internal gold standard.
- Keyboard path for every interaction: pipeline DnD has the per-card "Move"
  menu — keep it, announce it in copy.
- Contrast: 4.5:1 body text; never color-only error signaling.

## 10. React data-fetching doctrine

- **New/rebuilt pages:** server components for reads; `'use client'` only
  for interaction islands. Onboarding, settings, outreach, investors,
  pipeline get decomposed as they're touched — no more 1,700-line client
  pages.
- **react-query: DROP.** Zero usages today; client pages that must fetch
  use one small typed fetch helper (`lib/fetcher.ts`) with explicit
  loading/empty/error states instead of 32 hand-rolled loops. (Decision
  recorded 2026-11-17; backend agent notified via coordination file.)
- List keys: stable ids, never index keys, on any reorderable/editable list.
- Recharts lives in dashboard analytics only; landing keeps static SVG.

## 11. Copy voice

- Founder-side words, no infrastructure jargon ("Apply migration 020" →
  "Meetings are coming soon"). Active verbs on buttons ("Save changes", not
  "Submit"). Sentence case. Errors explain what happened + how to fix;
  no apology, no vagueness. Numbers are measured or "—".
