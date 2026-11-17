#!/usr/bin/env node
/**
 * Import SEC Form D venture funds into the demo corpus via the Supabase REST
 * API (the pooler DNS is unreliable on this host; REST is one stable endpoint).
 *
 * Source: investor-intelligence/data/qualified/scored-*.jsonl, filtered to
 * records whose filed investmentFundType is "Venture Capital Fund". Hedge,
 * PE and unidentified funds are deliberately excluded.
 *
 * Safety:
 *  - dry run by default; pass --apply to write
 *  - dedupes against every existing investor by normalized name
 *  - tagged source='sec_formd_bulk' / source_provider='SEC EDGAR'
 *  - idempotent: re-running skips source_ids already present
 *  - rollback (service role / SQL editor):
 *      delete from investors where source='sec_formd_bulk';
 *      delete from investor_firms where source='sec_formd_bulk';
 *    (investor_people rows cascade with their investor)
 *
 * Usage:
 *   node scripts/import-sec-funds.cjs             # dry run
 *   node scripts/import-sec-funds.cjs --apply
 *   node scripts/import-sec-funds.cjs --apply --limit 50
 */

require("dotenv").config({ path: ".env.local", quiet: true });
const fs = require("fs");
const path = require("path");
const { createClient } = require("@supabase/supabase-js");

const APPLY = process.argv.includes("--apply");
const LIMIT = (() => {
  const i = process.argv.indexOf("--limit");
  return i >= 0 ? Number(process.argv[i + 1]) || 0 : 0;
})();
const BATCH = 200;

const DATA = path.resolve(__dirname, "../investor-intelligence/data/qualified");

function latestScored() {
  const files = fs
    .readdirSync(DATA)
    .filter((f) => f.startsWith("scored-") && f.endsWith(".jsonl"))
    .sort();
  if (!files.length) throw new Error("no scored file in " + DATA);
  return path.join(DATA, files[files.length - 1]);
}

const LEGAL = /\b(llc|l\.l\.c|lp|l\.p|llp|ltd|limited|inc|incorporated|corp|corporation|co|company|plc|gmbh|ag|bv|nv|sarl|sas|sa|pte|pty)\b/g;
const normalizeName = (s) =>
  String(s || "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(LEGAL, " ")
    .replace(/\s+/g, " ")
    .trim();

const US_STATES = new Set(
  "AL AK AZ AR CA CO CT DE DC FL GA HI ID IL IN IA KS KY LA ME MD MA MI MN MS MO MT NE NV NH NJ NM NY NC ND OH OK OR PA RI SC SD TN TX UT VT VA WA WV WI WY".split(" ")
);
const STAGES = new Set(["pre_seed", "seed", "series_a", "series_b", "series_c", "growth", "late_stage", "pre_ipo"]);

const domainOf = (url) => {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return null;
  }
};

function descriptionOf(r) {
  const bits = ["SEC Form D filer, venture capital fund."];
  if (r.industry_group) bits.push(`Industry group: ${r.industry_group}.`);
  if (r.first_sale_date) bits.push(`First sale: ${r.first_sale_date}.`);
  if (r.total_offering_usd)
    bits.push(`Offering amount: $${Number(r.total_offering_usd).toLocaleString("en-US")}.`);
  if (r.city || r.state) bits.push(`Location: ${[r.city, r.state].filter(Boolean).join(", ")}.`);
  return bits.join(" ");
}

function thesisOf(r) {
  const bits = ["Filed investmentFundType: Venture Capital Fund (SEC Form D)."];
  if (r.stage_focus?.length) bits.push(`Stage evidence: ${r.stage_focus.join(", ")}.`);
  if (r.sectors?.length) bits.push(`Sector evidence: ${r.sectors.join(", ")}.`);
  if (r.min_investment_usd != null)
    bits.push(
      `Minimum LP commitment accepted: $${Number(r.min_investment_usd).toLocaleString("en-US")} (fund commitment, not a startup cheque).`
    );
  return bits.join(" ");
}

