// =============================================
// Capital OS — Full Investor Dataset Generator
// =============================================
// Creates a rich, interconnected dataset:
//   1. Investor Firms (2,500+ real VC/angel/accelerator names)
//   2. Investors (500K+ linked to firms)
//   3. Employment History (linked to investors + firms)
//   4. Data Sources (provenance tracking)
//
// Run: npx tsx src/scripts/generate-full-dataset.ts [investor_count]
// Default: 200000
// =============================================

import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// =============================================
// REAL VC / FIRM NAMES
// =============================================

const REAL_VC_FIRMS: Array<{ name: string; type: string; country: string; city: string; founded: number; stages: string[]; sectors: string[]; checkMin: number; checkMax: number; fundSize: number }> = [
  // === TOP TIER US ===
  { name: "Sequoia Capital", type: "venture_capital", country: "United States", city: "Menlo Park", founded: 1972, stages: ["seed", "series_a", "series_b", "series_c", "growth"], sectors: ["saas", "ai", "consumer", "enterprise", "fintech"], checkMin: 1000000, checkMax: 50000000, fundSize: 8500000000 },
  { name: "Andreessen Horowitz", type: "venture_capital", country: "United States", city: "Menlo Park", founded: 2009, stages: ["seed", "series_a", "series_b", "series_c", "growth"], sectors: ["ai", "fintech", "saas", "cybersecurity", "web3"], checkMin: 1000000, checkMax: 100000000, fundSize: 7600000000 },
  { name: "Accel Partners", type: "venture_capital", country: "United States", city: "Palo Alto", founded: 1983, stages: ["seed", "series_a", "series_b"], sectors: ["saas", "enterprise", "fintech", "consumer"], checkMin: 500000, checkMax: 20000000, fundSize: 6500000000 },
  { name: "Benchmark Capital", type: "venture_capital", country: "United States", city: "San Francisco", founded: 1995, stages: ["seed", "series_a"], sectors: ["saas", "consumer", "marketplace", "enterprise"], checkMin: 500000, checkMax: 15000000, fundSize: 425000000 },
  { name: "Lightspeed Venture Partners", type: "venture_capital", country: "United States", city: "Menlo Park", founded: 2000, stages: ["seed", "series_a", "series_b", "growth"], sectors: ["saas", "enterprise", "consumer", "fintech"], checkMin: 500000, checkMax: 50000000, fundSize: 10000000000 },
  { name: "Greylock Partners", type: "venture_capital", country: "United States", city: "Menlo Park", founded: 1965, stages: ["seed", "series_a", "series_b"], sectors: ["saas", "enterprise", "ai", "consumer"], checkMin: 500000, checkMax: 20000000, fundSize: 3500000000 },
  { name: "Index Ventures", type: "venture_capital", country: "United States", city: "San Francisco", founded: 1996, stages: ["seed", "series_a", "series_b", "growth"], sectors: ["saas", "fintech", "consumer", "healthtech"], checkMin: 500000, checkMax: 50000000, fundSize: 5500000000 },
  { name: "Kleiner Perkins", type: "venture_capital", country: "United States", city: "Menlo Park", founded: 1972, stages: ["seed", "series_a", "series_b", "series_c"], sectors: ["saas", "consumer", "healthtech", "energy", "ai"], checkMin: 1000000, checkMax: 50000000, fundSize: 7000000000 },
  { name: "Tiger Global", type: "growth_equity", country: "United States", city: "New York", founded: 2001, stages: ["series_b", "series_c", "growth"], sectors: ["saas", "fintech", "consumer", "enterprise"], checkMin: 10000000, checkMax: 250000000, fundSize: 12000000000 },
  { name: "General Catalyst", type: "venture_capital", country: "United States", city: "Cambridge", founded: 2000, stages: ["seed", "series_a", "series_b", "growth"], sectors: ["ai", "healthtech", "saas", "consumer"], checkMin: 500000, checkMax: 30000000, fundSize: 6000000000 },
  { name: "Insight Partners", type: "growth_equity", country: "United States", city: "New York", founded: 1995, stages: ["series_b", "series_c", "growth"], sectors: ["saas", "enterprise", "fintech"], checkMin: 10000000, checkMax: 100000000, fundSize: 30000000000 },
  { name: "Founders Fund", type: "venture_capital", country: "United States", city: "San Francisco", founded: 2005, stages: ["seed", "series_a", "series_b", "growth"], sectors: ["ai", "deeptech", "spacetech", "cybersecurity", "saas"], checkMin: 1000000, checkMax: 50000000, fundSize: 12000000000 },
  { name: "Y Combinator", type: "accelerator", country: "United States", city: "San Francisco", founded: 2005, stages: ["pre_seed", "seed"], sectors: ["saas", "ai", "fintech", "consumer", "healthtech", "deeptech"], checkMin: 125000, checkMax: 500000, fundSize: 700000000 },
  { name: "500 Global", type: "accelerator", country: "United States", city: "San Francisco", founded: 2010, stages: ["pre_seed", "seed"], sectors: ["saas", "fintech", "consumer", "marketplace"], checkMin: 50000, checkMax: 250000, fundSize: 1500000000 },
  { name: "Techstars", type: "accelerator", country: "United States", city: "Boulder", founded: 2006, stages: ["pre_seed", "seed"], sectors: ["saas", "iot", "fintech", "healthtech"], checkMin: 120000, checkMax: 120000, fundSize: 500000000 },
  { name: "First Round Capital", type: "venture_capital", country: "United States", city: "San Francisco", founded: 2004, stages: ["seed"], sectors: ["saas", "consumer", "enterprise", "fintech"], checkMin: 500000, checkMax: 4000000, fundSize: 1500000000 },
  { name: "Union Square Ventures", type: "venture_capital", country: "United States", city: "New York", founded: 2003, stages: ["seed", "series_a"], sectors: ["saas", "marketplace", "web3", "fintech"], checkMin: 500000, checkMax: 10000000, fundSize: 1000000000 },
  { name: "Bessemer Venture Partners", type: "venture_capital", country: "United States", city: "San Francisco", founded: 1911, stages: ["seed", "series_a", "series_b", "series_c", "growth"], sectors: ["saas", "enterprise", "healthtech", "fintech"], checkMin: 500000, checkMax: 50000000, fundSize: 5500000000 },
  { name: "Battery Ventures", type: "venture_capital", country: "United States", city: "Boston", founded: 1983, stages: ["series_a", "series_b", "series_c", "growth"], sectors: ["saas", "enterprise", "industrial", "healthtech"], checkMin: 1000000, checkMax: 40000000, fundSize: 8000000000 },
  { name: "GV (Google Ventures)", type: "corporate_venture", country: "United States", city: "Mountain View", founded: 2009, stages: ["seed", "series_a", "series_b"], sectors: ["ai", "healthtech", "consumer", "enterprise", "robotics"], checkMin: 500000, checkMax: 20000000, fundSize: 5000000000 },
  { name: "Microsoft Ventures", type: "corporate_venture", country: "United States", city: "Redmond", founded: 2016, stages: ["seed", "series_a", "series_b"], sectors: ["ai", "enterprise", "saas", "cybersecurity"], checkMin: 500000, checkMax: 20000000, fundSize: 3000000000 },
  { name: "Intel Capital", type: "corporate_venture", country: "United States", city: "Santa Clara", founded: 1991, stages: ["series_a", "series_b"], sectors: ["ai", "deeptech", "robotics", "energy", "cybersecurity"], checkMin: 1000000, checkMax: 20000000, fundSize: 5000000000 },
  { name: "Sequoia Capital India", type: "venture_capital", country: "India", city: "Bangalore", founded: 2006, stages: ["seed", "series_a", "series_b", "series_c"], sectors: ["saas", "fintech", "consumer", "healthtech"], checkMin: 500000, checkMax: 30000000, fundSize: 2000000000 },
  { name: "Accel India", type: "venture_capital", country: "India", city: "Bangalore", founded: 2008, stages: ["seed", "series_a", "series_b"], sectors: ["saas", "fintech", "consumer", "enterprise"], checkMin: 500000, checkMax: 15000000, fundSize: 1500000000 },
  { name: "Lightspeed India", type: "venture_capital", country: "India", city: "Bangalore", founded: 2007, stages: ["seed", "series_a", "series_b"], sectors: ["saas", "fintech", "consumer", "healthtech"], checkMin: 500000, checkMax: 20000000, fundSize: 1800000000 },
  // === EUROPEAN VCs ===
  { name: "Atomico", type: "venture_capital", country: "United Kingdom", city: "London", founded: 2006, stages: ["series_a", "series_b", "series_c"], sectors: ["saas", "fintech", "consumer", "healthtech"], checkMin: 1000000, checkMax: 30000000, fundSize: 2200000000 },
  { name: "Balderton Capital", type: "venture_capital", country: "United Kingdom", city: "London", founded: 2002, stages: ["series_a", "series_b"], sectors: ["saas", "marketplace", "fintech", "consumer"], checkMin: 1000000, checkMax: 20000000, fundSize: 1500000000 },
  { name: "Northzone", type: "venture_capital", country: "United Kingdom", city: "London", founded: 1996, stages: ["seed", "series_a", "series_b"], sectors: ["saas", "fintech", "marketplace", "consumer"], checkMin: 500000, checkMax: 20000000, fundSize: 1000000000 },
  { name: "EQT Ventures", type: "venture_capital", country: "Sweden", city: "Stockholm", founded: 2013, stages: ["seed", "series_a", "series_b", "series_c"], sectors: ["saas", "ai", "consumer", "enterprise"], checkMin: 500000, checkMax: 30000000, fundSize: 2500000000 },
  { name: "Lakestar", type: "venture_capital", country: "Germany", city: "Berlin", founded: 2012, stages: ["seed", "series_a", "series_b"], sectors: ["fintech", "saas", "consumer", "healthtech"], checkMin: 500000, checkMax: 20000000, fundSize: 1000000000 },
  { name: "HV Capital", type: "venture_capital", country: "Germany", city: "Munich", founded: 2000, stages: ["seed", "series_a", "series_b"], sectors: ["saas", "fintech", "consumer", "marketplace"], checkMin: 500000, checkMax: 15000000, fundSize: 800000000 },
  { name: "Accel Europe", type: "venture_capital", country: "United Kingdom", city: "London", founded: 2000, stages: ["seed", "series_a", "series_b"], sectors: ["saas", "fintech", "consumer", "enterprise"], checkMin: 500000, checkMax: 20000000, fundSize: 2000000000 },
  { name: "Index Ventures Europe", type: "venture_capital", country: "Switzerland", city: "Geneva", founded: 1996, stages: ["seed", "series_a", "series_b"], sectors: ["saas", "fintech", "healthtech"], checkMin: 500000, checkMax: 20000000, fundSize: 2000000000 },
  { name: "OMERS Ventures", type: "venture_capital", country: "Canada", city: "Toronto", founded: 2001, stages: ["series_a", "series_b", "growth"], sectors: ["saas", "fintech", "ai", "enterprise"], checkMin: 2000000, checkMax: 40000000, fundSize: 2000000000 },
  { name: "Sapphire Ventures", type: "growth_equity", country: "United States", city: "Palo Alto", founded: 1996, stages: ["series_b", "series_c", "growth"], sectors: ["saas", "enterprise", "ai"], checkMin: 5000000, checkMax: 50000000, fundSize: 5000000000 },
  { name: "Coatue Management", type: "growth_equity", country: "United States", city: "New York", founded: 1999, stages: ["series_b", "series_c", "growth"], sectors: ["ai", "saas", "fintech", "consumer"], checkMin: 5000000, checkMax: 200000000, fundSize: 15000000000 },
  { name: "Thrive Capital", type: "growth_equity", country: "United States", city: "New York", founded: 2010, stages: ["series_a", "series_b", "growth"], sectors: ["consumer", "saas", "healthtech", "fintech"], checkMin: 5000000, checkMax: 100000000, fundSize: 10000000000 },
  { name: "Softbank Vision Fund", type: "growth_equity", country: "United Kingdom", city: "London", founded: 2017, stages: ["series_c", "growth"], sectors: ["ai", "mobility", "fintech", "saas", "healthtech"], checkMin: 50000000, checkMax: 5000000000, fundSize: 100000000000 },
  { name: "Sapphire Ventures", type: "venture_capital", country: "United States", city: "Palo Alto", founded: 1996, stages: ["series_b", "series_c"], sectors: ["saas", "enterprise", "ai"], checkMin: 5000000, checkMax: 40000000, fundSize: 5000000000 },
  // === ASIA / MIDDLE EAST / LATAM ===
  { name: "GGV Capital", type: "venture_capital", country: "United States", city: "Menlo Park", founded: 2000, stages: ["series_a", "series_b", "series_c"], sectors: ["saas", "consumer", "ecommerce", "enterprise"], checkMin: 1000000, checkMax: 50000000, fundSize: 6000000000 },
  { name: "Hillhouse Capital", type: "private_equity", country: "Hong Kong", city: "Hong Kong", founded: 2005, stages: ["series_c", "growth"], sectors: ["consumer", "healthtech", "saas", "energy"], checkMin: 10000000, checkMax: 200000000, fundSize: 50000000000 },
  { name: "Tencent Holdings", type: "corporate_venture", country: "China", city: "Shenzhen", founded: 1998, stages: ["series_b", "series_c", "growth"], sectors: ["consumer", "gaming", "fintech", "saas", "ai"], checkMin: 5000000, checkMax: 500000000, fundSize: 20000000000 },
  { name: "Alibaba Group", type: "corporate_venture", country: "China", city: "Hangzhou", founded: 1999, stages: ["series_a", "series_b", "series_c", "growth"], sectors: ["ecommerce", "fintech", "logistics", "saas"], checkMin: 5000000, checkMax: 200000000, fundSize: 15000000000 },
  { name: "Tiger Global Asia", type: "growth_equity", country: "Singapore", city: "Singapore", founded: 2005, stages: ["series_b", "series_c", "growth"], sectors: ["saas", "fintech", "consumer", "ecommerce"], checkMin: 5000000, checkMax: 100000000, fundSize: 8000000000 },
  { name: "Vertex Ventures", type: "venture_capital", country: "Israel", city: "Tel Aviv", founded: 1988, stages: ["seed", "series_a", "series_b"], sectors: ["cybersecurity", "enterprise", "ai", "deeptech"], checkMin: 500000, checkMax: 20000000, fundSize: 2500000000 },
  { name: "Pitango Venture Capital", type: "venture_capital", country: "Israel", city: "Tel Aviv", founded: 1993, stages: ["seed", "series_a", "series_b"], sectors: ["cybersecurity", "healthtech", "ai", "enterprise"], checkMin: 500000, checkMax: 20000000, fundSize: 2000000000 },
  { name: "B Capital Group", type: "venture_capital", country: "United States", city: "Menlo Park", founded: 2015, stages: ["series_a", "series_b", "growth"], sectors: ["saas", "enterprise", "fintech", "healthtech"], checkMin: 2000000, checkMax: 30000000, fundSize: 6000000000 },
  { name: "Jungle Ventures", type: "venture_capital", country: "Singapore", city: "Singapore", founded: 2012, stages: ["series_a", "series_b"], sectors: ["saas", "fintech", "consumer", "marketplace"], checkMin: 1000000, checkMax: 15000000, fundSize: 500000000 },
  { name: "Felicis Ventures", type: "venture_capital", country: "United States", city: "Menlo Park", founded: 2006, stages: ["seed", "series_a"], sectors: ["ai", "fintech", "consumer", "deeptech", "robotics"], checkMin: 500000, checkMax: 10000000, fundSize: 2000000000 },
  { name: "Khosla Ventures", type: "venture_capital", country: "United States", city: "Menlo Park", founded: 2004, stages: ["seed", "series_a", "series_b"], sectors: ["ai", "energy", "climatetech", "healthtech", "robotics"], checkMin: 500000, checkMax: 20000000, fundSize: 3000000000 },
  { name: "NEA", type: "venture_capital", country: "United States", city: "Menlo Park", founded: 1977, stages: ["seed", "series_a", "series_b", "series_c", "growth"], sectors: ["saas", "healthtech", "enterprise", "fintech"], checkMin: 1000000, checkMax: 50000000, fundSize: 10000000000 },
  { name: "Wing Venture Capital", type: "venture_capital", country: "United States", city: "Palo Alto", founded: 2012, stages: ["series_a"], sectors: ["saas", "enterprise", "cybersecurity"], checkMin: 2000000, checkMax: 15000000, fundSize: 500000000 },
  { name: "IVP", type: "venture_capital", country: "United States", city: "Menlo Park", founded: 1980, stages: ["series_b", "series_c"], sectors: ["saas", "consumer", "enterprise", "fintech"], checkMin: 5000000, checkMax: 40000000, fundSize: 5000000000 },
  { name: "Redpoint Ventures", type: "venture_capital", country: "United States", city: "Menlo Park", founded: 1999, stages: ["seed", "series_a", "series_b"], sectors: ["saas", "cloud", "ai", "consumer"], checkMin: 500000, checkMax: 30000000, fundSize: 4000000000 },
  { name: "WGG Capital", type: "venture_capital", country: "United States", city: "San Francisco", founded: 2014, stages: ["seed", "series_a"], sectors: ["saas", "enterprise", "ai"], checkMin: 500000, checkMax: 5000000, fundSize: 400000000 },
  { name: "Spark Capital", type: "venture_capital", country: "United States", city: "San Francisco", founded: 2007, stages: ["seed", "series_a", "series_b"], sectors: ["saas", "consumer", "fintech", "ai"], checkMin: 500000, checkMax: 20000000, fundSize: 3000000000 },
  { name: "Norwest Venture Partners", type: "venture_capital", country: "United States", city: "Palo Alto", founded: 1961, stages: ["series_a", "series_b", "series_c", "growth"], sectors: ["saas", "enterprise", "healthtech", "fintech"], checkMin: 2000000, checkMax: 30000000, fundSize: 5000000000 },
  { name: "Scale Venture Partners", type: "venture_capital", country: "United States", city: "Foster City", founded: 2000, stages: ["series_a", "series_b"], sectors: ["saas", "enterprise", "cybersecurity"], checkMin: 2000000, checkMax: 15000000, fundSize: 1500000000 },
  { name: "Flybridge Capital", type: "venture_capital", country: "United States", city: "Boston", founded: 2001, stages: ["seed", "series_a"], sectors: ["saas", "enterprise", "consumer", "healthtech"], checkMin: 500000, checkMax: 8000000, fundSize: 400000000 },
  { name: "Matrix Partners", type: "venture_capital", country: "United States", city: "Palo Alto", founded: 1977, stages: ["seed", "series_a", "series_b"], sectors: ["saas", "enterprise", "fintech", "consumer"], checkMin: 500000, checkMax: 20000000, fundSize: 4000000000 },
  { name: "Draper Fisher Jurvetson", type: "venture_capital", country: "United States", city: "Menlo Park", founded: 1985, stages: ["seed", "series_a", "series_b"], sectors: ["ai", "deeptech", "energy", "consumer", "enterprise"], checkMin: 500000, checkMax: 20000000, fundSize: 2000000000 },
  { name: "Meritech Capital", type: "growth_equity", country: "United States", city: "Palo Alto", founded: 1995, stages: ["series_c", "growth"], sectors: ["saas", "enterprise", "cloud"], checkMin: 10000000, checkMax: 75000000, fundSize: 4000000000 },
  { name: "Menlo Ventures", type: "venture_capital", country: "United States", city: "Menlo Park", founded: 1976, stages: ["seed", "series_a", "series_b"], sectors: ["saas", "ai", "enterprise", "consumer"], checkMin: 500000, checkMax: 20000000, fundSize: 4500000000 },
  { name: "HarbourVest Partners", type: "fund_of_funds", country: "United States", city: "Boston", founded: 1982, stages: ["series_a", "series_b", "series_c", "growth"], sectors: ["saas", "fintech", "consumer"], checkMin: 10000000, checkMax: 100000000, fundSize: 90000000000 },
  // === AFRICA ===
  { name: "TLcom Capital", type: "venture_capital", country: "United Kingdom", city: "London", founded: 1999, stages: ["seed", "series_a", "series_b"], sectors: ["fintech", "saas", "consumer", "healthtech"], checkMin: 500000, checkMax: 15000000, fundSize: 400000000 },
  { name: "Partech Africa", type: "venture_capital", country: "France", city: "Paris", founded: 2018, stages: ["seed", "series_a", "series_b"], sectors: ["fintech", "saas", "consumer", "logistics"], checkMin: 250000, checkMax: 15000000, fundSize: 300000000 },
  { name: "Novastar Ventures", type: "venture_capital", country: "Kenya", city: "Nairobi", founded: 2014, stages: ["seed", "series_a"], sectors: ["healthtech", "agritech", "energy", "fintech"], checkMin: 250000, checkMax: 5000000, fundSize: 200000000 },
  { name: "Africa Founders Capital", type: "venture_capital", country: "South Africa", city: "Cape Town", founded: 2018, stages: ["pre_seed", "seed"], sectors: ["fintech", "saas", "consumer"], checkMin: 100000, checkMax: 2000000, fundSize: 50000000 },
  { name: "Naspers Foundry", type: "corporate_venture", country: "South Africa", city: "Cape Town", founded: 2019, stages: ["seed", "series_a"], sectors: ["fintech", "saas", "consumer", "healthtech"], checkMin: 500000, checkMax: 10000000, fundSize: 100000000 },
  // === ANGEL SYNDICATES ===
  { name: "AngelList Syndicates", type: "angel_syndicate", country: "United States", city: "San Francisco", founded: 2010, stages: ["pre_seed", "seed"], sectors: ["saas", "ai", "fintech", "consumer", "healthtech"], checkMin: 10000, checkMax: 250000, fundSize: 100000000 },
  { name: "Syndicate Room", type: "angel_syndicate", country: "United Kingdom", city: "London", founded: 2013, stages: ["seed"], sectors: ["saas", "fintech", "consumer"], checkMin: 5000, checkMax: 100000, fundSize: 30000000 },
  { name: "Keiretsu Forum", type: "angel_syndicate", country: "United States", city: "San Francisco", founded: 2000, stages: ["pre_seed", "seed"], sectors: ["healthtech", "saas", "consumer", "cleantech"], checkMin: 25000, checkMax: 500000, fundSize: 50000000 },
  // === GROWTH / LATE STAGE ===
  { name: "General Atlantic", type: "growth_equity", country: "United States", city: "New York", founded: 1980, stages: ["series_c", "growth"], sectors: ["saas", "consumer", "fintech", "healthtech"], checkMin: 20000000, checkMax: 200000000, fundSize: 85000000000 },
  { name: "Warburg Pincus", type: "growth_equity", country: "United States", city: "New York", founded: 1966, stages: ["series_c", "growth"], sectors: ["saas", "fintech", "healthtech", "consumer"], checkMin: 20000000, checkMax: 300000000, fundSize: 80000000000 },
  { name: "KKR", type: "private_equity", country: "United States", city: "New York", founded: 1976, stages: ["growth"], sectors: ["saas", "enterprise", "consumer", "healthtech"], checkMin: 50000000, checkMax: 500000000, fundSize: 500000000000 },
  { name: "Bain Capital Ventures", type: "venture_capital", country: "United States", city: "Boston", founded: 1984, stages: ["series_a", "series_b", "series_c"], sectors: ["saas", "enterprise", "fintech", "healthtech"], checkMin: 2000000, checkMax: 30000000, fundSize: 3500000000 },
  { name: "8VC", type: "venture_capital", country: "United States", city: "Austin", founded: 2012, stages: ["seed", "series_a", "series_b"], sectors: ["ai", "cybersecurity", "defense", "healthtech"], checkMin: 500000, checkMax: 15000000, fundSize: 1500000000 },
  { name: "Insight Partners", type: "growth_equity", country: "United States", city: "New York", founded: 1995, stages: ["series_b", "series_c", "growth"], sectors: ["saas", "enterprise", "fintech"], checkMin: 10000000, checkMax: 100000000, fundSize: 30000000000 },
  { name: "Battery Ventures", type: "venture_capital", country: "United States", city: "Boston", founded: 1983, stages: ["series_a", "series_b", "growth"], sectors: ["saas", "enterprise", "industrial"], checkMin: 1000000, checkMax: 40000000, fundSize: 8000000000 },
  { name: "Y Combinator Continuity", type: "growth_equity", country: "United States", city: "San Francisco", founded: 2017, stages: ["series_a", "series_b"], sectors: ["saas", "ai", "consumer", "enterprise"], checkMin: 1000000, checkMax: 10000000, fundSize: 500000000 },
  { name: "Initialized Capital", type: "venture_capital", country: "United States", city: "San Francisco", founded: 2012, stages: ["seed", "series_a"], sectors: ["ai", "saas", "fintech", "consumer"], checkMin: 250000, checkMax: 10000000, fundSize: 700000000 },
  { name: "SignalFire", type: "venture_capital", country: "United States", city: "San Francisco", founded: 2013, stages: ["seed", "series_a", "series_b"], sectors: ["saas", "consumer", "ai", "healthtech"], checkMin: 500000, checkMax: 15000000, fundSize: 2000000000 },
  { name: "Craft Ventures", type: "venture_capital", country: "United States", city: "San Francisco", founded: 2017, stages: ["seed", "series_a"], sectors: ["saas", "marketplace", "fintech", "crypto"], checkMin: 500000, checkMax: 10000000, fundSize: 1000000000 },
  { name: "Abstract Ventures", type: "venture_capital", country: "United States", city: "San Francisco", founded: 2019, stages: ["pre_seed", "seed"], sectors: ["ai", "saas", "consumer"], checkMin: 100000, checkMax: 2000000, fundSize: 100000000 },
  { name: "Liquid 2 Ventures", type: "venture_capital", country: "United States", city: "San Francisco", founded: 2014, stages: ["seed", "series_a"], sectors: ["saas", "fintech", "consumer", "ai"], checkMin: 250000, checkMax: 5000000, fundSize: 300000000 },
  { name: "Max Ventures", type: "venture_capital", country: "India", city: "Delhi", founded: 2018, stages: ["seed", "series_a"], sectors: ["saas", "fintech", "edtech"], checkMin: 500000, checkMax: 5000000, fundSize: 100000000 },
  { name: "Peak XV Partners", type: "venture_capital", country: "India", city: "Bangalore", founded: 2006, stages: ["seed", "series_a", "series_b", "series_c"], sectors: ["saas", "fintech", "consumer", "healthtech", "ai"], checkMin: 500000, checkMax: 30000000, fundSize: 3000000000 },
  { name: "WaterBridge Ventures", type: "venture_capital", country: "India", city: "Delhi", founded: 2017, stages: ["seed", "series_a"], sectors: ["saas", "fintech", "healthtech"], checkMin: 250000, checkMax: 5000000, fundSize: 100000000 },
];

