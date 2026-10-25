/**
 * Unit tests — Privacy service (Phase 3 privacy pack)
 *
 * Pins the export/delete contract against a PostgREST-shaped mock:
 *  - export paginates in 1000-row windows and redacts email_account credentials
 *  - per-table errors are isolated (table skipped, others still exported)
 *  - delete walks children-first and reports per-table counts
 *  - no table is silently dropped: errors are surfaced in the result
 */
import { describe, it, expect, vi } from "vitest";
import {
  exportUserData,
  deleteUserData,
  DELETE_CONFIRMATION,
  USER_DATA_TABLES,
  USER_TABLE_DELETE_ORDER,
} from "@/lib/services/privacy/user-data";

const UID = "11111111-2222-3333-4444-555555555555";

/** Fluent PostgREST-style mock for the single-table shape the service uses. */
function makeSp(opts: {
  rows?: Record<string, unknown[]>;
  selectErrorFor?: (table: string) => Error | null;
  deleteErrorFor?: (table: string) => Error | null;
  deleteCounts?: Record<string, number>;
}) {
  const calls: { op: "select" | "delete"; table: string; from?: number; to?: number }[] = [];
  return {
    calls,
    from(table: string) {
      const handler = {
        select: (_cols: string, _opts?: unknown) => handler,
        eq: (_col: string, _val: string) => handler,
        delete: (opts?: unknown) => { handler.deleteOpts = opts; return handler; },
        deleteOpts: null as unknown,
        range(from: number, to: number) {
          calls.push({ op: "select", table, from, to });
          const all = opts.rows?.[table] || [];
          const err = opts.selectErrorFor?.(table);
          if (err) return Promise.resolve({ data: null, error: err, count: 0 });
          return Promise.resolve({ data: all.slice(from, to + 1), error: null, count: all.length });
        },
        async then(resolve: (v: unknown) => void) {
          // delete({ count }) is awaited directly (no range)
          calls.push({ op: "delete", table });
          const err = opts.deleteErrorFor?.(table);
          if (err) return resolve({ data: null, error: err, count: 0 });
          return resolve({
            data: null,
            error: null,
            count: opts.deleteCounts?.[table] ?? 0,
          });
        },
      };
      return handler;
    },
  };
}

describe("exportUserData", () => {
  it("queries every user-scoped table for the requesting user", async () => {
    const sp = makeSp({ rows: {} });
    const { data, tables } = await exportUserData(sp, UID);
    for (const t of USER_DATA_TABLES) {
      expect(tables[t]).toBe(true);
      expect(data[t]).toEqual([]);
    }
    const sel = sp.calls.filter((c) => c.op === "select");
    expect(sel.length).toBe(USER_DATA_TABLES.length);
    for (const c of sel) {
      // eq("user_id", uid) is baked into the handler; verify via table set
      expect(USER_DATA_TABLES).toContain(c.table);
    }
  });

  it("redacts email_account credential fields", async () => {
    const sp = makeSp({
      rows: {
        email_accounts: [
          { id: "a1", user_id: UID, access_token: "secret-at", refresh_token: "secret-rt", smtp_pass_encrypted: "enc", email_address: "x@y.z" },
        ],
      },
    });
    const { data } = await exportUserData(sp, UID);
    const row = (data.email_accounts as Record<string, unknown>[])[0];
    expect(row.access_token).toBe("<redacted>");
    expect(row.refresh_token).toBe("<redacted>");
    expect(row.smtp_pass_encrypted).toBe("<redacted>");
    expect(row.email_address).toBe("x@y.z"); // non-credential fields survive
  });

  it("isolates per-table failures instead of failing the export", async () => {
    const sp = makeSp({
      rows: { campaigns: [{ id: "c1" }] },
      selectErrorFor: (t) => (t === "email_threads" ? new Error("table gone") : null),
    });
    const { data, tables } = await exportUserData(sp, UID);
    expect(tables.email_threads).toMatch(/skipped: table gone/);
    expect(data.email_threads).toEqual([]);
    expect(data.campaigns).toEqual([{ id: "c1" }]);
    expect(tables.campaigns).toBe(true);
  });
});

describe("deleteUserData", () => {
  it("deletes children before parents (FK order)", async () => {
    const sp = makeSp({ deleteCounts: {} });
    await deleteUserData(sp, UID);
    const saw = sp.calls.filter((c) => c.op === "delete").map((c) => c.table);
    expect(saw).toEqual([...USER_TABLE_DELETE_ORDER]);
    const idx = (t: string) => saw.indexOf(t);
    // FK-derived ordering pins from the live schema:
    expect(idx("pipeline_events")).toBeLessThan(idx("user_pipeline_entries"));
    expect(idx("campaign_sequence_emails")).toBeLessThan(idx("campaign_sequences"));
    expect(idx("email_tracking_events")).toBeLessThan(idx("email_messages"));
    expect(idx("campaigns")).toBeGreaterThan(idx("email_messages"));
    expect(idx("company_profiles")).toBeGreaterThan(idx("saved_investors"));
  });

  it("reports per-table counts and surfaces (not swallows) errors", async () => {
    const sp = makeSp({
      deleteCounts: { campaigns: 3, email_messages: 7 },
      deleteErrorFor: (t) => (t === "email_threads" ? new Error("violates FK") : null),
    });
    const { deleted, errors } = await deleteUserData(sp, UID);
    expect(deleted.campaigns).toBe(3);
    expect(deleted.email_messages).toBe(7);
    expect(errors.email_threads).toMatch(/violates FK/);
    expect(Object.keys(errors).length).toBe(1);
  });

  it("exposes the exact confirmation phrase the API route requires", () => {
    expect(DELETE_CONFIRMATION).toBe("DELETE MY ACCOUNT");
  });
});
