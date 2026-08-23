// =============================================
// Capital OS — Large Test CSV Generator
// =============================================
// Generates 500+ diverse investor records for stress-testing.
// Run: npx tsx src/scripts/generate-test-csv.ts [count]
// Default: 500
// =============================================

import { writeFileSync } from "fs";
import { join } from "path";

const COUNT = parseInt(process.argv[2] || "500", 10);

// =============================================
// Reference Data
// =============================================

const FIRST_NAMES_MALE = [
  "James","John","Robert","Michael","David","William","Richard","Joseph",
  "Thomas","Charles","Daniel","Matthew","Anthony","Mark","Steven","Paul",
  "Andrew","Joshua","Kevin","Brian","George","Timothy","Jason","Jeffrey",
  "Ryan","Gary","Eric","Scott","Brandon","Benjamin","Samuel","Alexander",
  "Patrick","Henry","Noah","Ethan","Liam","Mason","Leo","Aiden",
];

const FIRST_NAMES_FEMALE = [
  "Mary","Patricia","Jennifer","Linda","Barbara","Elizabeth","Susan",
  "Jessica","Sarah","Karen","Lisa","Nancy","Ashley","Emily","Michelle",
  "Stephanie","Rebecca","Laura","Cynthia","Kathleen","Angela","Anna",
  "Emma","Nicole","Samantha","Katherine","Rachel","Maria","Olivia",
  "Priya","Mei","Fatima","Aisha","Yuki","Sofia","Amara","Zara","Nadia",
];

const LAST_NAMES = [
  "Smith","Johnson","Williams","Brown","Jones","Garcia","Miller","Davis",
  "Rodriguez","Martinez","Hernandez","Lopez","Wilson","Anderson","Thomas",
  "Taylor","Moore","Jackson","Martin","Lee","Perez","Thompson","White",
  "Harris","Clark","Lewis","Robinson","Walker","Young","Allen","King",
  "Wright","Scott","Torres","Nguyen","Hill","Flores","Green","Adams",
  "Baker","Hall","Rivera","Campbell","Mitchell","Carter","Roberts",
  "Gomez","Phillips","Evans","Turner","Diaz","Parker","Cruz","Edwards",
  "Chen","Wang","Li","Zhang","Liu","Yang","Sharma","Gupta","Singh",
  "Kumar","Muller","Schmidt","Tanaka","Sato","Kim","Okafor","Adeyemi",
  "Osei","Nkosi","Moyo","Van der Berg","De Vries","Jansen",
];

const INVESTOR_TYPES = [
  "venture_capital","angel_investor","accelerator","family_office",
  "corporate_venture","micro_vc","private_equity","impact_investor",
  "strategic_investor","angel_syndicate","fund_of_funds",
  "debt_investor","incubator","government_fund",
];

const STAGES = ["pre_seed","seed","series_a","series_b","series_c","growth","late_stage","pre_ipo"];

const SECTORS = [
  "ai","fintech","saas","healthtech","climatetech","consumer",
  "cybersecurity","edtech","deeptech","robotics","web3","enterprise",
  "mobility","proptech","agritech","energy","media","logistics",
  "devtools","marketplace","biotech","gaming","insurtech","proptech",
];