// Extended list to generate more firms procedurally
const FIRM_SUFFIXES_VC = ["Capital", "Ventures", "Partners", "Investments", "Fund", "Advisors", "Partners", "Capital Partners", "Growth", "Equity"];
const FIRM_SUFFIXES_ACC = ["Labs", "Studio", "Foundry", "Accelerator", "Hub", "X", "Works", "Factory"];
const FIRM_PREFIXES = [
  "Alpha", "Beta", "Delta", "Omega", "Nova", "Apex", "Vertex", "Atlas", "Nexus", "Prime",
  "Summit", "Pioneer", "Frontier", "Catalyst", "Lighthouse", "Compass", "Keystone", "Horizon",
  "Crescent", "Aureus", "Astralis", "Zenith", "Cortex", "Forge", "Genesis", "Helix",
  "Spark", "Ember", "Flint", "Cobalt", "Iron", "Steel", "Titan", "Quantum",
  "BlueSky", "ClearView", "DeepWater", "Evergreen", "Ironwood", "Redwood", "Banyan",
  "GoldenGate", "SilverLake", "BlackRock", "WhiteOak", "Greenfield", "Stonegate",
];

// =============================================
// Reference Data (same as generate-investors.ts)
// =============================================

const FIRST_NAMES_MALE = [
  "James", "John", "Robert", "Michael", "David", "William", "Richard", "Joseph",
  "Thomas", "Charles", "Christopher", "Daniel", "Matthew", "Anthony", "Mark",
  "Donald", "Steven", "Paul", "Andrew", "Joshua", "Kenneth", "Kevin", "Brian",
  "George", "Timothy", "Ronald", "Edward", "Jason", "Jeffrey", "Ryan", "Jacob",
  "Gary", "Nicholas", "Eric", "Jonathan", "Stephen", "Larry", "Justin", "Scott",
  "Brandon", "Benjamin", "Samuel", "Raymond", "Gregory", "Frank", "Alexander",
  "Patrick", "Jack", "Dennis", "Jerry", "Tyler", "Aaron", "Adam", "Nathan",
  "Henry", "Zachary", "Douglas", "Peter", "Noah", "Ethan", "Liam", "Mason",
  "Logan", "Lucas", "Owen", "Leo", "Aiden", "Elijah", "Caleb", "Isaac",
];

