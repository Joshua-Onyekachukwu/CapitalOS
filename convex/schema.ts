import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  // Raw scraped investors — staging area before qualification
  raw_investors: defineTable({
    // Source tracking
    source: v.string(), // "edgar", "fishtank", "apollo", "web_scrape", "crunchbase"
    sourceUrl: v.optional(v.string()),
    sourceId: v.optional(v.string()), // Original ID from source
    scrapedAt: v.string(), // ISO timestamp

    // Raw data preserved from scraping
    rawData: v.any(), // Original scraped payload

    // Parsed fields (may be incomplete)
    firstName: v.optional(v.string()),
    lastName: v.optional(v.string()),
    fullName: v.string(),
    email: v.optional(v.string()),
    jobTitle: v.optional(v.string()),
    firmName: v.optional(v.string()),
    investorType: v.optional(v.string()),
    linkedinUrl: v.optional(v.string()),
    website: v.optional(v.string()),
    city: v.optional(v.string()),
    country: v.optional(v.string()),

    // Investment preferences (parsed from raw)
    investmentStages: v.optional(v.array(v.string())),
    investmentSectors: v.optional(v.array(v.string())),
    checkSizeMin: v.optional(v.number()),
    checkSizeMax: v.optional(v.number()),
    portfolioCompanies: v.optional(v.array(v.string())),

    // Processing status
    status: v.union(
      v.literal("scraped"),
      v.literal("deduplicating"),
      v.literal("deduplicated"),
      v.literal("normalizing"),
      v.literal("normalized"),
      v.literal("enriching"),
      v.literal("enriched"),
      v.literal("scoring"),
      v.literal("scored"),
      v.literal("qualifying"),
      v.literal("qualified"),
      v.literal("synced"),
      v.literal("rejected"),
      v.literal("error")
    ),

    // Deduplication
    deduplicationKey: v.string(), // Normalized key for dedup
    duplicateOf: v.optional(v.string()), // ID of the canonical record

    // Quality
    dataQualityScore: v.number(), // 0-100
    confidence: v.number(), // 0-100

    // Processing metadata
    lastProcessedAt: v.optional(v.string()),
    processingError: v.optional(v.string()),
    retryCount: v.number(),

    // Enrichment
    enrichedAt: v.optional(v.string()),
    enrichmentSource: v.optional(v.string()),
    emailVerified: v.boolean(),
    emailVerificationStatus: v.optional(v.union(
      v.literal("verified"),
      v.literal("likely"),
      v.literal("inferred"),
      v.literal("unverified"),
      v.literal("invalid")
    )),
    emailVerifiedAt: v.optional(v.string()),
  })
    .index("by_status", ["status"])
    .index("by_source", ["source"])
    .index("by_dedup_key", ["deduplicationKey"])
    .index("by_status_and_source", ["status", "source"])
    .index("by_email", ["email"]),

  // Qualification pipeline runs
  pipeline_runs: defineTable({
    runType: v.string(), // "dedup", "normalize", "enrich", "score", "qualify", "sync"
    status: v.union(
      v.literal("running"),
      v.literal("completed"),
      v.literal("failed")
    ),
    startedAt: v.string(),
    completedAt: v.optional(v.string()),
    recordsProcessed: v.number(),
    recordsSucceeded: v.number(),
    recordsFailed: v.number(),
    recordsSkipped: v.number(),
    errorLog: v.optional(v.array(v.string())),
    metadata: v.optional(v.any()),
  })
    .index("by_type", ["runType"])
    .index("by_status", ["status"]),

  // Sync log — tracks what was promoted to Supabase
  sync_log: defineTable({
    rawInvestorId: v.string(), // Convex raw_investors._id
    supabaseInvestorId: v.optional(v.string()),
    direction: v.union(v.literal("to_supabase"), v.literal("from_supabase")),
    status: v.union(v.literal("pending"), v.literal("synced"), v.literal("failed")),
    syncedAt: v.optional(v.string()),
    error: v.optional(v.string()),
  })
    .index("by_raw_id", ["rawInvestorId"])
    .index("by_status", ["status"]),

  // Scrape jobs — track scraping runs
  scrape_jobs: defineTable({
    source: v.string(),
    status: v.union(
      v.literal("queued"),
      v.literal("running"),
      v.literal("completed"),
      v.literal("failed")
    ),
    startedAt: v.optional(v.string()),
    completedAt: v.optional(v.string()),
    totalRecords: v.number(),
    newRecords: v.number(),
    duplicateRecords: v.number(),
    errorCount: v.number(),
    errors: v.optional(v.array(v.string())),
  })
    .index("by_source", ["source"])
    .index("by_status", ["status"]),
});
