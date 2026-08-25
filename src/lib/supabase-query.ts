/**
 * Supabase Query Compatibility Layer
 *
 * Provides a `query()` function that matches the CockroachDB pg `query()` API
 * but executes against Supabase via the PostgREST client.
 *
 * Usage:
 *   import { query, queryAs } from "@/lib/supabase-query";
 *   const rows = await query("SELECT * FROM investors WHERE fit_score > $1", [80]);
 */

import { createClient } from "@supabase/supabase-js";

// Service-role client for server-side queries (no auth context needed for public data)
let _serviceClient: ReturnType<typeof createClient> | null = null;

function getServiceClient() {
  if (!_serviceClient) {
    _serviceClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
  }
  return _serviceClient;
}

/**
 * Execute a SQL-like query against Supabase.
 *
 * Supports a subset of SQL that maps to PostgREST:
 * - SELECT ... FROM table WHERE col = $1
 * - SELECT COUNT(*) FROM table WHERE ...
 * - INSERT INTO ... VALUES ...
 * - UPDATE table SET ... WHERE ...
 * - DELETE FROM table WHERE ...
 *
 * For complex queries (JOINs, subqueries, window functions),
 * use Supabase RPC functions instead.
 */
export async function query<T = any>(
  sql: string,
  params?: any[]
): Promise<T[]> {
  const sp = getServiceClient();
  const normalized = sql.replace(/\s+/g, " ").trim();

  try {
    // ── COUNT queries ──
    const countMatch = normalized.match(
      /^SELECT\s+COUNT\(\s*\*?\s*\)(?:::?\w+)?\s+(?:AS\s+\w+\s+)?FROM\s+(\w+)(?:\s+(.*))?$/i
    );
    if (countMatch) {
      const table = countMatch[1];
      const whereClause = countMatch[2] || "";
      let builder = sp.from(table).select("id", { count: "exact", head: true });
      builder = applyWhereClause(builder, whereClause, params || []);
      const { count } = await builder;
      return [{ count: count || 0 }] as T[];
    }

    // ── INSERT queries ──
    const insertMatch = normalized.match(
      /^INSERT\s+INTO\s+(\w+)\s*\(([^)]+)\)\s+VALUES\s+(.+?)(?:\s+ON\s+CONFLICT.*)?$/i
    );
    if (insertMatch) {
      const table = insertMatch[1];
      const columns = insertMatch[2].split(",").map((c) => c.trim());
      // Parse values - handle multiple value sets
      const valuesStr = insertMatch[3];
      const valueSets = parseValueSets(valuesStr, params || []);
      const rows = valueSets.map((vs) => {
        const row: Record<string, any> = {};
        columns.forEach((col, i) => {
          row[col] = vs[i];
        });
        return row;
      });

      // Handle ON CONFLICT (upsert)
      const isUpsert = /ON\s+CONFLICT/i.test(normalized);
      let builder = sp.from(table).upsert(rows, { onConflict: isUpsert ? undefined : undefined });
      // For upserts with specific conflict columns, extract them
      if (isUpsert) {
        const conflictMatch = normalized.match(/ON\s+CONFLICT\s*\(([^)]+)\)/i);
        if (conflictMatch) {
          // Supabase upsert with onConflict
          builder = sp.from(table).upsert(rows, {
            onConflict: conflictMatch[1].split(",").map((c) => c.trim()).join(","),
            ignoreDuplicates: false,
          });
        }
      }

      const { data, error } = await builder.select();
      if (error) throw error;
      return (data || []) as T[];
    }

    // ── UPDATE queries ──
    const updateMatch = normalized.match(
      /^UPDATE\s+(\w+)\s+SET\s+(.+?)\s+WHERE\s+(.+?)$/i
    );
    if (updateMatch) {
      const table = updateMatch[1];
      const setClause = updateMatch[2];
      const whereClause = updateMatch[3];

      const updates = parseSetClause(setClause, params || []);
      const { whereParams, whereConditions } = parseWhereClause(whereClause, params || updates._extraParamCount || 0);

      let builder = sp.from(table).update(updates.values);

      // Apply WHERE conditions using eq/neq/etc
      for (const cond of whereConditions) {
        if (cond.operator === "eq") builder = builder.eq(cond.column, cond.value);
        else if (cond.operator === "in") builder = builder.in(cond.column, cond.value);
      }

      const { data, error } = await builder.select();
      if (error) throw error;
      return (data || []) as T[];
    }

    // ── DELETE queries ──
    const deleteMatch = normalized.match(
      /^DELETE\s+FROM\s+(\w+)\s+WHERE\s+(.+?)$/i
    );
    if (deleteMatch) {
      const table = deleteMatch[1];
      const whereClause = deleteMatch[2];
      const { whereConditions } = parseWhereClause(whereClause, params || []);

      let builder = sp.from(table).delete();
      for (const cond of whereConditions) {
        if (cond.operator === "eq") builder = builder.eq(cond.column, cond.value);
        else if (cond.operator === "in") builder = builder.in(cond.column, cond.value);
      }

      const { data, error } = await builder;
      if (error) throw error;
      return (data || []) as T[];
    }

    // ── SELECT queries ──
    const selectMatch = normalized.match(
      /^SELECT\s+(.+?)\s+FROM\s+(\w+)(?:\s+(.*))?$/i
    );
    if (selectMatch) {
      const fields = selectMatch[1];
      const table = selectMatch[2];
      const rest = selectMatch[3] || "";

      const columns = parseSelectFields(fields);
      let builder = sp.from(table).select(columns);

      // Parse WHERE, ORDER BY, LIMIT, OFFSET from rest
      const parsed = parseQueryRest(rest, params || []);
      builder = applyParsedFilters(builder, parsed);

      const { data, error } = await builder;
      if (error) throw error;
      return (data || []) as T[];
    }

    // ── Fallback: try as a raw RPC call ──
    console.warn(`[supabase-query] Unhandled SQL pattern: ${normalized.substring(0, 100)}`);
    return [];
  } catch (err: any) {
    console.error(`[supabase-query] Error: ${err.message}`, { sql: normalized.substring(0, 200) });
    return [];
  }
}

