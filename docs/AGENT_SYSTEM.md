# Agent System — Capital-OS

## Overview

Capital-OS uses a database-driven agent system where AI agents perform fundraising tasks autonomously (within defined permissions) while the founder retains control over consequential actions.

---

## Agent Organization

```
                    FOUNDER
                       │
                       ▼
              FUNDRAISING COPILOT
                       │
                       ▼
             FUNDRAISING DIRECTOR
                       │
       ┌───────────────┼────────────────┐
       │               │                │
       ▼               ▼                ▼
    STARTUP         INVESTOR         CAMPAIGN
    ANALYST          SCOUT            MANAGER
       │               │                │
       ▼               ▼                ▼
    DOCUMENT        RESEARCH          PIPELINE
    INTELLIGENCE      AGENT           AGENT
                       │
                       ▼
                  MATCHING AGENT
                       │
              ┌────────┴────────┐
              ▼                 ▼
          EMBEDDING          RERANKING
              │                 │
              └────────┬────────┘
                       ▼
                REASONING AGENT
                       │
                       ▼
               OUTREACH STRATEGY
                       │
                       ▼
                OUTREACH WRITER
                       │
                       ▼
                 HUMAN APPROVAL
                       │
                       ▼
                    EMAIL
                       │
                       ▼
                 INVESTOR REPLY
                       │
                       ▼
                  REPLY AGENT
                       │
             ┌─────────┴─────────┐
             ▼                   ▼
          INTERESTED            PASS
             │
             ▼
          MEETING
             │
             ▼
        MEETING AGENT
             │
             ▼
       NEXT ACTIONS
```

---

## Agent Roles

### Fundraising Director

The orchestrator that coordinates all other agents.

**Responsibilities:**
- Understand founder objectives
- Create and delegate tasks
- Monitor task progress
- Detect failures and retry
- Request founder approval
- Summarize results

**Permissions:** Read, Write DB, Modify Pipeline

### Startup Analyst

Understands the founder's startup deeply.

**Responsibilities:**
- Analyze pitch deck and documents
- Build structured startup profile
- Identify strengths and weaknesses
- Determine fundraising requirements

**Permissions:** Read, Write DB

### Investor Scout

Discovers potential investors from multiple sources.

**Responsibilities:**
- Search investor databases
- Find relevant investors
- Deduplicate results
- Initial qualification

**Permissions:** Read, Write DB

### Investor Researcher

Deep-dives into individual investors.

**Responsibilities:**
- Research investor background
- Analyze portfolio
- Find recent activity
- Generate intelligence summary
- Track sources and evidence

**Permissions:** Read, Write DB

### Matching Agent

Determines investor-startup fit.

**Responsibilities:**
- Apply hard filters
- Generate embeddings
- Coordinate reranking
- Calculate fit scores
- Rank and prioritize

**Permissions:** Read, Write DB, Modify Pipeline

### Outreach Strategist

Determines how to approach each investor.

**Responsibilities:**
- Determine optimal approach angle
- Identify relevant portfolio companies
- Suggest personalization points
- Recommend timing

**Permissions:** Read, Write DB

### Outreach Writer

Creates email drafts.

**Responsibilities:**
- Write personalized emails
- Apply founder preferences
- Ensure tone consistency
- Include relevant context

**Permissions:** Read, Write DB

### Reply Agent

Analyzes incoming investor emails.

**Responsibilities:**
- Classify reply type
- Extract key information
- Determine urgency
- Recommend next action

**Permissions:** Read, Write DB, Modify Pipeline

### Follow-Up Agent

Recommends next contact actions.

**Responsibilities:**
- Track conversation state
- Recommend follow-up timing
- Draft follow-up messages
- Respect opt-outs

**Permissions:** Read, Write DB

### Meeting Agent

Prepares meeting materials.

**Responsibilities:**
- Generate meeting briefs
- Summarize meeting notes
- Extract action items
- Track follow-ups

**Permissions:** Read, Write DB

### Compliance Agent

Ensures all actions comply with rules.

**Responsibilities:**
- Check opt-out status
- Verify sending limits
- Validate email addresses
- Flag policy violations

**Permissions:** Read, Write DB

---

## Agent State Machine

### States

```
pending → running → completed
                  → failed → retrying → running
                  → waiting
                  → awaiting_approval → running
                  → cancelled
```

### State Transitions

```
pending
  │ (agent picks up task)
  ▼
running
  │
  ├──→ completed (success)
  │
  ├──→ failed (error)
  │       │
  │       ▼
  │    retrying → running
  │
  ├──→ waiting (depends on another task)
  │
  ├──→ awaiting_approval (needs founder approval)
  │       │ (approved)
  │       ▼
  │     running
  │
  └──→ cancelled (founder cancels)
```

### Database Representation

```sql
agent_tasks (
  id UUID PRIMARY KEY,
  startup_id UUID,
  campaign_id UUID,
  batch_id UUID,           -- Groups related tasks
  agent_type TEXT,
  status TEXT,
  priority INTEGER,
  input_data JSONB,
  output_data JSONB,
  error_message TEXT,
  model_used TEXT,
  attempt_count INTEGER,
  max_attempts INTEGER,
  idempotency_key TEXT UNIQUE,
  created_at TIMESTAMPTZ,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ
)
```

---

## Batch Processing

### Task Creation

When a founder starts investor research for 100 investors:

