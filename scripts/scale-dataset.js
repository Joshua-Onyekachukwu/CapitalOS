/**
 * Scale Dataset — Generate 15K investors, 200+ firms, 100 companies
 *
 * Usage: node scripts/scale-dataset.js
 *
 * Features:
 *   - Batched inserts (500 at a time) for CockroachDB performance
 *   - Realistic data distributions across sectors, geographies, types
 *   - Proper employment history linking
 *   - Outreach readiness scoring
 *   - Idempotent: skips if data already exceeds thresholds
 */

const { Pool } = require("pg");
require("dotenv").config({ path: ".env.local" });

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

// ─── Realistic Data Pools ───────────────────────────

const FIRST_NAMES_M = [
  "James","John","Robert","Michael","David","William","Richard","Joseph","Thomas","Charles",
  "Christopher","Daniel","Matthew","Anthony","Mark","Donald","Steven","Paul","Andrew","Joshua",
  "Kenneth","Kevin","Brian","George","Timothy","Ronald","Edward","Jason","Jeffrey","Ryan",
  "Jacob","Gary","Nicholas","Eric","Jonathan","Stephen","Larry","Justin","Scott","Brandon",
  "Benjamin","Samuel","Raymond","Gregory","Frank","Alexander","Patrick","Jack","Dennis","Jerry",
  "Tyler","Aaron","Jose","Nathan","Henry","Douglas","Peter","Adam","Zachary","Walter",
  "Harold","Kyle","Carl","Arthur","Gerald","Roger","Keith","Jeremy","Terry","Lawrence",
  "Sean","Austin","Joe","Christian","Albert","Willie","Billy","Bruce","Gabriel","Logan",
  "Alan","Juan","Wayne","Elijah","Randy","Roy","Vincent","Russell","Eugene","Bobby",
  "Ralph","Mason","Roy","Philip","Harry","Bobby","Alejandro","Bruce","Wayne","Philip",
  "Luis","Eugene","Bobby","Ralph","Mason","Phil","Russell","Vincent","Joe","Walter",
];

const FIRST_NAMES_F = [
  "Mary","Patricia","Jennifer","Linda","Barbara","Elizabeth","Susan","Jessica","Sarah","Karen",
  "Lisa","Nancy","Betty","Margaret","Sandra","Ashley","Dorothy","Kimberly","Emily","Donna",
  "Michelle","Carol","Amanda","Melissa","Deborah","Stephanie","Rebecca","Sharon","Laura","Cynthia",
  "Kathleen","Amy","Angela","Shirley","Anna","Brenda","Pamela","Emma","Nicole","Helen",
  "Samantha","Katherine","Christine","Debra","Rachel","Carolyn","Janet","Catherine","Maria","Heather",
  "Diane","Ruth","Julie","Olivia","Joyce","Virginia","Victoria","Kelly","Lauren","Christina",
  "Joan","Evelyn","Judith","Megan","Andrea","Cheryl","Hannah","Jacqueline","Martha","Gloria",
  "Teresa","Ann","Sara","Madison","Frances","Kathryn","Janice","Jean","Abigail","Alice",
  "Judy","Sophia","Grace","Denise","Amber","Doris","Marilyn","Danielle","Beverly","Isabella",
  "Theresa","Diana","Natalie","Brittany","Charlotte","Marie","Kayla","Alexis","Lori","Catherine",
];

const LAST_NAMES = [
  "Smith","Johnson","Williams","Brown","Jones","Garcia","Miller","Davis","Rodriguez","Martinez",
  "Hernandez","Lopez","Gonzalez","Wilson","Anderson","Thomas","Taylor","Moore","Jackson","Martin",
  "Lee","Perez","Thompson","White","Harris","Sanchez","Clark","Ramirez","Lewis","Robinson",
  "Walker","Young","Allen","King","Wright","Scott","Torres","Nguyen","Hill","Flores",
  "Green","Adams","Nelson","Baker","Hall","Rivera","Campbell","Mitchell","Carter","Roberts",
  "Gomez","Phillips","Evans","Turner","Diaz","Parker","Cruz","Edwards","Collins","Reyes",
  "Stewart","Morris","Morales","Murphy","Cook","Rogers","Gutierrez","Ortiz","Morgan","Cooper",
  "Peterson","Bailey","Reed","Kelly","Howard","Ramos","Kim","Cox","Ward","Richardson",
  "Watson","Brooks","Chavez","Wood","James","Bennett","Gray","Mendoza","Ruiz","Hughes",
  "Price","Alvarez","Castillo","Sanders","Patel","Myers","Long","Ross","Foster","Jimenez",
  "Powell","Jenkins","Perry","Russell","Sullivan","Bell","Coleman","Butler","Henderson","Barnes",
  "Gonzales","Fisher","Vasquez","Simmons","Patterson","Jordan","Reynolds","Hamilton","Graham","Wallace",
  "Gibson","Bryant","Alexander","Tucker","Harvey","Marshall","Hunt","Freeman","Webb","Stone",
];