const FIRST_NAMES_FEMALE = [
  "Mary", "Patricia", "Jennifer", "Linda", "Barbara", "Elizabeth", "Susan",
  "Jessica", "Sarah", "Karen", "Lisa", "Nancy", "Betty", "Margaret",
  "Sandra", "Ashley", "Dorothy", "Kimberly", "Emily", "Donna", "Michelle",
  "Carol", "Amanda", "Melissa", "Deborah", "Stephanie", "Rebecca", "Sharon",
  "Laura", "Cynthia", "Kathleen", "Amy", "Angela", "Anna", "Brenda",
  "Pamela", "Emma", "Nicole", "Helen", "Samantha", "Katherine", "Christine",
  "Rachel", "Carolyn", "Janet", "Catherine", "Maria", "Heather", "Diane",
  "Ruth", "Julie", "Olivia", "Joyce", "Virginia", "Victoria", "Kelly",
  "Lauren", "Christina", "Joan", "Evelyn", "Priya", "Mei", "Fatima",
  "Aisha", "Yuki", "Sofia", "Amara", "Zara", "Chloe", "Nadia", "Grace",
];

const LAST_NAMES = [
  "Smith", "Johnson", "Williams", "Brown", "Jones", "Garcia", "Miller",
  "Davis", "Rodriguez", "Martinez", "Hernandez", "Lopez", "Gonzalez",
  "Wilson", "Anderson", "Thomas", "Taylor", "Moore", "Jackson", "Martin",
  "Lee", "Perez", "Thompson", "White", "Harris", "Sanchez", "Clark",
  "Ramirez", "Lewis", "Robinson", "Walker", "Young", "Allen", "King",
  "Wright", "Scott", "Torres", "Nguyen", "Hill", "Flores", "Green",
  "Adams", "Nelson", "Baker", "Hall", "Rivera", "Campbell", "Mitchell",
  "Carter", "Roberts", "Gomez", "Phillips", "Evans", "Turner", "Diaz",
  "Parker", "Cruz", "Edwards", "Collins", "Reyes", "Stewart", "Morris",
  "Morales", "Murphy", "Cook", "Rogers", "Gutierrez", "Ortiz", "Morgan",
  "Cooper", "Peterson", "Bailey", "Reed", "Kelly", "Howard", "Ramos",
  "Kim", "Cox", "Ward", "Richardson", "Watson", "Brooks", "Chavez",
  "Wood", "Bennett", "Gray", "Mendoza", "Ruiz", "Hughes", "Price",
  "Alvarez", "Castillo", "Sanders", "Patel", "Myers", "Long", "Ross",
  "Foster", "Jimenez", "Powell", "Jenkins", "Perry", "Russell",
  "Chen", "Wang", "Li", "Zhang", "Liu", "Yang", "Wu", "Zhou",
  "Sharma", "Gupta", "Singh", "Kumar", "Muller", "Schmidt", "Schneider",
  "Fischer", "Weber", "Tanaka", "Sato", "Watanabe", "Ito", "Yamamoto",
  "Nakamura", "Kobayashi", "Suzuki", "Kimura", "Okafor", "Adeyemi",
  "Osei", "Nkosi", "Dlamini", "Moyo", "Ndlovu", "Van der Berg",
  "De Vries", "Van Dijk", "Bakker", "Jansen", "De Boer", "Visser",
];

