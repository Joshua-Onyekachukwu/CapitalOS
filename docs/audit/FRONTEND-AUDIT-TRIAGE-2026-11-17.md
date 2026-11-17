# Frontend audit triage — 2026-11-17

Source: UI/UX audit track (completed 2026-11-17). Findings below are mapped to
the frontend task list in `AGENT-COORDINATION.md`. Backend-agent items are
NOT repeated here except where they gate frontend work.

## Design-system findings (feeds T1/T2 — highest priority)

1. **Three competing token systems, none authoritative.**
   - `src/styles/design-tokens.css` and `src/styles/design-system.css` are
     ~1:1 duplicates of each other; **neither is imported anywhere** (dead
     weight). `design-system.css:144-150` contains broken CSS
     (`background: rgb 240 253 244;` — invalid) in four `.ds-*-bg` classes.
   - The real tokens live in `src/app/globals.css` `@theme`, which also holds
     an unused purple `--color-primary-*` ramp (template leftover).
   - `design-tokens.css:37-67` redefines Tailwind default utilities (`m-1`,
     `gap-1`…) with colliding values — footgun if ever imported.
   - **Decision for DESIGN.md:** single source = `@theme` in `globals.css`;
     delete both `src/styles/*.css` token sheets after porting anything
     semantic; fix or drop broken `rgb` declarations.
2. **105 files hardcode hex values.** Brand dark `#06201b` inlined 30+
   times; `Button.tsx` mixes `bg-[#06201b]`, `bg-lime-500`, and theme token
   `bg-danger-500` in one component. **Fix:** add `--color-brand-dark` to
   `@theme`, purge unused primary ramp, migrate Button variants to tokens.
3. **817 `!important` overrides** caused by opinionated bare-element base
   styles in `globals.css:109-172`. Removing element-level global styles
   (keep font/antd-free base) removes most of them.
4. **UI kit barely adopted:** `EmptyState` used by 4 files (every page rolls
   its own), `Skeleton` by 2 (dozens of hand-rolled `animate-pulse`),
   ad-hoc dialogs in pipeline + PipelineRound despite `ui/Modal`. T2 must
   enforce kit usage on every page it touches.

## Icon conflict (T2)

- `material-symbols` imported in `src/app/layout.tsx:1` with **zero usages**
  in src — the entire variable icon font ships on every page load.
  remixicon is the real system (~100 files, `ri-*`). **Remove
  material-symbols import + dep.**

## Interaction-state defects (T4/T12, plus immediate hotfixes)

- **[Hotfix] API failure renders as "fresh account":** cockpit
  (`dashboard/page.tsx:140-152`) and investors (`investors/page.tsx:366-372`)
  swallow fetch errors into empty states with no banner/retry. Must
  distinguish "loaded, zero results" from "failed to load" (use `ui/Alert` +
  retry).
- **[Hotfix] Dead admin buttons:** `admin/system/page.tsx:253,255` — "Clear
  Cache" and "View Logs" have `action: () => {}`. Violates the no-fake-
  functionality repo rule. Implement or remove.
- Login "Remember me" checkbox is decorative (`login/page.tsx:25,131-139`) —
  implement or remove.
- Onboarding launch sequence is simulated theater with `setTimeout` sleeps
  (`onboarding/page.tsx:373-445`); step-4 cockpit fetch result discarded.
- Waitlist "Copy" gives no copied feedback, swallows clipboard failure
  (`Landing/Waitlist.tsx:108-117`).
- **Real bug:** cockpit stat renders literal `0` instead of "—" when
  `emailsSent === 0` (`dashboard/page.tsx:300` — falsy-check bug).
- **Onboarding discards saved wizard state on reload** (`:250-253` forces
  pitchDeckStyle/needs/traction back to defaults) — real data-loss bug.
- Stage tile constant drift: `pipeline/page.tsx:70-82` has 11 stage ids that
  don't match the 21 real ids in `lib/services/pipeline/stages.ts:18-38` —
  several tiles render untinted. Fix to import from the single source of
  truth.
- Jargon leak: cockpit next-step says "Apply migration 020 to enable
  meetings" to founders (`dashboard/page.tsx:172`) — replace with human copy.

## Accessibility (T12, wired into every task)

- `eslint-plugin-jsx-a11y` installed but NOT enabled in `eslint.config.mjs`
  (only the 6 baseline rules from next config are active). Wire the plugin
  in as part of T2.
- Only 14 `aria-label`s in the whole app; icon-only buttons rely on `title`.
- `ui/Modal` has no focus trap/initial focus/focus return; duplicated
  hardcoded `modal-title` id (line 68/76) breaks with two modals. Pipeline
  lost-reason dialog: no Escape, backdrop click discards typed text.
- Mobile sidebar drawer stays in tab order when off-canvas; no
  `inert`/`aria-hidden`, no Escape-to-close (`Sidebar.tsx:174-179`).
- Landing FAQ accordion lacks `aria-expanded`/`aria-controls` (FAQ.tsx:116-131).
- Pipeline DnD is native HTML5 (pointer-only) but has a keyboard path via
  the per-card "Move" menu — announce it; keep it in T7 work.
- Contrast: `text-gray-300` helper text on white (pipeline 679, investors
  570) and light lime `#8bd466` text links below 4.5:1.

## React correctness / performance (T12 + ongoing discipline)

- `@tanstack/react-query` installed, **zero usages**; 32 files hand-roll
  fetch+useState+AbortController loops, cockpit manually retries 401s.
  Decision needed: adopt react-query on the pages I rebuild, or drop dep.
  Default for T4/T5/T6 rebuilds: adopt it (cache + invalidation discipline),
  confirm with owner before deciding globally.
- Monolithic client pages: onboarding ~1,700 lines; settings 42KB; outreach
  35KB; investors 34KB; pipeline 30KB. Rebuilds should split into server
  components + client islands where possible.
- 40+ index-keyed lists; dynamic ones (onboarding team rows, copilot
  messages, timelines) can corrupt input state — fix as pages are touched.

## Landing claims verdict (T3)

Substantially accurate. Fix before next deploy:
1. `DataVizChart.tsx:122-131` + `FAQ.tsx:84-106`: says "18,995 **investors**"
   — must be "firms"; stat overlay says "SEC Sourced" — corpus is SEC
   **and IAPD** (IAPD is FINRA/IARD, not SEC).
2. `Pricing.tsx:21`: "7 branded templates" — only 3 default sequence
   templates exist (`sequence.ts:590-702`). Fix number or build the 7.
3. Borderline: "portfolio fields appear only where the source recorded them"
   — portfolio count is 0; safer to name cheque/thesis only.
4. Hero/FAQ images load from `/images/real-estate-agent/…` with alt texts
   like "faq-image" — template residue; replace imagery + alt text.

## Frontend-lane dependency on backend

- T5 discovery scale work gated on CR-1 (corpus import + deep pagination).
- T7 pipeline conversion gated on CR-4 aggregates.