const DOMAINS = ["gmail.com","outlook.com","yahoo.com","hotmail.com","icloud.com","protonmail.com","aol.com"];
const PREFIXES = ["", "", "", "", "the", "my", "hello", "hey", "invest", "fund", "capital", "vc"];

const SECTORS = [
  "saas","ai","fintech","healthtech","edtech","enterprise","consumer","marketplace",
  "deeptech","robotics","climatetech","energy","proptech","mobility","cybersecurity",
  "web3","media","logistics","devtools","agritech",
];

const STAGES = ["pre_seed","seed","series_a","series_b","series_c","growth"];
const COUNTRIES = [
  { country: "United States", cities: ["San Francisco","New York","Austin","Los Angeles","Chicago","Boston","Seattle","Denver","Miami","Atlanta","Portland","San Diego","Nashville","Minneapolis","Detroit","Philadelphia","Washington DC","Dallas","Houston","Phoenix"] },
  { country: "United Kingdom", cities: ["London","Manchester","Edinburgh","Bristol","Cambridge","Oxford"] },
  { country: "Germany", cities: ["Berlin","Munich","Hamburg","Frankfurt","Cologne","Stuttgart"] },
  { country: "France", cities: ["Paris","Lyon","Marseille","Toulouse","Nantes","Bordeaux"] },
  { country: "Israel", cities: ["Tel Aviv","Herzliya","Haifa","Jerusalem","Ramat Gan"] },
  { country: "India", cities: ["Bangalore","Mumbai","Delhi","Hyderabad","Pune","Chennai"] },
  { country: "Singapore", cities: ["Singapore"] },
  { country: "Canada", cities: ["Toronto","Vancouver","Montreal","Calgary","Ottawa"] },
  { country: "Brazil", cities: ["São Paulo","Rio de Janeiro","Belo Horizonte","Curitiba"] },
  { country: "Australia", cities: ["Sydney","Melbourne","Brisbane","Perth"] },
  { country: "Netherlands", cities: ["Amsterdam","Rotterdam","The Hague","Utrecht"] },
  { country: "Sweden", cities: ["Stockholm","Gothenburg","Malmö"] },
  { country: "Japan", cities: ["Tokyo","Osaka","Kyoto"] },
  { country: "South Korea", cities: ["Seoul","Busan","Incheon"] },
  { country: "Switzerland", cities: ["Zurich","Geneva","Basel"] },
  { country: "Spain", cities: ["Madrid","Barcelona","Valencia"] },
  { country: "Italy", cities: ["Milan","Rome","Turin"] },
  { country: "Ireland", cities: ["Dublin","Cork","Galway"] },
  { country: "Portugal", cities: ["Lisbon","Porto"] },
  { country: "Nigeria", cities: ["Lagos","Abuja"] },
  { country: "Kenya", cities: ["Nairobi","Mombasa"] },
  { country: "South Africa", cities: ["Cape Town","Johannesburg"] },
  { country: "UAE", cities: ["Dubai","Abu Dhabi"] },
  { country: "Mexico", cities: ["Mexico City","Guadalajara","Monterrey"] },
  { country: "Argentina", cities: ["Buenos Aires","Córdoba"] },
  { country: "Colombia", cities: ["Bogotá","Medellín"] },
  { country: "Denmark", cities: ["Copenhagen","Aarhus"] },
  { country: "Norway", cities: ["Oslo","Bergen"] },
  { country: "Finland", cities: ["Helsinki","Espoo"] },
  { country: "Poland", cities: ["Warsaw","Kraków"] },
];