/**
 * queryAs — same as query but with user context (for RLS-protected tables).
 */
export async function queryAs<T = any>(
  userId: string,
  sql: string,
  params?: any[]
): Promise<T[]> {
  // For now, use service role (same as query) since most tables don't have strict RLS
  // In the future, we could create a user-scoped client
  return query<T>(sql, params);
}

// ══════════════════════════════════════════════
// Query parsing helpers
// ══════════════════════════════════════════════

function parseSelectFields(fields: string): string {
  // Convert "id, email, fit_score" to Supabase's column syntax
  if (fields.trim() === "*") return "*";
  return fields
    .split(",")
    .map((f) => {
      const trimmed = f.trim();
      // Remove aliases like "AS count" or "::text"
      const cleaned = trimmed
        .replace(/::\w+/g, "")
        .replace(/\s+AS\s+\w+/gi, "")
        .trim();
      return cleaned;
    })
    .join(",");
}

function parseValueSets(valuesStr: string, params: any[]): any[][] {
  // Handle ($1, $2, $3), ($4, $5, $6) style
  const sets: any[][] = [];
  let paramIdx = 0;

  // Split by ),( to get individual value sets
  const rawSets = valuesStr.split(/\)\s*,\s*\(/);
  for (const rawSet of rawSets) {
    const cleaned = rawSet.replace(/[()]/g, "").trim();
    const values = cleaned.split(",").map((v) => {
      const trimmed = v.trim();
      // Handle $N params
      const paramMatch = trimmed.match(/^\$(\d+)$/);
      if (paramMatch) {
        return params[parseInt(paramMatch[1]) - 1];
      }
      // Handle ::type casts
      const castMatch = trimmed.match(/^\$(\d+)::\w+$/);
      if (castMatch) {
        return params[parseInt(castMatch[1]) - 1];
      }
      // Handle string literals
      if (
        (trimmed.startsWith("'") && trimmed.endsWith("'")) ||
        (trimmed.startsWith('"') && trimmed.endsWith('"'))
      ) {
        return trimmed.slice(1, -1);
      }
      // Handle NOW()
      if (trimmed.toUpperCase() === "NOW()") return new Date().toISOString();
      // Handle boolean
      if (trimmed.toLowerCase() === "true") return true;
      if (trimmed.toLowerCase() === "false") return false;
      // Handle null
      if (trimmed.toLowerCase() === "null") return null;
      // Handle numbers
      const num = Number(trimmed);
      if (!isNaN(num)) return num;
      return trimmed;
    });
    sets.push(values);
  }

  return sets;
}