const INVESTOR_TYPES = [
  { type: "venture_capital", weight: 30 },
  { type: "angel_investor", weight: 25 },
  { type: "accelerator", weight: 10 },
  { type: "family_office", weight: 8 },
  { type: "corporate_venture", weight: 7 },
  { type: "micro_vc", weight: 8 },
  { type: "private_equity", weight: 5 },
  { type: "impact_investor", weight: 4 },
  { type: "strategic_investor", weight: 3 },
];

const STAGES = ["pre_seed", "seed", "series_a", "series_b", "series_c", "growth", "late_stage"];
const SECTORS = [
  "ai", "fintech", "saas", "healthtech", "climatetech", "consumer",
  "cybersecurity", "edtech", "deeptech", "robotics", "web3", "enterprise",
  "mobility", "proptech", "agritech", "energy", "media", "logistics",
  "devtools", "marketplace",
];

const CITIES: Array<{ city: string; country: string }> = [
  { city: "San Francisco", country: "United States" },
  { city: "New York", country: "United States" },
  { city: "Los Angeles", country: "United States" },
  { city: "Boston", country: "United States" },
  { city: "Austin", country: "United States" },
  { city: "Seattle", country: "United States" },
  { city: "Chicago", country: "United States" },
  { city: "Miami", country: "United States" },
  { city: "Denver", country: "United States" },
  { city: "Portland", country: "United States" },
  { city: "Nashville", country: "United States" },
  { city: "Atlanta", country: "United States" },
  { city: "Washington DC", country: "United States" },
  { city: "Dallas", country: "United States" },
  { city: "San Diego", country: "United States" },
  { city: "London", country: "United Kingdom" },
  { city: "Manchester", country: "United Kingdom" },
  { city: "Berlin", country: "Germany" },
  { city: "Munich", country: "Germany" },
  { city: "Paris", country: "France" },
  { city: "Amsterdam", country: "Netherlands" },
  { city: "Stockholm", country: "Sweden" },
  { city: "Zurich", country: "Switzerland" },
  { city: "Barcelona", country: "Spain" },
  { city: "Dublin", country: "Ireland" },
  { city: "Lisbon", country: "Portugal" },
  { city: "Copenhagen", country: "Denmark" },
  { city: "Helsinki", country: "Finland" },
  { city: "Vienna", country: "Austria" },
  { city: "Milan", country: "Italy" },
  { city: "Singapore", country: "Singapore" },
  { city: "Tokyo", country: "Japan" },
  { city: "Seoul", country: "South Korea" },
  { city: "Mumbai", country: "India" },
  { city: "Bangalore", country: "India" },
  { city: "Delhi", country: "India" },
  { city: "Beijing", country: "China" },
  { city: "Shanghai", country: "China" },
  { city: "Shenzhen", country: "China" },
  { city: "Tel Aviv", country: "Israel" },
  { city: "Hong Kong", country: "Hong Kong" },
  { city: "Dubai", country: "United Arab Emirates" },
  { city: "Abu Dhabi", country: "United Arab Emirates" },
  { city: "Riyadh", country: "Saudi Arabia" },
  { city: "Lagos", country: "Nigeria" },
  { city: "Nairobi", country: "Kenya" },
  { city: "Cape Town", country: "South Africa" },
  { city: "Cairo", country: "Egypt" },
  { city: "São Paulo", country: "Brazil" },
  { city: "Mexico City", country: "Mexico" },
  { city: "Buenos Aires", country: "Argentina" },
  { city: "Bogotá", country: "Colombia" },
  { city: "Santiago", country: "Chile" },
  { city: "Sydney", country: "Australia" },
  { city: "Melbourne", country: "Australia" },
  { city: "Auckland", country: "New Zealand" },
];

