#!/usr/bin/env node
/**
 * Live two-account verification of the tenant scoping fixes.
 *
 * Creates two disposable confirmed users, gives each a campaign, sequence and
 * a scheduled enrollment, then runs the same scoped predicates the services
 * use and asserts neither account can see the other's row. Everything is
 * removed in `finally`, including the users.
 *
 * H1 (`job_queue`) cannot be exercised here: that table does not exist in the
 * database (only `background_jobs` does), so the jobs API is dead code until
 * the owner decides whether to rebuild or repoint it.
 *
 * Usage: node scripts/verify-tenant-isolation.cjs
 */

require("dotenv").config({ path: ".env.local", quiet: true });
if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
  require("dotenv").config({ path: ".env", quiet: true });
}

const crypto = require("crypto");
const { createClient } = require("@supabase/supabase-js");
const { query, close } = require("./db.cjs");

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!URL || !SERVICE_KEY) {
  console.error("NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set");
  process.exit(1);
}

const admin = createClient(URL, SERVICE_KEY, { auth: { persistSession: false } });
const stamp = Date.now();
const results = {
  checks: [],
  created: { users: [], enrollments: [], sequences: [], campaigns: [], providers: [] },
};

function check(name, pass, detail) {
  results.checks.push({ name, pass, detail });
}

async function makeUser(label) {
  const email = `tenant-check-${label}-${stamp}@capitalos.test`;
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password: `${crypto.randomBytes(24).toString("base64url")}aA1!`,
    email_confirm: true,
    user_metadata: { full_name: `Tenant Check ${label}`, purpose: "tenant isolation verification" },
  });
  if (error || !data?.user) throw new Error(`create ${label}: ${error?.message || "no user"}`);
  results.created.users.push(data.user.id);
  return data.user.id;
}

async function makeProvider() {
  const [provider] = await query(
    `INSERT INTO data_providers (name, display_name, provider_type, status)
     VALUES ($1, $2, 'investor_data', 'active') RETURNING id`,
    [`tenant-check-${stamp}`, `Tenant Check ${stamp}`]
  );
  results.created.providers.push(provider.id);
  return provider.id;
}

async function makePipeline(userId, providerId) {
  const [campaign] = await query(
    `INSERT INTO data_acquisition_jobs (provider_id, job_type, status)
     VALUES ($1, 'investor_search', 'pending') RETURNING id`,
    [providerId]
  );
  results.created.campaigns.push(campaign.id);

  const [sequence] = await query(
    `INSERT INTO campaign_sequences
       (campaign_id, user_id, name, status, total_steps, total_enrolled, total_completed, total_replies, stop_on_reply)
     VALUES ($1, $2, $3, 'draft', 0, 0, 0, 0, true) RETURNING id`,
    [campaign.id, userId, `tenant-check-${stamp}`]
  );
  results.created.sequences.push(sequence.id);
  return { campaignId: campaign.id, sequenceId: sequence.id };
}

async function makeEnrollment(userId, campaignId, sequenceId, investorId) {
  const [row] = await query(
    `INSERT INTO campaign_sequence_enrollments
       (sequence_id, investor_id, campaign_id, user_id, current_step, status, next_send_at)
     VALUES ($1, $2, $3, $4, 1, 'scheduled', NOW() - INTERVAL '1 minute') RETURNING id`,
    [sequenceId, investorId, campaignId, userId]
  );
  results.created.enrollments.push(row.id);
  return row.id;
}

// The exact shape of getPendingSends' scoped query (sequence.ts).
const pendingFor = (userId, limit = 50) =>
  query(
    `SELECT e.id, e.user_id
       FROM campaign_sequence_enrollments e
       INNER JOIN investors i ON e.investor_id = i.id
       INNER JOIN campaign_sequences cs ON e.sequence_id = cs.id
      WHERE e.status = 'scheduled' AND e.next_send_at <= NOW() AND e.user_id = $2
      LIMIT $1`,
    [limit, userId]
  );

(async () => {
  try {
    const [investor] = await query(
      `SELECT id, email FROM investors WHERE email IS NOT NULL AND email <> '' LIMIT 1`
    );
    if (!investor) throw new Error("no investor with an email to enroll");

    const userA = await makeUser("a");
    const userB = await makeUser("b");
    const provider = await makeProvider();
    const pipeA = await makePipeline(userA, provider);
    const pipeB = await makePipeline(userB, provider);

    const enrollA = await makeEnrollment(userA, pipeA.campaignId, pipeA.sequenceId, investor.id);
    const enrollB = await makeEnrollment(userB, pipeB.campaignId, pipeB.sequenceId, investor.id);

    // Baseline: the unqualified query really does contain both rows, so a
    // passing scoped check is not passing on an empty table.
    const [both] = await query(
      `SELECT count(*)::int AS n FROM campaign_sequence_enrollments WHERE id = ANY($1::uuid[])`,
      [[enrollA, enrollB]]
    );
    check("setup produced two rows", both.n === 2, { rows: both.n });

    const aRows = await pendingFor(userA);
    const bRows = await pendingFor(userB);

    check(
      "A's pending sends contain only A's enrollment",
      aRows.length === 1 && aRows[0].id === enrollA,
      { ids: aRows.map((r) => r.id), expected: enrollA }
    );
    check(
      "B's pending sends contain only B's enrollment",
      bRows.length === 1 && bRows[0].id === enrollB,
      { ids: bRows.map((r) => r.id), expected: enrollB }
    );

    // A sender iterating A's list can never touch B's row.
    const foreign = await query(
      `SELECT id FROM campaign_sequence_enrollments WHERE id = $1 AND user_id = $2`,
      [enrollB, userA]
    );
    check("A cannot address B's enrollment by id", foreign.length === 0, { matches: foreign.length });

    results.ok = results.checks.every((c) => c.pass);
    console.log(JSON.stringify(results, null, 2));
  } catch (err) {
    console.error("verification failed:", err instanceof Error ? err.message : err);
    process.exitCode = 1;
  } finally {
    // Children first; users would otherwise be blocked by FKs.
    for (const id of results.created.enrollments) {
      await query(`DELETE FROM campaign_sequence_enrollments WHERE id = $1`, [id]).catch(() => {});
    }
    for (const id of results.created.sequences) {
      await query(`DELETE FROM campaign_sequences WHERE id = $1`, [id]).catch(() => {});
    }
    for (const id of results.created.campaigns) {
      await query(`DELETE FROM data_acquisition_jobs WHERE id = $1`, [id]).catch(() => {});
    }
    for (const id of results.created.providers) {
      await query(`DELETE FROM data_providers WHERE id = $1`, [id]).catch(() => {});
    }
    for (const id of results.created.users) {
      const { error } = await admin.auth.admin.deleteUser(id);
      if (error) console.error(`cleanup: could not delete user ${id.slice(0, 8)}…: ${error.message}`);
    }
    await Promise.race([close(), new Promise((r) => setTimeout(r, 5000))]);
    process.exit(results.ok ? 0 : 1);
  }
})();
