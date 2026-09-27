#!/usr/bin/env node
/**
 * Keep the Vercel project's Supabase env vars in sync with the repo secrets,
 * and guarantee a fresh production build whenever they change.
 *
 * Why the fingerprint var: the Vercel REST API never returns plaintext for
 * stored encrypted env values, so "read Vercel and compare" is impossible
 * for secrets. Instead we persist a SHA-256 fingerprint of the desired
 * values as a dedicated PLAIN env var (CI_ENV_FINGERPRINT) on the Vercel
 * project itself — plain values are readable via the API, so drift
 * detection needs no external state and no extra GitHub permissions. A run
 * deploys only when the fingerprint of the current secrets differs from the
 * stored one — i.e. exactly when someone rotated a secret in the repo.
 *
 * This closes the failure mode from 2026-09-27 where production served a
 * bundle baked with a dead Supabase project ref: NEXT_PUBLIC_* values are
 * inlined at build time, so env changes without a rebuild are invisible.
 *
 * Usage (in GitHub Actions):
 *   node scripts/sync-vercel-env.mjs                 # full flow
 *   node scripts/sync-vercel-env.mjs --dry-run       # report only, no writes
 *   FORCE_REDEPLOY=1 node scripts/sync-vercel-env.mjs  # ignore stored fingerprint
 *
 * Required env:
 *   VERCEL_TOKEN, VERCEL_ORG_ID, VERCEL_PROJECT_ID
 *   NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY,
 *   SUPABASE_SERVICE_ROLE_KEY
 *   GITHUB_REPOSITORY (set automatically in Actions)
 * Optional:
 *   GITHUB_SHA (Actions sets it), FORCE_REDEPLOY=1
 */

import crypto from "node:crypto";

const args = new Set(process.argv.slice(2));
const DRY_RUN = args.has("--dry-run");

const API_VERCEL = "https://api.vercel.com";
const FINGERPRINT_VAR = "CI_ENV_FINGERPRINT";
const DEPLOY_WAIT_MS = 10 * 60 * 1000;
const DEPLOY_POLL_MS = 10_000;

const required = [
  "VERCEL_TOKEN",
  "VERCEL_ORG_ID",
  "VERCEL_PROJECT_ID",
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
  "GITHUB_REPOSITORY",
];
const missing = required.filter((k) => !process.env[k]);
if (missing.length) {
  console.error(`Missing required env vars: ${missing.join(", ")}`);
  process.exit(2);
}

const VERCEL_TOKEN = process.env.VERCEL_TOKEN;
const TEAM = process.env.VERCEL_ORG_ID;
const PROJECT = process.env.VERCEL_PROJECT_ID;
const [GH_OWNER, GH_REPO] = process.env.GITHUB_REPOSITORY.split("/");
const REF = process.env.GITHUB_SHA || "main";
const FORCE = process.env.FORCE_REDEPLOY === "1" || process.env.FORCE_REDEPLOY === "true";

// NEXT_PUBLIC_* must stay readable Config vars so they are baked into the
// client bundle; server keys stay Sensitive.
const DESIRED = [
  { key: "NEXT_PUBLIC_SUPABASE_URL", type: "encrypted" },
  { key: "NEXT_PUBLIC_SUPABASE_ANON_KEY", type: "encrypted" },
  { key: "SUPABASE_SERVICE_ROLE_KEY", type: "sensitive" },
].map((v) => ({ ...v, value: process.env[v.key] }));

const vercelHeaders = { Authorization: `Bearer ${VERCEL_TOKEN}`, "Content-Type": "application/json" };
const teamQ = `teamId=${TEAM}`;

async function vercel(path, init) {
  const res = await fetch(`${API_VERCEL}${path}`, init);
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(`vercel ${init?.method || "GET"} ${path} -> HTTP ${res.status}: ${JSON.stringify(body?.error || body)}`);
  }
  return body;
}

async function listEnvs() {
  const data = await vercel(`/v9/projects/${PROJECT}/env?${teamQ}`, { headers: vercelHeaders });
  const byKey = new Map();
  for (const e of data.envs || []) {
    if (!byKey.has(e.key)) byKey.set(e.key, []);
    byKey.get(e.key).push(e);
  }
  return byKey;
}

function fingerprint() {
  const canonical = DESIRED.map((d) => `${d.key}=${d.value}`).join("\n");
  return `sha256:${crypto.createHash("sha256").update(canonical).digest("hex")}`;
}

async function getStoredFingerprint() {
  try {
    const envs = await listEnvs();
    const fpVar = envs.get(FINGERPRINT_VAR)?.[0];
    return fpVar?.value ?? null; // plain type -> readable via API
  } catch {
    return null;
  }
}

