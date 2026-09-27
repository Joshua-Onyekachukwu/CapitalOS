#!/usr/bin/env node
/**
 * Static check: find Supabase query calls in src/ that reference columns
 * which do not exist on the live DB table (the "phantom column" bug class
 * that silently broke investor search and the meetings API).
 *
 * Heuristic parser: finds `.from("table")` then scans the following ~600
 * chars for .select("..."), .eq("col",...), .in("col",...),
 * .or("col.op.val,...") etc, and validates each column against the schema
 * dump in scripts/_schema-dump.json. Report-only; embedded relation hints
 * like `firms(name)` are skipped.
 */
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const schema = JSON.parse(fs.readFileSync(path.join(__dirname, "_schema-dump.json"), "utf8"));

function walk(dir, out = []) {
  for (const f of fs.readdirSync(dir)) {
    const p = path.join(dir, f);
    const st = fs.statSync(p);
    if (st.isDirectory()) walk(p, out);
    else if (/\.(ts|tsx)$/.test(f)) out.push(p);
  }
  return out;
}

const COLUMN_OPS = ["eq","neq","gt","gte","lt","lte","like","ilike","match","in","contains","containedBy","rangeGt","rangeGte","rangeLt","rangeLte","overlaps","textSearch"];
const findings = [];

for (const file of walk(path.join(ROOT, "src"))) {
  const src = fs.readFileSync(file, "utf8").replace(/\r\n/g, "\n");
  const fromRe = /\.from\(\s*["']([\w.]+)["']\s*\)/g;
  let m;
  while ((m = fromRe.exec(src))) {
    const table = m[1].split(".")[0];
    const cols = schema[table];
    if (!cols) continue; // view or unknown table — skip
    const colSet = new Set(cols);

    // scan only until the next .from() (avoid bleeding into other queries)
    const nextFrom = src.indexOf(".from(", m.index + 10);
    const window = src.slice(m.index, nextFrom === -1 ? m.index + 700 : Math.min(nextFrom, m.index + 700));

    // .select("a, b, c")
    const selRe = /\.select\(\s*["'`]([^"'`]+)["'`]/g;
    let s;
    while ((s = selRe.exec(window))) {
      for (const part of s[1].split(",")) {
        const col = part.trim().split(/[:\s(]/)[0].trim();
        if (!col || col === "*") continue;
        if (col.startsWith("!") || col.includes("(")) continue; // embedded hint
        if (!colSet.has(col)) {
          findings.push({ file: path.relative(ROOT, file), table, kind: "select", ref: col, snippet: s[1].slice(0, 60) });
        }
      }
    }

    // .eq("col", ...) etc
    for (const op of COLUMN_OPS) {
      const opRe = new RegExp(`\\.${op}\\(\\s*["']([\\w]+)["']`, "g");
      while ((s = opRe.exec(window))) {
        const col = s[1];
        if (!colSet.has(col)) {
          findings.push({ file: path.relative(ROOT, file), table, kind: op, ref: col });
        }
      }
    }

    // .or("a.op.v,a.op.v")
    const orRe = /\.or\(\s*["'`]([^"'`]+)["'`]/g;
    while ((s = orRe.exec(window))) {
      for (const clause of s[1].split(",")) {
        const col = clause.trim().split(".")[0].trim();
        if (!col || col.includes("(") || col.includes(")")) continue;
        if (!colSet.has(col)) {
          findings.push({ file: path.relative(ROOT, file), table, kind: "or", ref: col, snippet: s[1].slice(0, 60) });
        }
      }
    }

    // .update({...}) / .insert([{...}]) object keys
    for (const meth of ["update", "insert", "upsert"]) {
      const objRe = new RegExp(`\\.${meth}\\(\\s*(\\{[\\s\\S]{0,800}?\\})`, "g");
      while ((s = objRe.exec(window))) {
        try {
          // naive object-literal key extraction
          const keys = [...s[1].matchAll(/(?:^|[{,]\s*)([a-zA-Z_][\w]*)\s*:/g)].map((x) => x[1]);
          for (const col of keys) {
            if (colSet.has(col)) continue;
            if (["...spread", "if", "for"].includes(col)) continue;
            findings.push({ file: path.relative(ROOT, file), table, kind: meth, ref: col });
          }
        } catch { /* skip */ }
      }
    }
  }
}

// dedupe
const seen = new Set();
const uniq = findings.filter((f) => {
  const k = `${f.file}|${f.table}|${f.kind}|${f.ref}`;
  if (seen.has(k)) return false;
  seen.add(k);
  return true;
});

if (uniq.length === 0) {
  console.log("No phantom column references found.");
} else {
  console.log(`Found ${uniq.length} suspect column reference(s):\n`);
  for (const f of uniq) {
    console.log(`  ${f.file}  [${f.table}.${f.ref}]  via ${f.kind}${f.snippet ? `  "${f.snippet}"` : ""}`);
  }
  process.exitCode = 1;
}