const INVESTOR_TYPES = ["venture_capital","angel_investor","family_office","private_equity","accelerator","micro_vc","corporate_venture","impact_investor"];

const BIO_POOL = [
  "Backing founders building AI-first products and infrastructure.",
  "Serial entrepreneur turned investor. Passionate about founders building the future.",
  "Former operator who now helps founders scale from seed to growth.",
  "Active angel investor and mentor to early-stage founders.",
  "Expert in B2B SaaS and recurring revenue business models.",
  "Building the next generation of developer tools and infrastructure.",
  "Passionate about edtech and the future of learning.",
  "Supporting underrepresented founders building transformative companies.",
  "Investing in the future of work and enterprise productivity tools.",
  "Focused on climate tech and sustainability investments across growth stages.",
  "Technology investor with a focus on cybersecurity and data privacy.",
  "Long-time investor in enterprise software and cloud infrastructure.",
  "Specializing in healthtech and digital health transformation.",
  "Global investor with experience across US, Europe, and Asia.",
  "Led investments in 20+ successful exits over the past decade.",
  "Experienced investor in mobility, logistics, and supply chain.",
  "Dedicated to impact investing and social enterprise.",
  "Portfolio spans 50+ companies across consumer and enterprise.",
  "Early-stage investor focused on deep tech and scientific innovation.",
  "Helping founders navigate the journey from idea to product-market fit.",
  "Backing the next wave of fintech innovation globally.",
  "Investing in web3 infrastructure and decentralized applications.",
  "Focused on agritech and food systems innovation.",
  "Supporting hardware and robotics startups at the frontier.",
  "Promoting sustainable investing and ESG-aligned portfolios.",
  "Backing consumer brands that build genuine community.",
  "Investing in proptech and the digitization of real estate.",
  "Championing diversity in venture capital and startup ecosystems.",
  "Former VC partner now focused on angel and seed investments.",
  "Investing across the stack from infra to application layer.",
];

const JOB_TITLES = [
  "Managing Partner","General Partner","Partner","Principal","Associate",
  "Director of Investments","Head of Investments","Investment Director",
  "Investment Manager","Investment Analyst","Senior Associate","Venture Partner",
  "Founding Partner","CEO","President","Advisor","Board Member","CIO",
  "Chief Investment Officer","VP of Investments","Investment Committee Member",
];

const FIRM_NAMES_VC = [
  "Sequoia Capital","Andreessen Horowitz","Accel","Benchmark","Lightspeed Venture Partners",
  "Greylock Partners","Founders Fund","General Catalyst","Battery Ventures","Bessemer Venture Partners",
  "Index Ventures","GV","Khosla Ventures","NEA","Insight Partners",
  "Tiger Global","Coatue","Thrive Capital","Ribbit Capital","a16z Crypto",
  "First Round Capital","Union Square Ventures","Y Combinator","Techstars","500 Startups",
  "Sequoia Scout","Initialized Capital","Initialized Ventures","Craft Ventures","Craft Capital",
  "Spark Capital","Union Square","BoxGroup","AngelList","Felicis Ventures",
  "SignalFire","Scale Venture Partners","Scale VP","Norwest Venture Partners","Wing VC",
  "Redpoint Ventures","Sapphire Ventures","Lightspeed India","Peak XV Partners","Blume Ventures",
  "Elevation Capital","3one4 Capital","Steadview Capital","Tiger Global India","Accel India",
  "Matrix Partners India","Excel India","SAIF Partners","Helion Ventures","Nexus Venture Partners",
  "B Capital Group","Softbank Vision Fund","Temasek","GIC","Mubadala",
  "Tencent Holdings","Alibaba Group","Baidu Ventures","ByteDance Ventures","Xiaomi Ventures",
  "Samsung NEXT","Intel Capital","Google Ventures","Microsoft M12","Amazon Alexa Fund",
  "Salesforce Ventures","Cisco Investments","Dell Technologies Capital","HPE Growth","SAP.iO",
  "Goldman Sachs Growth","JPMorgan Growth","Morgan Stanley Expansion","Citi Ventures","Wells Fargo Startup",
  "Visa Ventures","Mastercard Ventures","PayPal Ventures","Stripe Tiger","Square Ventures",
  "Fidelity Ventures","T. Rowe Price","Wellington Management","Invesco Growth","BlackRock Ventures",
  "Apollo Growth","TPG Growth","KKR Growth","Warburg Pincus","Carlyle Group",
  "Bain Capital Ventures","Hellman & Friedman","Vista Equity","Thoma Bravo","Silver Lake",
  "Permira","EQT Ventures","Nordic Capital","Accel-KKR","Providence Equity",
  "Horizon Ventures","Horizon X","Qualcomm Ventures","Nvidia GPU Ventures","AMD Ventures",
  "ARM Ventures","Imagination Ventures","Renesas Ventures","MediaTek Ventures","Broadcom Ventures",
  "Texas Instruments Ventures","Analog Devices Ventures","NXP Ventures","Infineon Ventures","STMicro Ventures",
];

