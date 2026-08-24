import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  // ── Research Jobs ──
  // Tracks investor research/enrichment progress in real-time
  researchJobs: defineTable({
    // Reference to Supabase investor (external ID)
    supabaseInvestorId: v.string(),
    investorName: v.string(),
    
    // Job state
    status: v.union(
      v.literal("queued"),
      v.literal("scraping"),
      v.literal("enriching"),
      v.literal("scoring"),
      v.literal("completed"),
      v.literal("failed")
    ),
    progress: v.number(), // 0-100
    
    // Steps completed
    steps: v.array(v.object({
      name: v.string(),
      status: v.union(v.literal("pending"), v.literal("running"), v.literal("done"), v.literal("failed")),
      startedAt: v.optional(v.number()),
      completedAt: v.optional(v.number()),
      error: v.optional(v.string()),
    })),
    
    // Results
    resultData: v.optional(v.any()),
    errorMessage: v.optional(v.string()),
    
    // Metadata
    startedAt: v.number(),
    completedAt: v.optional(v.number()),
    createdAt: v.number(),
  })
    .index("by_status", ["status"])
    .index("by_investor", ["supabaseInvestorId"])
    .index("by_created", ["createdAt"]),

  // ── Dashboard State ──
  // Live dashboard metrics (updated by background workers)
  dashboardMetrics: defineTable({
    key: v.string(), // e.g., "total_investors", "emails_sent_today"
    value: v.number(),
    label: v.string(),
    updatedAt: v.number(),
  })
    .index("by_key", ["key"]),

  // ── Notifications ──
  notifications: defineTable({
    userId: v.string(),
    type: v.union(
      v.literal("job_complete"),
      v.literal("job_failed"),
      v.literal("new_investor"),
      v.literal("campaign_update"),
      v.literal("system")
    ),
    title: v.string(),
    message: v.string(),
    read: v.boolean(),
    data: v.optional(v.any()),
    createdAt: v.number(),
  })
    .index("by_user", ["userId", "read"])
    .index("by_created", ["createdAt"]),

  // ── Scraping Jobs ──
  scrapingJobs: defineTable({
    source: v.string(), // "edgar_13f", "edgar_form_d", "apollo_csv", etc.
    status: v.union(
      v.literal("queued"),
      v.literal("running"),
      v.literal("completed"),
      v.literal("failed")
    ),
    totalRecords: v.number(),
    processedRecords: v.number(),
    insertedRecords: v.number(),
    failedRecords: v.number(),
    backupPath: v.optional(v.string()),
    startedAt: v.number(),
    completedAt: v.optional(v.number()),
    error: v.optional(v.string()),
  })
    .index("by_status", ["status"])
    .index("by_source", ["source"]),

  // ── Campaign State ──
  campaignState: defineTable({
    campaignId: v.string(),
    status: v.union(
      v.literal("draft"),
      v.literal("sending"),
      v.literal("active"),
      v.literal("paused"),
      v.literal("completed")
    ),
    totalRecipients: v.number(),
    sentCount: v.number(),
    openedCount: v.number(),
    repliedCount: v.number(),
    bouncedCount: v.number(),
    lastSentAt: v.optional(v.number()),
    updatedAt: v.number(),
  })
    .index("by_campaign", ["campaignId"])
    .index("by_status", ["status"]),
});