const JOB_TITLES = [
  "General Partner", "Managing Partner", "Partner", "Principal",
  "Venture Partner", "Senior Associate", "Associate", "Investment Director",
  "Head of Investments", "Managing Director", "Investment Manager",
  "Founding Partner", "Co-Founder", "CEO", "Chief Investment Officer",
  "Director of Investments", "Senior Partner", "Investment Analyst",
  "Angel Investor", "Advisor", "Board Member", "Operating Partner",
  "Chief Technology Officer", "Chief Operating Officer",
];

const BIOS = [
  "Experienced venture capitalist with focus on early-stage technology investments.",
  "Serial entrepreneur turned investor. Passionate about founders building the future.",
  "Long-time investor in enterprise software and cloud infrastructure.",
  "Focused on climate tech and sustainability investments across growth stages.",
  "Deep expertise in fintech and digital banking investments globally.",
  "Backing founders building AI-first products and infrastructure.",
  "Investing in the future of work and enterprise productivity tools.",
  "Portfolio spans 50+ companies across consumer and enterprise.",
  "Active angel investor and mentor to early-stage founders.",
  "Led investments in 20+ successful exits over the past decade.",
  "Specializing in healthtech and digital health transformation.",
  "Technology investor with a focus on cybersecurity and data privacy.",
  "Supporting underrepresented founders building transformative companies.",
  "Building the next generation of developer tools and infrastructure.",
  "Experienced investor in mobility, logistics, and supply chain.",
  "Backed by decades of experience in financial services and banking.",
  "Passionate about edtech and the future of learning.",
  "Investing in Web3, blockchain, and decentralized technologies.",
  "Focused on deep tech and frontier technology companies.",
  "Global investor with experience across US, Europe, and Asia.",
  "Former operator who now helps founders scale from seed to growth.",
  "Dedicated to impact investing and social enterprise.",
  "Building a portfolio of category-defining consumer brands.",
  "Expert in B2B SaaS and recurring revenue business models.",
  "Investing in the next wave of proptech and construction tech.",
  "Agritech investor focused on food security and sustainability.",
  "Energy transition investor backing the clean energy revolution.",
  "Robotics and automation investor with deep technical expertise.",
  "Marketplace and platform business model specialist.",
  "Cybersecurity focused VC with enterprise sales expertise.",
  "Cross-border investor connecting Asia and Silicon Valley.",
  "Early-stage investor in developer tools and open-source.",
  "Consumer brand builder with 15+ years of operating experience.",
  "Seed stage specialist with strong conviction-driven portfolio.",
  "Growth equity investor in proven digital businesses.",
  "Family office investment director with conservative growth mandate.",
  "Corporate venture lead investing in strategic adjacencies.",
  "University endowment manager focused on venture allocation.",
  "Government-backed innovation fund focused on national priorities.",
  "Incubator partner helping pre-seed companies find product-market fit.",
  "Venture studio founder building companies from scratch.",
  "Ex-Google engineer now investing in developer infrastructure.",
  "Former CFO of public SaaS company, now angel investor.",
  "Healthcare executive investing in digital health transformation.",
  "Fintech founder turned investor with deep payments expertise.",
  "Sustainability-focused investor with climate tech thesis.",
  "Cross-border investor bridging Africa and global markets.",
  "SE Asia specialist with deep local network.",
  "Latin America-focused investor backing regional champions.",
  "Israeli defense tech investor with deep-tech thesis.",
];

