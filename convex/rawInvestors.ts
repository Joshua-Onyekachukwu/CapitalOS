import { defineTable } from "convex/server";
import { v } from "convex/values";

// ════════════════════════════════════════════════════════════════
// RAW INVESTOR STAGING — Unqualified scraped records
// ════════════════════════════════════════════════════════════════
// This table stores raw scraped investor data BEFORE qualification.
// Only investors that pass qualification are promoted to Supabase.
// Keeps Supabase free tier from being overwhelmed with raw data.

export const rawInvestors = defineTable({
  // ── Raw scraped data (preserved as-is) ──
  rawData: v.any(), // Original scraped payload

  // ── Normalized fields (extracted from rawData) ──
  fullName: v.string(),
  firstName: v.optional(v.string()),
  lastName: v.optional(v.string()),
  jobTitle: v.optional(v.string()),
  companyName: v.optional(v.string()),
  email: v.optional(v.string()),
  phone: v.optional(v.string()),
  website: v.optional(v.string()),
  linkedinUrl: v.optional(v.string()),
  country: v.optional(v.string()),
  city: v.optional(v.string()),
  investorType: v.optional(v.string()),

  // ── Source tracking ──
  source: v.string(), // "edgar-13f", "edgar-form-d", "fishtank", "vc-scraper", etc.
  sourceId: v.optional(v.string()),
  sourceUrl: v.optional(v.string()),
  scrapedAt: v.number(),

  // ── Processing status ──
  status: v.union(
    v.literal("scraped"),
    v.literal("deduplicated"),
    v.literal("normalized"),
    v.literal("enriched"),
    v.literal("scored"),
    v.literal("qualified"),
    v.literal("promoted"),
    v.literal("rejected"),
    v.literal("error")
  ),

  // ── Deduplication ──
  dedupeKey: v.string(), // email or "name|company" hash
  isDuplicate: v.boolean(),
  duplicateOf: v.optional(v.string()), // ID of canonical record

  // ── Enrichment tracking ──
  emailInferred: v.boolean(),
  emailVerified: v.boolean(),
  emailSource: v.optional(v.string()),
  emailConfidence: v.optional(v.string()), // "verified", "likely", "inferred", "unverified"

  // ── Qualification ──
  qualificationScore: v.optional(v.number()),
  qualificationNotes: v.optional(v.string()),

  // ── Sync to Supabase ──
  syncedToSupabase: v.boolean(),
  supabaseId: v.optional(v.string()),
  syncedAt: v.optional(v.number()),

  // ── Errors ──
  lastError: v.optional(v.string()),
  retryCount: v.number(),

  // ── Timestamps ──
  createdAt: v.number(),
  updatedAt: v.number(),
})
  .index("by_status", ["status"])
  .index("by_source", ["source"])
  .index("by_dedupeKey", ["dedupeKey"])
  .index("by_synced", ["syncedToSupabase"])
  .index("by_created", ["createdAt"])
  .index("by_email", ["email"]);

// ════════════════════════════════════════════════════════════════
// ENRICHMENT QUEUE — Jobs that need processing
// ════════════════════════════════════════════════════════════════

export const enrichmentJobs = defineTable({
  source: v.string(),
  status: v.union(
    v.literal("queued"),
    v.literal("running"),
    v.literal("completed"),
    v.literal("failed")
  ),
  totalRecords: v.number(),
  processedRecords: v.number(),
  enrichedRecords: v.number(),
  failedRecords: v.number(),
  qualifiedRecords: v.number(),
  promotedRecords: v.number(),
  error: v.optional(v.string()),
  startedAt: v.number(),
  completedAt: v.optional(v.number()),
})
  .index("by_status", ["status"])
  .index("by_source", ["source"]);

// ════════════════════════════════════════════════════════════════
// DATA QUALITY METRICS — Tracking data health
// ════════════════════════════════════════════════════════════════

export const dataQualityMetrics = defineTable({
  date: v.string(), // "2026-08-27"
  totalRaw: v.number(),
  totalQualified: v.number(),
  totalPromoted: v.number(),
  withEmail: v.number(),
  emailVerified: v.number(),
  emailInferred: v.number(),
  bySource: v.any(), // { "edgar-13f": { total: 30000, qualified: 15000 }, ... }
  createdAt: v.number(),
})
  .index("by_date", ["date"]);
