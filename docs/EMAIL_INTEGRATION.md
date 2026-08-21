# Email Integration — Capital-OS

## Overview

Capital-OS abstracts the email provider behind a common interface. V1 uses Resend for sending with polling/webhook for receiving. Gmail and Outlook integration planned for V2.

---

## Provider Architecture

### Provider Interface

```typescript
interface EmailProvider {
  // Authentication
  getAuthUrl(): string;
  handleCallback(code: string): Promise<AuthTokens>;
  refreshToken(token: string): Promise<AuthTokens>;

  // Sending
  sendEmail(params: SendEmailParams): Promise<SendResult>;

  // Receiving
  syncEmails(since?: Date): Promise<Email[]>;
  watchForChanges(): Promise<void>;

  // Events
  parseWebhook(payload: unknown): Promise<EmailEvent>;

  // Tracking
  trackOpen(messageId: string): Promise<boolean>;
  trackClick(messageId: string): Promise<boolean>;
}
```

### V1: Resend (Sending)

```typescript
// lib/email/resend-provider.ts
class ResendProvider implements EmailProvider {
  async sendEmail(params: SendEmailParams): Promise<SendResult> {
    const result = await resend.emails.send({
      from: params.from,
      to: params.to,
      subject: params.subject,
      html: params.html,
      text: params.text,
      headers: {
        'List-Unsubscribe': `<${params.unsubscribeUrl}>`,
      },
    });
    return { messageId: result.id, status: 'sent' };
  }
}
```

### V2: Gmail (OAuth + Pub/Sub)

```typescript
// Future implementation
class GmailProvider implements EmailProvider {
  async getAuthUrl(): Promise<string> {
    return oauth2Client.generateAuthUrl({
      scope: ['https://www.googleapis.com/auth/gmail.send',
              'https://www.googleapis.com/auth/gmail.readonly'],
    });
  }
}
```

### V2: Outlook (Microsoft Graph)

```typescript
// Future implementation
class OutlookProvider implements EmailProvider {
  async getAuthUrl(): Promise<string> {
    return msalClient.getAuthCodeUrl({
      scopes: ['Mail.Send', 'Mail.Read'],
    });
  }
}
```

---

## Email Data Model

### Email Record

```sql
emails (
  id UUID PRIMARY KEY,
  startup_id UUID,
  campaign_id UUID,
  investor_id UUID,
  thread_id UUID,
  message_id TEXT UNIQUE,
  provider_message_id TEXT,
  sender TEXT,
  recipient TEXT,
  subject TEXT,
  body TEXT,
  body_html TEXT,
  status TEXT,        -- draft, scheduled, sending, sent, delivered, bounced, failed
  direction TEXT,     -- outbound, inbound
  ai_generated BOOLEAN,
  founder_edited BOOLEAN,
  approved_by UUID,
  approved_at TIMESTAMPTZ,
  sent_at TIMESTAMPTZ,
  received_at TIMESTAMPTZ,
  opened_at TIMESTAMPTZ,
  clicked_at TIMESTAMPTZ,
  bounce_reason TEXT,
  metadata JSONB
)
```

### Thread Model

```sql
email_threads (
  id UUID PRIMARY KEY,
  startup_id UUID,
  campaign_id UUID,
  investor_id UUID,
  subject TEXT,
  last_message_at TIMESTAMPTZ,
  message_count INTEGER,
  status TEXT           -- active, closed, archived
)
```

---

## Email Sending Flow

### First-Contact Email

```
AI Draft Generated
        │
        ▼
┌─────────────────┐
│ Founder Review   │ ── Edit, approve, or reject
└────────┬────────┘
         │ (approved)
         ▼
┌─────────────────┐
│ Compliance Check │
│ • Not opted out  │
│ • Not suppressed │
│ • Rate limit OK  │
│ • Valid email    │
│ • Campaign active│
└────────┬────────┘
         │ (all pass)
         ▼
┌─────────────────┐
│ Send via Resend  │
│ • Unsubscribe    │
│ • Tracking pixel │
│ • Thread ID      │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Store Record     │
│ • status: sent   │
│ • sent_at: now   │
│ • thread_id      │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Audit Log        │
│ • action: sent   │
│ • entity: email  │
└─────────────────┘
```