const qualityOf = (r) => {
  if (Number.isFinite(r.evidence_score)) return Math.max(0, Math.min(100, Math.round(r.evidence_score)));
  if (r.tier === "B") return 75;
  if (r.tier === "C") return 55;
  return 35;
};

const splitName = (full) => {
  const parts = String(full).trim().split(/\s+/);
  return parts.length === 1
    ? { first: parts[0], last: null }
    : { first: parts[0], last: parts.slice(1).join(" ") };
};

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
);

async function fetchAll(table, select, filter) {
  const out = [];
  for (let from = 0; ; from += 1000) {
    let q = supabase.from(table).select(select).range(from, from + 999);
    if (filter) q = filter(q);
    const { data, error } = await q;
    if (error) throw new Error(`${table}: ${error.message}`);
    out.push(...(data || []));
    if (!data || data.length < 1000) break;
  }
  return out;
}

(async () => {
  const file = latestScored();
  const records = fs
    .readFileSync(file, "utf8")
    .split("\n")
    .filter(Boolean)
    .map((l) => {
      try {
        return JSON.parse(l);
      } catch {
        return null;
      }
    })
    .filter((r) => r && r.fund_type === "Venture Capital Fund");

  console.log(`source: ${path.basename(file)} · venture funds: ${records.length}`);

  const existing = await fetchAll("investors", "full_name,name_normalized");
  const existingNames = new Set();
  for (const e of existing) {
    existingNames.add(normalizeName(e.name_normalized || e.full_name));
    if (e.full_name) existingNames.add(normalizeName(e.full_name));
  }
  const already = new Set(
    (await fetchAll("investor_firms", "source_id", (q) => q.eq("source", "sec_formd_bulk"))).map(
      (r) => r.source_id
    )
  );

  const seen = new Set();
  const rows = [];
  const people = [];
  const skipped = { duplicate_name: 0, already_imported: 0, seen_in_file: 0, no_name: 0 };

  for (const r of records) {
    if (!r.full_name) {
      skipped.no_name += 1;
      continue;
    }
    if (already.has(r.candidate_id)) {
      skipped.already_imported += 1;
      continue;
    }
    const norm = normalizeName(r.full_name);
    if (!norm) {
      skipped.no_name += 1;
      continue;
    }
    if (seen.has(norm)) {
      skipped.seen_in_file += 1;
      continue;
    }
    if (existingNames.has(norm)) {
      skipped.duplicate_name += 1;
      continue;
    }
    seen.add(norm);

    const isUS = US_STATES.has(String(r.state || "").toUpperCase());
    const city = r.city ? String(r.city).replace(/\b\w/g, (c) => c.toUpperCase()) : null;
    const state = isUS ? String(r.state).toUpperCase() : null;
    const country = isUS ? "United States" : r.state || null;
    const headquarters = [city, state].filter(Boolean).join(", ") || null;
    const website = r.website || null;
    const quality = qualityOf(r);
    const email = Array.isArray(r.emails) && r.emails[0] ? r.emails[0] : null;
    const stages = (r.stage_focus || []).filter((s) => STAGES.has(s));
    const sectors = Array.isArray(r.sectors) ? r.sectors.slice(0, 12) : [];
    const sourceUrl =
      r.sources?.find((s) => s.type?.startsWith("sec_form_d"))?.url ||
      `https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK=${r.cik}&type=D`;

    rows.push({
      firm: {
        name: r.full_name,
        normalized_name: norm,
        domain: domainOf(website),
        website,
        description: descriptionOf(r),
        firm_type: "venture_capital",
        headquarters,
        country,
        investment_stages: stages,
        investment_sectors: sectors,
        source: "sec_formd_bulk",
        source_id: r.candidate_id,
        source_provider: "SEC EDGAR",
        data_quality_score: quality,
        last_enriched_at: new Date().toISOString(),
      },
      investor: {
        full_name: r.full_name,
        name_normalized: norm,
        city,
        country,
        location: [city, state].filter(Boolean).join(", ") || null,
        investor_type: "venture_capital",
        investment_stages: stages,
        investment_sectors: sectors,
        investment_geographies: country ? [country] : [],
        website_url: website,
        email,
        email_verified: false,
        investment_thesis: thesisOf(r),
        scope: "startup_investor",
        data_quality_score: quality,
        last_enriched_at: new Date().toISOString(),
        source: "sec_formd_bulk",
        source_id: r.candidate_id,
        source_provider: "SEC EDGAR",
        provenance: {
          source: "sec_formd_bulk",
          provider: "SEC EDGAR",
          source_url: sourceUrl,
          tier: r.tier ?? null,
          evidence_score: r.evidence_score ?? null,
          first_sale_date: r.first_sale_date ?? null,
          min_commitment_usd: r.min_investment_usd ?? null,
          imported_at: new Date().toISOString(),
        },
        is_verified: false,
        outreach_readiness: "needs_verification",
      },
      candidates: (r.team || []).slice(0, 12).filter((p) => p?.name).map((p, idx) => {
        const { first, last } = splitName(p.name);
        return {
          full_name: p.name.trim(),
          first_name: first,
          last_name: last,
          title: (p.relationships || []).join(", ") || null,
          location: [city, state].filter(Boolean).join(", ") || null,
          is_primary: idx === 0,
          source: "sec_formd_related_persons",
          source_url: sourceUrl,
        };
      }),
    });
  }

  const take = LIMIT ? rows.slice(0, LIMIT) : rows;
  const personRows = take.reduce((n, r) => n + r.candidates.length, 0);
  const distinctPeople = new Set(
    take.flatMap((r) => r.candidates.map((p) => p.full_name.toLowerCase()))
  ).size;

  console.log({
    to_import: take.length,
    people_rows: personRows,
    distinct_people: distinctPeople,
    skipped,
    apply: APPLY,
  });
  if (!take.length) return;
  if (!APPLY) {
    console.log("sample firm:", JSON.stringify(take[0].firm, null, 1).slice(0, 700));
    console.log("dry run only — pass --apply to write");
    return;
  }

  let firmCount = 0;
  let investorCount = 0;
  let peopleCount = 0;

  for (let i = 0; i < take.length; i += BATCH) {
    const chunk = take.slice(i, i + BATCH);

    const { data: firmData, error: firmErr } = await supabase
      .from("investor_firms")
      .insert(chunk.map((r) => r.firm))
      .select("id,source_id");
    if (firmErr) throw new Error(`firms batch ${i}: ${firmErr.message}`);
    const firmBySource = new Map((firmData || []).map((f) => [f.source_id, f.id]));
    firmCount += firmBySource.size;

    const investorPayload = chunk
      .filter((r) => firmBySource.has(r.source_id ?? r.firm.source_id))
      .map((r) => ({ ...r.investor, current_firm_id: firmBySource.get(r.firm.source_id) }));

    const { data: invData, error: invErr } = await supabase
      .from("investors")
      .insert(investorPayload)
      .select("id,source_id");
    if (invErr) throw new Error(`investors batch ${i}: ${invErr.message}`);
    const invBySource = new Map((invData || []).map((x) => [x.source_id, x.id]));
    investorCount += invBySource.size;

    const peoplePayload = chunk.flatMap((r) => {
      const investorId = invBySource.get(r.firm.source_id);
      if (!investorId) return [];
      return r.candidates.map((p) => ({ ...p, firm_id: investorId }));
    });
    if (peoplePayload.length) {
      const { error: pErr } = await supabase.from("investor_people").insert(peoplePayload);
      if (pErr) throw new Error(`people batch ${i}: ${pErr.message}`);
      peopleCount += peoplePayload.length;
    }

    process.stdout.write(`\r  firms ${firmCount} · investors ${investorCount} · people ${peopleCount} / ${take.length}`);
  }

  console.log("\ndone");
  const { count: imported } = await supabase
    .from("investors")
    .select("id", { count: "exact", head: true })
    .eq("source", "sec_formd_bulk");
  console.log({ imported_investors: imported });
})().catch((e) => {
  console.error("\nFAILED:", e.message);
  process.exit(1);
});
