import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

// ── Queries ──

// Get all research jobs (paginated)
export const list = query({
  args: {
    status: v.optional(v.string()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    let q = ctx.db.query("researchJobs");
    if (args.status) {
      q = q.withIndex("by_status", (q) => q.eq("status", args.status as any));
    }
    return await q.order("desc").take(args.limit ?? 50);
  },
});

// Get live job progress (for real-time UI updates)
export const getProgress = query({
  args: { jobId: v.id("researchJobs") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.jobId);
  },
});

// Get stats by status
export const stats = query({
  handler: async (ctx) => {
    const all = await ctx.db.query("researchJobs").collect();
    const byStatus: Record<string, number> = {};
    for (const job of all) {
      byStatus[job.status] = (byStatus[job.status] || 0) + 1;
    }
    return {
      total: all.length,
      byStatus,
      avgProgress: all.length > 0
        ? Math.round(all.reduce((sum, j) => sum + j.progress, 0) / all.length)
        : 0,
    };
  },
});

// ── Mutations ──

// Create a new research job
export const create = mutation({
  args: {
    supabaseInvestorId: v.string(),
    investorName: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("researchJobs", {
      supabaseInvestorId: args.supabaseInvestorId,
      investorName: args.investorName,
      status: "queued",
      progress: 0,
      steps: [
        { name: "website_scrape", status: "pending" },
        { name: "linkedin_lookup", status: "pending" },
        { name: "investment_history", status: "pending" },
        { name: "contact_discovery", status: "pending" },
        { name: "ai_analysis", status: "pending" },
        { name: "scoring", status: "pending" },
      ],
      startedAt: Date.now(),
      createdAt: Date.now(),
    });
  },
});

// Update job progress (called by background workers)
export const updateProgress = mutation({
  args: {
    jobId: v.id("researchJobs"),
    status: v.optional(v.string()),
    progress: v.optional(v.number()),
    stepName: v.optional(v.string()),
    stepStatus: v.optional(v.string()),
    error: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const job = await ctx.db.get(args.jobId);
    if (!job) throw new Error("Job not found");

    const updates: Record<string, any> = {};
    if (args.status) updates.status = args.status;
    if (args.progress !== undefined) updates.progress = args.progress;
    if (args.error) updates.errorMessage = args.error;

    // Update specific step
    if (args.stepName && args.stepStatus) {
      const steps = [...job.steps];
      const stepIdx = steps.findIndex((s) => s.name === args.stepName);
      if (stepIdx >= 0) {
        steps[stepIdx] = {
          ...steps[stepIdx],
          status: args.stepStatus as any,
          startedAt: args.stepStatus === "running" ? Date.now() : steps[stepIdx].startedAt,
          completedAt: args.stepStatus === "done" ? Date.now() : steps[stepIdx].completedAt,
          error: args.stepStatus === "failed" ? args.error : steps[stepIdx].error,
        };
        updates.steps = steps;
      }
    }

    if (args.status === "completed" || args.status === "failed") {
      updates.completedAt = Date.now();
    }

    await ctx.db.patch(args.jobId, updates);
  },
});

// Complete a job with results
export const complete = mutation({
  args: {
    jobId: v.id("researchJobs"),
    resultData: v.any(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.jobId, {
      status: "completed",
      progress: 100,
      resultData: args.resultData,
      completedAt: Date.now(),
    });
  },
});
