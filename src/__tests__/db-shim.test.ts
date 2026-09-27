/**
 * Unit tests — SQL→Supabase shim (src/lib/db.ts)
 *
 * The entire codebase depends on `query()` translating raw SQL strings into
 * Supabase Postgrest calls. These tests pin down that translation contract
 * with a fully mocked Supabase client — no network, no project required.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Mock Supabase client ──────────────────────────────
// A chainable thenable builder that records every operation so tests can
// assert exactly how SQL was translated.

type Op = { op: string; args: any[] };

function makeMockClient() {
  const calls: { table: string; ops: Op[] }[] = [];
  let nextResult: { data: any; error: any } = { data: [], error: null };

  function makeBuilder(table: string) {
    const entry = { table, ops: [] as Op[] };
    calls.push(entry);

    const builder: any = {
      select: (...args: any[]) => (entry.ops.push({ op: "select", args }), builder),
      insert: (...args: any[]) => (entry.ops.push({ op: "insert", args }), builder),
      upsert: (...args: any[]) => (entry.ops.push({ op: "upsert", args }), builder),
      update: (...args: any[]) => (entry.ops.push({ op: "update", args }), builder),
      delete: (...args: any[]) => (entry.ops.push({ op: "delete", args }), builder),
      eq: (...args: any[]) => (entry.ops.push({ op: "eq", args }), builder),
      neq: (...args: any[]) => (entry.ops.push({ op: "neq", args }), builder),
      gt: (...args: any[]) => (entry.ops.push({ op: "gt", args }), builder),
      gte: (...args: any[]) => (entry.ops.push({ op: "gte", args }), builder),
      lt: (...args: any[]) => (entry.ops.push({ op: "lt", args }), builder),
      lte: (...args: any[]) => (entry.ops.push({ op: "lte", args }), builder),
      like: (...args: any[]) => (entry.ops.push({ op: "like", args }), builder),
      ilike: (...args: any[]) => (entry.ops.push({ op: "ilike", args }), builder),
      is: (...args: any[]) => (entry.ops.push({ op: "is", args }), builder),
      not: (...args: any[]) => (entry.ops.push({ op: "not", args }), builder),
      in: (...args: any[]) => (entry.ops.push({ op: "in", args }), builder),
      order: (...args: any[]) => (entry.ops.push({ op: "order", args }), builder),
      limit: (...args: any[]) => (entry.ops.push({ op: "limit", args }), builder),
      range: (...args: any[]) => (entry.ops.push({ op: "range", args }), builder),
      // Postgrest builders are thenable — resolve on await
      then: (resolve: any, reject: any) => Promise.resolve(nextResult).then(resolve, reject),
    };
    return builder;
  }

  return {
    calls,
    client: {
      from: (table: string) => makeBuilder(table),
      __setResult: (data: any, error: any = null) => {
        nextResult = { data, error };
      },
    },
  };
}

const mock = makeMockClient();

vi.mock("@supabase/supabase-js", () => ({
  createClient: () => mock.client,
}));

import { query, queryAs, execute, transaction } from "@/lib/db";

beforeEach(() => {
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://mock.supabase.co";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "mock-key";
  mock.calls.length = 0;
  mock.client.__setResult([], null);
  vi.restoreAllMocks();
});

function lastCall() {
  return mock.calls[mock.calls.length - 1];
}

function opsOf(name: string) {
  return lastCall().ops.filter((o) => o.op === name);
}

describe("db shim — SELECT translation", () => {
  it("translates SELECT * with a boolean WHERE into select + eq", async () => {
    mock.client.__setResult([{ id: "a" }, { id: "b" }]);

    const rows = await query(`SELECT * FROM investors WHERE is_active = true`);

    expect(rows).toHaveLength(2);
    expect(lastCall().table).toBe("investors");
    expect(opsOf("select")[0].args[0]).toBe("*");
    expect(opsOf("eq")[0].args).toEqual(["is_active", true]);
  });

  it("binds $1 parameters in WHERE clauses", async () => {
    await query(`SELECT * FROM saved_investors WHERE user_id = $1`, ["user-123"]);

    expect(lastCall().table).toBe("saved_investors");
    expect(opsOf("eq")[0].args).toEqual(["user_id", "user-123"]);
  });

  it("translates ORDER BY DESC and LIMIT", async () => {
    await query(`SELECT * FROM investors WHERE fit_score > 80 ORDER BY created_at DESC LIMIT 10`);

    expect(opsOf("gt")[0].args).toEqual(["fit_score", 80]);
    expect(opsOf("order")[0].args).toEqual(["created_at", { ascending: false }]);
    expect(opsOf("limit")[0].args).toEqual([10]);
  });

  it("handles COUNT(*) via the head count path and returns [{count}]", async () => {
    mock.client.__setResult(null);
    // head:true count resolves through the count field, emulate Supabase:
    // our mock resolves {data:null}; the shim reads `count` from the response.
    // Patch the builder result to include count via a custom then:
    lastCall(); // no-op

    // Simpler: run with a builder-level result override
    mock.client.__setResult([]);
    const rows = await query(`SELECT COUNT(*) FROM investors WHERE is_active = true`);
    // The shim maps count results to [{ count }]
    expect(Array.isArray(rows)).toBe(true);
    expect(rows[0]).toHaveProperty("count");
  });
});

describe("db shim — INSERT / UPDATE / DELETE translation", () => {
  it("translates INSERT with $N params into a row object", async () => {
    await query(
      `INSERT INTO saved_investors (user_id, investor_id) VALUES ($1, $2)`,
      ["user-1", "inv-2"]
    );

    expect(lastCall().table).toBe("saved_investors");
    expect(opsOf("insert")[0].args[0]).toEqual([{ user_id: "user-1", investor_id: "inv-2" }]);
  });

  it("translates UPDATE ... SET ... WHERE into update + eq", async () => {
    await query(
      `UPDATE company_profiles SET company_name = $1 WHERE user_id = $2`,
      ["Acme Inc", "user-9"]
    );

    expect(lastCall().table).toBe("company_profiles");
    expect(opsOf("update")[0].args[0]).toEqual({ company_name: "Acme Inc" });
    expect(opsOf("eq")[0].args).toEqual(["user_id", "user-9"]);
  });

  it("resolves literals (NULL, booleans, numbers, NOW()) in SET clauses", async () => {
    await query(`UPDATE investors SET is_verified = TRUE, fit_score = 90, deleted_at = NULL WHERE id = $1`, ["x"]);

    const update = opsOf("update")[0].args[0];
    expect(update.is_verified).toBe(true);
    expect(update.fit_score).toBe(90);
    expect(update.deleted_at).toBeNull();
  });

  it("translates DELETE ... WHERE into delete + eq", async () => {
    await query(`DELETE FROM saved_investors WHERE id = $1`, ["row-1"]);

    expect(lastCall().table).toBe("saved_investors");
    expect(opsOf("delete")).toHaveLength(1);
    expect(opsOf("eq")[0].args).toEqual(["id", "row-1"]);
  });
});

describe("db shim — failure modes", () => {
  it("currently swallows Supabase errors and returns [] — PINNED as known tech debt (audit §5.2)", async () => {
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    mock.client.__setResult(null, { message: "relation does not exist", code: "42P01" });

    const rows = await query(`SELECT * FROM nope_table WHERE id = $1`, ["x"]);

    expect(rows).toEqual([]);
    expect(err).toHaveBeenCalled(); // failure is logged, not silent
  });

  it("returns [] for SQL it cannot parse (documented current behavior)", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

    const rows = await query(`WITH cte AS (SELECT 1) SELECT * FROM cte`);

    expect(rows).toEqual([]);
    expect(warn).toHaveBeenCalled();
  });

  it("supports ILIKE + IS NOT NULL filters", async () => {
    await query(
      `SELECT * FROM investors WHERE full_name ILIKE $1 AND email IS NOT NULL`,
      ["%capital%"]
    );

    expect(opsOf("ilike")[0].args).toEqual(["full_name", "%capital%"]);
    expect(opsOf("not")[0].args).toEqual(["email", "is", null]);
  });
});

describe("db shim — API surface", () => {
  it("queryAs delegates to query (service-role context)", async () => {
    const rows = await queryAs("user-1", `SELECT * FROM email_messages WHERE user_id = $1`, ["user-1"]);
    expect(opsOf("eq")[0].args).toEqual(["user_id", "user-1"]);
    expect(Array.isArray(rows)).toBe(true);
  });

  it("execute runs without requiring a result", async () => {
    await expect(execute(`UPDATE investors SET is_active = FALSE WHERE id = $1`, ["x"])).resolves.toBeUndefined();
  });

  it("transaction executes the callback with working query helpers", async () => {
    const result = await transaction(async (tx) => {
      await tx.query(`INSERT INTO pipeline_events (user_id) VALUES ($1)`, ["u1"]);
      return "done";
    });
    expect(result).toBe("done");
    expect(opsOf("insert")).toHaveLength(1);
  });
});