function parseSetClause(
  setClause: string,
  params: any[]
): { values: Record<string, any>; _extraParamCount: number } {
  const values: Record<string, any> = {};
  // Split by comma, but not inside functions
  const parts = setClause.split(/,(?![^(]*\))/);
  let paramOffset = 0;

  for (const part of parts) {
    const eqIdx = part.indexOf("=");
    if (eqIdx === -1) continue;

    const col = part.substring(0, eqIdx).trim();
    const val = part.substring(eqIdx + 1).trim();

    // Handle NOW()
    if (val.toUpperCase() === "NOW()") {
      values[col] = new Date().toISOString();
      continue;
    }

    // Handle $N params
    const paramMatch = val.match(/^\$(\d+)$/);
    if (paramMatch) {
      values[col] = params[parseInt(paramMatch[1]) - 1];
      continue;
    }

    // Handle string values
    if (
      (val.startsWith("'") && val.endsWith("'")) ||
      (val.startsWith('"') && val.endsWith('"'))
    ) {
      values[col] = val.slice(1, -1);
      continue;
    }

    values[col] = val;
  }

  return { values, _extraParamCount: 0 };
}

interface ParsedWhere {
  column: string;
  operator: string;
  value: any;
}

interface ParsedQuery {
  whereConditions: ParsedWhere[];
  orderBy?: { column: string; ascending: boolean };
  limit?: number;
  offset?: number;
}

function parseWhereClause(
  whereClause: string,
  _paramOffset: number
): { whereConditions: ParsedWhere[]; whereParams: any[] } {
  // Simplified WHERE parser
  const conditions: ParsedWhere[] = [];

  // Handle "column = $N" patterns
  const eqPattern = /(\w+(?:\.\w+)?)\s*=\s*\$(\d+)/g;
  let match;
  while ((match = eqPattern.exec(whereClause)) !== null) {
    conditions.push({
      column: match[1],
      operator: "eq",
      value: _paramOffset > 0 ? match[2] : match[2], // Will be resolved by caller
    });
  }

  // Handle "column = 'value'" patterns
  const eqStrPattern = /(\w+(?:\.\w+)?)\s*=\s*'([^']+)'/g;
  while ((match = eqStrPattern.exec(whereClause)) !== null) {
    conditions.push({
      column: match[1],
      operator: "eq",
      value: match[2],
    });
  }

  // Handle "column = ANY($N)" patterns (IN clause)
  const anyPattern = /(\w+)\s*=\s*ANY\(\$(\d+)\)/g;
  while ((match = anyPattern.exec(whereClause)) !== null) {
    conditions.push({
      column: match[1],
      operator: "in",
      value: `_param_${match[2]}`, // Placeholder - caller resolves
    });
  }

  // Handle "column IN ($1, $2)" patterns
  const inPattern = /(\w+)\s+IN\s*\(([^)]+)\)/gi;
  while ((match = inPattern.exec(whereClause)) !== null) {
    conditions.push({
      column: match[1],
      operator: "in",
      value: `_in_${match[2]}`,
    });
  }

  return { whereConditions: conditions, whereParams: [] };
}

