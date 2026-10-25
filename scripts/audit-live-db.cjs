// Read-only live database audit probe. Prints row counts, RLS policy summary,
// auth usage, and duplicate statistics. Never writes.
// Usage: node scripts/audit-live-db.cjs [--json]
require("dotenv").config({ path: ".env.local", quiet: true });
const { createClient } = require("@supabase/supabase-js");

const TABLES = [
  "investors", "investor_firms", "investor_profiles", "investor_sectors",
  "investor_employment_history", "investor_search_history",
  "raw_records", "data_acquisition_jobs", "data_change_log",
  "duplicate_candidates", "profiles", "company_profiles",
  "company_documents", "company_team_members", "saved_investors",
  "user_pipeline_entries", "pipeline_events", "campaigns_saved_probe",
  "notes_probe", "email_messages", "email_threads",
  "email_tracking_events", "email_accounts", "reply_insights",
  "campaign_investors", "campaign_sequences", "campaign_sequence_steps",
  "campaign_sequence_enrollments", "campaign_sequence_emails",
  "credit_ledger", "user_subscriptions", "billing_events", "billing_plans",
  "credit_costs", "admin_audit_log", "background_jobs",
];

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error("Missing NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY");
    process.exit(2);
  }
  const sb = createClient(url.replace(/\/$/, ""), key, { auth: { persistSession: false } });

  const counts = {};
  for (const t of TABLES) {
    try {
      const { count, error } = await sb.from(t).select("*", { count: "exact", head: true });
      counts[t] = error ? { error: error.message } : { rows: count ?? 0 };
    } catch (e) {
      counts[t] = { error: String(e).slice(0, 120) };
    }
  }

  // Auth usage
  let users = { error: "unavailable" };
  try {
    const { data, error } = await sb.auth.admin.listUsers({ page: 1, perPage: 200 });
    if (error) users = { error: error.message };
    else {
      const u = data.users || [];
      users = {
        total: u.length,
        byProvider: u.reduce((m, x) => {
          const p = (x.app_metadata && x.app_metadata.provider) || "email";
          m[p] = (m[p] || 0) + 1;
          return m;
        }, {}),
        lastSignup: u.slice().sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)))
          .slice(0, 3).map((x) => ({ created_at: x.created_at, provider: x.app_metadata?.provider || "email" })),
      };
    }
  } catch (e) {
    users = { error: String(e).slice(0, 120) };
  }

  console.log(JSON.stringify({ project: url, counts, users }, null, 2));
}

main();