const COUNTRIES_CITIES: Array<{ country: string; city: string }> = [
  { country: "United States", city: "San Francisco" },
  { country: "United States", city: "New York" },
  { country: "United States", city: "Los Angeles" },
  { country: "United States", city: "Boston" },
  { country: "United States", city: "Austin" },
  { country: "United States", city: "Seattle" },
  { country: "United States", city: "Chicago" },
  { country: "United States", city: "Miami" },
  { country: "United States", city: "Denver" },
  { country: "United States", city: "Portland" },
  { country: "United States", city: "Nashville" },
  { country: "United States", city: "Atlanta" },
  { country: "United Kingdom", city: "London" },
  { country: "United Kingdom", city: "Manchester" },
  { country: "Germany", city: "Berlin" },
  { country: "Germany", city: "Munich" },
  { country: "France", city: "Paris" },
  { country: "Netherlands", city: "Amsterdam" },
  { country: "Sweden", city: "Stockholm" },
  { country: "Switzerland", city: "Zurich" },
  { country: "Spain", city: "Barcelona" },
  { country: "Ireland", city: "Dublin" },
  { country: "Portugal", city: "Lisbon" },
  { country: "Denmark", city: "Copenhagen" },
  { country: "Finland", city: "Helsinki" },
  { country: "Italy", city: "Milan" },
  { country: "Singapore", city: "Singapore" },
  { country: "Japan", city: "Tokyo" },
  { country: "South Korea", city: "Seoul" },
  { country: "India", city: "Mumbai" },
  { country: "India", city: "Bangalore" },
  { country: "India", city: "Delhi" },
  { country: "China", city: "Beijing" },
  { country: "China", city: "Shanghai" },
  { country: "Israel", city: "Tel Aviv" },
  { country: "Hong Kong", city: "Hong Kong" },
  { country: "United Arab Emirates", city: "Dubai" },
  { country: "Saudi Arabia", city: "Riyadh" },
  { country: "Nigeria", city: "Lagos" },
  { country: "Kenya", city: "Nairobi" },
  { country: "South Africa", city: "Cape Town" },
  { country: "Brazil", city: "São Paulo" },
  { country: "Mexico", city: "Mexico City" },
  { country: "Argentina", city: "Buenos Aires" },
  { country: "Colombia", city: "Bogotá" },
  { country: "Chile", city: "Santiago" },
  { country: "Australia", city: "Sydney" },
  { country: "Australia", city: "Melbourne" },
  { country: "New Zealand", city: "Auckland" },
  { country: "Canada", city: "Toronto" },
  { country: "Canada", city: "Vancouver" },
];

const JOB_TITLES = [
  "General Partner","Managing Partner","Partner","Principal",
  "Venture Partner","Senior Associate","Associate","Investment Director",
  "Head of Investments","Managing Director","Investment Manager",
  "Founding Partner","Co-Founder","CEO","Chief Investment Officer",
  "Director of Investments","Angel Investor","Advisor","Board Member",
  "Operating Partner","Chief Technology Officer","Chief Operating Officer",
  "Venture Architect","Innovation Lead","Ecosystem Builder",
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
];

const DOMAIN_TLDS = [".com",".io",".vc",".capital",".fund",".partners",".ventures"];

// =============================================
// Helpers
// =============================================

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function pickN<T>(arr: T[], min: number, max: number): T[] {
  const n = min + Math.floor(Math.random() * (max - min + 1));
  const shuffled = [...arr].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, n);
}

function randInt(min: number, max: number): number {
  return min + Math.floor(Math.random() * (max - min + 1));
}

function weightedPick(items: Array<{ value: string; weight: number }>): string {
  const total = items.reduce((s, i) => s + i.weight, 0);
  let r = Math.random() * total;
  for (const item of items) {
    r -= item.weight;
    if (r <= 0) return item.value;
  }
  return items[items.length - 1].value;
}

function generateEmail(first: string, last: string): string {
  const seps = [".", "_", ""];
  const num = Math.random() > 0.5 ? randInt(1, 99) : "";
  const tlds = ["gmail.com", "yahoo.com", "outlook.com", "protonmail.com", "icloud.com", "hotmail.com"];
  return `${first.toLowerCase()}${pick(seps)}${last.toLowerCase()}${num}@${pick(tlds)}`;
}

function generateLinkedIn(first: string, last: string): string {
  return `https://linkedin.com/in/${first.toLowerCase()}-${last.toLowerCase()}-${randInt(100, 9999)}`;
}

function generateWebsite(company: string): string {
  const slug = company.toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 20);
  return `https://www.${slug}${pick(DOMAIN_TLDS)}`;
}

