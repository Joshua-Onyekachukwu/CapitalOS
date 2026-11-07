// =============================================
// Import preview gate
// =============================================
// A preview only protects the corpus if the write path refuses anything it did
// not sign, so the token behaviour is tested rather than assumed.

import { beforeAll, describe, expect, it, vi } from "vitest";

let signImportPreview: (csv: string, source: string) => string;
let verifyImportPreview: (token: unknown, csv: string, source: string) => boolean;

beforeAll(async () => {
  vi.stubEnv("IMPORT_CONFIRM_SECRET", "test-preview-secret");
  ({ signImportPreview, verifyImportPreview } = await import("@/lib/admin/import-preview"));
});

const CSV = "full_name,email\nFixture Capital,fund@example.invalid\n";

describe("import preview tokens", () => {
  it("accepts a token for the exact content and source it signed", () => {
    const token = signImportPreview(CSV, "csv_import");
    expect(verifyImportPreview(token, CSV, "csv_import")).toBe(true);
  });

  it("rejects edited content", () => {
    const token = signImportPreview(CSV, "csv_import");
    expect(verifyImportPreview(token, `${CSV}Fixture Two,two@example.invalid\n`, "csv_import")).toBe(
      false
    );
  });

  it("rejects a different source", () => {
    const token = signImportPreview(CSV, "csv_import");
    expect(verifyImportPreview(token, CSV, "other_source")).toBe(false);
  });

  it("rejects a missing or malformed token", () => {
    expect(verifyImportPreview(undefined, CSV, "csv_import")).toBe(false);
    expect(verifyImportPreview("nonsense", CSV, "csv_import")).toBe(false);
    expect(verifyImportPreview("123.", CSV, "csv_import")).toBe(false);
  });

  it("rejects an expired token", () => {
    const token = signImportPreview(CSV, "csv_import");
    const future = Date.now() + 11 * 60 * 1000;
    vi.spyOn(Date, "now").mockReturnValue(future);
    expect(verifyImportPreview(token, CSV, "csv_import")).toBe(false);
    vi.restoreAllMocks();
  });
});
