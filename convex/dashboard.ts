import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

// ── Queries ──

// Get all dashboard metrics (real-time)
export const getMetrics = query({
  handler: async (ctx) => {
    const metrics = await ctx.db.query("dashboardMetrics").collect();
    const result: Record<string, { value: number; label: string; updatedAt: number }> = {};
    for (const m of metrics) {
      result[m.key] = { value: m.value, label: m.label, updatedAt: m.updatedAt };
    }
    return result;
  },
});

// Get a single metric by key
export const getMetric = query({
  args: { key: v.string() },
  handler: async (ctx, args) => {
    const results = await ctx.db
      .query("dashboardMetrics")
      .withIndex("by_key", (q) => q.eq("key", args.key))
      .first();
    return results;
  },
});

// ── Mutations ──

// Update or create a metric
export const setMetric = mutation({
  args: {
    key: v.string(),
    value: v.number(),
    label: v.string(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("dashboardMetrics")
      .withIndex("by_key", (q) => q.eq("key", args.key))
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, {
        value: args.value,
        updatedAt: Date.now(),
      });
    } else {
      await ctx.db.insert("dashboardMetrics", {
        key: args.key,
        value: args.value,
        label: args.label,
        updatedAt: Date.now(),
      });
    }
  },
});

// Increment a metric
export const increment = mutation({
  args: {
    key: v.string(),
    amount: v.optional(v.number()),
    label: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("dashboardMetrics")
      .withIndex("by_key", (q) => q.eq("key", args.key))
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, {
        value: existing.value + (args.amount ?? 1),
        updatedAt: Date.now(),
      });
    } else {
      await ctx.db.insert("dashboardMetrics", {
        key: args.key,
        value: args.amount ?? 1,
        label: args.label ?? args.key,
        updatedAt: Date.now(),
      });
    }
  },
});
