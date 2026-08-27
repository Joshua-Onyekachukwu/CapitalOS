import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

/**
 * CONVEX = Full Investor Archive + App State
 * 
 * Strategy:
 * - Supabase: Hot data (50K most-searched, active investors)
 * - Convex: Full archive (all investors, 1M+ when needed)
 * 
 * When user searches:
 * 1. Search Supabase first (fast, <50ms)
 * 2. If not found, search Convex (slower, but complete)
 * 
 * Background jobs keep both in sync.
 */

export default defineSchema({
  // ════════════════════════════════════════════════════════════════
  // FULL INVESTOR ARCHIVE (1M+ records)
  // Every investor ever scraped, with all details.
  // ════════════════════════════════════════════════════════════════

  investors: defineTable({
    // ── Identity ──
    fullName: v.string(),
    firstName: v.optional(v.string()),
    lastName: v.optional(v.string()),
    jobTitle: v.optional(v.string()),
    investorType: v.string(),
    
    // ── Company ──
    companyName: v.optional(v.string()),
    companyWebsite: v.optional(v.string()),
    linkedinUrl: v.optional(v.string()),
    
    // ── Location ──
    country: v.optional(v.string()),
    city: v.optional(v.string()),
    
    // ── Contact ──
    email: v.optional(v.string()),
    phone: v.optional(v.string()),
    
    // ── Investment ──
    minCheckSize: v.optional(v.number()),
    maxCheckSize: v.optional(v.number()),
    fundSize: v.optional(v.number()),
    aum: v.optional(v.number()),
    investmentStages: v.optional(v.array(v.string())),
    investmentSectors: v.optional(v.array(v.string())),
    investmentGeographies: v.optional(v.array(v.string())),
    
    // ── History ──
    numberOfInvestments: v.optional(v.number()),
    numberOfExits: v.optional(v.number()),
    lastInvestmentDate: v.optional(v.string()),
    
    // ── Scores ──
    fitScore: v.optional(v.number()),
    dataQualityScore: v.optional(v.number()),
    
    // ── Status ──
    outreachReadiness: v.optional(v.string()),
    
    // ── Source ──
    source: v.string(),
    sourceId: v.optional(v.string()),
    
    // ── Sync ──
    inSupabase: v.boolean(), // true = also in Supabase hot data
    
    // ── Timestamps ──
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_investorType", ["investorType"])
    .index("by_country", ["country"])
    .index("by_source", ["source"])
    .index("by_score", ["fitScore"])
    .index("by_supabase", ["inSupabase"])
    .index("by_created", ["createdAt"]),

  // ════════════════════════════════════════════════════════════════
  // APP STATE (jobs, metrics, notifications)
  // ════════════════════════════════════════════════════════════════

  researchJobs: defineTable({
    supabaseInvestorId: v.string(),
    investorName: v.string(),
    status: v.union(
      v.literal("queued"),
      v.literal("scraping"),
      v.literal("enriching"),
      v.literal("scoring"),
      v.literal("completed"),
      v.literal("failed")
    ),
    progress: v.number(),
    steps: v.array(v.object({
      name: v.string(),
      status: v.union(v.literal("pending"), v.literal("running"), v.literal("done"), v.literal("failed")),
    })),
    startedAt: v.number(),
    completedAt: v.optional(v.number()),
    createdAt: v.number(),
  })
    .index("by_status", ["status"])
    .index("by_created", ["createdAt"]),

  dashboardMetrics: defineTable({
    key: v.string(),
    value: v.number(),
    label: v.string(),
    updatedAt: v.number(),
  })
    .index("by_key", ["key"]),

  notifications: defineTable({
    userId: v.string(),
    type: v.string(),
    title: v.string(),
    message: v.string(),
    read: v.boolean(),
    createdAt: v.number(),
  })
    .index("by_user", ["userId", "read"]),

  scrapingJobs: defineTable({
    source: v.string(),
    status: v.union(
      v.literal("queued"),
      v.literal("running"),
      v.literal("completed"),
      v.literal("failed")
    ),
    totalRecords: v.number(),
    processedRecords: v.number(),
    insertedRecords: v.number(),
    startedAt: v.number(),
    completedAt: v.optional(v.number()),
  })
    .index("by_status", ["status"]),

  // ════════════════════════════════════════════════════════════════
  // RAW INVESTOR STAGING — Unqualified scraped records
  // Keeps Supabase free tier from being overwhelmed.
  // Only qualified investors are promoted to Supabase.
  // ════════════════════════════════════════════════════════════════

  rawInvestors: defineTable({
    rawData: v.any(),
    fullName: v.string(),
    firstName: v.optional(v.string()),
    lastName: v.optional(v.string()),
    companyName: v.optional(v.string()),
    email: v.optional(v.string()),
    phone: v.optional(v.string()),
    website: v.optional(v.string()),
    linkedinUrl: v.optional(v.string()),
    country: v.optional(v.string()),
    city: v.optional(v.string()),
    investorType: v.optional(v.string()),
    source: v.string(),
    sourceId: v.optional(v.string()),
    sourceUrl: v.optional(v.string()),
    scrapedAt: v.number(),
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
    dedupeKey: v.string(),
    isDuplicate: v.boolean(),
    duplicateOf: v.optional(v.string()),
    emailInferred: v.boolean(),
    emailVerified: v.boolean(),
    emailSource: v.optional(v.string()),
    emailConfidence: v.optional(v.string()),
    qualificationScore: v.optional(v.number()),
    syncedToSupabase: v.boolean(),
    supabaseId: v.optional(v.string()),
    syncedAt: v.optional(v.number()),
    lastError: v.optional(v.string()),
    retryCount: v.number(),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_status", ["status"])
    .index("by_source", ["source"])
    .index("by_dedupeKey", ["dedupeKey"])
    .index("by_synced", ["syncedToSupabase"])
    .index("by_created", ["createdAt"]),

  // ════════════════════════════════════════════════════════════════
  // ENRICHMENT QUEUE
  // ════════════════════════════════════════════════════════════════

  enrichmentJobs: defineTable({
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
    .index("by_source", ["source"]),

  // ════════════════════════════════════════════════════════════════
  // DATA QUALITY METRICS — Daily snapshots
  // ════════════════════════════════════════════════════════════════

  dataQualityMetrics: defineTable({
    date: v.string(),
    totalRaw: v.number(),
    totalQualified: v.number(),
    totalPromoted: v.number(),
    withEmail: v.number(),
    emailVerified: v.number(),
    emailInferred: v.number(),
    bySource: v.any(),
    createdAt: v.number(),
  })
    .index("by_date", ["date"]),
});
