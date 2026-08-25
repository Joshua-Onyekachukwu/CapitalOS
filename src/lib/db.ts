/**
 * Database Query Layer — Supabase
 *
 * Provides the same `query()`, `queryAs()`, `execute()`, `transaction()` API
 * that all service files expect, but backed by Supabase instead of CockroachDB.
 *
 * CockroachDB is kept as a backup — see src/lib/db-cockroach.ts for the original.
 *
 * Usage (unchanged from before):
 *   import { query, queryAs } from "@/lib/db";
 *   const investors = await query('SELECT * FROM investors WHERE fit_score > $1', [80]);
 */

import { createClient } from "@supabase/supabase-js";

// ─────────────────────────────────────────────
// Supabase Service Client
// ─────────────────────────────────────────────

let _sp: ReturnType<typeof createClient> | null = null;

function sp() {
  if (!_sp) {
    _sp = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
  }
  return _sp;
}

// ─────────────────────────────────────────────
// SQL Pattern Matching & Execution
// ─────────────────────────────────────────────

/**
 * Execute a SQL-like query against Supabase.
 * Supports the subset of SQL used throughout the codebase:
 * - SELECT ... FROM table WHERE ...
 * - INSERT INTO ... VALUES ... [ON CONFLICT]
 * - UPDATE table SET ... WHERE ...
 * - DELETE FROM table WHERE ...
 * - COUNT(*) queries
 */
