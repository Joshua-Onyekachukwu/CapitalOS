# Testing — Capital-OS

## Overview

Capital-OS uses a layered testing approach: unit tests for business logic, integration tests for external services, agent tests for AI workflows, and E2E tests for critical user journeys.

---

## Testing Layers

```
┌─────────────────────────────────────────┐
│              E2E Tests                   │
│    Full user journeys (Playwright)       │
├─────────────────────────────────────────┤
│           Integration Tests              │
│   Supabase, NVIDIA, Email Provider       │
├─────────────────────────────────────────┤
│            Agent Tests                   │
│  Research, Matching, Writing, Classify   │
├─────────────────────────────────────────┤
│             Unit Tests                   │
│   Schemas, Utils, Scoring, Filters       │
└─────────────────────────────────────────┘
```

---

## Unit Tests

### Tools

- **Vitest** — Fast, Vite-native test runner
- **@testing-library/react** — Component testing

### What to Test

#### Zod Schemas

```typescript
describe('startupProfileSchema', () => {
  it('should accept valid startup data', () => {
    const result = startupProfileSchema.safeParse({
      name: 'Provance',
      description: 'AI media authenticity platform',
      fundraising_stage: 'pre-seed',
      amount_raising: 750000,
    });
    expect(result.success).toBe(true);
  });

  it('should reject empty names', () => {
    const result = startupProfileSchema.safeParse({
      name: '',
    });
    expect(result.success).toBe(false);
  });

  it('should reject invalid fundraising stages', () => {
    const result = startupProfileSchema.safeParse({
      name: 'Test',
      fundraising_stage: 'mega-round',
    });
    expect(result.success).toBe(false);
  });
});
```

#### Utility Functions

```typescript
describe('calculateFitScore', () => {
  it('should score compatible investors higher', () => {
    const startup = createTestStartup({ stage: 'seed', sector: 'ai' });
    const investor = createTestInvestor({ stages: ['seed'], sectors: ['ai'] });

    const score = calculateFitScore(startup, investor);
    expect(score).toBeGreaterThan(70);
  });

  it('should score incompatible investors lower', () => {
    const startup = createTestStartup({ stage: 'pre-seed' });
    const investor = createTestInvestor({ stages: ['series-b'] });

    const score = calculateFitScore(startup, investor);
    expect(score).toBeLessThan(30);
  });
});
```

#### Filtering Logic

```typescript
describe('hardFilterInvestors', () => {
  it('should filter by stage compatibility', () => {
    const investors = [
      { stages: ['seed'], minCheck: 100000, maxCheck: 1000000 },
      { stages: ['series-b'], minCheck: 5000000, maxCheck: 20000000 },
    ];

    const filtered = hardFilterInvestors(investors, {
      stage: 'seed',
      amountRaising: 500000,
    });

    expect(filtered).toHaveLength(1);
    expect(filtered[0].stages).toContain('seed');
  });
});
```

#### Score Calculation

```typescript
describe('composeInvestorScore', () => {
  it('should weight components correctly', () => {
    const score = composeInvestorScore({
      hardFit: 20,
      semanticSimilarity: 25,
      stageFit: 15,
      checkSize: 15,
      sectorFit: 10,
      geography: 5,
      recentActivity: 5,
      portfolioAlignment: 5,
    });

    expect(score).toBeGreaterThanOrEqual(0);
    expect(score).toBeLessThanOrEqual(100);
  });
});
```

---

## Integration Tests

### Tools

- **Vitest** with Supabase test database
- **MSW** (Mock Service Worker) for API mocking

### Supabase Integration

```typescript
describe('Startup CRUD', () => {
  let supabase: SupabaseClient;

  beforeAll(async () => {
    supabase = createTestClient();
  });

  afterAll(async () => {
    await cleanupTestData();
  });

  it('should create and retrieve a startup', async () => {
    const { data: startup } = await supabase
      .from('startups')
      .insert({ name: 'Test Startup', user_id: testUserId })
      .select()
      .single();

    expect(startup).toBeDefined();
    expect(startup.name).toBe('Test Startup');

    // Verify RLS — different user should not see it
    const otherUserClient = createTestClient(otherUserId);
    const { data } = await otherUserClient
      .from('startups')
      .select()
      .eq('id', startup.id)
      .single();

    expect(data).toBeNull();
  });
});
```

### NVIDIA API Integration

```typescript
describe('NVIDIA Embedding', () => {
  it('should generate embeddings', async () => {
    const embedding = await nvidiaClient.generateEmbedding(
      'AI infrastructure startup raising seed round'
    );

    expect(embedding).toHaveLength(1536);
    expect(embedding.every(v => typeof v === 'number')).toBe(true);
  });

  it('should handle rate limits gracefully', async () => {
    // Mock rate limit response
    mockNvidiaRateLimit();

    await expect(
      nvidiaClient.generateEmbedding('test')
    ).rejects.toThrow('Rate limit');
  });
});
```

### Email Provider Integration

```typescript
describe('Resend Email Provider', () => {
  it('should send email in mock mode', async () => {
    process.env.AI_MOCK_MODE = 'true';

    const result = await emailProvider.sendEmail({
      from: 'founder@capitalos.com',
      to: 'investor@example.com',
      subject: 'Test',
      text: 'Hello',
    });

    expect(result.status).toBe('sent');
    expect(result.messageId).toBeDefined();
  });
});
```

---

## Agent Tests

### Research Agent

