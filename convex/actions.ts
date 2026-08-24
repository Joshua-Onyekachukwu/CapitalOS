import { action } from "./_generated/server";
import { v } from "convex/values";

// ── Actions ──
// These run outside the Convex database and can call external APIs

// Trigger EDGAR scraping (calls our existing scraper)
export const triggerEdgarScrape = action({
  args: {
    source: v.string(), // "13f_hr", "form_d", "ncen"
    days: v.number(),
  },
  handler: async (ctx, args) => {
    // This would call our existing EDGAR scraper
    // In production, this would spawn a background worker
    console.log(`Starting EDGAR scrape: ${args.source} (${args.days} days)`);
    return { status: "started", source: args.source };
  },
});

// Enrich a single investor (calls external APIs)
export const enrichInvestor = action({
  args: {
    investorId: v.string(),
    investorName: v.string(),
    sourceUrl: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // In production, this would:
    // 1. Scrape the investor's website/LinkedIn
    // 2. Call AI for analysis
    // 3. Score the investor
    // 4. Write results back to Supabase
    console.log(`Enriching investor: ${args.investorName}`);
    return {
      status: "completed",
      investorId: args.investorId,
      scores: {
        industryMatch: 15,
        stageMatch: 12,
        capacity: 10,
        activity: 8,
        geography: 7,
        contactability: 9,
        relevance: 4,
        overall: 65,
      },
    };
  },
});

// AI-powered investment thesis analysis
export const analyzeThesis = action({
  args: {
    text: v.string(),
    investorId: v.string(),
  },
  handler: async (ctx, args) => {
    // In production, this would call OpenAI/NVIDIA API
    // For now, return mock analysis
    return {
      industries: ["fintech", "saas", "b2b"],
      stages: ["seed", "series_a"],
      checkSize: { min: 100000, max: 500000 },
      geography: ["united_states", "united_kingdom"],
      thesis: "Focuses on early-stage B2B SaaS companies in fintech",
      confidence: 0.85,
    };
  },
});

// Batch score multiple investors
export const batchScore = action({
  args: {
    investorIds: v.array(v.string()),
    targetIndustry: v.optional(v.string()),
    targetStage: v.optional(v.string()),
    targetGeography: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // In production, this would:
    // 1. Fetch investor data from Supabase
    // 2. Score each against targets
    // 3. Write scores back to Supabase
    console.log(`Scoring ${args.investorIds.length} investors`);
    return {
      scored: args.investorIds.length,
      highFit: Math.floor(args.investorIds.length * 0.1),
      mediumFit: Math.floor(args.investorIds.length * 0.4),
    };
  },
});