```sql
-- Create batch
INSERT INTO agent_tasks (startup_id, campaign_id, batch_id, agent_type, status, input_data)
VALUES
  ($startup_id, $campaign_id, $batch_id, 'researcher', 'pending', '{"investor_id": "inv_1"}'),
  ($startup_id, $campaign_id, $batch_id, 'researcher', 'pending', '{"investor_id": "inv_2"}'),
  -- ... 100 tasks
  ($startup_id, $campaign_id, $batch_id, 'researcher', 'pending', '{"investor_id": "inv_100"}');
```

### Progress Tracking

```sql
SELECT
  COUNT(*) FILTER (WHERE status = 'completed') as completed,
  COUNT(*) FILTER (WHERE status = 'failed') as failed,
  COUNT(*) FILTER (WHERE status = 'running') as running,
  COUNT(*) FILTER (WHERE status = 'pending') as pending,
  COUNT(*) as total
FROM agent_tasks
WHERE batch_id = $batch_id;
```

### UI Display

```
Researching investors... 97/100 completed, 3 failed

[View Failed] [Retry Failed] [Cancel Remaining]
```

### Failed Task Handling

When user clicks "View Failed":

```sql
SELECT at.*, i.name as investor_name, i.email
FROM agent_tasks at
JOIN investors i ON i.id = (at.input_data->>'investor_id')::uuid
WHERE at.batch_id = $batch_id
  AND at.status = 'failed';
```

---

## Retry System

### Configuration

Each task supports:
- `attempt_count` — Current attempt number
- `max_attempts` — Maximum retries (default: 3)
- `last_error` — Error message from last failure
- `retry_after` — When to retry (for rate limit errors)

### Retry Logic

```typescript
async function processTask(task: AgentTask) {
  try {
    await updateTaskStatus(task.id, 'running');
    const result = await executeAgent(task);
    await updateTaskStatus(task.id, 'completed', result);
  } catch (error) {
    if (task.attempt_count < task.max_attempts) {
      await updateTaskStatus(task.id, 'retrying', {
        error_message: error.message,
        attempt_count: task.attempt_count + 1,
      });
      // Schedule retry with exponential backoff
      await scheduleRetry(task.id, task.attempt_count);
    } else {
      await updateTaskStatus(task.id, 'failed', {
        error_message: error.message,
      });
      await notifyFounder(task, error);
    }
  }
}
```

### Exponential Backoff

```
Attempt 1: Immediate
Attempt 2: 30 seconds
Attempt 3: 2 minutes
Attempt 4: 8 minutes
Attempt 5: 32 minutes
```

---

## Idempotency

Every task has a unique `idempotency_key` to prevent duplicate processing.

### Key Generation

```typescript
function generateIdempotencyKey(task: AgentTask): string {
  return `${task.agent_type}_${task.startup_id}_${task.input_data.investor_id}_${task.batch_id}`;
}
```

### Processing

```sql
INSERT INTO agent_tasks (..., idempotency_key)
VALUES (..., $key)
ON CONFLICT (idempotency_key) DO NOTHING;
```

---

## Agent Permissions

| Agent | Research | Write DB | Send Email | Modify Pipeline |
|-------|----------|----------|------------|-----------------|
| Scout | Yes | Yes | No | No |
| Researcher | Yes | Yes | No | No |
| Matching | Yes | Yes | No | Yes |
| Writer | Yes | Yes | No | No |
| Reply | Yes | Yes | No | Yes |
| Director | Yes | Yes | No | Yes |

**Critical Rule:** No agent can send first-contact emails without founder approval.

---

## Error Handling

### Error Types

```typescript
enum AgentErrorType {
  MODEL_ERROR = 'model_error',       // NVIDIA API error
  VALIDATION_ERROR = 'validation_error', // Output didn't pass schema
  TIMEOUT = 'timeout',               // API timeout
  RATE_LIMIT = 'rate_limit',         // NVIDIA rate limit
  DATA_ERROR = 'data_error',         // Invalid input data
  UNKNOWN = 'unknown',
}
```

### Error Response

```json
{
  "task_id": "uuid",
  "agent_type": "researcher",
  "error_type": "model_error",
  "error_message": "NVIDIA API returned 429: Rate limit exceeded",
  "attempt_count": 2,
  "max_attempts": 3,
  "retry_after": "2026-08-21T12:45:00Z",
  "investor_name": "Jane Doe",
  "retry_available": true
}
```

### UI Error Display

```
Investor Research failed for 3 investors.

Failed:
• Jane Doe — Rate limit exceeded (retry in 30s)
• John Smith — Timeout (retry available)
• Bob Wilson — Model error (retry available)

[Retry Failed] [View Details] [Cancel]
```

---

## Observation & Monitoring

### Real-time Updates

Use Supabase Realtime to push task updates to the dashboard.

```typescript
// Subscribe to task changes
supabase
  .channel('agent-tasks')
  .on('postgres_changes', {
    event: '*',
    schema: 'public',
    table: 'agent_tasks',
    filter: `batch_id=eq.${batchId}`,
  }, handleTaskUpdate)
  .subscribe();
```

### AI Activity Center

```
12:41 — Investor Research Agent
Completed research on 25 investors.
Duration: 3m 42s

12:43 — Matching Agent
Found 8 high-fit investors.
Top match: Jane Doe (94/100)

12:45 — Outreach Agent
Prepared 5 email drafts.
Status: Awaiting founder approval
```

### Metrics to Track

- Task completion rate
- Average task duration
- Error rate by agent type
- Retry rate
- Model usage and costs
- Token consumption per task