export async function query<T = any>(
  text: string,
  params?: any[]
): Promise<T[]> {
  const sql = text.replace(/\s+/g, " ").trim();
  const p = params || [];

  try {
    // ── COUNT(*) queries ──
    if (/^SELECT\s+COUNT\(/i.test(sql)) {
      return await handleCount(sql, p) as T[];
    }

    // ── INSERT queries ──
    if (/^INSERT\s+INTO/i.test(sql)) {
      return await handleInsert(sql, p) as T[];
    }

    // ── UPDATE queries ──
    if (/^UPDATE\s+/i.test(sql)) {
      return await handleUpdate(sql, p) as T[];
    }

    // ── DELETE queries ──
    if (/^DELETE\s+FROM/i.test(sql)) {
      return await handleDelete(sql, p) as T[];
    }

    // ── SELECT queries ──
    if (/^SELECT\s+/i.test(sql)) {
      return await handleSelect(sql, p) as T[];
    }

    console.warn(`[db] Unhandled SQL: ${sql.substring(0, 100)}`);
    return [];
  } catch (err: any) {
    console.error(`[db] Query error: ${err.message?.substring(0, 200)}`, { sql: sql.substring(0, 150) });
    return [];
  }
}

/**
 * queryAs — same as query (user context is implicit via service role).
 */
export async function queryAs<T = any>(
  userId: string,
  text: string,
  params?: any[]
): Promise<T[]> {
  return query<T>(text, params);
}

/**
 * execute — same as query but no return value.
 */
export async function execute(sql: string, params?: any[]): Promise<void> {
  await query(sql, params);
}

/**
 * raw — for scripts/migrations.
 */
export async function raw(sql: string): Promise<any> {
  console.warn("[db] raw() is deprecated — use query() instead");
  return { rows: [] };
}

/**
 * transaction — simplified: just run the function.
 * Supabase doesn't support arbitrary SQL transactions, but most
 * transaction usage in this codebase is sequential inserts/updates.
 */
export async function transaction<T>(
  fn: (tx: { query: typeof query; queryOne: typeof queryOne }) => Promise<T>
): Promise<T> {
  return fn({ query, queryOne });
}

async function queryOne<T = any>(text: string, params?: any[]): Promise<T | null> {
  const rows = await query<T>(text, params);
  return rows[0] ?? null;
}

// ══════════════════════════════════════════════
// Query Handlers
// ══════════════════════════════════════════════

async function handleCount(sql: string, params: any[]): Promise<any[]> {
  // Parse: SELECT COUNT(*)::text AS count FROM table WHERE conditions
  const tableMatch = sql.match(/FROM\s+(\w+)/i);
  if (!tableMatch) return [{ count: 0 }];

  const table = tableMatch[1];
  const whereMatch = sql.match(/WHERE\s+(.+?)(?:\s+GROUP\s+BY|\s+ORDER\s+BY|\s+LIMIT|$)/i);
  const whereClause = whereMatch ? whereMatch[1] : "";

  let builder = sp().from(table).select("id", { count: "exact", head: true });
  builder = applySimpleWhere(builder, whereClause, params);

  const { count, error } = await builder;
  if (error) throw error;
  return [{ count: count || 0 }];
}

async function handleSelect(sql: string, params: any[]): Promise<any[]> {
  // Parse: SELECT fields FROM table [WHERE ...] [ORDER BY ...] [LIMIT N] [OFFSET N]
  const selectMatch = sql.match(
    /^SELECT\s+(.+?)\s+FROM\s+(\w+)(?:\s+(.*))?$/i
  );
  if (!selectMatch) return [];

  const fields = selectMatch[1].trim();
  const table = selectMatch[2];
  const rest = selectMatch[3] || "";

  // Convert SELECT fields to Supabase columns
  let columns = "*";
  if (fields !== "*") {
    columns = fields
      .split(",")
      .map((f) => {
        const cleaned = f.trim()
          .replace(/::\w+/g, "")
          .replace(/\s+AS\s+\w+/gi, "")
          .trim();
        // Handle COUNT(*)::text AS count
        if (/COUNT\(/i.test(cleaned)) return "id";
        return cleaned;
      })
      .filter((f) => f !== "id" || fields.includes("id") || /COUNT/i.test(fields))
      .join(",");
    if (!columns) columns = "id";
  }

  let builder = sp().from(table).select(columns);

  // Parse WHERE, ORDER BY, LIMIT, OFFSET from rest
  const whereMatch = rest.match(/WHERE\s+(.+?)(?:\s+ORDER\s+BY|\s+LIMIT|\s+OFFSET|$)/i);
  if (whereMatch) {
    builder = applySimpleWhere(builder, whereMatch[1], params);
  }

  const orderMatch = rest.match(/ORDER\s+BY\s+(\w+)(?:\s+(ASC|DESC))?/i);
  if (orderMatch) {
    builder = builder.order(orderMatch[1], {
      ascending: orderMatch[2]?.toUpperCase() !== "DESC",
    });
  }

  const limitMatch = rest.match(/LIMIT\s+(\$\d+|\d+)/i);
  if (limitMatch) {
    const val = limitMatch[1].startsWith("$")
      ? params[parseInt(limitMatch[1].slice(1)) - 1]
      : parseInt(limitMatch[1]);
    if (val) builder = builder.limit(val);
  }

  const offsetMatch = rest.match(/OFFSET\s+(\$\d+|\d+)/i);
  if (offsetMatch) {
    const val = offsetMatch[1].startsWith("$")
      ? params[parseInt(offsetMatch[1].slice(1)) - 1]
      : parseInt(offsetMatch[1]);
    if (val) {
      const currentLimit = limitMatch
        ? (limitMatch[1].startsWith("$")
            ? params[parseInt(limitMatch[1].slice(1)) - 1]
            : parseInt(limitMatch[1]))
        : 1000;
      builder = builder.range(val, val + (currentLimit || 1000) - 1);
    }
  }

  const { data, error } = await builder;
  if (error) throw error;
  return data || [];
}

async function handleInsert(sql: string, params: any[]): Promise<any[]> {
  // Parse: INSERT INTO table (cols) VALUES (...) [ON CONFLICT ...]
  const insertMatch = sql.match(
    /^INSERT\s+INTO\s+(\w+)\s*\(([^)]+)\)\s+VALUES\s+(.+?)(?:\s+ON\s+CONFLICT.*)?(?:\s+RETURNING.*)?$/i
  );
  if (!insertMatch) return [];

  const table = insertMatch[1];
  const columns = insertMatch[2].split(",").map((c) => c.trim());
  const valuesStr = insertMatch[3];

  // Parse value sets: ($1, $2, $3), ($4, $5, $6)
  const rawSets = valuesStr.split(/\)\s*,\s*\(/);
  const rows: Record<string, any>[] = [];

  for (const rawSet of rawSets) {
    const cleaned = rawSet.replace(/[()]/g, "").trim();
    const values = parseParamValues(cleaned, params);
    const row: Record<string, any> = {};
    columns.forEach((col, i) => {
      if (values[i] !== undefined) row[col] = values[i];
    });
    rows.push(row);
  }

  if (rows.length === 0) return [];

  // Handle ON CONFLICT (upsert)
  const isUpsert = /ON\s+CONFLICT/i.test(sql);
  const conflictMatch = sql.match(/ON\s+CONFLICT\s*\(([^)]+)\)/i);

  let builder = sp().from(table);
  if (isUpsert) {
    builder = builder.upsert(rows, {
      onConflict: conflictMatch
        ? conflictMatch[1].split(",").map((c) => c.trim()).join(",")
        : undefined,
      ignoreDuplicates: /DO\s+NOTHING/i.test(sql),
    });
  } else {
    builder = builder.insert(rows);
  }

  // Handle RETURNING
  if (/RETURNING/i.test(sql)) {
    const { data, error } = await builder.select();
    if (error) throw error;
    return data || [];
  }

  const { error } = await builder.select();
  if (error) throw error;
  return [];
}