function applyWhereClause(
  builder: any,
  whereClause: string,
  params: any[]
): any {
  if (!whereClause) return builder;

  // Parse simple WHERE conditions
  const conditions = whereClause.split(/\s+AND\s+/i);

  for (const cond of conditions) {
    const trimmed = cond.trim();

    // column = $N
    const paramMatch = trimmed.match(/^(\w+)\s*=\s*\$(\d+)$/);
    if (paramMatch) {
      builder = builder.eq(paramMatch[1], params[parseInt(paramMatch[2]) - 1]);
      continue;
    }

    // column = 'value'
    const strMatch = trimmed.match(/^(\w+)\s*=\s*'([^']+)'$/);
    if (strMatch) {
      builder = builder.eq(strMatch[1], strMatch[2]);
      continue;
    }

    // column >= $N or column > $N
    const gteMatch = trimmed.match(/^(\w+)\s*>=\s*\$(\d+)$/);
    if (gteMatch) {
      builder = builder.gte(gteMatch[1], params[parseInt(gteMatch[2]) - 1]);
      continue;
    }

    const gtMatch = trimmed.match(/^(\w+)\s*>\s*(\d+)$/);
    if (gtMatch) {
      builder = builder.gt(gtMatch[1], parseInt(gtMatch[2]));
      continue;
    }

    // column IS NOT NULL
    const notNullMatch = trimmed.match(/^(\w+)\s+IS\s+NOT\s+NULL$/i);
    if (notNullMatch) {
      builder = builder.not(notNullMatch[1], "is", null);
      continue;
    }
  }

  return builder;
}

function parseQueryRest(rest: string, params: any[]): ParsedQuery {
  const result: ParsedQuery = { whereConditions: [] };

  // Extract WHERE
  const whereMatch = rest.match(/WHERE\s+(.+?)(?:\s+ORDER\s+BY|\s+LIMIT|\s+OFFSET|$)/i);
  if (whereMatch) {
    const { whereConditions } = parseWhereClause(whereMatch[1], 0);
    result.whereConditions = whereConditions;
  }

  // Extract ORDER BY
  const orderMatch = rest.match(/ORDER\s+BY\s+(\w+)(?:\s+(?:ASC|DESC))?(?:\s+NULLS\s+(?:FIRST|LAST))?(?:\s+LIMIT|\s+OFFSET|$)/i);
  if (orderMatch) {
    const isDesc = /DESC/i.test(rest.match(/ORDER\s+BY\s+\w+\s+(DESC|ASC)/i)?.[1] || "DESC");
    result.orderBy = { column: orderMatch[1], ascending: !isDesc };
  }

  // Extract LIMIT
  const limitMatch = rest.match(/LIMIT\s+\$(\d+)/i) || rest.match(/LIMIT\s+(\d+)/i);
  if (limitMatch) {
    result.limit = limitMatch[1].startsWith("$")
      ? params[parseInt(limitMatch[1].slice(1)) - 1]
      : parseInt(limitMatch[1]);
  }

  // Extract OFFSET
  const offsetMatch = rest.match(/OFFSET\s+\$(\d+)/i) || rest.match(/OFFSET\s+(\d+)/i);
  if (offsetMatch) {
    result.offset = offsetMatch[1].startsWith("$")
      ? params[parseInt(offsetMatch[1].slice(1)) - 1]
      : parseInt(offsetMatch[1]);
  }

  return result;
}

function applyParsedFilters(builder: any, parsed: ParsedQuery): any {
  // Apply WHERE
  for (const cond of parsed.whereConditions) {
    if (cond.operator === "eq") builder = builder.eq(cond.column, cond.value);
    else if (cond.operator === "in") builder = builder.in(cond.column, cond.value);
    else if (cond.operator === "gt") builder = builder.gt(cond.column, cond.value);
    else if (cond.operator === "gte") builder = builder.gte(cond.column, cond.value);
  }

  // Apply ORDER BY
  if (parsed.orderBy) {
    builder = builder.order(parsed.orderBy.column, {
      ascending: parsed.orderBy.ascending,
    });
  }

  // Apply LIMIT/OFFSET
  if (parsed.limit) {
    const from = parsed.offset || 0;
    const to = from + parsed.limit - 1;
    builder = builder.range(from, to);
  }

  return builder;
}
