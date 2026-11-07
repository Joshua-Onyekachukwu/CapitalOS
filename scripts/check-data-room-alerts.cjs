#!/usr/bin/env node
/**
 * Live check of the data room alert path.
 *
 * Creates a temporary share owned by the E2E account, opens it once (granted),
 * revokes it, then hammers it past the blocked-burst threshold. Asserts that the
 * owner got one open alert and one blocked alert, that concurrent writes of the
 * same (share, kind, bucket) collapse to a single row, and that the access log
 * recorded the denials. Everything it creates is deleted afterwards.
 *
 * Requires ALERTS_CHECK=1 because it writes to the production database.
 *
 * Usage: ALERTS_CHECK=1 node scripts/check-data-room-alerts.cjs
 */

require("dotenv").config({ path: ".env.e2e.local", quiet: true });
require("dotenv").config({ path: ".env.local", quiet: true });
if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
  require("dotenv").config({ path: ".env", quiet: true });
}

const crypto = require("crypto");
const { createClient } = require("@supabase/supabase-js");
const db = require("./db.cjs");

if (process.env.ALERTS_CHECK !== "1") {
  console.error("Refusing to run: set ALERTS_CHECK=1 (this writes and then removes test rows).");
  process.exit(2);
}

const BASE_URL = process.env.E2E_BASE_URL || "https://capital-os-nine.vercel.app";
const EMAIL = process.env.E2E_EMAIL;

if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
  console.error("Supabase service credentials are required (.env.local).");
  process.exit(1);
}

const sp = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
);

const results = [];
function check(name, ok, detail) {
  results.push({ name, ok: Boolean(ok), detail });
  if (!ok) throw new Error(`${name} failed: ${JSON.stringify(detail)}`);
}

const CONCURRENCY_BUCKET = `probe_${Date.now()}`;

(async () => {
  let shareId = null;

  try {
    const users = await db.query(
      "select id from auth.users where lower(email) = lower($1) limit 1",
      [EMAIL]
    );
    if (users.length === 0) throw new Error(`E2E user ${EMAIL} not found`);
    const userId = users[0].id;

    const { data: share, error: shareError } = await sp
      .from("data_room_shares")
      .insert({
        user_id: userId,
        token: crypto.randomBytes(32).toString("base64url"),
        label: "alerts gate check",
        document_ids: [],
        expires_at: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
      })
      .select("id, token")
      .single();
    if (shareError || !share) throw new Error(`could not create share: ${shareError?.message}`);
    shareId = share.id;

    const url = `${BASE_URL}/api/data-room/${share.token}`;

    // 1. A real open: 200 and an "opened" alert.
    const open = await fetch(url, { headers: { "user-agent": "capitalos-alerts-check" } });
    check("granted open returns 200", open.status === 200, open.status);

    const openedAlerts = await db.query(
      "select count(*)::int as n from public.data_room_notifications where share_id = $1 and kind = 'opened'",
      [shareId]
    );
    check("one opened alert", openedAlerts[0].n === 1, openedAlerts[0]);

    // 2. Concurrency: many simultaneous writes of the same key must collapse.
    const writes = Array.from({ length: 12 }, () =>
      sp.from("data_room_notifications").upsert(
        {
          user_id: userId,
          share_id: shareId,
          kind: "opened",
          bucket: CONCURRENCY_BUCKET,
          title: "concurrency probe",
          detail: { summary: "probe" },
        },
        { onConflict: "share_id,kind,bucket", ignoreDuplicates: true }
      )
    );
    await Promise.all(writes);
    const probe = await db.query(
      "select count(*)::int as n from public.data_room_notifications where share_id = $1 and bucket = $2",
      [shareId, CONCURRENCY_BUCKET]
    );
    check("concurrent writes collapse to one row", probe[0].n === 1, probe[0]);
    await db.query(
      "delete from public.data_room_notifications where share_id = $1 and bucket = $2",
      [shareId, CONCURRENCY_BUCKET]
    );

    // 3. Revoke, then hammer it: five blocked attempts trigger one alert.
    const { error: revokeError } = await sp
      .from("data_room_shares")
      .update({ revoked_at: new Date().toISOString() })
      .eq("id", shareId);
    if (revokeError) throw new Error(`could not revoke: ${revokeError.message}`);

    const statuses = [];
    for (let i = 0; i < 6; i++) {
      const response = await fetch(url, { headers: { "user-agent": "capitalos-alerts-check" } });
      statuses.push(response.status);
    }
    check("all blocked attempts return 410", statuses.every((s) => s === 410), statuses);

    const blockedAlerts = await db.query(
      "select count(*)::int as n from public.data_room_notifications where share_id = $1 and kind = 'blocked'",
      [shareId]
    );
    check("one blocked alert after the burst", blockedAlerts[0].n === 1, blockedAlerts[0]);

    const denials = await db.query(
      "select count(*)::int as n from public.data_room_access_log where share_id = $1 and outcome = 'revoked'",
      [shareId]
    );
    check("denials were audited", denials[0].n >= 6, denials[0]);

    console.log(JSON.stringify({ ok: true, baseUrl: BASE_URL, checks: results }, null, 2));
  } finally {
    if (shareId) {
      await db.query("delete from public.data_room_notifications where share_id = $1", [shareId]).catch(() => {});
      await db.query("delete from public.data_room_access_log where share_id = $1", [shareId]).catch(() => {});
      await db.query("delete from public.data_room_shares where id = $1", [shareId]).catch(() => {});
    }
    await db.close();
  }
})().catch((err) => {
  console.error(JSON.stringify({ ok: false, checks: results, error: err.message }, null, 2));
  process.exit(1);
});