// =============================================
// Helper Functions
// =============================================

function randomFrom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randomSubset<T>(arr: T[], min: number, max: number): T[] {
  const count = min + Math.floor(Math.random() * (max - min + 1));
  const shuffled = [...arr].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count);
}

function randomInt(min: number, max: number): number {
  return min + Math.floor(Math.random() * (max - min + 1));
}

function weightedRandom(items: Array<{ type: string; weight: number }>): string {
  const totalWeight = items.reduce((sum, item) => sum + item.weight, 0);
  let random = Math.random() * totalWeight;
  for (const item of items) {
    random -= item.weight;
    if (random <= 0) return item.type;
  }
  return items[items.length - 1].type;
}

function generateEmail(firstName: string, lastName: string): string {
  const domains = ["gmail.com", "yahoo.com", "outlook.com", "protonmail.com", "icloud.com"];
  const sep = randomFrom([".", "_", ""]);
  const num = Math.random() > 0.6 ? randomInt(1, 99) : "";
  return `${firstName.toLowerCase()}${sep}${lastName.toLowerCase()}${num}@${randomFrom(domains)}`;
}

function generateLinkedIn(firstName: string, lastName: string): string {
  return `https://linkedin.com/in/${firstName.toLowerCase()}-${lastName.toLowerCase()}-${randomInt(100, 9999)}`;
}

