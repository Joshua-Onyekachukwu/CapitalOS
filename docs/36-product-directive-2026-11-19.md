# 36 — Product directive: full review, landing-page priority, and roadmap

Status: owner-supplied brief, received 2026-11-19, stored verbatim in §1 for later
reference. §2 is my reading of it against the repository as it stands; §3 lists the
conflicts that need a decision before work starts.

Related: `docs/35-master-blueprint-execution-plan.md` (phased plan), `AGENTS.md`
(landing-claim truth rule), `docs/TREZO_INTEGRATION.md`, `docs/30-completion-tracker.md`.

---

## 1. The brief (verbatim)

# Capital OS: Full Product Review, Landing Page Improvement and Development Roadmap

We have a development environment running at:

**Development URL:** http://localhost:65089

I want you to conduct a comprehensive review of Capital OS, understand the product
vision, assess the current implementation, and begin improving the product.

For now, our first priority is the **landing page**. However, before making changes, I
want you to understand the entire system, including the Founder Dashboard, Admin
Dashboard, all existing pages, product documentation, and the features we intend to
build.

## 1. Understand the Product and Its Vision

Before making changes, study the entire documentation folder and all relevant project
files.

I want you to understand:

- What Capital OS is building.
- The problem we are solving for startup founders.
- Our target customers, initially pre-seed and seed-stage founders.
- How our investor discovery and matching system should work.
- Our AI-powered investor qualification and intelligence capabilities.
- Our proprietary technology and what makes our matching algorithm different.
- The long-term product vision and how all the modules should work together.

Capital OS is not simply an investor directory or database. We are building an AI-powered
fundraising workflow platform that helps founders identify the right investors, understand
their investment preferences, research individual investors, generate personalized
outreach, manage fundraising pipelines, and build meaningful investor relationships.

Our long-term vision is to become the central operating system for startup fundraising.

Our matching technology is one of our biggest competitive advantages. We want to build a
system that evaluates both founders and investors to identify meaningful investment
alignment.

Read the documentation carefully and use it as the foundation for your decisions. Do not
make assumptions about the product without checking the existing implementation and
documentation.

## 2. Conduct a Complete Product Audit

Before implementing major changes, inspect the entire application and create a
comprehensive list of all pages, modules, and features.

I specifically want you to review:

### A. Landing Page
- Current design and layout.
- Messaging and positioning.
- Hero section and primary call to action.
- Product demonstrations and visual sections.
- Features and benefits.
- Investor discovery and matching explanations.
- Pricing section.
- Animations and interactions.
- Mobile responsiveness.
- Overall UI/UX and conversion experience.

### B. Founder Dashboard
Review every existing page and feature, including:

- Founder onboarding and company profile.
- Founder dashboard overview.
- Fundraising readiness.
- Investor discovery.
- Investor intelligence profiles.
- Intelligent investor matching.
- Fundraising CRM.
- Investor outreach management.
- Warm introductions and relationship management.
- Fundraising pipeline.
- Pitch deck intelligence.
- AI fundraising copilot.
- Settings and account management.

Identify what is fully implemented, partially implemented, missing, broken, or needs
improvement.

### C. Admin Dashboard
Review all administrative functionality, including:

- Admin overview and analytics.
- Founder management.
- Investor database management.
- Investor data enrichment.
- User management and permissions.
- Subscription and billing management.
- Waitlist management.
- AI and matching system monitoring.
- Database management.
- Platform settings.
- System activity, logs, and operational monitoring.

Identify missing functionality and areas that require better UI/UX.

### D. Other Application Pages

Do not limit your review to the pages listed above. Inspect the entire application,
including authentication, onboarding, settings, supporting pages, and any other existing
modules.

### Deliverable: Product Audit Report

Create a structured report containing:

| Page/Module | Current Status | What Works | What Needs Improvement | Remaining Work |
|---|---|---|---|---|
| Landing Page | | | | |
| Founder Dashboard | | | | |
| Investor Discovery | | | | |
| Investor Profiles | | | | |
| Matching Engine | | | | |
| Fundraising CRM | | | | |
| Outreach Management | | | | |
| Admin Dashboard | | | | |
| Other Pages | | | | |