async function storeFingerprint(fp) {
  const envs = await listEnvs();
  const existing = envs.get(FINGERPRINT_VAR)?.[0];
  const body = JSON.stringify({
    key: FINGERPRINT_VAR,
    value: fp,
    type: "plain",
    target: ["production", "preview"],
  });
  if (existing?.id) {
    await vercel(`/v9/projects/${PROJECT}/env/${existing.id}?${teamQ}`, {
      method: "PATCH",
      headers: vercelHeaders,
      body,
    });
  } else {
    await vercel(`/v9/projects/${PROJECT}/env?${teamQ}&upsert=true`, {
      method: "POST",
      headers: vercelHeaders,
      body,
    });
  }
}

async function upsertEnvVars() {
  // Vercel keys one env RECORD per (name, target-set): PATCHing a
  // production-only record to also target preview 400s when a separate
  // preview record already exists, and POST with upsert=true 403s on any
  // existing name+target combo. So: PATCH only when there is exactly one
  // record already targeting [production, preview]; otherwise DELETE all
  // records for the key and create one clean record covering both targets.
  const envs = await listEnvs();
  const wantTargets = JSON.stringify(["production", "preview"]);
  for (const d of DESIRED) {
    const records = envs.get(d.key) || [];
    const singleBoth =
      records.length === 1 &&
      JSON.stringify([...(records[0].target || [])].sort()) === wantTargets;

    if (singleBoth) {
      await vercel(`/v9/projects/${PROJECT}/env/${records[0].id}?${teamQ}`, {
        method: "PATCH",
        headers: vercelHeaders,
        body: JSON.stringify({ value: d.value, type: d.type }),
      });
      console.log(`  patched ${d.key} (value updated)`);
      continue;
    }

    for (const r of records) {
      await vercel(`/v9/projects/${PROJECT}/env/${r.id}?${teamQ}`, {
        method: "DELETE",
        headers: vercelHeaders,
      });
    }
    await vercel(`/v9/projects/${PROJECT}/env?${teamQ}`, {
      method: "POST",
      headers: vercelHeaders,
      body: JSON.stringify({ key: d.key, value: d.value, type: d.type, target: ["production", "preview"] }),
    });
    console.log(`  recreated ${d.key} as a single production+preview record (was ${records.length} record(s))`);
  }
}

async function createProductionDeployment() {
  const dep = await vercel(`/v13/deployments?${teamQ}`, {
    method: "POST",
    headers: vercelHeaders,
    body: JSON.stringify({
      name: PROJECT,
      target: "production",
      gitSource: { type: "github", org: GH_OWNER, repo: GH_REPO, ref: REF },
    }),
  });
  console.log(`Production build created: https://${dep.url || dep.id} (${dep.id})`);
  return dep;
}

async function waitForDeployment(id) {
  const deadline = Date.now() + DEPLOY_WAIT_MS;
  while (Date.now() < deadline) {
    const dep = await vercel(`/v13/deployments/${id}?${teamQ}`, { headers: vercelHeaders });
    const state = dep.readyState;
    if (state === "READY") {
      console.log(`Deployment READY: https://${dep.url}`);
      return true;
    }
    if (state === "ERROR" || state === "CANCELED") {
      console.error(`Deployment ended in ${state}: https://${dep.url}`);
      return false;
    }
    process.stdout.write(`  build state: ${state}...\n`);
    await new Promise((r) => setTimeout(r, DEPLOY_POLL_MS));
  }
  console.error("Timed out waiting for the deployment to finish (it may still succeed).");
  return false;
}

async function main() {
  const fp = fingerprint();
  const stored = await getStoredFingerprint();
  const changed = FORCE || stored !== fp;

  console.log(`Fingerprint: ${fp}`);
  console.log(`Stored:      ${stored || "(none)"}`);
  if (DRY_RUN) {
    console.log(changed ? "DRY RUN: env drift detected - would sync vars + create production build." : "DRY RUN: in sync - nothing to do.");
    return;
  }

  if (!changed) {
    console.log("Env vars in sync with the repo - no Vercel changes, no rebuild needed.");
    return;
  }

  console.log(FORCE ? "FORCE_REDEPLOY set - syncing and rebuilding." : "Env drift detected - syncing vars and rebuilding production.");
  await upsertEnvVars();

  const dep = await createProductionDeployment();
  const ok = await waitForDeployment(dep.id);
  if (!ok) {
    console.error("Not persisting the fingerprint because the deployment did not become READY. Fix and re-run.");
    process.exit(1);
  }

  await storeFingerprint(fp);
  console.log(`Fingerprint persisted as Vercel env var ${FINGERPRINT_VAR}.`);
  console.log("Production is now built from the current commit with the current secrets.");
}

main().catch((err) => {
  console.error(`FAILED: ${err.message}`);
  process.exit(1);
});
