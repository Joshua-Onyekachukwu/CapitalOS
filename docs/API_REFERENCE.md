# API Reference — Capital-OS

## Overview

Capital-OS uses Next.js Server Actions and API Routes. All data operations go through Supabase. This document covers the application's API surface.

---

## Base URL

```
Production: https://capitalos.com
Local:      http://localhost:3456
```

---

## Server Actions

Server Actions are the primary way to mutate data. They run on the server with full access to Supabase service role and NVIDIA APIs.

### Startup Actions

#### createStartup

```typescript
// app/(dashboard)/startup/actions.ts
"use server";

export async function createStartup(data: CreateStartupInput): Promise<Startup> {
  const supabase = getServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) throw new Error("Unauthorized");

  const validated = CreateStartupSchema.parse(data);

  const { data: startup, error } = await supabase
    .from("startups")
    .insert({ ...validated, user_id: user.id })
    .select()
    .single();

  if (error) throw error;
  return startup;
}
```

**Input:**
```json
{
  "name": "Provance",
  "description": "AI media authenticity platform",
  "website": "https://provance.ai"
}
```

**Output:** `Startup` object

---

#### updateStartup

```typescript
export async function updateStartup(
  startupId: string,
  data: Partial<UpdateStartupInput>
): Promise<Startup>
```

**Input:** Partial startup fields + ID

**Output:** Updated `Startup` object

---

#### finalizeStartupProfile

```typescript
export async function finalizeStartupProfile(
  startupId: string
): Promise<{ success: boolean; completeness: number }>
```

**Output:**
```json
{
  "success": true,
  "completeness": 96
}
```

---

### Document Actions

#### uploadDocument

```typescript
export async function uploadDocument(
  startupId: string,
  file: File,
  type: DocumentType
): Promise<StartupDocument>
```

**Supported Types:** `pitch_deck`, `one_pager`, `business_plan`, `financial_model`, `product_doc`, `other`

**Output:** `StartupDocument` with extraction status

---

#### processDocument

Triggers AI extraction on an uploaded document.

```typescript
export async function processDocument(
  documentId: string
): Promise<{ status: string; extractedFields: number }>
```

---

### Investor Actions

#### discoverInvestors

```typescript
export async function discoverInvestors(
  criteria: InvestorDiscoveryCriteria
): Promise<{ taskId: string; estimatedCount: number }>
```

**Input:**
```json
{
  "stage": ["seed", "pre-seed"],
  "sector": ["ai", "saas"],
  "geography": ["us", "europe"],
  "checkSizeMin": 250000,
  "checkSizeMax": 2000000,
  "count": 100
}
```

**Output:**
```json
{
  "taskId": "uuid",
  "estimatedCount": 100
}
```

---

#### researchInvestor

```typescript
export async function researchInvestor(
  investorId: string
): Promise<{ taskId: string }>
```

---

#### getInvestorProfile

```typescript
export async function getInvestorProfile(
  investorId: string
): Promise<InvestorProfile>
```

**Output:**
```json
{
  "investor": { ... },
  "firm": { ... },
  "fitScore": 92,
  "priority": "A",
  "research": { ... },
  "sources": [ ... ],
  "portfolio": [ ... ],
  "activity": [ ... ]
}
```

---

### Campaign Actions

#### createCampaign

```typescript
export async function createCampaign(
  data: CreateCampaignInput
): Promise<Campaign>
```

**Input:**
```json
{
  "startupId": "uuid",
  "name": "Pre-Seed Round",
  "targetAmount": 750000,
  "stage": "pre-seed",
  "targetInvestorCount": 100
}
```

---

#### addInvestorToCampaign

```typescript
export async function addInvestorToCampaign(
  campaignId: string,
  investorId: string
): Promise<CampaignInvestor>
```

---

#### moveInvestorStage

```typescript
export async function moveInvestorStage(
  campaignInvestorId: string,
  newStage: PipelineStage
): Promise<CampaignInvestor>
```

---

### Email Actions

#### generateEmailDraft

```typescript
export async function generateEmailDraft(
  data: GenerateEmailInput
): Promise<EmailDraft>
```

**Input:**
```json
{
  "investorId": "uuid",
  "campaignId": "uuid",
  "type": "first_contact",
  "tone": "professional"
}
```

**Output:**
```json
{
  "emailId": "uuid",
  "subject": "...",
  "body": "...",
  "aiGenerated": true,
  "personalizationPoints": ["..."]
}
```

---

#### approveEmail