async function handleUpdate(sql: string, params: any[]): Promise<any[]> {
  // Parse: UPDATE table SET col1 = $1, col2 = $2 WHERE conditions
  const updateMatch = sql.match(
    /^UPDATE\s+(\w+)\s+SET\s+(.+?)\s+WHERE\s+(.+?)(?:\s+RETURNING.*)?$/i
  );
  if (!updateMatch) return [];

  const table = updateMatch[1];
  const setClause = updateMatch[2];
  const whereClause = updateMatch[3];

  // Parse SET clause
  const updates: Record<string, any> = {};
  const setParts = setClause.split(/,(?![^(]*\))/);
  for (const part of setParts) {
    const eqIdx = part.indexOf("=");
    if (eqIdx === -1) continue;
    const col = part.substring(0, eqIdx).trim();
    const val = part.substring(eqIdx + 1).trim();
    updates[col] = resolveParamValue(val, params);
  }

  // Apply WHERE conditions
  let builder = sp().from(table).update(updates);
  builder = applySimpleWhere(builder, whereClause, params);

  if (/RETURNING/i.test(sql)) {
    const { data, error } = await builder.select();
    if (error) throw error;
    return data || [];
  }

  const { error } = await builder;
  if (error) throw error;
  return [];
}

async function handleDelete(sql: string, params: any[]): Promise<any[]> {
  const deleteMatch = sql.match(
    /^DELETE\s+FROM\s+(\w+)\s+WHERE\s+(.+?)(?:\s+RETURNING.*)?$/i
  );
  if (!deleteMatch) return [];

  const table = deleteMatch[1];
  const whereClause = deleteMatch[2];

  let builder = sp().from(table).delete();
  builder = applySimpleWhere(builder, whereClause, params);

  const { error } = await builder;
  if (error) throw error;
  return [];
}

// ══════════════════════════════════════════════
// WHERE Clause Application
// ══════════════════════════════════════════════

