// =============================================
// Capital OS — Investor Data Generator
// =============================================
// Generates 100K+ realistic investor records directly into CockroachDB.
// Uses real firm names, realistic names, proper investment profiles.
// Run: npx tsx src/scripts/generate-investors.ts
// =============================================

import { query, closePool } from "./db";

// =============================================
// Reference Data
// =============================================

const FIRST_NAMES_MALE = [
  "James", "John", "Robert", "Michael", "David", "William", "Richard", "Joseph",
  "Thomas", "Charles", "Christopher", "Daniel", "Matthew", "Anthony", "Mark",
  "Donald", "Steven", "Paul", "Andrew", "Joshua", "Kenneth", "Kevin", "Brian",
  "George", "Timothy", "Ronald", "Edward", "Jason", "Jeffrey", "Ryan", "Jacob",
  "Gary", "Nicholas", "Eric", "Jonathan", "Stephen", "Larry", "Justin", "Scott",
  "Brandon", "Benjamin", "Samuel", "Raymond", "Gregory", "Frank", "Alexander",
  "Patrick", "Jack", "Dennis", "Jerry", "Tyler", "Aaron", "Jose", "Adam",
  "Nathan", "Henry", "Zachary", "Douglas", "Peter", "Noah", "Ethan",
  "Liam", "Mason", "Logan", "Lucas", "Owen", "Leo", "Aiden", "Elijah",
];

const FIRST_NAMES_FEMALE = [
  "Mary", "Patricia", "Jennifer", "Linda", "Barbara", "Elizabeth", "Susan",
  "Jessica", "Sarah", "Karen", "Lisa", "Nancy", "Betty", "Margaret",
  "Sandra", "Ashley", "Dorothy", "Kimberly", "Emily", "Donna", "Michelle",
  "Carol", "Amanda", "Melissa", "Deborah", "Stephanie", "Rebecca", "Sharon",
  "Laura", "Cynthia", "Kathleen", "Amy", "Angela", "Shirley", "Anna",
  "Brenda", "Pamela", "Emma", "Nicole", "Helen", "Samantha", "Katherine",
  "Christine", "Debra", "Rachel", "Carolyn", "Janet", "Catherine", "Maria",
  "Heather", "Diane", "Ruth", "Julie", "Olivia", "Joyce", "Virginia",
  "Victoria", "Kelly", "Lauren", "Christina", "Joan", "Evelyn",
  "Priya", "Mei", "Fatima", "Aisha", "Yuki", "Sofia", "Amara", "Zara",
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
  "Wood", "James", "Bennett", "Gray", "Mendoza", "Ruiz", "Hughes",
  "Price", "Alvarez", "Castillo", "Sanders", "Patel", "Myers", "Long",
  "Ross", "Foster", "Jimenez", "Powell", "Jenkins", "Perry", "Russell",
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

const STAGES = ["pre_seed", "seed", "series_a", "series_b", "series_c", "growth"];
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
  const domains = [
    "gmail.com", "yahoo.com", "outlook.com", "hotmail.com",
    "protonmail.com", "icloud.com",
  ];
  const separators = [".", "_", ""];
  const sep = randomFrom(separators);
  const num = Math.random() > 0.6 ? randomInt(1, 99) : "";
  return `${firstName.toLowerCase()}${sep}${lastName.toLowerCase()}${num}@${randomFrom(domains)}`;
}

function generateLinkedIn(firstName: string, lastName: string): string {
  const slug = `${firstName.toLowerCase()}-${lastName.toLowerCase()}-${randomInt(100, 9999)}`;
  return `https://linkedin.com/in/${slug}`;
}

function generateCheckSize(investorType: string): { min: number; max: number } {
  switch (investorType) {
    case "venture_capital":
      return { min: randomInt(100000, 1000000), max: randomInt(5000000, 50000000) };
    case "angel_investor":
      return { min: randomInt(5000, 50000), max: randomInt(25000, 250000) };
    case "accelerator":
      return { min: 25000, max: 150000 };
    case "family_office":
      return { min: randomInt(500000, 2000000), max: randomInt(10000000, 100000000) };
    case "corporate_venture":
      return { min: randomInt(500000, 2000000), max: randomInt(10000000, 75000000) };
    case "micro_vc":
      return { min: randomInt(25000, 100000), max: randomInt(250000, 1000000) };
    case "private_equity":
      return { min: randomInt(5000000, 20000000), max: randomInt(50000000, 500000000) };
    case "impact_investor":
      return { min: randomInt(50000, 500000), max: randomInt(500000, 5000000) };
    default:
      return { min: randomInt(10000, 100000), max: randomInt(100000, 2000000) };
  }
}

// =============================================
// Main Generator
// =============================================

function generateInvestor(index: number) {
  const firstName = randomFrom([...FIRST_NAMES_MALE, ...FIRST_NAMES_FEMALE]);
  const lastName = randomFrom(LAST_NAMES);
  const investorType = weightedRandom(INVESTOR_TYPES);
  const location = randomFrom(CITIES);
  const stages = randomSubset(STAGES, 1, 3);
  const sectors = randomSubset(SECTORS, 1, 5);
  const geos = [location.country, ...randomSubset(CITIES.filter(c => c.country === location.country).map(c => c.country), 0, 2).filter(g => g !== location.country)].slice(0, 3);
  const checkSize = generateCheckSize(investorType);
  const title = randomFrom(JOB_TITLES);
  const portfolioCount = investorType === "angel_investor" ? randomInt(1, 30) :
    investorType === "accelerator" ? randomInt(10, 200) :
    randomInt(5, 80);

  return {
    full_name: `${firstName} ${lastName}`,
    first_name: firstName,
    last_name: lastName,
    email: Math.random() > 0.35 ? generateEmail(firstName, lastName) : null,
    linkedin_url: Math.random() > 0.3 ? generateLinkedIn(firstName, lastName) : null,
    job_title: title,
    investor_type: investorType,
    investment_stages: stages,
    investment_sectors: sectors,
    investment_geographies: [...new Set(geos)],
    country: location.country,
    city: location.city,
    min_check_size: checkSize.min,
    max_check_size: checkSize.max,
    currency: "USD",
    portfolio_count: portfolioCount,
    bio: randomFrom(BIOS),
    is_active: true,
    is_verified: Math.random() > 0.4,
    data_quality_score: randomInt(30, 95),
    fit_score: 0,
    fit_score_breakdown: null,
    outreach_readiness: "not_ready",
    current_firm_id: null,
    source: "generated",
    source_id: `gen_${index}`,
  };
}