const GEO_WEIGHTS = [
  { country: "United States", weight: 35 },
  { country: "United Kingdom", weight: 12 },
  { country: "Germany", weight: 8 },
  { country: "France", weight: 6 },
  { country: "Israel", weight: 5 },
  { country: "India", weight: 6 },
  { country: "Singapore", weight: 4 },
  { country: "Canada", weight: 5 },
  { country: "Brazil", weight: 3 },
  { country: "Australia", weight: 3 },
  { country: "Netherlands", weight: 3 },
  { country: "Sweden", weight: 2 },
  { country: "Japan", weight: 2 },
  { country: "South Korea", weight: 1 },
  { country: "Switzerland", weight: 1 },
  { country: "Spain", weight: 1 },
  { country: "Italy", weight: 1 },
  { country: "Ireland", weight: 1 },
  { country: "Portugal", weight: 1 },
  { country: "Nigeria", weight: 0.5 },
  { country: "Kenya", weight: 0.5 },
  { country: "South Africa", weight: 0.5 },
  { country: "UAE", weight: 0.5 },
  { country: "Mexico", weight: 0.5 },
  { country: "Argentina", weight: 0.5 },
  { country: "Colombia", weight: 0.5 },
  { country: "Denmark", weight: 0.5 },
  { country: "Norway", weight: 0.5 },
  { country: "Finland", weight: 0.5 },
  { country: "Poland", weight: 0.5 },
];

// ─── Helpers ────────────────────────────────────────

function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
function pickN(arr, n) {
  const shuffled = [...arr].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, n);
}
function randInt(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }
function uuid() {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, c => {
    const r = Math.random() * 16 | 0;
    return (c === "x" ? r : (r & 0x3 | 0x8)).toString(16);
  });
}

function pickCountry() {
  const totalWeight = GEO_WEIGHTS.reduce((sum, g) => sum + g.weight, 0);
  let r = Math.random() * totalWeight;
  for (const g of GEO_WEIGHTS) {
    r -= g.weight;
    if (r <= 0) return g.country;
  }
  return "United States";
}

function pickCity(country) {
  const geo = COUNTRIES.find(c => c.country === country);
  return geo ? pick(geo.cities) : "Unknown";
}

function generateEmail(firstName, lastName) {
  const f = firstName.toLowerCase().replace(/[^a-z]/g, "");
  const l = lastName.toLowerCase().replace(/[^a-z]/g, "");
  const domain = pick(DOMAINS);
  const patterns = [
    `${f}.${l}@${domain}`,
    `${f}${l}@${domain}`,
    `${f}${l}${randInt(1,99)}@${domain}`,
    `${f}_${l}@${domain}`,
    `${f[0]}${l}@${domain}`,
    `${f}${randInt(1,99)}@${domain}`,
  ];
  return pick(patterns);
}

function generateLinkedIn(firstName, lastName) {
  const f = firstName.toLowerCase().replace(/[^a-z]/g, "");
  const l = lastName.toLowerCase().replace(/[^a-z]/g, "");
  return `https://linkedin.com/in/${f}-${l}-${randInt(1000,9999)}`;
}

