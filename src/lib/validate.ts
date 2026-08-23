/**
 * Input Validation with Zod
 *
 * Provides reusable validation schemas for all API inputs.
 * Prevents injection of unexpected data types and values.
 *
 * Usage:
 *   import { validateBody, validateQuery, investorFiltersSchema } from "@/lib/validate";
 *
 *   const filters = validateQuery(request, investorFiltersSchema);
 *   if (filters instanceof NextResponse) return filters; // 400 error
 */

import { z } from "zod";
import { NextRequest, NextResponse } from "next/server";

// ── Common Schemas ──

export const idSchema = z.string().uuid("Invalid ID format");

export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

export const sortSchema = z.object({
  sortBy: z.string().optional(),
  sortDir: z.enum(["asc", "desc"]).default("desc"),
});

// ── Investor Schemas ──

export const investorFiltersSchema = z.object({
  search: z.string().max(200).optional(),
  type: z.string().max(50).optional(),
  sector: z.string().max(50).optional(),
  stage: z.string().max(50).optional(),
  country: z.string().max(100).optional(),
  city: z.string().max(100).optional(),
  readiness: z.string().max(50).optional(),
  verified: z.enum(["true", "false"]).optional(),
  minScore: z.coerce.number().int().min(0).max(100).optional(),
  maxScore: z.coerce.number().int().min(0).max(100).optional(),
  minQuality: z.coerce.number().int().min(0).max(100).optional(),
  hasEmail: z.enum(["true", "false"]).optional(),
  hasLinkedin: z.enum(["true", "false"]).optional(),
  firmId: z.string().uuid().optional(),
  ...paginationSchema.shape,
  ...sortSchema.shape,
});

export const investorIdSchema = z.object({
  id: idSchema,
});

// ── Campaign Schemas ──

export const campaignFiltersSchema = z.object({
  search: z.string().max(200).optional(),
  status: z.enum(["draft", "active", "pending", "running", "completed", "paused", "failed"]).optional(),
  sector: z.string().max(50).optional(),
  stage: z.string().max(50).optional(),
  ...paginationSchema.shape,
  ...sortSchema.shape,
});

// ── Email Schemas ──

export const sendEmailSchema = z.object({
  investorId: idSchema,
  subject: z.string().min(1).max(200),
  bodyHtml: z.string().min(1).max(50000),
  bodyText: z.string().max(50000).optional(),
});

export const draftEmailSchema = z.object({
  investorId: idSchema,
  tone: z.enum(["professional", "casual", "formal", "friendly"]).optional(),
  context: z.string().max(2000).optional(),
});

// ── Deck Schemas ──

export const generateDeckSchema = z.object({
  style: z.enum(["investor", "minimal", "bold"]).optional(),
  slideCount: z.coerce.number().int().min(3).max(30).optional(),
});

// ── Copilot Schemas ──

export const copilotSchema = z.object({
  message: z.string().min(1).max(5000),
  context: z.enum(["dashboard", "investor", "campaign", "deck"]).optional(),
});

// ── Saved Filters Schemas ──

export const savedFilterSchema = z.object({
  name: z.string().min(1).max(100),
  filters: z.record(z.unknown()),
  sortBy: z.string().max(50).optional(),
  pageName: z.string().max(50).default("investors"),
});

// ── Saved Investors Schemas ──

export const saveInvestorSchema = z.object({
  investorId: idSchema,
  notes: z.string().max(1000).optional(),
});

export const unsaveInvestorSchema = z.object({
  savedId: idSchema,
});

// ── Job Schemas ──

export const createJobSchema = z.object({
  type: z.enum([
    "investor_qualification",
    "investor_dedup",
    "apollo_import",
    "email_polling",
    "edgar_scrape",
    "process_raw_records",
    "investor_enrichment",
  ]),
  payload: z.record(z.unknown()).default({}),
});

// ── Profile Schemas ──

export const updateProfileSchema = z.object({
  full_name: z.string().min(1).max(200).trim(),
});

// ── Outreach Schemas ──

export const outreachSequenceSchema = z.object({
  investorId: idSchema,
  founderName: z.string().min(1).max(100),
  companyName: z.string().min(1).max(200),
  companyDescription: z.string().max(2000).optional(),
  roundType: z.string().max(50).optional(),
  raiseAmount: z.string().max(50).optional(),
  tone: z.enum(["professional", "casual", "formal"]).optional(),
});

// ── Validation Helpers ──

/**
 * Validate request body against a zod schema.
 * Returns parsed data or NextResponse with 400 error.
 */
export function validateBody<T>(
  request: NextRequest,
  schema: z.ZodSchema<T>
): T | NextResponse {
  try {
    const body = request.body ? JSON.parse("{}") : {};
    return schema.parse(body);
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json(
        {
          error: "Validation failed",
          details: err.errors.map((e) => ({
            field: e.path.join("."),
            message: e.message,
          })),
        },
        { status: 400 }
      );
    }
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }
}

/**
 * Validate request body (async version that reads the body first).
 */
export async function validateBodyAsync<T>(
  request: NextRequest,
  schema: z.ZodSchema<T>
): Promise<T | NextResponse> {
  try {
    const body = await request.json();
    return schema.parse(body);
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json(
        {
          error: "Validation failed",
          details: err.errors.map((e) => ({
            field: e.path.join("."),
            message: e.message,
          })),
        },
        { status: 400 }
      );
    }
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }
}

/**
 * Validate query parameters against a zod schema.
 * Returns parsed data or NextResponse with 400 error.
 */
export function validateQuery<T>(
  request: NextRequest,
  schema: z.ZodSchema<T>
): T | NextResponse {
  try {
    const params: Record<string, string> = {};
    request.nextUrl.searchParams.forEach((value, key) => {
      params[key] = value;
    });
    return schema.parse(params);
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json(
        {
          error: "Invalid query parameters",
          details: err.errors.map((e) => ({
            field: e.path.join("."),
            message: e.message,
          })),
        },
        { status: 400 }
      );
    }
    return NextResponse.json({ error: "Invalid query parameters" }, { status: 400 });
  }
}