Use these status classifications:

- Completed: Working as intended.
- Needs Improvement: Implemented but requires refinement.
- Partially Completed: Some functionality exists, but important parts are missing.
- Not Started: Not implemented.
- Broken: Exists but is not functioning correctly.

Be honest about the actual state of the application. Do not mark features as completed
simply because a page or UI component exists.

## 3. Landing Page: First Development Priority

After understanding the product, begin with the landing page.

I want the landing page to communicate a compelling vision and make founders immediately
understand why Capital OS is worth using.

The landing page should sell the outcome, not simply list features.

### Our Positioning

Capital OS helps founders find the right investors, understand what they are looking for,
and approach them with relevant, personalized fundraising strategies.

We want founders to feel that fundraising can become more structured, informed, and
manageable when they use Capital OS.

The message should communicate that we help founders improve their chances of finding
suitable investors and securing funding through better investor intelligence and matching.

Do not promise guaranteed funding or imply that using Capital OS automatically results in
investment.

### A. Investor Database Positioning

I do not think displaying our current actual investor database count on the landing page is
the right approach.

Our ambition is to build a global investor intelligence database containing 500,000+
investor records and eventually much more.

I want the landing page to communicate this ambition.

For example, we can position the platform around:

- Access to a growing global network of 500K+ investor targets.
- Individual investor intelligence, not just fund listings.
- Detailed investment preferences and qualification.
- AI-powered investor-founder matching.
- Personalized fundraising intelligence.

The 500K+ figure must be presented as our target or platform vision until the database
actually supports that claim. Do not present planned database capacity as existing,
verified coverage.

Also, avoid displaying changing internal database statistics, unverified user counts, or
other operational numbers that could become outdated.

### B. Landing Page Copywriting

Rewrite and improve the landing page copy.

The copy should be:

- Simple and straight to the point.
- Persuasive without sounding exaggerated.
- Clear about the problem we solve.
- Focused on outcomes rather than technical jargon.
- Written specifically for startup founders.
- Consistent throughout the entire page.

Avoid generic AI-generated marketing language, unnecessary paragraphs, repetitive
messaging, and exaggerated promises.

The goal is to make founders understand the value of Capital OS within seconds.

### C. Landing Page Design and UI/UX

Improve the entire landing page experience.

Pay attention to:

- A compelling hero section.
- Clear visual hierarchy.
- Strong typography.
- Consistent colors and spacing.
- Professional use of gradients and backgrounds.
- Smooth transitions and animations.
- Interactive product demonstrations.
- Engaging feature presentations.
- Strong call-to-action placement.
- Responsive layouts across desktop, tablet, and mobile.
- Fast loading and smooth performance.

Use animations and visual storytelling where they genuinely improve the experience.

I want the design to communicate sophistication, intelligence, trust, and the potential of
a powerful fundraising platform.

Avoid unnecessary animations, visual clutter, generic AI aesthetics, and design elements
that make the website feel like a template.

### D. Pricing Section

Review and improve the pricing section.

Reduce the number of bullet points under each pricing plan. Each plan should have
approximately 5–6 key features at most.

Focus on the most valuable differences between the plans rather than listing every small
feature.

Make the pricing easy to understand and visually appealing.

Do not introduce pricing or feature promises that are not supported by our actual product
plans.

## 4. Investor Intelligence Database and Apollo.io Integration

I am currently exploring Apollo.io to determine whether we can access its platform and use
its available data to enrich our investor intelligence database.

I would prefer individual investor records rather than only collecting venture capital firm
names.

Our ideal records should include, where available and permitted:

- Investor's full name.
- Current professional position.
- Venture capital firm.
- Professional email address.
- LinkedIn profile.
- Geographic location.
- Investment stages.
- Industry preferences.
- Typical check sizes.
- Investment history.
- Other relevant investor information.

Prioritize individual partners, managing directors, principals, associates, angel
investors, and other relevant investment decision-makers.

Review Apollo's available APIs, export capabilities, access permissions, and applicable
data-use restrictions before choosing an integration or collection method.

