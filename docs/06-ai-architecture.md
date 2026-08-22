# Capital OS — AI Architecture

## Overview

Capital OS uses AI as an **intelligence component, not the database itself**. We use deterministic logic where deterministic logic is better, and AI where AI adds genuine value.

## Principle: Right Tool for the Right Job

| Task Type | Approach | Example |
|-----------|----------|---------|
| **Exact matching** | Deterministic | Email dedup, LinkedIn URL matching |
| **Scoring** | Algorithm + rules | Fit score calculation (4-factor) |
| **Classification** | Rules + scoring | Investor type detection |
| **Text generation** | AI | Email drafting, research summaries |
| **Reasoning** | AI | Why an investor fits, thesis analysis |
| **Extraction** | AI + validation | Website content extraction |
| **Strategy** | AI + human review | Fundraising recommendations |

## AI Provider: NVIDIA NIM

All AI operations go through NVIDIA NIM API with a pool of 5 API keys using round-robin rotation.

### Client Architecture

```
src/lib/ai/
├── client.ts     — chatCompletion(), aiComplete(), isAiConfigured()
├── keys.ts       — Key rotation, rate-limit handling, retry logic
├── models.ts     — Model configuration per task
└── index.ts      — Public exports
```

### Key Rotation

- 5 API keys loaded from `NVIDIA_API_KEY_1` through `NVIDIA_API_KEY_5`
- Round-robin selection
- Rate-limited keys are skipped for 60 seconds
- Automatic retry with exponential backoff (up to 3 attempts)

### Model Configuration

All tasks use `nvidia/llama-3.3-nemotron-super-49b-v1` with different parameters:

| Task | Temperature | Max Tokens | Purpose |
|------|-------------|-----------|---------|
| `investor_matching` | 0.1 | 2048 | High-accuracy classification |
| `investor_scoring` | 0.2 | 4096 | Structured scoring with reasoning |
| `email_drafting` | 0.7 | 2048 | Creative, natural language |
| `research_summary` | 0.3 | 4096 | Condensing large data |
| `fit_analysis` | 0.2 | 2048 | Explainable fit explanations |
| `pipeline_analysis` | 0.3 | 4096 | Strategic insights |

## AI Operations

### 1. Investor Research Summary

**Purpose:** Generate a comprehensive research summary for a specific investor.

**Input:** Investor ID → fetches all investor data, firm data, employment history, existing analysis.

**Output:** JSON with summary, investment thesis, key strengths, concerns, recommended approach, talking points.

**API Route:** `POST /api/investors/[id]/research`

**Credit Cost:** 5 credits

**When used:** Founder clicks "Generate Research" on investor detail page.

### 2. Email Drafting

**Purpose:** Generate a personalized investor outreach email.

**Input:** Investor name, firm, type, fit score, AI analysis, tone.

**Output:** JSON with subject and body.

**API Route:** `POST /api/outreach/draft`

**Credit Cost:** 3 credits

**When used:** Founder clicks "Draft Email" or "Regenerate with AI" on outreach page.

### 3. Copilot Chat

**Purpose:** AI fundraising assistant that answers questions about the founder's pipeline, investors, and strategy.

**Input:** Chat messages + real investor/firm data from Supabase.

**Output:** Text response.

**API Route:** `POST /api/copilot`

**Credit Cost:** 2 credits per response

**When used:** Founder asks questions in the AI Copilot page.

### 4. Fit Analysis (Planned)

**Purpose:** Explain why a specific investor fits the founder's company.

**Input:** Investor data + company profile.

**Output:** Detailed fit breakdown with reasoning.

**Credit Cost:** 4 credits

### 5. Pitch Deck Generation (Planned)

**Purpose:** Generate a company-specific investor pitch deck.

**Input:** Company intelligence, existing materials, design direction.

**Output:** Slide content + design composition.

**Credit Cost:** 25 credits (generation), 10 credits (revision)

### 6. Email Sequence Generation (Planned)

**Purpose:** Generate a 3-step email sequence (cold, follow-up, break-up).

**Input:** Investor data, company context, tone.

**Output:** 3 emails with subjects and bodies.

**Credit Cost:** 5 credits

## AI Safety Rules

1. **Never fabricate business information** — AI never invents revenue, customers, partnerships, or metrics
2. **Never auto-send** — All AI-generated emails require founder approval before sending
3. **Show reasoning** — AI analysis always shows its reasoning and confidence
4. **Allow override** — Founder can always edit, regenerate, or reject AI output
5. **Source attribution** — AI output is attributed to the model and timestamped
6. **Cost visibility** — Every AI operation logs model used, tokens consumed, credits deducted

## Error Handling

- **Rate limiting (429):** Rotate to next API key, retry with backoff
- **Auth errors (401/403):** Fail immediately, log error
- **Empty response:** Retry up to 3 times
- **All retries exhausted:** Return user-friendly error message
- **AI unavailable:** Graceful fallback ("AI service unavailable. Please try again later.")

## Cost Tracking

Every AI operation logs to `credit_ledger`:
- User ID
- Operation type
- Credits consumed
- Model used
- Tokens consumed (prompt + completion)
- Timestamp

---

*Last updated: August 22, 2026*