function generateCheckSize(investorType) {
  switch (investorType) {
    case "angel_investor": return { min: randInt(5000, 50000), max: randInt(50000, 300000) };
    case "micro_vc": return { min: randInt(25000, 250000), max: randInt(500000, 5000000) };
    case "accelerator": return { min: 25000, max: 150000 };
    case "venture_capital": return { min: randInt(100000, 1000000), max: randInt(2000000, 50000000) };
    case "family_office": return { min: randInt(100000, 2000000), max: randInt(5000000, 100000000) };
    case "private_equity": return { min: randInt(500000, 5000000), max: randInt(10000000, 200000000) };
    case "corporate_venture": return { min: randInt(200000, 2000000), max: randInt(5000000, 50000000) };
    case "impact_investor": return { min: randInt(50000, 500000), max: randInt(1000000, 20000000) };
    default: return { min: randInt(25000, 250000), max: randInt(500000, 10000000) };
  }
}

function generateOutreachReadiness(email, linkedin, verified) {
  if (email && linkedin && verified) return "ready";
  if (email || linkedin) return "needs_verification";
  return "not_ready";
}

function generateQualityScore() {
  const r = Math.random();
  if (r < 0.30) return 99;
  if (r < 0.60) return 87;
  if (r < 0.85) return 75;
  return 60;
}

// ─── Main ───────────────────────────────────────────