Where access is authorized, design an enrichment workflow that can import, normalize,
deduplicate, validate, and update investor records.

Do not build the database around firm names alone. Individual investor intelligence is
important to our matching and outreach capabilities.

### Founder Waitlist and Test Data

I also want us to build a substantial founder waitlist as we prepare to launch.

Explore how we can attract and onboard founders through a proper waitlist registration
system.

For development and load testing, we can generate up to 10,000 clearly identified synthetic
founder records with realistic field structures.

These records must be kept separate from actual users and genuine waitlist registrations.
They must never be presented as real founders, verified signups, or actual product traction.

The production waitlist should contain genuine registrations and accurately report its
numbers.

## 5. Our Proprietary Matching Technology and Competitive Advantage

I want you to pay particular attention to our investor-founder matching system.

This is one of the most important parts of Capital OS.

We do not want to build another platform that simply allows founders to search through
thousands of investors.

Our goal is to build intelligent matching technology that understands:

**The founder:**
- Startup stage.
- Industry and business model.
- Geography.
- Fundraising amount.
- Traction and business maturity.
- Team background.
- Growth potential.
- Fundraising readiness.

**The investor:**
- Investment stage.
- Industry preferences.
- Geographic preferences.
- Check sizes.
- Previous investments.
- Portfolio composition.
- Investment thesis.
- Other qualification criteria.

The system should evaluate these factors and identify investors who are genuinely relevant
to each founder.

I want you to review our existing matching implementation and documentation to understand
what has already been developed.

Identify opportunities to improve:

- Matching accuracy.
- Investor qualification.
- Founder qualification.
- Ranking and scoring.
- Explainability of recommendations.
- Investor data enrichment.
- Match confidence.
- Personalized recommendations.

Our long-term vision is also to reverse this process so investors can identify founders who
align with their investment thesis.

This matching intelligence, combined with our investor data and fundraising workflow,
should become a meaningful competitive advantage.

Do not expose sensitive implementation details of our proprietary matching technology on
the public landing page.

## 6. Trezo Template and Existing Design Resources

We have Trezo template files available in the project.

Study the available template components, layouts, design resources, and existing
implementations.

You can reuse and adapt them wherever appropriate, especially for:

- Dashboard layouts.
- Admin interfaces.
- Analytics components.
- Tables and data views.
- Charts.
- Navigation.
- Forms.
- Cards.
- Other application components.

However, do not blindly copy the template.

Adapt its components to Capital OS's brand identity, product requirements, and design
system.

Maintain consistency across the entire application.

## 7. Development Quality Requirements

While implementing changes:

- Preserve existing working functionality.
- Avoid unnecessary rewrites.
- Reuse existing components where practical.
- Maintain consistent design patterns.
- Ensure all buttons and interactions work.
- Check responsive behavior.
- Verify that forms and data flows work.
- Check authentication and role-based access.
- Avoid introducing duplicate functionality.
- Review loading, empty, and error states.
- Test changes before considering them complete.

Do not create frontend interfaces that look functional but have no actual implementation
behind them.

Where a feature requires backend work, clearly identify it rather than presenting a mockup
as a completed feature.

## 8. How I Want You to Execute This Work

Follow this order:

**Phase 1: Understand and Audit**
1. Inspect the complete project structure.
2. Read the entire documentation folder.
3. Inspect the running development site.
4. Review all landing page, founder dashboard, admin dashboard, and supporting pages.
5. Understand the current architecture and existing functionality.
6. Produce the complete product audit and development roadmap.

**Phase 2: Landing Page Improvement**
1. Review the existing landing page.
2. Rewrite the copy.
3. Improve the hero section and overall positioning.
4. Redesign the sections where necessary.
5. Improve the pricing section.
6. Implement polished animations and interactions.
7. Ensure responsive behavior.
8. Test the entire landing page.

The landing page is the first implementation priority. Do not start making unrelated
dashboard changes before completing this priority.

**Phase 3: Founder Dashboard**
After the landing page, work through the founder dashboard modules based on the audit and
product roadmap.

**Phase 4: Admin Dashboard**
Improve the administrative experience and ensure the backend functionality supports the
platform's operational needs.