### Follow-Up Email

```
Follow-Up Agent Recommends
        │
        ▼
┌─────────────────┐
│ Founder Approval │ ── Required for V1
└────────┬────────┘
         │ (approved)
         ▼
┌─────────────────┐
│ Same as above    │
│ + Reply context  │
│ + Thread linking │
└─────────────────┘
```

---

## Reply Detection (V1)

### Hybrid Polling + Webhook

**Primary: Polling every 5 minutes**

Supabase Edge Function + pg_cron:

```sql
-- Schedule polling every 5 minutes
SELECT cron.schedule(
  'poll-emails',
  '*/5 * * * *',
  $$
  SELECT net.http_post(
    url := current_setting('app.settings.edge_function_url') || '/poll-emails',
    headers := '{"Authorization": "Bearer " || current_setting('app.settings.service_role_key')}',
    body := '{}'::jsonb
  );
  $$
);
```

**Polling Edge Function:**

```typescript
// supabase/functions/poll-emails/index.ts
Deno.serve(async (req) => {
  const lastSync = await getLastSyncTime();
  const emails = await emailProvider.syncEmails(lastSync);

  for (const email of emails) {
    // Idempotency check
    const exists = await checkProcessedEvent(email.messageId);
    if (exists) continue;

    // Store raw email
    await storeEmail(email);

    // Classify with AI
    const classification = await classifyReply(email);

    // Update pipeline
    await updatePipeline(email.investorId, classification);

    // Mark as processed
    await markEventProcessed(email.messageId);
  }

  return new Response('OK');
});
```

### Reply Processing Flow

```
Email Received
      │
      ▼
┌─────────────────┐
│ Validate Event   │ ── Check sender, verify signature
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Idempotency     │ ── Check processed_events
└────────┬────────┘
         │ (new event)
         ▼
┌─────────────────┐
│ Store Raw Email │ ── Save to emails table
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ AI Classification│ ── Classify reply type
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Update Pipeline │ ── Move investor stage
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Create Action   │ ── Follow-up recommendation
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Notify Founder  │ ── Realtime + notification
└─────────────────┘
```

---

## Reply Classification

### Categories

| Category | Description | Pipeline Action |
|----------|-------------|-----------------|
| Interested | Positive response | → interested |
| Very Interested | Strong enthusiasm | → interested |
| Request More Info | Wants details | → replied |
| Request Pitch Deck | Wants deck | → replied |
| Request Meeting | Wants to meet | → meeting_scheduled |
| Question | Has questions | → replied |
| Maybe Later | Not now | → follow_up |
| Follow-up Later | Reconnect later | → follow_up |
| Passed | Not interested | → passed |
| Not a Fit | Wrong fit | → not_a_fit |
| Opt-Out | Remove me | → opted_out |
| Unclear | Can't determine | → replied |

### Opt-Out Hard Stop

If any of these phrases are detected:

- "Stop contacting me"
- "Remove me"
- "Don't email me"
- "Unsubscribe"
- "No further communication"

Immediately:
```sql
UPDATE investors SET do_not_contact = true WHERE id = $investor_id;
INSERT INTO suppression_list (investor_id, email, reason, source)
VALUES ($investor_id, $email, 'opt_out', 'ai_classification');
```

---

## Email Structure (AI-Generated)

### First-Contact Email

```
Subject: [Personalized, specific]

[Personalized opening — reference investor's specific thesis/portfolio]

[Why we're reaching out — 1-2 sentences on relevance]

[Startup explanation — problem + solution in 2-3 sentences]

[Why this investor specifically — concrete reason, not generic]

[Traction / proof — key metrics or milestones]

[Fundraising ask — amount, stage, what you're looking for]

[Simple CTA — would love 15 minutes to share more]

[Founder signature]
```

