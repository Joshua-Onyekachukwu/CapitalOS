#!/usr/bin/env node
/**
 * Manager identity from shared people, not name strings.
 *
 * Each Form D filing names related persons. Two vehicles managed by the same
 * person are the same manager far more reliably than two similar names are:
 * name clustering merges unrelated SPVs filed under one umbrella LLC
 * ("CGF2021", "Roll Up Vehicles") and splits the same manager across name
 * variants. This builds connected components over shared person names and
 * reports the distinct-manager count. Read-only.
 *
 *   node scripts/analyze-manager-graph.cjs
 */

require("dotenv").config({ path: ".env.local", quiet: true });
const { createClient } = require("@supabase/supabase-js");
const fs = require("fs");

const sp = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
);

async function fetchAll(table, select, filter) {
  const out = [];
  for (let from = 0; ; from += 1000) {
    let q = sp.from(table).select(select).range(from, from + 999);
    if (filter) q = filter(q);
    const { data, error } = await q;
    if (error) throw new Error(`${table}: ${error.message}`);
    out.push(...(data || []));
    if (!data || data.length < 1000) break;
  }
  return out;
}

// Union-find over firm ids.
function makeDsu() {
  const parent = new Map();
  const find = (x) => {
    if (!parent.has(x)) parent.set(x, x);
    let root = x;
    while (parent.get(root) !== root) root = parent.get(root);
    while (parent.get(x) !== root) {
      const next = parent.get(x);
      parent.set(x, root);
      x = next;
    }
    return root;
  };
  const union = (a, b) => {
    const ra = find(a);
    const rb = find(b);
    if (ra !== rb) parent.set(ra, rb);
  };
  return { find, union, parent };
}

(async () => {
  const firms = await fetchAll(
    "investors",
    "id,full_name",
    (q) => q.eq("source", "sec_formd_bulk").eq("is_active", true)
  );
  const people = await fetchAll("investor_people", "firm_id,full_name");
  const nameById = new Map(firms.map((f) => [f.id, f.full_name]));

  const dsu = makeDsu();
  for (const f of firms) dsu.find(f.id);

  // Person name -> every firm that person appears at.
  // Entity names and filing administrators are not manager identity: one
  // administrator can sign for thousands of unrelated SPVs. They are dropped
  // before clustering, and any remaining name at more than ADMIN_LIMIT firms
  // is treated as an administrator too.
  const ORG = /\b(llc|l\.l\.c|lp|l\.p|ltd|inc|corp|company|co|fund|funds|admin|administration|management|mgmt|capital|partners|group|trust|gp|agent|sponsor|sydecar|series|holdings?)\b/i;
  const ADMIN_LIMIT = 25;
  const byPerson = new Map();
  for (const p of people) {
    if (!p.firm_id || !nameById.has(p.firm_id)) continue;
    const name = String(p.full_name || "").trim().toLowerCase();
    if (name.length < 4) continue;
    if (/n\/a|\bunknown\b/.test(name)) continue;
    if (ORG.test(name)) continue;
    if (!byPerson.has(name)) byPerson.set(name, new Set());
    byPerson.get(name).add(p.firm_id);
  }

  let droppedAdmins = 0;
  for (const [name, ids] of [...byPerson]) {
    if (ids.size > ADMIN_LIMIT) {
      byPerson.delete(name);
      droppedAdmins += 1;
      continue;
    }
    const list = [...ids];
    for (let i = 1; i < list.length; i++) dsu.union(list[0], list[i]);
  }

  const components = new Map();
  for (const f of firms) {
    const root = dsu.find(f.id);
    if (!components.has(root)) components.set(root, []);
    components.get(root).push(f.id);
  }

  const multi = [...components.values()].filter((ids) => ids.length > 1);
  multi.sort((a, b) => b.length - a.length);

  const describe = (ids) => {
    const names = ids.map((id) => nameById.get(id)).filter(Boolean);
    const shared = [];
    for (const [name, set] of byPerson) {
      if (ids.some((id) => set.has(id)) && ids.filter((id) => set.has(id)).length > 1) {
        shared.push(name);
        if (shared.length >= 3) break;
      }
    }
    return { vehicles: ids.length, examples: names.slice(0, 4), shared_people: shared };
  };

  const report = {
    generated_at: new Date().toISOString(),
    method:
      "connected components over shared related-person names; entity names and administrators (>25 vehicles) excluded",
    dropped_admin_names: droppedAdmins,
    imported_vehicles: firms.length,
    distinct_manager_components: components.size,
    collapse_ratio: Number((firms.length / Math.max(1, components.size)).toFixed(2)),
    components_with_multiple_vehicles: multi.length,
    vehicles_absorbed: multi.reduce((n, ids) => n + ids.length - 1, 0),
    largest_components: multi.slice(0, 15).map(describe),
    caveat:
      "A shared person is strong evidence of a common manager, but administrators who sign for many unrelated funds can over-merge. Counts are a measured lower bound on distinct managers, not a legal entity register.",
  };

  fs.mkdirSync(".tmp", { recursive: true });
  fs.writeFileSync(".tmp/manager-graph.json", JSON.stringify(report, null, 2) + "\n");
  console.log(JSON.stringify({ ...report, largest_components: report.largest_components.slice(0, 8) }, null, 2));
})().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