**Phase 5: Investor Intelligence and Matching**
Review and improve the investor database, Apollo integration where authorized, enrichment
workflows, founder waitlist, and matching engine.

**Phase 6: Full Application QA**
Test the entire application, including all pages, interactions, backend functionality,
authentication, data integrity, and responsiveness.

## 9. Communication and Progress Reporting

I want you to be transparent about what has been done and what remains.

After the initial audit, provide:

1. A complete list of all application pages.
2. The current implementation status of each page.
3. What is already working.
4. What needs improvement.
5. What has not been implemented.
6. Any bugs or architectural concerns.
7. A prioritized development roadmap.

As you work, keep the audit updated.

Clearly distinguish between:
- Completed work.
- Work currently in progress.
- Work remaining.
- Features that are planned but not implemented.

I want to see actual changes on the development site, not just recommendations or
descriptions of what could be done.

When you finish each phase, summarize the changes, identify the files and modules affected,
and explain what I should review.

## Final Direction

I want us to build Capital OS into a serious, globally relevant fundraising intelligence
platform.

We are bootstrapping, so we need to be thoughtful about resources, prioritize high-impact
work, and build intelligently.

Think beyond making individual pages look good. Think about the complete product, how the
modules connect, how the platform scales, and how we create something genuinely valuable
for founders.

**Start by studying the documentation and the existing application. Then complete the audit
and begin with the landing page.**

Keep the execution focused, the communication simple, and the quality of the work high.

---

## 2. What each directive maps to in the repository (2026-11-19)

| Brief item | Existing implementation | Status |
|---|---|---|
| Landing page sections | `src/components/Landing/*`: `HeroBanner`, `Benefits`, `Features`, `WhyCapitalOS`, `WorkingProcess`, `DataVizChart`, `Testimonials`, `Pricing`, `FAQ`, `Waitlist`, `About` | Built; copy and claims need a truth pass |
| Pricing | `src/components/Landing/Pricing.tsx` — a landing section only; **no `/pricing` route** | Built; plan data must match `billing_plans` |
| Founder dashboard | 26 module directories under `src/app/dashboard` | Broad; depth varies (see `docs/35` §4) |
| Admin dashboard | 10 sections under `src/app/admin`: `ai`, `audit-logs`, `data-sources`, `finance`, `intelligence`, `investor-firms`, `investors`, `review`, `system`, `users` | Built, unverified authorization |
| Onboarding | `src/app/onboarding` 7-step wizard | Verified end to end 2026-11-19 |
| Matching engine | `src/lib/services/investor/fit-scoring.ts` (6 weighted factors + `confidence`), `matching.ts`, `qualification.ts` | Built; not calibrated |
| Embeddings | `src/lib/services/investor/embeddings.ts` — NVIDIA `nemotron-3-embed-1b`, 2048 dims | Built; index decision open (`docs/35` D4) |
| Apollo enrichment | `src/lib/services/investor/apollo-enrichment.ts` | Exists; access/ToS not confirmed |
| Founder waitlist | `src/app/api/waitlist/route.ts` + `Landing/Waitlist.tsx` | Built; traction reporting must stay honest |
| Trezo template | `docs/TREZO_INTEGRATION.md` and existing dashboard styling | Already absorbed into the design system; see `DESIGN.md` |
| Investor corpus | 24,379 active records (18,995 firms + 5,461 Form D funds) | Measured; `docs/23`, `docs/30` |

**Dev environment note:** nothing is listening on `http://localhost:65089`. The running
dev server is on **`http://localhost:3100`** (PID 97604, log at
`.next/dev/logs/next-development.log`). Reviews and screenshots in this repo have all
been taken on 3100.

---

## 3. Conflicts and decisions this brief creates

### 3.1 The 500K+ figure versus `AGENTS.md`

`AGENTS.md` says every landing number must match a measured value in `docs/23` and
`docs/30`, and that the corpus is 24,379 active records. The brief asks for "500K+
investor targets".

These reconcile **only** if the number is never attached to coverage. Copy must read as
ambition, not inventory, for example:

