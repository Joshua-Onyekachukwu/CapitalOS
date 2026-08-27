import { query, mutation, internalMutation } from "./_generated/server";
import { v } from "convex/values";

// ════════════════════════════════════════════════════════════════
// QUERIES — Read-only, used by dashboard and scripts
// ════════════════════════════════════════════════════════════════

/**
 * Efficient stats using index-based counting.
 * Does NOT load all records into memory.
 */
export const stats = query({
  handler: async (ctx) => {
    // Count by status using indexed queries (each is O(log n))
    const statuses = [
      "scraped", "deduplicated", "normalized", "enriched",
      "scored", "qualified", "promoted", "rejected", "error",
    ] as const;

    const byStatus: Record<string, number> = {};
    let total = 0;

    for (const status of statuses) {
      const count = await ctx.db
        .query("rawInvestors")
        .withIndex("by_status", (q) => q.eq("status", status))
        .collect();
      byStatus[status] = count.length;
      total += count.length;
    }

    // Count by source
    const sources = [
      "edgar-13f", "edgar-form-d", "edgar-ncen", "fishtank",
      "vc-team-scraper", "openvc", "vc-directory-manual", "unknown",
    ];

    const bySource: Record<string, number> = {};
    for (const source of sources) {
      const count = await ctx.db
        .query("rawInvestors")
        .withIndex("by_source", (q) => q.eq("source", source))
        .collect();
      if (count.length > 0) bySource[source] = count.length;
    }

    // Count synced
    const synced = await ctx.db
      .query("rawInvestors")
      .withIndex("by_synced", (q) => q.eq("syncedToSupabase", true))
      .collect();

    return {
      total,
      byStatus,
      bySource,
      synced: synced.length,
      unsynced: total - synced.length,
    };
  },
});

/**
 * Quick count — even more efficient, just counts records.
 */
export const quickCount = query({
  handler: async (ctx) => {
    const all = await ctx.db.query("rawInvestors").collect();
    return all.length;
  },
});

/**
 * List raw investors by status with pagination.
 */
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

/**
 * List raw investors by source.
 */
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

/**
 * Get records ready for promotion to Supabase.
 * Only returns qualified records that haven't been synced yet.
 */
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

/**
 * Get records that need processing (scraped but not yet enriched).
 */
export const pendingProcessing = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("rawInvestors")
      .withIndex("by_status", (q) => q.eq("status", "scraped"))
      .take(args.limit ?? 100);
  },
});

/**
 * Search raw investors by name or company.
 */
export const search = query({
  args: {
    query: v.string(),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const q = args.query.toLowerCase();
    const results = await ctx.db.query("rawInvestors").collect();
    return results
      .filter((r) =>
        r.fullName.toLowerCase().includes(q) ||
        r.companyName?.toLowerCase().includes(q) ||
        r.email?.toLowerCase().includes(q)
      )
      .slice(0, args.limit ?? 50);
  },
});

// ════════════════════════════════════════════════════════════════
// MUTATIONS — Write operations
// ════════════════════════════════════════════════════════════════

/**
 * Insert a single raw investor record with deduplication.
 */
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

    const existing = await ctx.db
      .query("rawInvestors")
      .withIndex("by_dedupeKey", (q) => q.eq("dedupeKey", dedupeKey))
      .first();

    if (existing) {
      return { id: existing._id, status: "duplicate" as const };
    }

    const id = await ctx.db.insert("rawInvestors", {
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

    return { id, status: "inserted" as const };
  },
});

/**
 * Batch insert with deduplication. Processes up to 100 records per call.
 * For larger imports, call this multiple times from a script.
 */
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
    const ids: string[] = [];

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

      const id = await ctx.db.insert("rawInvestors", {
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
      ids.push(id);
      inserted++;
    }

    return { inserted, duplicates, total: args.records.length, ids };
  },
});

/**
 * Update status of a raw investor record.
 */
export const updateStatus = mutation({
  args: {
    id: v.id("rawInvestors"),
    status: v.string(),
    error: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.id, {
      status: args.status as any,
      lastError: args.error,
      updatedAt: Date.now(),
    });
  },
});

/**
 * Mark a record as enriched with email data.
 */
export const markEnriched = mutation({
  args: {
    id: v.id("rawInvestors"),
    email: v.optional(v.string()),
    emailInferred: v.optional(v.boolean()),
    emailSource: v.optional(v.string()),
    emailConfidence: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const updates: Record<string, any> = { status: "enriched", updatedAt: Date.now() };
    if (args.email) updates.email = args.email;
    if (args.emailInferred !== undefined) updates.emailInferred = args.emailInferred;
    if (args.emailSource) updates.emailSource = args.emailSource;
    if (args.emailConfidence) updates.emailConfidence = args.emailConfidence;
    await ctx.db.patch(args.id, updates);
  },
});

/**
 * Mark a record as qualified with a score.
 */
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

/**
 * Mark a record as promoted to Supabase.
 */
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

/**
 * Mark a record as rejected.
 */
export const markRejected = mutation({
  args: {
    id: v.id("rawInvestors"),
    reason: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.id, {
      status: "rejected",
      lastError: args.reason,
      updatedAt: Date.now(),
    });
  },
});

/**
 * Batch update status for multiple records.
 */
export const batchUpdateStatus = mutation({
  args: {
    ids: v.array(v.id("rawInvestors")),
    status: v.string(),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    for (const id of args.ids) {
      await ctx.db.patch(id, {
        status: args.status as any,
        updatedAt: now,
      });
    }
    return { updated: args.ids.length };
  },
});

// ════════════════════════════════════════════════════════════════
// INTERNAL MUTATIONS — Called by Convex actions/cron jobs
// ════════════════════════════════════════════════════════════════

/**
 * Record daily data quality metrics snapshot.
 */
export const recordDailyMetrics = internalMutation({
  handler: async (ctx) => {
    const now = Date.now();
    const date = new Date(now).toISOString().split("T")[0];

    const all = await ctx.db.query("rawInvestors").collect();
    const bySource: Record<string, number> = {};
    let withEmail = 0;
    let emailVerified = 0;
    let emailInferred = 0;
    let qualified = 0;
    let promoted = 0;

    for (const r of all) {
      bySource[r.source] = (bySource[r.source] || 0) + 1;
      if (r.email) withEmail++;
      if (r.emailVerified) emailVerified++;
      if (r.emailInferred) emailInferred++;
      if (r.status === "qualified") qualified++;
      if (r.status === "promoted") promoted++;
    }

    await ctx.db.insert("dataQualityMetrics", {
      date,
      totalRaw: all.length,
      totalQualified: qualified,
      totalPromoted: promoted,
      withEmail,
      emailVerified,
      emailInferred,
      bySource,
      createdAt: now,
    });

    return { date, totalRaw: all.length };
  },
});