### Personalization Inputs

```typescript
const emailContext = {
  startup: {
    name, problem, solution, traction, stage, amountRaising
  },
  investor: {
    name, firm, thesis, portfolio, recentActivity,
    partnerInterests, relevantCompanies
  },
  strategy: {
    recommendedAngle, personalizationPoints,
    tone, keyMessage
  },
  founderPreferences: {
    emailLength, emailTone, signOff, customNotes
  }
};
```

---

## Email Deliverability (V1)

### Pre-Send Checks

1. **DNS Verification** — SPF, DKIM, DMARC records
2. **Email Format** — Valid syntax
3. **Domain Health** — No blacklisting
4. **Unsubscribe Link** — Required in all emails
5. **Content Check** — No spam trigger words

### Bounce Handling

```
Hard Bounce:
  → email_status = invalid
  → investor.contact_status = 'invalid'
  → Block future automated outreach

Soft Bounce:
  → Retry once
  → If repeated: treat as hard bounce
```

---

## Rate Limiting

### Default Limits

```sql
-- Conservative defaults
INSERT INTO rate_config (action_type, limit_per_hour, limit_per_day) VALUES
  ('email_send', 20, 100),
  ('email_send_campaign', 50, 200);
```

### Implementation

```typescript
async function checkRateLimit(userId: string, action: string): Promise<boolean> {
  const oneHourAgo = new Date(Date.now() - 3600000);

  const { count } = await supabase
    .from('rate_limits')
    .select('count', { count: 'exact' })
    .eq('user_id', userId)
    .eq('action_type', action)
    .gte('window_start', oneHourAgo);

  return count < getLimit(action);
}
```

---

## Unsubscribe

Every outbound email includes:

```html
<p style="font-size: 12px; color: #999;">
  Don't want to receive emails from us?
  <a href="https://app.capitalos.com/unsubscribe?token=...">Unsubscribe</a>
</p>
```

Unsubscribe endpoint:

```typescript
// app/api/unsubscribe/route.ts
export async function GET(req: Request) {
  const token = new URL(req.url).searchParams.get('token');
  const { investor_id, email } = verifyUnsubscribeToken(token);

  // Mark investor as opted out
  await supabase
    .from('investors')
    .update({ do_not_contact: true })
    .eq('id', investor_id);

  // Add to suppression list
  await supabase
    .from('suppression_list')
    .insert({ investor_id, email, reason: 'opt_out', source: 'unsubscribe_link' });

  return new Response('You have been unsubscribed.');
}
```

---

## Batch Approval

For sending multiple emails at once:

```
18 drafts ready

┌─────────────────────────────────────────────┐
│ Select All  │  Investor 1  [✓]              │
│             │  Investor 2  [✓]              │
│             │  Investor 3  [ ]              │
│             │  Investor 4  [✓]              │
└─────────────────────────────────────────────┘

18 emails | 18 recipients | Personalization verified
0 opt-outs | 0 invalid addresses

[Approve Selected (3)] [Approve All (18)] [Cancel]
```

### Pre-Send Batch Validation

```typescript
async function validateBatch(emails: EmailDraft[]): Promise<BatchValidation> {
  const results = {
    total: emails.length,
    valid: 0,
    optOuts: 0,
    invalidAddresses: 0,
    rateLimited: false,
    errors: [] as string[],
  };

  for (const email of emails) {
    const investor = await getInvestor(email.investor_id);

    if (investor.do_not_contact) {
      results.optOuts++;
      continue;
    }

    if (investor.contact_status === 'invalid') {
      results.invalidAddresses++;
      continue;
    }

    const rateOk = await checkRateLimit(email.user_id, 'email_send');
    if (!rateOk) {
      results.rateLimited = true;
      continue;
    }

    results.valid++;
  }

  return results;
}
```
