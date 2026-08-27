import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

// ════════════════════════════════════════════════════════════════
// QUERIES
// ════════════════════════════════════════════════════════════════

export const stats = query({
  handler: async (ctx) => {
    const all = await ctx.db.query("rawInvestors").collect();
    const byStatus: Record<string, number> = {};
    const bySource: Record<string, number> = {};
    let withEmail = 0;
    let synced = 0;

    for (const r of all) {
      byStatus[r.status] = (byStatus[r.status] || 0) + 1;
      bySource[r.source] = (bySource[r.source] || 0) + 1;
      if (r.email) withEmail++;
      if (r.syncedToSupabase) synced++;
    }

    return {
      total: all.length,
      byStatus,
      bySource,
      withEmail,
      synced,
    };
  },
});

export const listByStatus = query({
  args: {
    status: v.string(),
    limit: v.optional(v.number()),
    offset: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("rawInvestors")
      .withIndex("by_status", (q) => q.eq("status", args.status as any))
      .order("desc")
      .skip(args.offset ?? 0)
      .take(args.limit ?? 50);
  },
});

export const listBySource = query({
  args: {
    source: v.string(),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("rawInvestors")
      .withIndex("by_source", (q) => q.eq("source", args.source))
      .order("desc")
      .take(args.limit ?? 50);
  },
});

export const pendingPromotion = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("rawInvestors")
      .withIndex("by_status", (q) => q.eq("status", "qualified"))
      .filter((q) => q.eq(q.field("syncedToSupabase"), false))
      .take(args.limit ?? 100);
  },
});

// ════════════════════════════════════════════════════════════════
// MUTATIONS
// ════════════════════════════════════════════════════════════════

export const insertRaw = mutation({
  args: {
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
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const dedupeKey = args.email
      ? args.email.toLowerCase()
      : `${args.fullName}|${args.companyName || ""}`.toLowerCase();

    // Check for duplicate
    const existing = await ctx.db
      .query("rawInvestors")
      .withIndex("by_dedupeKey", (q) => q.eq("dedupeKey", dedupeKey))
      .first();

    return await ctx.db.insert("rawInvestors", {
      rawData: args.rawData,
      fullName: args.fullName,
      firstName: args.firstName,
      lastName: args.lastName,
      companyName: args.companyName,
      email: args.email,
      phone: args.phone,
      website: args.website,
      linkedinUrl: args.linkedinUrl,
      country: args.country,
      city: args.city,
      investorType: args.investorType,
      source: args.source,
      sourceId: args.sourceId,
      sourceUrl: args.sourceUrl,
      scrapedAt: now,
      status: existing ? "rejected" : "scraped",
      dedupeKey,
      isDuplicate: !!existing,
      duplicateOf: existing?._id,
      emailInferred: false,
      emailVerified: false,
      syncedToSupabase: false,
      retryCount: 0,
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const batchInsert = mutation({
  args: {
    records: v.array(
      v.object({
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
      })
    ),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    let inserted = 0;
    let duplicates = 0;

    for (const record of args.records) {
      const dedupeKey = record.email
        ? record.email.toLowerCase()
        : `${record.fullName}|${record.companyName || ""}`.toLowerCase();

      const existing = await ctx.db
        .query("rawInvestors")
        .withIndex("by_dedupeKey", (q) => q.eq("dedupeKey", dedupeKey))
        .first();

      if (existing) {
        duplicates++;
        continue;
      }

      await ctx.db.insert("rawInvestors", {
        rawData: record.rawData,
        fullName: record.fullName,
        firstName: record.firstName,
        lastName: record.lastName,
        companyName: record.companyName,
        email: record.email,
        phone: record.phone,
        website: record.website,
        linkedinUrl: record.linkedinUrl,
        country: record.country,
        city: record.city,
        investorType: record.investorType,
        source: record.source,
        sourceId: record.sourceId,
        sourceUrl: record.sourceUrl,
        scrapedAt: now,
        status: "scraped",
        dedupeKey,
        isDuplicate: false,
        emailInferred: false,
        emailVerified: false,
        syncedToSupabase: false,
        retryCount: 0,
        createdAt: now,
        updatedAt: now,
      });
      inserted++;
    }

    return { inserted, duplicates, total: args.records.length };
  },
});

export const updateStatus = mutation({
  args: {
    id: v.id("rawInvestors"),
    status: v.string(),
    error: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    await ctx.db.patch(args.id, {
      status: args.status as any,
      lastError: args.error,
      updatedAt: now,
    });
  },
});

export const markPromoted = mutation({
  args: {
    id: v.id("rawInvestors"),
    supabaseId: v.string(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.id, {
      status: "promoted",
      syncedToSupabase: true,
      supabaseId: args.supabaseId,
      syncedAt: Date.now(),
      updatedAt: Date.now(),
    });
  },
});

export const markEnriched = mutation({
  args: {
    id: v.id("rawInvestors"),
    email: v.optional(v.string()),
    emailInferred: v.optional(v.boolean()),
    emailSource: v.optional(v.string()),
    emailConfidence: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.id, {
      status: "enriched",
      ...(args.email ? { email: args.email } : {}),
      ...(args.emailInferred !== undefined ? { emailInferred: args.emailInferred } : {}),
      ...(args.emailSource ? { emailSource: args.emailSource } : {}),
      ...(args.emailConfidence ? { emailConfidence: args.emailConfidence } : {}),
      updatedAt: Date.now(),
    });
  },
});

export const markQualified = mutation({
  args: {
    id: v.id("rawInvestors"),
    score: v.number(),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.id, {
      status: "qualified",
      qualificationScore: args.score,
      qualificationNotes: args.notes,
      updatedAt: Date.now(),
    });
  },
});
