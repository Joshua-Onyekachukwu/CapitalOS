import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

/**
 * CONVEX = Application / Realtime Layer ONLY
 * 
 * DO NOT store investor data here.
 * Supabase is the source of truth for all permanent data.
 * Convex handles: jobs, live state, notifications, temporary workflow state.
 * 
 * Storage budget: ~500MB-1GB of app state (well within 3GB limit)
 */

export default defineSchema({
  // ════════════════════════════════════════════════════════════════
  // RESEARCH JOBS — Real-time progress tracking
  // ════════════════════════════════════════════════════════════════
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

  // ════════════════════════════════════════════════════════════════
  // DASHBOARD METRICS — Live metrics (no polling)
  // ════════════════════════════════════════════════════════════════
  dashboardMetrics: defineTable({
    key: v.string(),
    value: v.number(),
    label: v.string(),
    updatedAt: v.number(),
  })
    .index("by_key", ["key"]),

  // ════════════════════════════════════════════════════════════════
  // NOTIFICATIONS — Real-time alerts
  // ════════════════════════════════════════════════════════════════
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

  // ════════════════════════════════════════════════════════════════
  // SCRAPING JOBS — Track background scraping progress
  // ════════════════════════════════════════════════════════════════
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
    failedRecords: v.number(),
    backupPath: v.optional(v.string()),
    startedAt: v.number(),
    completedAt: v.optional(v.number()),
    error: v.optional(v.string()),
  })
    .index("by_status", ["status"])
    .index("by_source", ["source"]),

  // ════════════════════════════════════════════════════════════════
  // CAMPAIGN STATE — Live email campaign tracking
  // ════════════════════════════════════════════════════════════════
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

  // ════════════════════════════════════════════════════════════════
  // WORKFLOW STATE — Temporary processing state
  // ════════════════════════════════════════════════════════════════
  workflowState: defineTable({
    workflowId: v.string(),
    type: v.string(), // "import", "enrichment", "scoring", etc.
    status: v.union(
      v.literal("pending"),
      v.literal("running"),
      v.literal("completed"),
      v.literal("failed")
    ),
    progress: v.number(),
    currentStep: v.optional(v.string()),
    metadata: v.optional(v.any()),
    startedAt: v.number(),
    completedAt: v.optional(v.number()),
  })
    .index("by_workflow", ["workflowId"])
    .index("by_status", ["status"]),
});