function escapeCsvField(field: string | null | undefined): string {
  if (field === null || field === undefined) return "";
  const str = String(field);
  if (str.includes(",") || str.includes('"') || str.includes("\n")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

// =============================================
// Generate Records
// =============================================

function generateRecord(index: number): Record<string, string> {
  const firstName = pick([...FIRST_NAMES_MALE, ...FIRST_NAMES_FEMALE]);
  const lastName = pick(LAST_NAMES);
  const loc = pick(COUNTRIES_CITIES);
  const investorType = weightedPick([
    { value: "venture_capital", weight: 25 },
    { value: "angel_investor", weight: 20 },
    { value: "accelerator", weight: 8 },
    { value: "family_office", weight: 7 },
    { value: "corporate_venture", weight: 7 },
    { value: "micro_vc", weight: 10 },
    { value: "private_equity", weight: 5 },
    { value: "impact_investor", weight: 5 },
    { value: "strategic_investor", weight: 4 },
    { value: "angel_syndicate", weight: 3 },
    { value: "fund_of_funds", weight: 1 },
    { value: "incubator", weight: 1 },
    { value: "government_fund", weight: 1 },
  ]);

  const stages = pickN(STAGES, 1, 3);
  const sectors = pickN(SECTORS, 1, 5);
  const geos = [loc.country, ...pickN(
    [...new Set(COUNTRIES_CITIES.map(c => c.country))].filter(c => c !== loc.country),
    0, 2
  )].slice(0, 3);

  const hasEmail = Math.random() > 0.3; // 70% have email
  const hasLinkedIn = Math.random() > 0.25; // 75% have LinkedIn
  const hasBio = Math.random() > 0.2; // 80% have bio
  const hasPhone = Math.random() > 0.5; // 50% have phone
  const isVerified = Math.random() > 0.4; // 60% verified

  // Data quality varies — some records intentionally incomplete
  const completeness = Math.random();
  const useFullData = completeness > 0.3; // 70% get full data

  const checkMin = investorType === "angel_investor" ? randInt(5000, 50000) :
    investorType === "accelerator" ? 25000 :
    investorType === "micro_vc" ? randInt(25000, 200000) :
    investorType === "family_office" ? randInt(500000, 5000000) :
    investorType === "private_equity" ? randInt(5000000, 50000000) :
    randInt(100000, 5000000);

  const checkMax = checkMin * randInt(3, 20);

  const company = `${pick(["Alpha","Beta","Delta","Omega","Nova","Apex","Vertex","Atlas","Nexus","Prime",
    "Summit","Pioneer","Frontier","Catalyst","Lighthouse","Compass","Keystone","Horizon",
    "Spark","Ember","Flint","Cobalt","Quantum","BlueSky","ClearView","Evergreen"])} ${pick(["Capital","Ventures","Partners","Investments","Fund","Advisors","Growth","Equity"])}`;

  return {
    full_name: `${firstName} ${lastName}`,
    first_name: firstName,
    last_name: lastName,
    email: hasEmail ? generateEmail(firstName, lastName) : "",
    phone: hasPhone ? `+1${randInt(200, 999)}${randInt(100, 999)}${randInt(1000, 9999)}` : "",
    linkedin_url: hasLinkedIn ? generateLinkedIn(firstName, lastName) : "",
    job_title: pick(JOB_TITLES),
    investor_type: investorType,
    investment_stages: stages.join(";"),
    investment_sectors: sectors.join(";"),
    investment_geographies: geos.join(";"),
    country: loc.country,
    city: loc.city,
    min_check_size: String(checkMin),
    max_check_size: String(checkMax),
    currency: "USD",
    portfolio_count: String(randInt(0, 120)),
    bio: hasBio ? pick(BIOS) : "",
    company_name: useFullData ? company : "",
    company_domain: useFullData ? `${company.toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 20)}.com` : "",
    company_website: useFullData ? generateWebsite(company) : "",
    is_verified: String(isVerified),
    source: pick(["csv_import","apollo","manual","web_research","edgar","partner"]),
    source_id: `test_${String(index).padStart(6, "0")}`,
  };
}

// =============================================
// Main
// =============================================

const headers = [
  "full_name","first_name","last_name","email","phone","linkedin_url",
  "job_title","investor_type","investment_stages","investment_sectors",
  "investment_geographies","country","city","min_check_size","max_check_size",
  "currency","portfolio_count","bio","company_name","company_domain",
  "company_website","is_verified","source","source_id",
];

console.log(`\n📊 Generating ${COUNT} test investor records...\n`);

const rows: string[] = [headers.join(",")];

for (let i = 0; i < COUNT; i++) {
  const record = generateRecord(i);
  const row = headers.map(h => escapeCsvField(record[h])).join(",");
  rows.push(row);
}

// Add edge cases at the end
const edgeCases: Record<string, string>[] = [
  // Record with all fields empty
  { full_name: "Empty Test Record", first_name: "Empty", last_name: "Test", email: "", phone: "", linkedin_url: "", job_title: "", investor_type: "angel_investor", investment_stages: "", investment_sectors: "", investment_geographies: "", country: "", city: "", min_check_size: "", max_check_size: "", currency: "", portfolio_count: "", bio: "", company_name: "", company_domain: "", company_website: "", is_verified: "false", source: "test_edge", source_id: "edge_001" },
  // Record with special characters in name
  { full_name: "José María García-López", first_name: "José María", last_name: "García-López", email: "jose@example.com", phone: "+34612345678", linkedin_url: "https://linkedin.com/in/jose-test", job_title: "Managing Partner", investor_type: "venture_capital", investment_stages: "seed;series_a", investment_sectors: "fintech;saas", investment_geographies: "Spain;United States", country: "Spain", city: "Barcelona", min_check_size: "500000", max_check_size: "5000000", currency: "EUR", portfolio_count: "25", bio: "European VC with cross-border focus", company_name: "Iberia Ventures", company_domain: "iberiaventures.com", company_website: "https://iberiaventures.com", is_verified: "true", source: "test_edge", source_id: "edge_002" },
  // Record with very long bio
  { full_name: "Long Bio Test", first_name: "Long", last_name: "Bio", email: "longbio@test.com", phone: "", linkedin_url: "https://linkedin.com/in/longbio-test", job_title: "General Partner", investor_type: "venture_capital", investment_stages: "seed;series_a;series_b", investment_sectors: "ai;saas;fintech;healthtech;consumer", investment_geographies: "United States;United Kingdom;Germany", country: "United States", city: "San Francisco", min_check_size: "1000000", max_check_size: "20000000", currency: "USD", portfolio_count: "80", bio: "This is a very long bio that tests how the system handles extended text content. It includes multiple sentences and provides detailed information about the investor's background, experience, and investment thesis. The goal is to verify that the import pipeline correctly handles bios of varying lengths without truncation or data loss.", company_name: "Long Bio Capital", company_domain: "longbiocapital.com", company_website: "https://longbiocapital.com", is_verified: "true", source: "test_edge", source_id: "edge_003" },
  // Record with commas in bio (CSV edge case)
  { full_name: "Comma Test", first_name: "Comma", last_name: "Test", email: "comma@test.com", phone: "", linkedin_url: "", job_title: "Partner", investor_type: "micro_vc", investment_stages: "seed", investment_sectors: "saas", investment_geographies: "United States", country: "United States", city: "New York", min_check_size: "100000", max_check_size: "500000", currency: "USD", portfolio_count: "10", bio: "Invests in SaaS, fintech, and consumer startups. Focus on New York, San Francisco, and Austin.", company_name: "", company_domain: "", company_website: "", is_verified: "false", source: "test_edge", source_id: "edge_004" },
  // Record with quotes in bio
  { full_name: 'Quote "Test"', first_name: "Quote", last_name: "Test", email: "quote@test.com", phone: "", linkedin_url: "", job_title: "Angel Investor", investor_type: "angel_investor", investment_stages: "pre_seed;seed", investment_sectors: "ai", investment_geographies: "United States", country: "United States", city: "Austin", min_check_size: "25000", max_check_size: "100000", currency: "USD", portfolio_count: "5", bio: 'Founder of "TestCo" and "AnotherCo". Passionate about AI.', company_name: "", company_domain: "", company_website: "", is_verified: "false", source: "test_edge", source_id: "edge_005" },
];

for (const ec of edgeCases) {
  const row = headers.map(h => escapeCsvField(ec[h])).join(",");
  rows.push(row);
}

const totalRecords = rows.length - 1; // minus header
const csvContent = rows.join("\n");
const outPath = join(process.cwd(), "test-data", "stress-test-investors.csv");

writeFileSync(outPath, csvContent, "utf-8");

// Stats
const stats = {
  total: totalRecords,
  withEmail: rows.filter(r => r.split(",")[3]?.trim()).length - 1, // minus header
  types: {} as Record<string, number>,
  countries: {} as Record<string, number>,
};

for (let i = 1; i <= COUNT; i++) {
  const fields = rows[i].split(",");
  const type = fields[7]?.trim();
  const country = fields[11]?.trim();
  if (type) stats.types[type] = (stats.types[type] || 0) + 1;
  if (country) stats.countries[country] = (stats.countries[country] || 0) + 1;
}

console.log(`✅ Generated: ${outPath}`);
console.log(`   Total records: ${stats.total}`);
console.log(`   With email: ${stats.withEmail}`);
console.log(`\n📊 Investor Types:`);
for (const [type, count] of Object.entries(stats.types).sort((a, b) => b[1] - a[1])) {
  console.log(`   ${type.padEnd(22)} ${count}`);
}
console.log(`\n🌍 Top Countries:`);
for (const [country, count] of Object.entries(stats.countries).sort((a, b) => b[1] - a[1]).slice(0, 15)) {
  console.log(`   ${country.padEnd(22)} ${count}`);
}
console.log(`\n📎 Edge cases: ${edgeCases.length} (empty fields, special chars, commas, quotes, long bio)`);
