import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  // ════════════════════════════════════════════════════════════════
  // INVESTOR DATABASE (1M+ records)
  // This is the primary data store for all investor intelligence.
  // Convex gives you 3GB storage — enough for ~1.5M investor records.
  // ════════════════════════════════════════════════════════════════

  investors: defineTable({
    // ── 1. Investor Identity ──
    fullName: v.string(),
    firstName: v.optional(v.string()),
    lastName: v.optional(v.string()),
    jobTitle: v.optional(v.string()),
    managementLevel: v.optional(v.string()), // c_suite, vp, partner, etc.
    investorType: v.string(), // venture_capital, private_equity, angel, etc.
    
    // ── Company / Fund ──
    companyName: v.optional(v.string()),
    companyWebsite: v.optional(v.string()),
    linkedinUrl: v.optional(v.string()),
    companyLinkedinUrl: v.optional(v.string()),
    personalWebsite: v.optional(v.string()),
    
    // ── Location ──
    country: v.optional(v.string()),
    state: v.optional(v.string()),
    city: v.optional(v.string()),
    location: v.optional(v.string()),
    
    // ── 2. Contact Information ──
    email: v.optional(v.string()),
    emailVerified: v.optional(v.boolean()),
    emailVerificationStatus: v.optional(v.string()), // verified, risky, invalid, unknown
    emailSource: v.optional(v.string()),
    secondaryEmail: v.optional(v.string()),
    phone: v.optional(v.string()),
    contactFormUrl: v.optional(v.string()),
    twitterUrl: v.optional(v.string()),
    
    // ── 3. Investment Capacity ──
    minCheckSize: v.optional(v.number()),
    maxCheckSize: v.optional(v.number()),
    typicalCheckSize: v.optional(v.number()),
    averageCheckSize: v.optional(v.number()),
    totalCapitalInvested: v.optional(v.number()),
    fundSize: v.optional(v.number()),
    aum: v.optional(v.number()), // Assets Under Management
    currency: v.optional(v.string()),
    
    // ── 4. Investment Focus ──
    investmentStages: v.optional(v.array(v.string())), // pre_seed, seed, series_a, etc.
    investmentSectors: v.optional(v.array(v.string())), // fintech, saas, etc.
    investmentGeographies: v.optional(v.array(v.string())),
    primaryIndustry: v.optional(v.string()),
    secondaryIndustries: v.optional(v.array(v.string())),
    investmentThesis: v.optional(v.string()),
    preferredBusinessModel: v.optional(v.string()), // saas, marketplace, b2b, etc.
    
    // ── 5. Investment History ──
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
    
    // ── 6. Activity Signals ──
    currentlyActive: v.optional(v.boolean()),
    investmentsLast12Months: v.optional(v.number()),
    investmentsLast24Months: v.optional(v.number()),
    recentlyRaisedFund: v.optional(v.boolean()),
    currentlyDeployingCapital: v.optional(v.boolean()),
    investmentFrequency: v.optional(v.string()),
    
    // ── 7. Professional Background ──
    yearsInvestmentExperience: v.optional(v.number()),
    founderExperience: v.optional(v.boolean()),
    previousExits: v.optional(v.number()),
    
    // ── 8. Company / Fund Info ──
    fundType: v.optional(v.string()), // venture_capital, private_equity, etc.
    currentFund: v.optional(v.string()),
    numberOfPartners: v.optional(v.number()),
    fundraisingStatus: v.optional(v.string()),
    firmFoundedYear: v.optional(v.number()),
    
    // ── 9. Quality Scores ──
    overallScore: v.optional(v.number()), // 0-100
    industryMatchScore: v.optional(v.number()),
    investmentCapacityScore: v.optional(v.number()),
    contactabilityScore: v.optional(v.number()),
    activityScore: v.optional(v.number()),
    fitScore: v.optional(v.number()),
    dataQualityScore: v.optional(v.number()),
    
    // ── 10. Source & Verification ──
    source: v.string(), // edgar_13f_hr, edgar_form_d, apollo_csv, etc.
    sourceId: v.optional(v.string()),
    sourceUrl: v.optional(v.string()),
    sourceName: v.optional(v.string()),
    dateScraped: v.optional(v.string()),
    dateVerified: v.optional(v.string()),
    sourceReliability: v.optional(v.number()), // 0-100
    
    // ── Outreach Status ──
    outreachReadiness: v.optional(v.string()), // ready, needs_verification, not_ready
    isVerified: v.optional(v.boolean()),
    isFavorited: v.optional(v.boolean()),
    notes: v.optional(v.string()),
    
    // ── Timestamps ──
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    // Indexes for fast queries at scale
    .index("by_investorType", ["investorType"])
    .index("by_country", ["country"])
    .index("by_source", ["source"])
    .index("by_score", ["overallScore"])
    .index("by_email", ["email"])
    .index("by_outreach", ["outreachReadiness"])
    .index("by_active", ["currentlyActive"])
    .index("by_created", ["createdAt"])
    .index("by_fullName", ["fullName"]),

  // ════════════════════════════════════════════════════════════════
  // APPLICATION STATE
  // ════════════════════════════════════════════════════════════════

  // ── Research Jobs ──
  researchJobs: defineTable({
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
    steps: v.array(v.object({
      name: v.string(),
      status: v.union(v.literal("pending"), v.literal("running"), v.literal("done"), v.literal("failed")),
      startedAt: v.optional(v.number()),
      completedAt: v.optional(v.number()),
      error: v.optional(v.string()),
    })),
    resultData: v.optional(v.any()),
    errorMessage: v.optional(v.string()),
    startedAt: v.number(),
    completedAt: v.optional(v.number()),
    createdAt: v.number(),
  })
    .index("by_status", ["status"])
    .index("by_investor", ["supabaseInvestorId"])
    .index("by_created", ["createdAt"]),

  // ── Dashboard Metrics ──
  dashboardMetrics: defineTable({
    key: v.string(),
    value: v.number(),
    label: v.string(),
    updatedAt: v.number(),
  })
    .index("by_key", ["key"]),

  // ── Notifications ──
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

  // ── Scraping Jobs ──
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

  // ── Campaign State ──
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
});