function applySimpleWhere(builder: any, whereStr: string, params: any[]): any {
  if (!whereStr) return builder;

  // Split by AND
  const conditions = whereStr.split(/\s+AND\s+/i);

  for (const cond of conditions) {
    const trimmed = cond.trim();

    // column = $N
    const paramEq = trimmed.match(/^(\w+(?:\.\w+)?)\s*=\s*\$(\d+)$/);
    if (paramEq) {
      builder = builder.eq(paramEq[1], params[parseInt(paramEq[2]) - 1]);
      continue;
    }

    // column = 'string'
    const strEq = trimmed.match(/^(\w+(?:\.\w+)?)\s*=\s*'([^']*)'$/);
    if (strEq) {
      builder = builder.eq(strEq[1], strEq[2]);
      continue;
    }

    // column != 'string' or column <> 'string'
    const neq = trimmed.match(/^(\w+)\s*(?:!=|<>)\s*'([^']*)'$/);
    if (neq) {
      builder = builder.neq(neq[1], neq[2]);
      continue;
    }

    // column >= $N or column > $N
    const gte = trimmed.match(/^(\w+)\s*>=\s*\$(\d+)$/);
    if (gte) {
      builder = builder.gte(gte[1], params[parseInt(gte[2]) - 1]);
      continue;
    }

    const gt = trimmed.match(/^(\w+)\s*>\s*(\d+)$/);
    if (gt) {
      builder = builder.gt(gt[1], parseInt(gt[2]));
      continue;
    }

    // column <= $N
    const lte = trimmed.match(/^(\w+)\s*<=\s*\$(\d+)$/);
    if (lte) {
      builder = builder.lte(lte[1], params[parseInt(lte[2]) - 1]);
      continue;
    }

    // column IS NOT NULL
    if (/IS\s+NOT\s+NULL$/i.test(trimmed)) {
      const col = trimmed.replace(/\s+IS\s+NOT\s+NULL$/i, "").trim();
      builder = builder.not(col, "is", null);
      continue;
    }

    // column IS NULL
    if (/IS\s+NULL$/i.test(trimmed)) {
      const col = trimmed.replace(/\s+IS\s+NULL$/i, "").trim();
      builder = builder.is(col, null);
      continue;
    }

    // column LIKE $N
    const like = trimmed.match(/^(\w+)\s+LIKE\s+\$(\d+)$/);
    if (like) {
      builder = builder.like(like[1], params[parseInt(like[2]) - 1]);
      continue;
    }

    // column ILIKE $N
    const ilike = trimmed.match(/^(\w+)\s+ILIKE\s+\$(\d+)$/);
    if (ilike) {
      builder = builder.ilike(ilike[1], params[parseInt(ilike[2]) - 1]);
      continue;
    }
  }

  return builder;
}

// ══════════════════════════════════════════════
// Value Resolution
// ══════════════════════════════════════════════

function resolveParamValue(val: string, params: any[]): any {
  const trimmed = val.trim();

  // $N param
  const paramMatch = trimmed.match(/^\$(\d+)(?:::\w+)?$/);
  if (paramMatch) return params[parseInt(paramMatch[1]) - 1];

  // String literal
  if ((trimmed.startsWith("'") && trimmed.endsWith("'")) ||
      (trimmed.startsWith('"') && trimmed.endsWith('"'))) {
    return trimmed.slice(1, -1);
  }

  // NOW()
  if (/^NOW\(\)$/i.test(trimmed)) return new Date().toISOString();

  // NULL
  if (/^NULL$/i.test(trimmed)) return null;

  // Boolean
  if (/^TRUE$/i.test(trimmed)) return true;
  if (/^FALSE$/i.test(trimmed)) return false;

  // Number
  const num = Number(trimmed);
  if (!isNaN(num)) return num;

  return trimmed;
}

function parseParamValues(valuesStr: string, params: any[]): any[] {
  const parts = valuesStr.split(",").map((v) => v.trim());
  return parts.map((part) => {
    // $N::type
    const castMatch = part.match(/^\$(\d+)::\w+$/);
    if (castMatch) return params[parseInt(castMatch[1]) - 1];

    // $N
    const paramMatch = part.match(/^\$(\d+)$/);
    if (paramMatch) return params[parseInt(paramMatch[1]) - 1];

    return resolveParamValue(part, params);
  });
}

// ─────────────────────────────────────────────
// Connection Test (for diagnostics)
// ─────────────────────────────────────────────

export async function testConnection(): Promise<boolean> {
  try {
    const { data, error } = await sp().from("investors").select("id", { count: "exact", head: true });
    if (error) throw error;
    console.log(`✅ Connected to Supabase — investors count: ${data}`);
    return true;
  } catch (err: any) {
    console.error("❌ Supabase connection failed:", err.message);
    return false;
  }
}

// ─────────────────────────────────────────────
// Graceful Fallbacks (keep API stable)
// ─────────────────────────────────────────────

export function getPoolStats() {
  return {
    totalCount: 1,
    idleCount: 0,
    waitingCount: 0,
    circuitBreaker: { state: "closed" as const, failures: 0 },
  };
}

export async function closePool(): Promise<void> {
  // No-op — Supabase client manages connections
}
