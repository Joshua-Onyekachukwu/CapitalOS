import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import { dataQualityMetrics, enrichmentJobs, rawInvestors } from "./rawInvestors";

const pipelineRun = defineTable({
  runType: v.string(),
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
}).index("by_type", ["runType"]).index("by_status", ["status"]);

const syncLog = defineTable({
  rawInvestorId: v.string(),
  supabaseInvestorId: v.optional(v.string()),
  direction: v.union(v.literal("to_supabase"), v.literal("from_supabase")),
  status: v.union(v.literal("pending"), v.literal("synced"), v.literal("failed")),
  syncedAt: v.optional(v.string()),
  error: v.optional(v.string()),
}).index("by_raw_id", ["rawInvestorId"]).index("by_status", ["status"]);

const scrapeJobs = defineTable({
  source: v.string(),
  status: v.union(
    v.literal("queued"),
    v.literal("running"),
    v.literal("completed"),
    v.literal("failed")
  ),
  startedAt: v.optional(v.number()),
  completedAt: v.optional(v.number()),
  totalRecords: v.number(),
  processedRecords: v.number(),
  insertedRecords: v.number(),
  failedRecords: v.number(),
  backupPath: v.optional(v.string()),
  error: v.optional(v.string()),
}).index("by_source", ["source"]).index("by_status", ["status"]).index("by_created", ["startedAt"]);

const dashboardMetrics = defineTable({
  key: v.string(),
  value: v.number(),
  label: v.string(),
  updatedAt: v.number(),
}).index("by_key", ["key"]);

const notifications = defineTable({
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
}).index("by_user", ["userId"]);

const researchJobs = defineTable({
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
  steps: v.array(
    v.object({
      name: v.string(),
      status: v.string(),
      startedAt: v.optional(v.number()),
      completedAt: v.optional(v.number()),
      error: v.optional(v.string()),
    })
  ),
  startedAt: v.number(),
  createdAt: v.number(),
  completedAt: v.optional(v.number()),
  resultData: v.optional(v.any()),
  errorMessage: v.optional(v.string()),
}).index("by_status", ["status"]).index("by_created", ["createdAt"]);

export default defineSchema({
  rawInvestors,
  enrichmentJobs,
  dataQualityMetrics,
  pipeline_runs: pipelineRun,
  sync_log: syncLog,
  scrapeJobs,
  dashboardMetrics,
  notifications,
  researchJobs,
});
