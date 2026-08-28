require("dotenv").config({ path: ".env.local" });
const { createClient } = require("@supabase/supabase-js");
const sp = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

(async () => {
  const tables = [
    "company_profiles", "email_messages", "email_accounts", "campaigns",
    "saved_filters", "audit_log", "acquisition_jobs", "company_team_members",
    "company_documents", "founding_members"
  ];

  for (const t of tables) {
    // Use Supabase REST to get column info via a dummy query
    // We'll just try to select all columns and see what comes back
    const { data, error } = await sp.from(t).select("*").limit(0);
    if (error) {
      // Table might not exist — try insert with minimal data to see column errors
      console.log(`${t}: ${error.message}`);
    } else {
      // Table exists but empty — check schema via raw query
      // Use the information_schema approach
      const { data: cols, error: colErr } = await sp
        .from("information_schema.columns")
        .select("column_name, data_type")
        .eq("table_name", t)
        .order("ordinal_position");

      if (colErr || !cols || cols.length === 0) {
        console.log(`${t}: exists but can't read schema (${colErr?.message || "no columns found"})`);
      } else {
        console.log(`${t}: ${cols.map(c => c.column_name).join(", ")}`);
      }
    }
  }
})();