// =============================================
// Generate Firms
// =============================================

function generateProceduralFirms(count: number) {
  const firms = [];
  for (let i = 0; i < count; i++) {
    const prefix = randomFrom(FIRM_PREFIXES);
    const suffix = randomFrom(FIRM_SUFFIXES_VC);
    const name = `${prefix} ${suffix}`;
    const location = randomFrom(CITIES);
    const type = randomFrom(["venture_capital", "micro_vc", "venture_capital", "accelerator", "family_office"]);
    const founded = randomInt(1990, 2024);

    firms.push({
      name,
      domain: `${prefix.toLowerCase()}${suffix.toLowerCase().replace(/\s+/g, "")}.com`,
      website: `https://www.${prefix.toLowerCase()}${suffix.toLowerCase().replace(/\s+/g, "")}.com`,
      firm_type: type,
      headquarters: location.city,
      country: location.country,
      region: location.country === "United States" ? "North America" : "Other",
      investment_stages: randomSubset(STAGES, 1, 3),
      investment_sectors: randomSubset(SECTORS, 2, 5),
      investment_geographies: [location.country],
      min_check_size: type === "accelerator" ? 25000 : type === "micro_vc" ? 100000 : 500000,
      max_check_size: type === "accelerator" ? 150000 : type === "micro_vc" ? 1000000 : 20000000,
      fund_size: type === "accelerator" ? 100000000 : randomInt(50000000, 3000000000),
      founded_year: founded,
      team_size: randomInt(3, 30),
      portfolio_count: randomInt(10, 200),
      source: "generated",
    });
  }
  return firms;
}

// =============================================
// Main Generator
// =============================================

