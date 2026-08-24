import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

// ── Queries ──

// Get user notifications (real-time)
export const list = query({
  args: {
    userId: v.string(),
    unreadOnly: v.optional(v.boolean()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    let q = ctx.db
      .query("notifications")
      .withIndex("by_user", (q) => q.eq("userId", args.userId));

    if (args.unreadOnly) {
      q = q.filter((q) => q.eq(q.field("read"), false));
    }

    return await q.order("desc").take(args.limit ?? 20);
  },
});

// Count unread notifications
export const unreadCount = query({
  args: { userId: v.string() },
  handler: async (ctx, args) => {
    const all = await ctx.db
      .query("notifications")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .collect();
    return all.filter((n) => !n.read).length;
  },
});

// ── Mutations ──

// Create a notification
export const create = mutation({
  args: {
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
    data: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("notifications", {
      userId: args.userId,
      type: args.type,
      title: args.title,
      message: args.message,
      read: false,
      data: args.data,
      createdAt: Date.now(),
    });
  },
});

// Mark as read
export const markRead = mutation({
  args: { notificationId: v.id("notifications") },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.notificationId, { read: true });
  },
});

// Mark all as read for a user
export const markAllRead = mutation({
  args: { userId: v.string() },
  handler: async (ctx, args) => {
    const unread = await ctx.db
      .query("notifications")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .collect();
    for (const n of unread.filter((n) => !n.read)) {
      await ctx.db.patch(n._id, { read: true });
    }
  },
});