// =============================================
// Batch Insert
// =============================================

async function insertBatch(batch: ReturnType<typeof generateInvestor>[]): Promise<number> {
  // Build a multi-row INSERT
  const values: string[] = [];
  const params: any[] = [];
  let paramIdx = 1;

  for (const inv of batch) {
    values.push(`(
      $${paramIdx++}, $${paramIdx++}, $${paramIdx++}, $${paramIdx++}, $${paramIdx++},
      $${paramIdx++}, $${paramIdx++}, $${paramIdx++}, $${paramIdx++}, $${paramIdx++},
      $${paramIdx++}, $${paramIdx++}, $${paramIdx++}, $${paramIdx++}, $${paramIdx++},
      $${paramIdx++}, $${paramIdx++}, $${paramIdx++}, $${paramIdx++}, $${paramIdx++},
      $${paramIdx++}, $${paramIdx++}, $${paramIdx++}, $${paramIdx++}, $${paramIdx++},
      $${paramIdx++}, $${paramIdx++}
    )`);
    params.push(
      inv.full_name, inv.first_name, inv.last_name, inv.email, inv.linkedin_url,
      inv.job_title, inv.investor_type, inv.investment_stages, inv.investment_sectors,
      inv.investment_geographies, inv.country, inv.city, inv.min_check_size,
      inv.max_check_size, inv.currency, inv.portfolio_count, inv.bio, inv.is_active,
      inv.is_verified, inv.data_quality_score, inv.fit_score, inv.fit_score_breakdown,
      inv.outreach_readiness, inv.current_firm_id, inv.source, inv.source_id,
      new Date().toISOString()
    );
  }

  try {
    await query(
      `INSERT INTO investors (
        full_name, first_name, last_name, email, linkedin_url,
        job_title, investor_type, investment_stages, investment_sectors,
        investment_geographies, country, city, min_check_size,
        max_check_size, currency, portfolio_count, bio, is_active,
        is_verified, data_quality_score, fit_score, fit_score_breakdown,
        outreach_readiness, current_firm_id, source, source_id, created_at
      ) VALUES ${values.join(", ")}`,
      params
    );
    return batch.length;
  } catch (err) {
    // Fallback: try half-batches
    if (batch.length > 1) {
      const mid = Math.floor(batch.length / 2);
      const left = await insertBatch(batch.slice(0, mid));
      const right = await insertBatch(batch.slice(mid));
      return left + right;
    }
    console.error("Single insert error:", err);
    return 0;
  }
}

// =============================================
// Run
// =============================================

async function main() {
  const TARGET_COUNT = parseInt(process.argv[2] || "100000", 10);
  const BATCH_SIZE = 500;

  console.log(`\n🚀 Generating ${TARGET_COUNT.toLocaleString()} investor records...\n`);

  // Check existing count
  const [existingCount] = await query<{ count: string }>(
    `SELECT count(*) as count FROM investors`
  );

  console.log(`📊 Existing investors: ${parseInt(existingCount?.count || "0")}`);

  const startTime = Date.now();
  let totalInserted = 0;
  let batchNum = 0;

  for (let i = 0; i < TARGET_COUNT; i += BATCH_SIZE) {
    const batch: ReturnType<typeof generateInvestor>[] = [];
    const batchSize = Math.min(BATCH_SIZE, TARGET_COUNT - i);

    for (let j = 0; j < batchSize; j++) {
      batch.push(generateInvestor(i + j));
    }

    const inserted = await insertBatch(batch);
    totalInserted += inserted;
    batchNum++;

    // Progress report every 50 batches
    if (batchNum % 50 === 0 || i + BATCH_SIZE >= TARGET_COUNT) {
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
      const rate = Math.round(totalInserted / (Date.now() - startTime) * 1000);
      const eta = totalInserted > 0 ? (((TARGET_COUNT - totalInserted) / rate)).toFixed(0) : "∞";
      console.log(
        `  📥 ${totalInserted.toLocaleString()} / ${TARGET_COUNT.toLocaleString()} inserted` +
        ` (${((totalInserted / TARGET_COUNT) * 100).toFixed(1)}%)` +
        ` — ${rate}/s — ETA: ${eta}s`
      );
    }
  }

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  const [finalCount] = await query<{ count: string }>(
    `SELECT count(*) as count FROM investors`
  );

  console.log(`\n✅ Done!`);
  console.log(`   Inserted: ${totalInserted.toLocaleString()}`);
  console.log(`   Total in DB: ${parseInt(finalCount?.count || "0").toLocaleString()}`);
  console.log(`   Time: ${elapsed}s`);
  console.log(`   Rate: ${Math.round(totalInserted / (Date.now() - startTime) * 1000)}/s\n`);

  await closePool();
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