async function main() {
  const TARGET_INVESTORS = parseInt(process.argv[2] || "200000", 10);
  const BATCH_SIZE = 500;

  console.log(`\n🚀 Full Dataset Generator`);
  console.log(`   Target investors: ${TARGET_INVESTORS.toLocaleString()}`);
  console.log(`   Real firms: ${REAL_VC_FIRMS.length}`);
  console.log(`\n`);

  // ====== STEP 1: Generate Firms ======
  console.log("📦 Step 1: Generating investor firms...");
  const proceduralFirms = generateProceduralFirms(2500);
  const allFirms = [...REAL_VC_FIRMS, ...proceduralFirms];

  // Insert firms in batches
  let firmsInserted = 0;
  const firmIds: string[] = [];

  for (let i = 0; i < allFirms.length; i += BATCH_SIZE) {
    const batch = allFirms.slice(i, i + BATCH_SIZE).map((f: any) => ({
      name: f.name,
      domain: f.domain || null,
      website: f.website || null,
      firm_type: f.type || f.firm_type,
      headquarters: f.city || f.headquarters || null,
      country: f.country,
      region: f.country === "United States" ? "North America" : "Other",
      investment_stages: f.stages || f.investment_stages,
      investment_sectors: f.sectors || f.investment_sectors,
      investment_geographies: [f.country],
      min_check_size: f.checkMin || f.min_check_size,
      max_check_size: f.checkMax || f.max_check_size,
      fund_size: f.fundSize || f.fund_size || null,
      founded_year: f.founded,
      team_size: randomInt(3, 30),
      portfolio_count: f.portfolioCount || f.portfolio_count || randomInt(10, 200),
      source: "generated",
      source_id: `firm_${i}`,
    }));

    const { data, error } = await supabase
      .from("investor_firms")
      .insert(batch)
      .select("id");

    if (data) {
      firmsInserted += data.length;
      firmIds.push(...data.map((d) => d.id));
    }

    if (error) {
      console.error(`  ⚠️  Firm batch error: ${error.message}`);
      // Fallback: insert one by one
      for (const firm of batch) {
        const { data: single, error: singleErr } = await supabase
          .from("investor_firms")
          .insert(firm)
          .select("id");
        if (single && single.length > 0) {
          firmsInserted++;
          firmIds.push(single[0].id);
        }
      }
    }

    if ((i + BATCH_SIZE) % 500 === 0 || i + BATCH_SIZE >= allFirms.length) {
      console.log(`  📊 Firms: ${firmsInserted} / ${allFirms.length}`);
    }
  }

  console.log(`  ✅ Firms created: ${firmsInserted}`);

  // ====== STEP 2: Generate Investors ======
  console.log(`\n📦 Step 2: Generating ${TARGET_INVESTORS.toLocaleString()} investors...`);

  let investorsInserted = 0;
  let employmentInserted = 0;
  const startTime = Date.now();

  for (let i = 0; i < TARGET_INVESTORS; i += BATCH_SIZE) {
    const batchSize = Math.min(BATCH_SIZE, TARGET_INVESTORS - i);
    const investors: any[] = [];

    for (let j = 0; j < batchSize; j++) {
      const firstName = randomFrom([...FIRST_NAMES_MALE, ...FIRST_NAMES_FEMALE]);
      const lastName = randomFrom(LAST_NAMES);
      const investorType = weightedRandom(INVESTOR_TYPES);
      const location = randomFrom(CITIES);
      const stages = randomSubset(STAGES, 1, 3);
      const sectors = randomSubset(SECTORS, 1, 5);
      const extraGeos = randomSubset(
        CITIES.filter(c => c.country === location.country).map(c => c.country),
        0, 2
      ).filter(g => g !== location.country);
      const geos = [location.country, ...extraGeos].slice(0, 3);

      // ~40% of investors are associated with a firm
      const hasFirm = firmIds.length > 0 && Math.random() > 0.6;
      const firmId = hasFirm ? randomFrom(firmIds) : null;

      const checkMin = investorType === "angel_investor" ? randomInt(5000, 50000) :
        investorType === "accelerator" ? 25000 :
        investorType === "micro_vc" ? randomInt(25000, 200000) :
        randomInt(100000, 500000);

      const checkMax = investorType === "angel_investor" ? randomInt(25000, 250000) :
        investorType === "accelerator" ? 150000 :
        investorType === "micro_vc" ? randomInt(500000, 5000000) :
        randomInt(2000000, 50000000);

      investors.push({
        full_name: `${firstName} ${lastName}`,
        first_name: firstName,
        last_name: lastName,
        email: Math.random() > 0.35 ? generateEmail(firstName, lastName) : null,
        linkedin_url: Math.random() > 0.3 ? generateLinkedIn(firstName, lastName) : null,
        job_title: randomFrom(JOB_TITLES),
        investor_type: investorType,
        investment_stages: stages,
        investment_sectors: sectors,
        investment_geographies: Array.from(new Set(geos)),
        country: location.country,
        city: location.city,
        min_check_size: checkMin,
        max_check_size: checkMax,
        currency: "USD",
        portfolio_count: randomInt(0, 80),
        bio: randomFrom(BIOS),
        is_active: true,
        is_verified: Math.random() > 0.4,
        data_quality_score: randomInt(30, 95),
        fit_score: 0,
        outreach_readiness: "not_ready",
        current_firm_id: firmId,
        source: "generated",
        source_id: `inv_${i + j}`,
      });
    }

    // Batch insert investors
    const { data, error } = await supabase
      .from("investors")
      .insert(investors)
      .select("id");

    if (error) {
      // Fallback: half-batch
      if (investors.length > 1) {
        const mid = Math.floor(investors.length / 2);
        const left = investors.slice(0, mid);
        const right = investors.slice(mid);
        await supabase.from("investors").insert(left);
        await supabase.from("investors").insert(right);
        investorsInserted += investors.length;
      }
    } else if (data) {
      investorsInserted += data.length;

      // Generate employment history for ~60% of investors with firms
      const withFirms = investors.filter(inv => inv.current_firm_id && data[investors.indexOf(inv)]);
      if (withFirms.length > 0) {
        const employmentRecords = withFirms.map((inv, idx) => ({
          investor_id: data[investors.indexOf(inv)].id,
          firm_id: inv.current_firm_id,
          title: inv.job_title,
          start_date: `${randomInt(2010, 2024)}-${String(randomInt(1, 12)).padStart(2, "0")}-01`,
          is_current: true,
        }));

        const { error: empError } = await supabase
          .from("investor_employment_history")
          .insert(employmentRecords);

        if (!empError) employmentInserted += employmentRecords.length;
      }
    }

    // Progress
    if ((i + batchSize) % 5000 === 0 || i + batchSize >= TARGET_INVESTORS) {
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(0);
      const rate = Math.round(investorsInserted / (Date.now() - startTime) * 1000);
      const pct = ((investorsInserted / TARGET_INVESTORS) * 100).toFixed(1);
      console.log(
        `  📥 ${investorsInserted.toLocaleString()} / ${TARGET_INVESTORS.toLocaleString()} investors (${pct}%)` +
        ` — ${rate}/s — Employment: ${employmentInserted.toLocaleString()}`
      );
    }
  }

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

  // Final count
  const { count: totalCount } = await supabase
    .from("investors")
    .select("id", { count: "exact", head: true });

  const { count: firmCount } = await supabase
    .from("investor_firms")
    .select("id", { count: "exact", head: true });

  console.log(`\n✅ Dataset generation complete!`);
  console.log(`   Firms:       ${firmCount?.toLocaleString() || "unknown"}`);
  console.log(`   Investors:   ${totalCount?.toLocaleString() || "unknown"}`);
  console.log(`   Employment:  ${employmentInserted.toLocaleString()} records`);
  console.log(`   Time:        ${elapsed}s`);
  console.log(`   Rate:        ${Math.round(investorsInserted / (Date.now() - startTime) * 1000)}/s\n`);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
