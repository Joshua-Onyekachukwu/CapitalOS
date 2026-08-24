import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

// ── Queries ──

export const list = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("scrapingJobs")
      .withIndex("by_created" as any)
      .order("desc")
      .take(args.limit ?? 20);
  },
});

export const activeJobs = query({
  handler: async (ctx) => {
    const running = await ctx.db
      .query("scrapingJobs")
      .withIndex("by_status", (q) => q.eq("status", "running"))
      .collect();
    const queued = await ctx.db
      .query("scrapingJobs")
      .withIndex("by_status", (q) => q.eq("status", "queued"))
      .collect();
    return { running, queued, total: running.length + queued.length };
  },
});

// ── Mutations ──

export const create = mutation({
  args: {
    source: v.string(),
    totalRecords: v.number(),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("scrapingJobs", {
      source: args.source,
      status: "queued",
      totalRecords: args.totalRecords,
      processedRecords: 0,
      insertedRecords: 0,
      failedRecords: 0,
      startedAt: Date.now(),
    });
  },
});

export const updateProgress = mutation({
  args: {
    jobId: v.id("scrapingJobs"),
    processedRecords: v.number(),
    insertedRecords: v.number(),
    failedRecords: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.jobId, {
      status: "running",
      processedRecords: args.processedRecords,
      insertedRecords: args.insertedRecords,
      failedRecords: args.failedRecords ?? 0,
    });
  },
});

export const complete = mutation({
  args: {
    jobId: v.id("scrapingJobs"),
    backupPath: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.jobId, {
      status: "completed",
      completedAt: Date.now(),
      backupPath: args.backupPath,
    });
  },
});

export const fail = mutation({
  args: {
    jobId: v.id("scrapingJobs"),
    error: v.string(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.jobId, {
      status: "failed",
      completedAt: Date.now(),
      error: args.error,
    });
  },
});
