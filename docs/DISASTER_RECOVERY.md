# Disaster Recovery — Capital-OS

## Overview

This document covers backup strategies, recovery procedures, and business continuity for Capital-OS.

---

## Backup Strategy

### Supabase Automatic Backups

Supabase Pro plan includes:
- **Daily automatic backups** — 7-day retention
- **Point-in-time recovery** — Restore to any point in the last 7 days

### Manual Backups

For additional safety, create weekly manual backups:

```bash
#!/bin/bash
# scripts/backup.sh

DATE=$(date +%Y%m%d)
BACKUP_FILE="backup_${DATE}.dump"

# Export database
pg_dump \
  -h db.xxx.supabase.co \
  -U postgres \
  -F c \
  -f "/tmp/${BACKUP_FILE}" \
  postgres

# Upload to separate storage (e.g., AWS S3, Google Cloud Storage)
aws s3 cp "/tmp/${BACKUP_FILE}" s3://capitalos-backups/${BACKUP_FILE}

# Cleanup
rm "/tmp/${BACKUP_FILE}"

echo "Backup completed: ${BACKUP_FILE}"
```

### What to Back Up

| Data | Method | Frequency |
|------|--------|-----------|
| Database | Supabase auto-backup | Daily |
| Database | Manual pg_dump | Weekly |
| Storage files | Supabase storage | Daily (auto) |
| Environment variables | Vercel dashboard | Manual |
| Code | GitHub | On every push |

---

## Recovery Scenarios

### Scenario 1: Accidental Data Deletion

**Impact:** User accidentally deletes startup data

**Recovery:**

1. Check audit logs to identify what was deleted and when
2. Use Supabase point-in-time recovery to restore to before deletion
3. Verify data integrity
4. Communicate to affected user

**Time to recover:** ~15 minutes

```sql
-- Check audit logs for deletion
SELECT * FROM audit_logs
WHERE action = 'delete'
  AND entity_type = 'startup'
  AND created_at > now() - INTERVAL '24 hours'
ORDER BY created_at DESC;
```

### Scenario 2: Database Corruption

**Impact:** Data integrity compromised

**Recovery:**

1. Stop application (maintenance mode)
2. Take a backup of current state
3. Restore from latest clean backup
4. Apply any recoverable transactions
5. Verify data integrity
6. Resume application

**Time to recover:** ~1 hour

### Scenario 3: Supabase Outage

**Impact:** Application unavailable

**Recovery:**

1. Check [status.supabase.com](https://status.supabase.com)
2. Show maintenance page
3. Wait for Supabase to recover
4. Verify application functionality
5. Process any queued tasks

**Time to recover:** Depends on Supabase

### Scenario 4: Vercel Outage

**Impact:** Frontend unavailable

**Recovery:**

1. Check [vercel.status.com](https://vercel.status.com)
2. API routes still work if Supabase is up
3. Wait for Vercel to recover
4. Verify deployment health

### Scenario 5: NVIDIA API Outage

**Impact:** AI features unavailable

**Recovery:**

1. Enable graceful degradation
2. Non-AI features continue working
3. Queue AI tasks for later processing
4. Resume when NVIDIA recovers

```typescript
// Graceful degradation
async function handleAIFeature(request: Request) {
  try {
    return await processWithAI(request);
  } catch (error) {
    if (error.status === 503) {
      // Queue for later
      await queueTask(request);
      return { status: 'queued', message: 'AI temporarily unavailable. Your request has been queued.' };
    }
    throw error;
  }
}
```

### Scenario 6: Security Breach

**Impact:** Unauthorized access

**Recovery:**

1. Immediately rotate all API keys and secrets
2. Revoke all active sessions
3. Check audit logs for unauthorized access
4. Notify affected users
5. Review and patch vulnerability
6. Enable enhanced monitoring

```bash
# Rotate Supabase keys via dashboard
# Rotate NVIDIA API key via build.nvidia.com
# Reset all user sessions
# Deploy emergency security patch
```

---

## Maintenance Mode

### Enable Maintenance Mode

```typescript
// middleware.ts
const MAINTENANCE_MODE = process.env.MAINTENANCE_MODE === 'true';

export function middleware(request: NextRequest) {
  if (MAINTENANCE_MODE && !request.nextUrl.pathname.startsWith('/maintenance')) {
    return NextResponse.redirect(new URL('/maintenance', request.url));
  }
}
```

### Maintenance Page

Create `/app/maintenance/page.tsx` with:
- Status message
- Expected恢复 time
- Contact information
- Status page link

---

## Data Integrity Checks

### Weekly Integrity Verification

```sql
-- Check for orphaned records
SELECT ci.id, ci.campaign_id, ci.investor_id
FROM campaign_investors ci
LEFT JOIN campaigns c ON c.id = ci.campaign_id
WHERE c.id IS NULL;

-- Check for emails without threads
SELECT e.id, e.thread_id
FROM emails e
LEFT JOIN email_threads et ON et.id = e.thread_id
WHERE e.thread_id IS NOT NULL AND et.id IS NULL;

-- Check for agent tasks stuck in running
SELECT id, agent_type, started_at, now() - started_at as duration
FROM agent_tasks
WHERE status = 'running'
  AND started_at < now() - INTERVAL '1 hour';
```

### Data Consistency Monitoring

```sql
-- Daily consistency report
SELECT
  'startups' as entity, COUNT(*) as total FROM startups
UNION ALL
SELECT 'campaigns', COUNT(*) FROM campaigns
UNION ALL
SELECT 'investors', COUNT(*) FROM investors
UNION ALL
SELECT 'emails', COUNT(*) FROM emails
UNION ALL
SELECT 'agent_tasks', COUNT(*) FROM agent_tasks
WHERE status = 'running' AND started_at < now() - INTERVAL '1 hour';
```

---

## Communication Plan

### During Outage

1. **Internal:** Slack notification to team
2. **External:** Status page update
3. **Email:** Notify affected users if prolonged

### After Recovery

1. Post-mortem document
2. User communication
3. Process improvements

---

## Quarterly Recovery Drill

Every quarter:

1. Test backup restoration on staging
2. Verify point-in-time recovery works
3. Test rollback procedures
4. Review and update this document
5. Update contact information

---

## Contact Information

| Service | Support |
|---------|---------|
| Supabase | [supabase.com/support](https://supabase.com/support) |
| Vercel | [vercel.com/support](https://vercel.com/support) |
| NVIDIA | [build.nvidia.com/support](https://build.nvidia.com/support) |
| Sentry | [sentry.io/support](https://sentry.io/support) |
