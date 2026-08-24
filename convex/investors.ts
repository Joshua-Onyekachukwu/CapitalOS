import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

// ════════════════════════════════════════════════════════════════
// INVESTOR QUERIES (1M+ records)
// ════════════════════════════════════════════════════════════════

// Get investors with pagination and filtering
export const list = query({
  args: {
    page: v.optional(v.number()),
    pageSize: v.optional(v.number()),
    investorType: v.optional(v.string()),
    country: v.optional(v.string()),
    source: v.optional(v.string()),
    minScore: v.optional(v.number()),
    search: v.optional(v.string()),
    sortBy: v.optional(v.string()),
    sortOrder: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const page = args.page ?? 0;
    const pageSize = Math.min(args.pageSize ?? 25, 100);
    
    let q = ctx.db.query("investors");
    
    // Apply filters using indexes
    if (args.investorType) {
      q = q.withIndex("by_investorType", (q) => q.eq("investorType", args.investorType!));
    } else if (args.country) {
      q = q.withIndex("by_country", (q) => q.eq("country", args.country!));
    } else if (args.source) {
      q = q.withIndex("by_source", (q) => q.eq("source", args.source!));
    } else if (args.minScore) {
      q = q.withIndex("by_score", (q) => q.gte("overallScore", args.minScore!));
    }
    
    // Text search (basic — Convex supports search on indexed string fields)
    if (args.search) {
      const searchLower = args.search.toLowerCase();
      q = q.filter((q) => 
        q.or(
          q.eq(q.field("fullName"), args.search!),
          q.includes(q.field("email"), args.search!),
        )
      );
    }
    
    // Get total count
    const all = await q.collect();
    const total = all.length;
    
    // Sort
    const sortBy = args.sortBy ?? "overallScore";
    const sortOrder = args.sortOrder ?? "desc";
    all.sort((a: any, b: any) => {
      const aVal = a[sortBy] ?? 0;
      const bVal = b[sortBy] ?? 0;
      return sortOrder === "desc" ? bVal - aVal : aVal - bVal;
    });
    
    // Paginate
    const start = page * pageSize;
    const items = all.slice(start, start + pageSize);
    
    return {
      items,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  },
});

// Get a single investor by ID
export const get = query({
  args: { id: v.id("investors") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id);
  },
});

// Get investor count
export const count = query({
  handler: async (ctx) => {
    const all = await ctx.db.query("investors").collect();
    return all.length;
  },
});

// Get dashboard stats
export const stats = query({
  handler: async (ctx) => {
    const all = await ctx.db.query("investors").collect();
    
    const byType: Record<string, number> = {};
    const bySource: Record<string, number> = {};
    const byCountry: Record<string, number> = {};
    let withEmail = 0;
    let withLinkedin = 0;
    let highScore = 0;
    let readyForOutreach = 0;
    
    for (const inv of all) {
      byType[inv.investorType] = (byType[inv.investorType] || 0) + 1;
      bySource[inv.source] = (bySource[inv.source] || 0) + 1;
      if (inv.country) byCountry[inv.country] = (byCountry[inv.country] || 0) + 1;
      if (inv.email) withEmail++;
      if (inv.linkedinUrl) withLinkedin++;
      if ((inv.overallScore ?? 0) >= 80) highScore++;
      if (inv.outreachReadiness === "ready") readyForOutreach++;
    }
    
    return {
      total: all.length,
      withEmail,
      withLinkedin,
      highScore,
      readyForOutreach,
      byType,
      bySource,
      byCountry,
    };
  },
});

// ════════════════════════════════════════════════════════════════
// INVESTOR MUTATIONS
// ════════════════════════════════════════════════════════════════

