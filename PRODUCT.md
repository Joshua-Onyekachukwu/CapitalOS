# Capital OS — Product Truth

Last updated: 2026-11-17. Sources: `README.md`, `docs/01-product-vision.md`,
`docs/audit/EXECUTIVE_SUMMARY.md`, `docs/30-completion-tracker.md`,
`AGENTS.md`. If code and this file disagree on a *number*, the measured value
in `docs/23-wave1-investor-data-findings.md` / `docs/30-completion-tracker.md`
wins.

## What this is

**Capital OS is a fundraising operating system for startup founders.** It
helps a founder discover relevant investors, understand investor fit (with
written explanations, not just scores), prepare personalized outreach, and
manage the entire fundraising pipeline in one place.

## Who it is for (first segment)

**Nigerian + diaspora founders raising pre-seed/seed.** The DB's weakness is
exactly their gap: local/impact investors are under-indexed by OpenVC and
spreadsheet lists. Pricing wedge: $9.99 founding member. Founders are the
buyer; investor-side CRM is explicitly out of scope for now.

## What the product promises (and does NOT yet promise)

- ✅ Real investor corpus from public filings — **24,379 active records**:
  18,995 firm records (SEC 13F / Form D / IAPD filings) + **5,461 SEC Form D
  venture funds** (imported 2026-11-17), **US only**.
- ✅ **4,933** records have an email address on file. **None are
  email-verified** — never write "verified contactable emails".
- ✅ **12,102 person rows / 4,205 distinct named people** from Form D related
  persons — **not background-checked or contact-verified**; copy must not
  imply diligence.
- ✅ Deterministic 7-factor fit scoring **with a written explanation per
  factor** (explainability is the qualitative edge).
- ✅ AI-drafted outreach the founder approves; **nothing auto-sends**.
- ✅ 21-stage pipeline with drag-and-drop, lost reasons, stage history.
- ⚠️ Cheque size exists on 14 records; thesis text on 26; portfolio
  companies on 0. Never claim these fields are complete. Never claim UK/EU
  coverage.
- ⚠️ Outreach sending, Stripe billing, PostHog analytics: code complete /
  partially verified; **no email has ever been sent, no purchase has ever
  completed**. UI must not imply otherwise.

## Non-negotiable product rules

1. **No fake functionality.** UI must not claim actions the backend doesn't
   perform. Every number shown is measured or explicitly "—".
2. **Honesty over polish.** Empty states say what's missing and why; error
   states are distinct from empty states; loading states are real.
3. **Founder-side copy only.** No infrastructure jargon (migrations, table
   names, RPC) in user-facing text.
4. **Landing claims match measured data in the same commit** (per AGENTS.md).

## Demo goal (current constraint)

Working MVP to demo to founders for signup + founding-member payment. The
demo path: landing → signup → onboarding → discover investors → qualify
(with explanations) → shortlist/compare → pipeline → dashboard cockpit.
Every screen on that path must have real loading/empty/error states, because
demo accounts start with zero data.
