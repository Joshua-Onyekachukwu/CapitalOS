// =============================================
// Privacy Pack — export & erasure of a founder's data
// =============================================
// Phase 3 (privacy pack): every founder can export everything Capital OS
// holds about them and delete their account. Data lives in per-user tables;
// this module owns the table lists and the deletion order so foreign-key
// chains are removed children-first.
//
// Retention policy: financial/audit records (user_subscriptions,
// billing_events, credit_ledger, founding_members, admin_audit_log) are NOT
// deleted on request — they are pseudonymous financial records kept for
// Stripe/billing integrity and admin audit. Everything else is erased and
// the auth user is deleted.
// (service-role clients are untyped generic mirrors; param typed any to
// avoid generic-parameter mismatches across createClient call sites)

const PAGE = 1000;

// Every table holding the founder's data (service-role read). Credentials are
// stripped from email_accounts in the export payload.
export const USER_DATA_TABLES = [
  "email_health_scores",
  "email_threads",
  "pipeline_events",
  "campaign_sequences",
  "user_subscriptions",
  "investor_search_history",
  "reply_insights",
  "email_health_events",
  "email_warmup",
  "audit_log",
  "email_tracking_events",
  "email_messages",
  "company_profiles",
  "background_jobs",
  "admin_audit_log",
  "email_domain_health",
  "campaigns",
  "copilot_conversations",
  "billing_events",
  "campaign_sequence_emails",
  "credit_ledger",
  "founding_members",
  "saved_investors",
  "email_suppression_list",
  "campaign_sequence_enrollments",
  "user_pipeline_entries",
  "email_sending_log",
  "saved_filters",
  "email_accounts",
] as const;

// Deletion order: children before parents (FK constraints in the live schema).
export const USER_TABLE_DELETE_ORDER = [
  "pipeline_events",
  "user_pipeline_entries",
  "email_tracking_events",
  "email_sending_log",
  "email_health_scores",
  "email_health_events",
  "email_domain_health",
  "reply_insights",
  "campaign_sequence_emails",
  "campaign_sequence_enrollments",
  "campaign_sequences",
  "email_messages",
  "email_threads",
  "email_warmup",
  "email_suppression_list",
  "campaigns",
  "email_accounts",
  "copilot_conversations",
  "investor_search_history",
  "saved_filters",
  "saved_investors",
  "company_profiles",
  "background_jobs",
  "audit_log",
] as const;

/** Fields never exported (credentials / secrets). */
const EMAIL_ACCOUNT_EXPORT_REDACTIONS = ["access_token", "refresh_token", "smtp_pass_encrypted"];

/**
 * Export every row of every user-scoped table for `userId`. Pagination loops
 * (PostgREST caps at 1000 rows/request). email_accounts credentials are
 * redacted; retained financial/audit rows are exported too (transparency).
 */
export async function exportUserData(
  sp: any,
  userId: string
): Promise<{ data: Record<string, unknown[]>; tables: Record<string, string | true> }> {
  const out: Record<string, unknown[]> = {};
  const tables: Record<string, string | true> = {};

  for (const name of USER_DATA_TABLES) {
    try {
      let rows: unknown[] = [];
      for (let from = 0; ; from += PAGE) {
        const { data, error } = await sp
          .from(name)
          .select("*", { count: "exact" })
          .eq("user_id", userId)
          .range(from, from + PAGE - 1);
        if (error) throw error;
        rows = rows.concat(data || []);
        if (!data || data.length < PAGE) break;
      }

      if (name === "email_accounts") {
        rows = (rows as Record<string, unknown>[]).map((row) => {
          const clean = { ...row };
          for (const f of EMAIL_ACCOUNT_EXPORT_REDACTIONS) {
            if (f in clean) clean[f] = "<redacted>";
          }
          return clean;
        });
      }

      out[name] = rows;
      tables[name] = true;
    } catch (err) {
      out[name] = [];
      tables[name] = `skipped: ${(err as Error)?.message || "unknown error"}`;
    }
  }

  return { data: out, tables };
}

/**
 * Delete the founder's rows from every erasable table (children-first) and
 * report per-table counts/errors. The caller is responsible for deleting the
 * auth user via the admin API afterwards.
 */
export async function deleteUserData(
  sp: any,
  userId: string
): Promise<{ deleted: Record<string, number>; errors: Record<string, string> }> {
  const deleted: Record<string, number> = {};
  const errors: Record<string, string> = {};

  for (const name of USER_TABLE_DELETE_ORDER) {
    try {
      const { error, count } = await sp
        .from(name)
        .delete({ count: "exact" })
        .eq("user_id", userId);
      if (error) throw error;
      deleted[name] = count || 0;
    } catch (err) {
      errors[name] = (err as Error)?.message || "unknown error";
    }
  }

  return { deleted, errors };
}

/** The only confirmation string accepted for deletion. */
export const DELETE_CONFIRMATION = "DELETE MY ACCOUNT";