// Insert a single investor
export const insert = mutation({
  args: {
    fullName: v.string(),
    firstName: v.optional(v.string()),
    lastName: v.optional(v.string()),
    jobTitle: v.optional(v.string()),
    managementLevel: v.optional(v.string()),
    investorType: v.string(),
    companyName: v.optional(v.string()),
    companyWebsite: v.optional(v.string()),
    linkedinUrl: v.optional(v.string()),
    companyLinkedinUrl: v.optional(v.string()),
    personalWebsite: v.optional(v.string()),
    country: v.optional(v.string()),
    state: v.optional(v.string()),
    city: v.optional(v.string()),
    location: v.optional(v.string()),
    email: v.optional(v.string()),
    emailVerified: v.optional(v.boolean()),
    emailSource: v.optional(v.string()),
    secondaryEmail: v.optional(v.string()),
    phone: v.optional(v.string()),
    contactFormUrl: v.optional(v.string()),
    twitterUrl: v.optional(v.string()),
    minCheckSize: v.optional(v.number()),
    maxCheckSize: v.optional(v.number()),
    typicalCheckSize: v.optional(v.number()),
    averageCheckSize: v.optional(v.number()),
    totalCapitalInvested: v.optional(v.number()),
    fundSize: v.optional(v.number()),
    aum: v.optional(v.number()),
    currency: v.optional(v.string()),
    investmentStages: v.optional(v.array(v.string())),
    investmentSectors: v.optional(v.array(v.string())),
    investmentGeographies: v.optional(v.array(v.string())),
    primaryIndustry: v.optional(v.string()),
    secondaryIndustries: v.optional(v.array(v.string())),
    investmentThesis: v.optional(v.string()),
    preferredBusinessModel: v.optional(v.string()),
    numberOfInvestments: v.optional(v.number()),
    numberOfExits: v.optional(v.number()),
    numberOfPortfolioCompanies: v.optional(v.number()),
    successfulExits: v.optional(v.number()),
    ipos: v.optional(v.number()),
    acquisitions: v.optional(v.number()),
    lastInvestmentDate: v.optional(v.string()),
    recentInvestments: v.optional(v.array(v.object({
      companyName: v.string(),
      date: v.optional(v.string()),
      amount: v.optional(v.number()),
      round: v.optional(v.string()),
    }))),
    currentlyActive: v.optional(v.boolean()),
    investmentsLast12Months: v.optional(v.number()),
    investmentsLast24Months: v.optional(v.number()),
    recentlyRaisedFund: v.optional(v.boolean()),
    currentlyDeployingCapital: v.optional(v.boolean()),
    investmentFrequency: v.optional(v.string()),
    yearsInvestmentExperience: v.optional(v.number()),
    founderExperience: v.optional(v.boolean()),
    previousExits: v.optional(v.number()),
    fundType: v.optional(v.string()),
    currentFund: v.optional(v.string()),
    numberOfPartners: v.optional(v.number()),
    fundraisingStatus: v.optional(v.string()),
    firmFoundedYear: v.optional(v.number()),
    overallScore: v.optional(v.number()),
    industryMatchScore: v.optional(v.number()),
    investmentCapacityScore: v.optional(v.number()),
    contactabilityScore: v.optional(v.number()),
    activityScore: v.optional(v.number()),
    fitScore: v.optional(v.number()),
    dataQualityScore: v.optional(v.number()),
    source: v.string(),
    sourceId: v.optional(v.string()),
    sourceUrl: v.optional(v.string()),
    sourceName: v.optional(v.string()),
    dateScraped: v.optional(v.string()),
    dateVerified: v.optional(v.string()),
    sourceReliability: v.optional(v.number()),
    outreachReadiness: v.optional(v.string()),
    isVerified: v.optional(v.boolean()),
    isFavorited: v.optional(v.boolean()),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("investors", {
      ...args,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
  },
});

// Update an investor
export const update = mutation({
  args: {
    id: v.id("investors"),
    updates: v.any(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.id, {
      ...args.updates,
      updatedAt: Date.now(),
    });
  },
});

// Bulk insert (for migration)
export const bulkInsert = mutation({
  args: {
    investors: v.array(v.any()),
  },
  handler: async (ctx, args) => {
    let inserted = 0;
    for (const inv of args.investors) {
      try {
        await ctx.db.insert("investors", {
          ...inv,
          createdAt: inv.createdAt ?? Date.now(),
          updatedAt: inv.updatedAt ?? Date.now(),
        });
        inserted++;
      } catch (e) {
        // Skip duplicates
      }
    }
    return inserted;
  },
});