- Acceptable: "Built for a 500K+ investor network" / "Designed to scale to 500,000+
  investor records" / "Our target: individual-level intelligence on 500K+ investors".
- Not acceptable: "500K+ investors" as a stat tile, "Search 500K+ investors", "Access
  500,000 verified investors", or any number with a "verified" adjective.

Because the brief also says "avoid displaying changing internal database statistics", the
current 24,379 corpus tiles should come **off** the landing page rather than be replaced
by 500K. The measured numbers stay in the product (Discover, dashboard) and in `docs/`.

This is a change to the `AGENTS.md` landing rule and needs your explicit sign-off, because
the rule was written to prevent exactly this class of claim.

### 3.2 Landing page first, money path still broken

`docs/35` Phase 0 exists because "founders sign up and pay" currently cannot be demoed
(subscription SQL broken, Stripe keys absent, credit gate 402s). The brief makes the
landing page the first implementation priority.

Recommendation: they do not conflict in practice if the landing work is scoped to
copy/layout/pricing and runs in parallel with the three backend fixes, because they touch
disjoint files. The risk is only calendar: a founder who converts from the new landing
page still hits a 503 at checkout. Treat Phase 0 fixes as a same-week dependency of any
landing experiment.

### 3.3 Synthetic founders

10,000 synthetic records are fine for load testing **only** if they are physically
separate (own schema/table prefix, `is_synthetic` flag, excluded from every admin count
and every public number). The blocker is not generation; it is making the exclusion
provable. I would add a test that asserts every traction query filters them out.

### 3.4 Apollo.io

`apollo-enrichment.ts` exists but its legality and plan limits are unverified. Before any
import: confirm the plan's API/export rights for storing and re-displaying personal data,
and record the lawful basis per field. Emails pulled from Apollo would still be
"unverified" under our own taxonomy unless separately validated.

### 3.5 Trezo

`docs/TREZO_INTEGRATION.md` shows the template was already mined for layout patterns. The
design system (`DESIGN.md`) is the authority; copying Trezo wholesale would undo the token
consolidation already committed.

---

## 4. Revised sequencing (proposal)

Insert the landing work as **Phase 0.5 — Landing** ahead of `docs/35` Phase 1, keeping
Phase 0 (money path) in flight:

| Order | Work | Gate |
|---|---|---|
| 0 | Money path: subscription SQL, credit gate, Stripe keys, facets | Checkout completes; badge resolves |
| 0.5 | Landing: copy truth pass, hero, sections, pricing (5–6 bullets), motion, mobile | No unmeasured claim; Lighthouse mobile ≥ 90; every CTA lands somewhere real |
| 1 | Audit deliverables, RLS suite, schema review | Cross-tenant suite green |
| 2 | Matching v2 + calibration | Published precision@10/@20 |
| 3 | Discovery depth | p95 < 800 ms page 1 |
| 4 | Execution loop | One real send + threaded reply |
| 5 | Copilot tools | Unapproved tool call impossible |
| 6 | Readiness / deck / data room | Revoked link fails |
| 7 | Admin / ingestion | Source published without code changes |
| 8 | Commercial completion | Plans enforced, invoices correct |
| 9 | Scale & hardening | 10× load within budget |

Landing copy acceptance rules, to be enforced in review:

1. No funding guarantees, no "guaranteed investor meetings", no implied success rate.
2. The 500K+ figure appears at most once, in vision language, never as a stat tile.
3. Pricing bullets ≤ 6 per plan and every bullet corresponds to shipped behaviour or is
   labelled "coming".
4. Every screenshot in the demo sections is a real screen from the app, or clearly marked
   as illustrative.
5. Mobile first: 390 px, 768 px, 1440 px breakpoints all verified.

---

## 5. Open questions for the owner

1. Sign off on §3.1: replace the measured corpus tiles with vision-framed 500K+ copy?
2. Which port is canonical for review — 3100 (running) or should a server be started on
   65089?
3. Does the landing page ship before the checkout fixes, or after? (Recommendation: after,
   or in the same week.)
4. Is the Apollo plan already paid for, and which tier? It determines whether enrichment is
   API-based or export-based.