```typescript
export async function approveEmail(
  emailId: string,
  editedBody?: string
): Promise<{ status: string; scheduledAt?: string }>
```

---

#### sendEmail

```typescript
export async function sendEmail(
  emailId: string
): Promise<{ messageId: string; status: string }>
```

---

### Meeting Actions

#### createMeeting

```typescript
export async function createMeeting(
  data: CreateMeetingInput
): Promise<Meeting>
```

---

#### generateMeetingBrief

```typescript
export async function generateMeetingBrief(
  meetingId: string
): Promise<MeetingBrief>
```

**Output:**
```json
{
  "investorSummary": "...",
  "whyRelevant": "...",
  "portfolioCompanies": ["..."],
  "potentialQuestions": ["..."],
  "talkingPoints": ["..."],
  "objections": ["..."],
  "questionsToAsk": ["..."]
}
```

---

### Copilot Actions

#### sendCopilotMessage

```typescript
export async function sendCopilotMessage(
  message: string,
  context: CopilotContext
): Promise<ReadableStream<string>>
```

Returns a streaming response for real-time copilot interaction.

---

## API Routes

### Webhook Endpoints

#### POST /api/webhooks/resend

Handles Resend email events (delivered, opened, bounced, etc.).

```typescript
// app/api/webhooks/resend/route.ts
export async function POST(req: Request) {
  const payload = await req.json();

  // Verify signature
  if (!verifyResendSignature(req, payload)) {
    return new Response("Invalid signature", { status: 401 });
  }

  // Process event
  await processEmailEvent(payload);

  return new Response("OK", { status: 200 });
}
```

---

#### POST /api/unsubscribe

Handles unsubscribe requests.

```
GET /api/unsubscribe?token=<encrypted_token>
```

---

### Health Check

#### GET /api/health

```json
{
  "status": "healthy",
  "timestamp": "2026-08-21T12:00:00Z",
  "database": "connected",
  "ai": "available"
}
```

---

## Error Responses

All errors follow a consistent format:

```json
{
  "error": {
    "code": "INVESTOR_NOT_FOUND",
    "message": "Investor with ID xxx not found",
    "details": {}
  }
}
```

### Error Codes

| Code | Status | Description |
|------|--------|-------------|
| `UNAUTHORIZED` | 401 | Not authenticated |
| `FORBIDDEN` | 403 | No access to resource |
| `NOT_FOUND` | 404 | Resource not found |
| `VALIDATION_ERROR` | 400 | Invalid input |
| `RATE_LIMITED` | 429 | Too many requests |
| `AI_ERROR` | 500 | AI service error |
| `EMAIL_ERROR` | 500 | Email service error |
| `INTERNAL_ERROR` | 500 | Unexpected server error |

---

## Realtime Events

Subscribe via Supabase Realtime:

```typescript
// Agent task updates
supabase
  .channel("agent-tasks")
  .on("postgres_changes", {
    event: "*",
    schema: "public",
    table: "agent_tasks",
    filter: `batch_id=eq.${batchId}`,
  }, (payload) => {
    // Handle task update
  })
  .subscribe();

// Pipeline updates
supabase
  .channel("pipeline")
  .on("postgres_changes", {
    event: "*",
    schema: "public",
    table: "campaign_investors",
    filter: `campaign_id=eq.${campaignId}`,
  }, (payload) => {
    // Handle pipeline change
  })
  .subscribe();

// Notifications
supabase
  .channel(`notifications:${userId}`)
  .on("postgres_changes", {
    event: "INSERT",
    schema: "public",
    table: "notifications",
    filter: `user_id=eq.${userId}`,
  }, (payload) => {
    // Handle new notification
  })
  .subscribe();
```

---

## Rate Limits

| Endpoint | Limit | Window |
|----------|-------|--------|
| `sendEmail` | 20/hour | Rolling |
| `discoverInvestors` | 5/hour | Rolling |
| `researchInvestor` | 30/hour | Rolling |
| `copilot` | 60/hour | Rolling |
| General API | 100/minute | Rolling |

---

## Authentication

All server actions and API routes require authentication via Supabase session.

```typescript
// Middleware protection
// middleware.ts
const protectedRoutes = ["/dashboard", "/api"];
const publicRoutes = ["/", "/login", "/signup"];

export function middleware(request: NextRequest) {
  const session = request.cookies.get("sb-xxx-auth-token");
  const isPublic = publicRoutes.some(r => request.nextUrl.pathname.startsWith(r));

  if (!session && !isPublic) {
    return NextResponse.redirect(new URL("/login", request.url));
  }
}
```
