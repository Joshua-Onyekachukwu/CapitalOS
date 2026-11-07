// =============================================
// Form D importer — pooled-fund filter and mapping
// =============================================
// A Form D filing is a company raising money. Only pooled investment funds are
// investors, and only when the fund type maps to a real investor type. These
// tests pin that boundary on a synthetic fixture so the rule cannot quietly
// widen into importing operating companies as investors.

import { createRequire } from "node:module";
import path from "node:path";
import { describe, expect, it } from "vitest";

const requireCjs = createRequire(import.meta.url);
const importer = requireCjs("../../scripts/import-investors.cjs") as {
  readFormDFile: (file: string) => { headers: string[]; rows: Record<string, unknown>[] };
  buildRecord: (
    flat: Record<string, unknown>,
    source: string,
    rowNumber: number,
    fileName: string,
    mode: string
  ) =>
    | { skip: string }
    | {
        record: Record<string, unknown> & {
          full_name: string;
          investor_type: string;
          min_check_size: number | null;
          max_check_size: number | null;
          source_id: string;
        };
        provenance: {
          imports: Array<{ kind: string; fields: string[]; filing_url: string | null }>;
        };
      };
  isPooledFund: (flat: Record<string, unknown>, fundType?: string | null) => boolean;
  formDFundType: (flat: Record<string, unknown>) => string | null;
};

const FIXTURE = path.join(__dirname, "../../scripts/fixtures/form-d-sample.json");
const SOURCE = "form_d_fixture";

function rows() {
  return importer.readFormDFile(FIXTURE).rows;
}

function build(index: number) {
  return importer.buildRecord(rows()[index], SOURCE, index + 2, "form-d-sample.json", "form_d");
}

describe("Form D fixture", () => {
  it("reads every synthetic filing", () => {
    expect(rows()).toHaveLength(4);
  });

  it("prefers the fund type over the generic pooled-fund classification", () => {
    expect(importer.formDFundType(rows()[0])).toBe("Venture Capital Fund");
  });
});

describe("pooled-fund filter", () => {
  it("imports a venture fund as venture_capital", () => {
    const built = build(0);
    if ("skip" in built) throw new Error(`unexpected skip: ${built.skip}`);
    expect(built.record.investor_type).toBe("venture_capital");
    expect(built.record.full_name).toBe("Fixture Ridge Capital Fund III, L.P.");
  });

  it("imports a buyout fund as private_equity", () => {
    const built = build(1);
    if ("skip" in built) throw new Error(`unexpected skip: ${built.skip}`);
    expect(built.record.investor_type).toBe("private_equity");
  });

  it("skips an operating company, which is not an investor", () => {
    const built = build(2);
    expect("skip" in built && built.skip).toBe("not_pooled_fund");
  });

  it("skips a pooled fund whose type has no investor equivalent", () => {
    const built = build(3);
    expect("skip" in built && built.skip.startsWith("unmapped_type")).toBe(true);
  });
});

describe("mapping and provenance", () => {
  it("parses the cheque range the filing actually carried", () => {
    const built = build(0);
    if ("skip" in built) throw new Error(`unexpected skip: ${built.skip}`);
    expect(built.record.min_check_size).toBe(250_000);
    expect(built.record.max_check_size).toBe(2_000_000);
  });

  it("records form_d provenance with the filing URL", () => {
    const built = build(0);
    if ("skip" in built) throw new Error(`unexpected skip: ${built.skip}`);
    const entry = built.provenance.imports[0];
    expect(entry.kind).toBe("form_d");
    expect(entry.filing_url).toContain("example.invalid/form-d/");
  });

  it("lists only fields the source carried, not defaults", () => {
    const built = build(0);
    if ("skip" in built) throw new Error(`unexpected skip: ${built.skip}`);
    const fields = built.provenance.imports[0].fields;
    expect(fields).toContain("min_check_size");
    expect(fields).toContain("investor_type");
    // The fixture has no email; provenance must not claim one.
    expect(fields).not.toContain("email");
  });
});