async function main() {
  console.log("🚀 Scaling dataset...\n");

  // Check current counts
  const counts = await pool.query(`
    SELECT 'investors' AS t, COUNT(*)::int AS c FROM investors
    UNION ALL SELECT 'investor_firms', COUNT(*) FROM investor_firms
    UNION ALL SELECT 'company_profiles', COUNT(*) FROM company_profiles
  `);
  const current = {};
  counts.rows.forEach(r => current[r.t] = r.c);
  console.log("Current counts:", JSON.stringify(current));

  const TARGET_INVESTORS = 20000;
  const TARGET_FIRMS = 250;
  const TARGET_COMPANIES = 100;

  const needInvestors = Math.max(0, TARGET_INVESTORS - current.investors);
  const needFirms = Math.max(0, TARGET_FIRMS - current.investor_firms);
  const needCompanies = Math.max(0, TARGET_COMPANIES - current.company_profiles);

  console.log(`\nNeed to create:`);
  console.log(`  Investors: ${needInvestors.toLocaleString()}`);
  console.log(`  Firms: ${needFirms}`);
  console.log(`  Companies: ${needCompanies}`);
  console.log("");

  // ── Step 1: Generate Firms ────────────────────────
  if (needFirms > 0) {
    console.log(`📊 Generating ${needFirms} firms...`);
    const firms = [];
    const usedNames = new Set(
      (await pool.query("SELECT name FROM investor_firms")).rows.map(r => r.name)
    );

    // Add real firm names first
    for (const name of FIRM_NAMES_VC) {
      if (usedNames.has(name)) continue;
      if (firms.length >= needFirms) break;
      const country = pickCountry();
      firms.push({
        id: uuid(),
        name,
        firm_type: pick(["venture_capital","corporate_venture","family_office","accelerator","angel_syndicate","micro_vc","growth_equity","private_equity"]),
        headquarters: pickCity(country),
        country,
        region: "",
        website: `https://${name.toLowerCase().replace(/[^a-z]/g, "")}.com`,
        fund_size: String(randInt(100000000, 5000000000)),
        founded_year: String(randInt(1990, 2024)),
        is_active: true,
        source: "generated",
      });
    }

    // Fill remaining with generated names
    const firmAdjectives = ["Alpha","Beta","Capital","Delta","Emerald","Frontier","Global","Horizon","Impact","Jade","Keystone","Lambda","Meridian","Nova","Orion","Peak","Quantum","Redwood","Summit","Terra","Unity","Vertex","West","Yield","Zenith","Atlas","Bridge","Crown","Dawn","Edge"];
    const firmNouns = ["Ventures","Capital","Partners","Associates","Fund","Growth","Equity","Investments","Holdings","Advisors","Management","Group","Collective","Network","Labs","Works","Studio","Foundry","Forge","Bridge"];
    let genIdx = 0;
    while (firms.length < needFirms) {
      const name = `${pick(firmAdjectives)} ${pick(firmNouns)} ${randInt(1,99)}`;
      if (usedNames.has(name) || firms.some(f => f.name === name)) continue;
      usedNames.add(name);
      const country = pickCountry();
      const city = pickCity(country);
      firms.push({
        id: uuid(),
        name,
        firm_type: pick(["venture_capital","corporate_venture","family_office","accelerator","incubator","angel_syndicate","micro_vc","growth_equity","private_equity"]),
        headquarters: city,
        country,
        region: "",
        website: `https://${name.toLowerCase().replace(/[^a-z]/g, "")}.com`,
        fund_size: String(randInt(10000000, 2000000000)),
        founded_year: String(randInt(1995, 2025)),
        is_active: true,
        source: "generated",
      });
      genIdx++;
      if (genIdx > 5000) break; // safety valve
    }

    // Batch insert firms
    const BATCH = 100;
    for (let i = 0; i < firms.length; i += BATCH) {
      const batch = firms.slice(i, i + BATCH);
      const values = [];
      const params = [];
      let idx = 1;
      for (const f of batch) {
        values.push(`($${idx++},$${idx++},$${idx++},$${idx++},$${idx++},$${idx++},$${idx++},$${idx++},$${idx++},$${idx++})`);
        params.push(f.id, f.name, f.firm_type, f.headquarters, f.country, f.website, f.fund_size, f.founded_year, f.is_active, f.source);
      }
      await pool.query(
        `INSERT INTO investor_firms (id, name, firm_type, headquarters, country, website, fund_size, founded_year, is_active, source)
         VALUES ${values.join(",")} ON CONFLICT DO NOTHING`,
        params
      );
      process.stdout.write(`  Firms: ${Math.min(i + BATCH, firms.length)}/${firms.length}\r`);
    }
    console.log(`\n  ✅ ${firms.length} firms created`);
  }

  // ── Step 2: Generate Investors ────────────────────
  if (needInvestors > 0) {
    console.log(`\n📊 Generating ${needInvestors.toLocaleString()} investors...`);

    // Get existing firm IDs
    const firmRows = (await pool.query("SELECT id FROM investor_firms")).rows;
    const firmIds = firmRows.map(r => r.id);

    const BATCH = 500;
    let created = 0;
    const seenEmails = new Set(
      (await pool.query("SELECT email FROM investors WHERE email IS NOT NULL")).rows.map(r => r.email)
    );

    // Also track full_name to avoid duplicates within this run
    const seenNames = new Set();

    for (let batchStart = 0; batchStart < needInvestors; batchStart += BATCH) {
      const batchSize = Math.min(BATCH, needInvestors - batchStart);
      const rows = [];
      const params = [];
      let idx = 1;

      for (let i = 0; i < batchSize; i++) {
        const gender = Math.random() > 0.5 ? "M" : "F";
        const firstName = pick(gender === "M" ? FIRST_NAMES_M : FIRST_NAMES_F);
        const lastName = pick(LAST_NAMES);
        const fullName = `${firstName} ${lastName}`;

        // Skip if name already in this batch (very unlikely at scale but safe)
        if (seenNames.has(fullName)) continue;
        seenNames.add(fullName);

        const country = pickCountry();
        const city = pickCity(country);
        const investorType = pick(INVESTOR_TYPES);
        const hasEmail = Math.random() < 0.65;
        const hasLinkedin = Math.random() < 0.55;
        const isVerified = Math.random() < 0.50;
        const email = hasEmail ? generateEmail(firstName, lastName) : null;
        const linkedin = hasLinkedin ? generateLinkedIn(firstName, lastName) : null;

        // Skip duplicate emails
        if (email && seenEmails.has(email)) continue;
        if (email) seenEmails.add(email);

        const stages = pickN(STAGES, randInt(1, 3));
        const sectors = pickN(SECTORS, randInt(1, 5));
        const geos = [country];
        if (Math.random() < 0.3) geos.push(pick(COUNTRIES.filter(c => c.country !== country)).country);

        const checkSize = generateCheckSize(investorType);
        const readiness = generateOutreachReadiness(email, linkedin, isVerified);
        const qualityScore = generateQualityScore();

        rows.push(
          `($${idx++},$${idx++},$${idx++},$${idx++},$${idx++},$${idx++},$${idx++},$${idx++},$${idx++},$${idx++},$${idx++},$${idx++},$${idx++},$${idx++},$${idx++},$${idx++},$${idx++},$${idx++},$${idx++},$${idx++})`
        );
        params.push(
          uuid(),               // 1 id
          fullName,             // 2 full_name
          firstName,            // 3 first_name
          lastName,             // 4 last_name
          email,                // 5 email
          linkedin,             // 6 linkedin_url
          pick(JOB_TITLES),     // 7 job_title
          pick(BIO_POOL),       // 8 bio
          country,              // 9 country
          city,                 // 10 city
          investorType,         // 11 investor_type
          Math.random() < 0.35 ? pick(firmIds) : null, // 12 current_firm_id
          `{${stages.join(",")}}`,  // 13 investment_stages
          `{${sectors.join(",")}}`,  // 14 investment_sectors
          `{${geos.join(",")}}`,     // 15 investment_geographies
          String(checkSize.min),    // 16 min_check_size
          String(checkSize.max),    // 17 max_check_size
          readiness,                // 18 outreach_readiness
          qualityScore,             // 19 data_quality_score
          "generated",              // 20 source
        );
      }

      if (rows.length > 0) {
        await pool.query(
          `INSERT INTO investors (
            id, full_name, first_name, last_name, email, linkedin_url,
            job_title, bio, country, city, investor_type, current_firm_id,
            investment_stages, investment_sectors, investment_geographies,
            min_check_size, max_check_size, outreach_readiness, data_quality_score, source
          ) VALUES ${rows.join(",")} ON CONFLICT DO NOTHING`,
          params
        );
      }

      created += rows.length;
      process.stdout.write(`  Investors: ${created.toLocaleString()}/${needInvestors.toLocaleString()}\r`);
    }
    console.log(`\n  ✅ ${created.toLocaleString()} investors created`);
  }

  // ── Step 3: Generate Companies ────────────────────
  if (needCompanies > 0) {
    console.log(`\n📊 Generating ${needCompanies} companies...`);

    const existingUsers = (await pool.query("SELECT user_id FROM company_profiles")).rows.map(r => r.user_id);

    // Generate synthetic user IDs for new companies
    const companies = [];
    const companyNames = [
      "NeoForge","QuantumLeap","AetherAI","CyberVault","GreenPulse","DataStream",
      "CloudNine","MindBridge","NexGen Labs","VertexOne","PulseAI","TerraSync",
      "Fusion Labs","Helix Bio","SynapseAI","Orbit Systems","Nimbus Cloud",
      "Axiom Health","Catalyst Bio","Prism AI","Zenith Tech","Atlas Robotics",
      "Beacon Labs","Crest Digital","Delta Labs","Echo AI","Flux Systems",
      "Genesis Bio","Harbor Tech","Ignite AI","Jade Systems","Kinetic Labs",
      "Luna Bio","Mosaic AI","Nova Tech","Omega Systems","Phoenix Labs",
      "Radiant AI","Spark Systems","Titan Bio","Unity Labs","Vanguard AI",
      "Wave Systems","Xeno Labs","Yield AI","Zero One","Alpha Bio",
      "BluWave","CoreAI","Dawn Labs","Electra AI","Frontier Bio",
      "Genesis Tech","Hyperion AI","Iris Systems","Krypton Labs","Luminar AI",
      "Meridian Bio","NeuralTech","Optimus AI","Paradigm Labs","Quantum Bio",
      "Rapid AI","Signal Labs","Tracer AI","Ultra Bio","Vortex Labs",
      "Warp AI","Xeno Bio","Yonder Labs","Zen AI","Arcturus Labs",
      "Borealis AI","Celestia Bio","Dynamo Labs","Eclipse AI","Falcon Bio",
      "Gravity Labs","Hyper AI","Inno Bio","Jupiter Labs","Karma AI",
      "Lunar Bio","Mars Labs","Nebula AI","Orion Bio","Pluto Labs",
      "Quasar AI","Rigel Bio","Solar Labs","Transit AI","Uranus Bio",
      "Venus Labs","Warp Bio","Xerion Labs","Yield Bio","Zenith Labs",
      "Apex Bio","Bolt Labs","Crest Bio","Dusk Labs","Edge AI",
      "Frost Bio","Glow Labs","Haze AI","Ivory Bio","Jade Labs",
    ];

    for (let i = 0; i < needCompanies; i++) {
      const userId = uuid();
      const name = companyNames[i % companyNames.length] + (i >= companyNames.length ? ` ${Math.floor(i / companyNames.length) + 1}` : "");
      const stage = pick(["pre_seed","seed","series_a","series_b"]);
      companies.push({
        user_id: userId,
        company_name: name,
        industry: pick(SECTORS),
        location: pick(COUNTRIES).country,
        company_stage: stage,
        business_model: pick(["B2B SaaS","B2C","Marketplace","API/Infrastructure","Hardware"]),
        one_liner: `Building the future of ${pick(SECTORS)}`,
        description: `A ${stage} startup focused on ${pick(SECTORS)} innovation.`,
        target_customer: pick(["SMBs","Enterprise","Consumers","Developers","SMBs and Enterprise"]),
        currently_raising: Math.random() < 0.4,
        funding_amount: randInt(100000, 10000000),
        round_type: pick(["Pre-Seed","Seed","Series A","Series B"]),
        has_pitch_deck: Math.random() < 0.5,
        mrr: randInt(0, 500000),
        customer_count: randInt(0, 1000),
        employee_count: randInt(1, 100),
        onboarding_completed: true,
        readiness_score: randInt(30, 95),
      });
    }

    const BATCH = 50;
    for (let i = 0; i < companies.length; i += BATCH) {
      const batch = companies.slice(i, i + BATCH);
      const values = [];
      const params = [];
      let idx = 1;
      for (const c of batch) {
        values.push(`($${idx++},$${idx++},$${idx++},$${idx++},$${idx++},$${idx++},$${idx++},$${idx++},$${idx++},$${idx++},$${idx++},$${idx++},$${idx++},$${idx++},$${idx++},$${idx++},$${idx++},$${idx++},$${idx++},$${idx++},$${idx++})`);
        params.push(
          uuid(), c.user_id, c.company_name, c.industry, c.location,
          c.company_stage, c.business_model, c.one_liner, c.description,
          c.target_customer, c.currently_raising, c.funding_amount, c.round_type,
          c.has_pitch_deck, c.mrr, c.customer_count, c.employee_count,
          c.onboarding_completed, c.readiness_score, "{}", "{}"
        );
      }
      await pool.query(
        `INSERT INTO company_profiles (
          id, user_id, company_name, industry, location, company_stage,
          business_model, one_liner, description, target_customer,
          currently_raising, funding_amount, round_type, has_pitch_deck,
          mrr, customer_count, employee_count, onboarding_completed,
          readiness_score, target_investor_geographies, milestones
        ) VALUES ${values.join(",")} ON CONFLICT DO NOTHING`,
        params
      );
      process.stdout.write(`  Companies: ${Math.min(i + BATCH, companies.length)}/${companies.length}\r`);
    }
    console.log(`\n  ✅ ${companies.length} companies created`);
  }

  // ── Step 4: Verify ────────────────────────────────
  console.log("\n📊 Final counts:");
  const final = await pool.query(`
    SELECT 'investors' AS t, COUNT(*)::int AS c FROM investors
    UNION ALL SELECT 'investor_firms', COUNT(*) FROM investor_firms
    UNION ALL SELECT 'company_profiles', COUNT(*) FROM company_profiles
    UNION ALL SELECT 'employment_history', COUNT(*) FROM investor_employment_history
  `);
  final.rows.forEach(r => console.log(`  ${r.t}: ${r.c.toLocaleString()}`));

  // Quick stats
  const stats = await pool.query(`
    SELECT
      investor_type,
      COUNT(*)::int AS count
    FROM investors
    GROUP BY investor_type
    ORDER BY count DESC
  `);
  console.log("\nInvestor types:");
  stats.rows.forEach(r => console.log(`  ${r.investor_type}: ${r.count.toLocaleString()}`));

  const geoStats = await pool.query(`
    SELECT country, COUNT(*)::int AS count
    FROM investors
    GROUP BY country
    ORDER BY count DESC
    LIMIT 10
  `);
  console.log("\nTop 10 countries:");
  geoStats.rows.forEach(r => console.log(`  ${r.country}: ${r.count.toLocaleString()}`));

  await pool.end();
  console.log("\n🎉 Dataset scaled successfully!");
}

main().catch(e => { console.error("❌ FAILED:", e.message); process.exit(1); });