```typescript
describe('Investor Research Agent', () => {
  it('should research an investor and produce valid output', async () => {
    const task = createTestTask({
      agent_type: 'researcher',
      input_data: { investor_id: testInvestorId },
    });

    const result = await executeResearchAgent(task);

    expect(result.summary).toBeDefined();
    expect(result.evidence).toBeInstanceOf(Array);
    expect(result.evidence.length).toBeGreaterThan(0);
    expect(result.confidence).toBeGreaterThan(0);
  });

  it('should handle unknown investors gracefully', async () => {
    const task = createTestTask({
      agent_type: 'researcher',
      input_data: { investor_id: unknownInvestorId },
    });

    const result = await executeResearchAgent(task);

    expect(result.summary).toContain('limited information');
  });
});
```

### Matching Agent

```typescript
describe('Matching Agent', () => {
  it('should produce ranked results', async () => {
    const results = await executeMatchingAgent({
      startup_id: testStartupId,
      campaign_id: testCampaignId,
      filters: { stage: 'seed', sector: 'ai' },
    });

    expect(results.length).toBeGreaterThan(0);
    expect(results[0].fit_score).toBeGreaterThanOrEqual(results[1].fit_score);
    expect(results[0].priority).toBeDefined();
  });
});
```

### Reply Classification

```typescript
describe('Reply Classification Agent', () => {
  it('should classify interested reply', async () => {
    const classification = await classifyReply({
      body: "Thanks for reaching out! I'd love to learn more. Can we schedule a call?",
    });

    expect(classification.classification).toBe('interested');
    expect(classification.confidence).toBeGreaterThan(0.7);
  });

  it('should detect opt-out', async () => {
    const classification = await classifyReply({
      body: "Please remove me from your mailing list.",
    });

    expect(classification.classification).toBe('opt_out');
  });
});
```

---

## E2E Tests

### Tools

- **Playwright** — Browser automation

### Critical User Journeys

#### 1. Onboarding Flow

```typescript
test('founder can sign up and create startup', async ({ page }) => {
  await page.goto('/signup');
  await page.fill('[name="email"]', 'founder@test.com');
  await page.fill('[name="password"]', 'SecurePass123!');
  await page.click('button[type="submit"]');

  await page.waitForURL('/dashboard');

  // Create startup
  await page.click('text=Create Startup');
  await page.fill('[name="name"]', 'Test Startup');
  await page.fill('[name="description"]', 'An AI startup');
  await page.click('text=Create');

  await page.waitForURL(/\/startup/);
  await expect(page.locator('text=Test Startup')).toBeVisible();
});
```

#### 2. Investor Discovery Flow

```typescript
test('founder can discover and view investors', async ({ page }) => {
  // Assumes logged in with startup created
  await page.goto('/investors/discover');

  await page.fill('[name="sector"]', 'AI');
  await page.click('text=Find Investors');

  await page.waitForSelector('[data-testid="investor-card"]');
  const cards = await page.locator('[data-testid="investor-card"]').count();
  expect(cards).toBeGreaterThan(0);
});
```

#### 3. Campaign + Outreach Flow

```typescript
test('founder can create campaign and send email', async ({ page }) => {
  await page.goto('/campaigns/new');
  await page.fill('[name="name"]', 'Seed Round');
  await page.fill('[name="target_amount"]', '750000');
  await page.click('text=Create Campaign');

  // Add investor and generate email
  await page.click('text=Add to Campaign');
  await page.click('text=Draft Email');

  // Review and approve
  await page.waitForSelector('[data-testid="email-draft"]');
  await page.click('text=Approve');

  await expect(page.locator('text=Email sent')).toBeVisible();
});
```

---

## Mock Mode

When `AI_MOCK_MODE=true`:

- All NVIDIA API calls return pre-defined mock responses
- Embeddings return random vectors
- LLM calls return template responses
- Reranking returns shuffled input
- No real API costs incurred

### Running Tests in Mock Mode

```bash
AI_MOCK_MODE=true pnpm test
```

---

## Test Commands

```bash
# Run all tests
pnpm test

# Run with coverage
pnpm test:coverage

# Run specific file
pnpm test investor-matching.test.ts

# Run E2E tests
pnpm test:e2e

# Run E2E with UI
pnpm test:e2e:ui
```

---

## Test Database

### Setup

```bash
# Create test database
supabase db reset --db-url $TEST_DATABASE_URL

# Or use local Supabase
supabase start
```

### Isolation

Each test suite:
1. Creates test data in `beforeAll`
2. Cleans up in `afterAll`
3. Uses unique IDs to prevent collisions

### Fixtures

```typescript
// tests/fixtures/startups.ts
export function createTestStartup(overrides?: Partial<Startup>): Startup {
  return {
    id: crypto.randomUUID(),
    user_id: testUserId,
    name: 'Test Startup',
    description: 'A test startup',
    fundraising_stage: 'seed',
    amount_raising: 1000000,
    ...overrides,
  };
}
```

---

## Coverage Targets

| Layer | Target |
|-------|--------|
| Unit tests | 80% |
| Integration tests | 70% |
| Agent tests | 60% |
| E2E tests | Critical paths only |

---

## CI Integration

```yaml
# GitHub Actions
- name: Run tests
  run: pnpm test

- name: Run typecheck
  run: pnpm typecheck

- name: Run lint
  run: pnpm lint

- name: Run build
  run: pnpm build
```

All checks must pass before merge to `develop`.
