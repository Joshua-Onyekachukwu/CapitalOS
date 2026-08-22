# Capital OS — Email & Outreach System

## Overview

The Email & Outreach System enables founders to connect their email accounts, draft personalized investor emails with AI, send them through the platform, and track communication history.

## Email Account Connection

### Supported Providers

| Provider | OAuth Flow | Status |
|----------|-----------|--------|
| Google Gmail | OAuth 2.0 → Gmail API | ✅ Built |
| Microsoft Outlook | OAuth 2.0 → Microsoft Graph | ✅ Built |

### OAuth Flow

```
User clicks "Connect Email"
     ↓
Redirect to provider OAuth consent screen
     ↓
User authorizes (send + read permissions only)
     ↓
Callback route receives authorization code
     ↓
Exchange code for access + refresh tokens
     ↓
Encrypt tokens (AES-256-GCM)
     ↓
Store in email_accounts table
     ↓
Email account is now active
```

### Security

- Tokens encrypted at rest with AES-256-GCM
- Encryption key stored in `EMAIL_TOKEN_ENCRYPTION_KEY` env var
- OAuth scopes limited to `send` + `read` only
- No access to contacts, calendar, or other data
- Tokens never exposed to client bundle

## Email Sending

### API Route

`POST /api/outreach/send`

### Flow

```
Client sends: { userId, investorId, subject, bodyHtml, bodyText }
     ↓
API route fetches investor email from Supabase
     ↓
API route fetches connected email account
     ↓
Decrypt OAuth token
     ↓
Send via Gmail API or Microsoft Graph
     ↓
Log to email_messages table
     ↓
Return success/failure
```

## AI Email Drafting

### API Route

`POST /api/outreach/draft`

### Flow

```
Client sends: { investorName, investorFirm, investorType, fitScore, tone }
     ↓
Server calls NVIDIA NIM with email_drafting task
     ↓
AI generates personalized email
     ↓
Parse JSON response (subject + body)
     ↓
Return to client for review
```

### Credit Cost: 3 credits per draft

## Outreach Page

The Outreach page (`/dashboard/outreach`) provides:

1. **Investor list** — Investors with email addresses, sorted by fit score
2. **Draft management** — Drafts, Approved, Sent, Replies tabs
3. **AI regeneration** — Click "Regenerate with AI" for new draft
4. **Approval workflow** — Draft → Approve → Send
5. **Email preview** — See subject and body before sending
6. **AI analysis** — Shows investor type and fit score context

### Workflow

```
Select investor → AI generates draft → Founder reviews →
  ├── Edit manually → Approve → Send
  ├── Regenerate with AI → Review → Approve → Send
  └── Reject → Select different investor
```

## Email History

Every sent email is logged to `email_messages` with:
- Direction (outbound/inbound)
- Subject, body (HTML + text)
- From/to addresses
- Status (draft → sent → delivered → opened → replied)
- Timestamps (sent, opened, replied)
- AI generation flag
- Investor association

## Campaign System

Campaigns organize investors into outreach batches:

| Stage | Description |
|-------|-------------|
| Discovered | Added to campaign |
| Qualified | Fit analysis completed |
| Outreach | Email sent |
| Interested | Responded positively |
| Meeting | Meeting scheduled |
| Closed | Deal closed |
| Rejected | Passed on this investor |

## Rate Limiting

- Email sending rate-limited per account (provider limits)
- AI drafting rate-limited by credit balance
- API routes have server-side rate limiting

## Human-in-the-Loop Rules

| Action | Requires Approval |
|--------|------------------|
| AI email draft | ✅ Always reviewed before sending |
| Send email | ✅ Always requires explicit "Send" click |
| Regenerate email | ✅ Always requires click |
| Delete draft | ✅ Confirmation required |
| Bulk send | ❌ Not yet implemented |

---

*Last updated: August 22, 2026*
