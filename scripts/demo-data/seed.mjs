#!/usr/bin/env node
/**
 * Capital OS demo dataset generator.
 *
 * Produces a deterministic, fully-populated synthetic dataset that the real
 * application can query as-is:
 *
 *   - investor_firms   (~6,000)  fictional funds with commercial detail
 *   - investors        (~50,000) individual partners, principals, angels
 *   - demo_founders    (~10,000) founder/company profiles
 *
 * Rules the generator will not break:
 *   1. Every row is flagged is_synthetic = true and carries demo_batch.
 *   2. Emails use the reserved `.example` TLD, so no message can ever reach a
 *      real person, even if a demo accidentally triggers a send.
 *   3. LinkedIn/website URLs point at demo.capitalos.example, never a real
 *      profile.
 *   4. Firm names are invented from word banks; no real fund is impersonated.
 *   5. Re-running replaces the batch atomically (delete by demo_batch, then
 *      insert), so the dataset is reproducible rather than additive.
 *
 * Usage:
 *   node scripts/demo-data/seed.mjs
 *   node scripts/demo-data/seed.mjs --investors=5000 --founders=1000
 *   node scripts/demo-data/seed.mjs --clear          # remove the batch only
 *   node scripts/demo-data/seed.mjs --dry-run        # generate, print stats, no DB
 *
 * Requires .env.local with NEXT_PUBLIC_SUPABASE_URL and SUPABASE_DB_PASSWORD.
 */

import dotenv from "dotenv";
import pg from "pg";
import crypto from "node:crypto";
import { existsSync } from "node:fs";

dotenv.config({ path: existsSync(".env.local") ? ".env.local" : ".env", quiet: true });

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------
const args = new Map(
  process.argv.slice(2).map((a) => {
    const [k, v = "true"] = a.replace(/^--/, "").split("=");
    return [k, v];
  })
);
const BATCH = args.get("batch") || "demo-2026-11";
const N_INVESTORS = Number(args.get("investors") || 50000);
const N_FIRMS = Number(args.get("firms") || 6000);
const N_FOUNDERS = Number(args.get("founders") || 10000);
const CLEAR_ONLY = args.has("clear");
const DRY_RUN = args.has("dry-run");
const SEED = Number(args.get("seed") || 20261119);
// Founders double as synthetic waitlist entries so the waitlist and admin
// surfaces can be exercised at volume. They stay flagged and uncounted.
const WAITLIST = args.get("waitlist") !== "false";

// ---------------------------------------------------------------------------
// Deterministic RNG (mulberry32) — same seed, same dataset, every machine.
// ---------------------------------------------------------------------------
function mulberry32(a) {
  return function rng() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rng = mulberry32(SEED);

const pick = (arr) => arr[Math.floor(rng() * arr.length)];
const int = (min, max) => Math.floor(rng() * (max - min + 1)) + min;
const chance = (p) => rng() < p;
const between = (min, max) => min + rng() * (max - min);
const round = (n, step) => Math.round(n / step) * step;

// Countries are not evenly distributed in any real corpus: the US dominates,
// then the UK, then a long tail. Picking uniformly would make the demo look
// nothing like the market it is meant to represent.
function weightedGeo() {
  return weighted(GEOGRAPHIES.map((g) => [g, g.weight]));
}

// A primary stage plus, sometimes, one adjacent stage — the shape of real
// investor mandates. Uniform stage sampling produced as many growth investors
// as pre-seed ones, which inverts the product's entire focus.
const STAGE_ORDER = ["pre_seed", "seed", "series_a", "series_b", "growth"];
function stagesForProfile(allowUpTo = 2) {
  const primary = weighted(STAGE);
  const idx = STAGE_ORDER.indexOf(primary);
  const adjacent = [STAGE_ORDER[idx - 1], STAGE_ORDER[idx + 1]].filter(Boolean);
  const out = [primary];
  if (chance(0.45) && adjacent.length) out.push(pick(adjacent));
  return out.slice(0, allowUpTo);
}

function weighted(entries) {
  // entries: [[value, weight], ...]
  const total = entries.reduce((s, [, w]) => s + w, 0);
  let r = rng() * total;
  for (const [value, weight] of entries) {
    r -= weight;
    if (r <= 0) return value;
  }
  return entries[entries.length - 1][0];
}

function pickMany(arr, min, max) {
  const n = int(min, max);
  const copy = [...arr];
  const out = [];
  while (out.length < n && copy.length) {
    out.push(copy.splice(Math.floor(rng() * copy.length), 1)[0]);
  }
  return out;
}

function uuidFrom(key) {
  const h = crypto.createHash("sha1").update(`${SEED}:${BATCH}:${key}`).digest("hex");
  return [
    h.slice(0, 8),
    h.slice(8, 12),
    "4" + h.slice(13, 16),
    ((parseInt(h.slice(16, 17), 16) & 0x3) | 0x8).toString(16) + h.slice(17, 20),
    h.slice(20, 32),
  ].join("-");
}

function slugify(s) {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

// ---------------------------------------------------------------------------
// Vocabulary
// ---------------------------------------------------------------------------
const SECTORS = [
  ["ai", 16], ["software", 14], ["fintech", 11], ["healthtech", 9], ["climate", 7],
  ["deeptech", 6], ["consumer", 6], ["cybersecurity", 5], ["web3", 4],
  ["marketplace", 4], ["edtech", 3], ["biotech", 3], ["logistics", 3],
  ["proptech", 3], ["insurtech", 2], ["semiconductors", 2], ["energy", 2],
  ["media", 2], ["real_estate", 2], ["business_services", 2], ["hardware", 2],
  ["spacetech", 1], ["robotics", 1], ["agritech", 1], ["legaltech", 1],
];

const STAGE = [
  ["pre_seed", 40], ["seed", 36], ["series_a", 16], ["series_b", 6], ["growth", 2],
];

const INVESTOR_TYPE = [
  ["venture_capital", 34], ["angel_investor", 20], ["micro_vc", 9],
  ["private_equity", 6], ["corporate_venture", 5], ["family_office", 5],
  ["angel_syndicate", 4], ["accelerator", 3], ["strategic_investor", 3],
  ["impact_investor", 3], ["fund_of_funds", 2], ["venture_studio", 2],
  ["government_fund", 1], ["university_fund", 1], ["incubator", 1], ["debt_investor", 1],
];

const FIRM_TYPE = [
  ["venture_capital", 46], ["micro_vc", 12], ["private_equity", 9],
  ["corporate_venture", 7], ["family_office", 7], ["angel_syndicate", 4],
  ["accelerator", 4], ["fund_of_funds", 3], ["growth_equity", 3],
  ["incubator", 2], ["sovereign_wealth", 1], ["other", 2],
];

const GEOGRAPHIES = [
  { country: "United States", weight: 34, cities: ["San Francisco, CA", "New York, NY", "Boston, MA", "Austin, TX", "Seattle, WA", "Chicago, IL", "Los Angeles, CA", "Miami, FL", "Denver, CO", "Palo Alto, CA"] },
  { country: "United Kingdom", weight: 12, cities: ["London", "Cambridge", "Manchester", "Edinburgh", "Bristol"] },
  { country: "Germany", weight: 7, cities: ["Berlin", "Munich", "Hamburg", "Frankfurt"] },
  { country: "France", weight: 6, cities: ["Paris", "Lyon", "Bordeaux", "Toulouse"] },
  { country: "Canada", weight: 5, cities: ["Toronto", "Vancouver", "Montreal", "Waterloo"] },
  { country: "India", weight: 5, cities: ["Bengaluru", "Mumbai", "Delhi", "Hyderabad", "Pune"] },
  { country: "Singapore", weight: 4, cities: ["Singapore"] },
  { country: "Netherlands", weight: 3, cities: ["Amsterdam", "Rotterdam", "Eindhoven"] },
  { country: "Israel", weight: 3, cities: ["Tel Aviv", "Herzliya", "Jerusalem"] },
  { country: "United Arab Emirates", weight: 3, cities: ["Dubai", "Abu Dhabi"] },
  { country: "Nigeria", weight: 3, cities: ["Lagos", "Abuja", "Port Harcourt"] },
  { country: "Kenya", weight: 2, cities: ["Nairobi", "Mombasa"] },
  { country: "South Africa", weight: 2, cities: ["Cape Town", "Johannesburg"] },
  { country: "Sweden", weight: 2, cities: ["Stockholm", "Gothenburg"] },
  { country: "Spain", weight: 2, cities: ["Madrid", "Barcelona", "Valencia"] },
  { country: "Brazil", weight: 2, cities: ["São Paulo", "Rio de Janeiro"] },
  { country: "Australia", weight: 2, cities: ["Sydney", "Melbourne", "Brisbane"] },
  { country: "Japan", weight: 2, cities: ["Tokyo", "Osaka"] },
  { country: "Switzerland", weight: 1, cities: ["Zurich", "Geneva"] },
  { country: "Ireland", weight: 1, cities: ["Dublin", "Cork"] },
  { country: "Denmark", weight: 1, cities: ["Copenhagen", "Aarhus"] },
  { country: "Estonia", weight: 1, cities: ["Tallinn", "Tartu"] },
  { country: "Indonesia", weight: 1, cities: ["Jakarta", "Bandung"] },
  { country: "Mexico", weight: 1, cities: ["Mexico City", "Guadalajara"] },
  { country: "Egypt", weight: 1, cities: ["Cairo", "Alexandria"] },
  { country: "Ghana", weight: 1, cities: ["Accra", "Kumasi"] },
  { country: "Rwanda", weight: 1, cities: ["Kigali"] },
  { country: "Singapore", weight: 1, cities: ["Singapore"] },
];

// Names are drawn per cultural group, so a Lagos-based investor does not end
// up called "Wei Kowalski". A demo full of implausible names reads as fake
// instantly, which is the opposite of what this dataset is for.
const NAME_GROUPS = {
  us_uk: {
    first: ["Olivia", "Liam", "Emma", "Noah", "Ava", "Ethan", "Sophia", "Mason", "Isabella", "Logan",
      "Mia", "Lucas", "Charlotte", "Henry", "Amelia", "Jack", "Harper", "Owen", "Evelyn", "Leo",
      "Grace", "Daniel", "Chloe", "Samuel", "Zoe", "Nathan", "Hannah", "Eli", "Nora", "Caleb",
      "Ruby", "Adam", "Alice", "Thomas", "Freya", "James", "Ella", "Ben", "Imogen", "Jacob",
      "Oliver", "Katie", "Ryan", "Lucy", "Sean", "Fiona", "Declan", "Niamh", "Callum", "Saoirse"],
    last: ["Smith", "Johnson", "Williams", "Brown", "Jones", "Miller", "Davis", "Wilson", "Taylor", "Clarke",
      "Evans", "Thomas", "Roberts", "Walker", "Wright", "Thompson", "White", "Hughes", "Edwards", "Green",
      "Hall", "Wood", "Harris", "Martin", "Jackson", "Morris", "Turner", "Cooper", "Ward", "Bennett",
      "Foster", "Murphy", "Kelly", "O'Brien", "Ryan", "Walsh", "Doyle", "Quinn", "Brennan", "Hayes",
      "Reid", "Palmer", "Brooks", "Ellis", "Grant", "Carter", "Mitchell", "Fraser", "Sinclair", "Byrne"],
  },
  germanic: {
    first: ["Lukas", "Anna", "Jonas", "Lea", "Felix", "Lena", "Maximilian", "Sophie", "Paul", "Marie",
      "Leon", "Finn", "Hannah", "Tim", "Laura", "Jan", "Nina", "Sven", "Katrin", "Moritz",
      "Franziska", "Sebastian", "Miriam", "Tobias", "Sanne", "Bram", "Lotte", "Daan", "Femke", "Thijs",
      "Anouk", "Ruben", "Esther", "Matthias", "Anja", "Stefan", "Petra", "Sabine", "Koen", "Marloes",
      "Wouter", "Ilse", "Jeroen", "Fleur"],
    last: ["Müller", "Schmidt", "Schneider", "Fischer", "Weber", "Meyer", "Wagner", "Becker", "Hoffmann", "Schulz",
      "Bauer", "Koch", "Richter", "Klein", "Wolf", "Neumann", "Schwarz", "Zimmermann", "Braun", "Krüger",
      "Hartmann", "Lange", "Werner", "Krause", "Köhler", "Vogel", "de Vries", "Jansen", "van den Berg", "Bakker",
      "Visser", "Smit", "Meijer", "Mulder", "Bos", "Vos", "Hendriks", "Dekker", "Brouwer", "Koster",
      "Hofer", "Gruber", "Brunner", "Baumann"],
  },
  nordic: {
    first: ["Erik", "Astrid", "Lars", "Freja", "Magnus", "Elin", "Anders", "Saga", "Nils", "Ingrid",
      "Johan", "Maja", "Karl", "Signe", "Henrik", "Linnea", "Oskar", "Alma", "Gustav", "Selma",
      "Emil", "Ebba", "Viktor", "Hedda", "Axel", "Tove", "Rasmus", "Ida", "Mads", "Sofie"],
    last: ["Andersson", "Johansson", "Karlsson", "Nilsson", "Eriksson", "Larsson", "Olsson", "Persson", "Svensson", "Gustafsson",
      "Lindqvist", "Bergström", "Hansen", "Jensen", "Nielsen", "Pedersen", "Andersen", "Christensen", "Larsen", "Sørensen",
      "Berg", "Lund", "Dahl", "Holm", "Lindholm", "Ek", "Ström", "Åberg", "Møller", "Kristensen"],
  },
  french: {
    first: ["Camille", "Louis", "Chloé", "Hugo", "Manon", "Théo", "Léa", "Nathan", "Inès", "Juliette",
      "Gabriel", "Sophie", "Antoine", "Élodie", "Julien", "Marion", "Maxime", "Clara", "Baptiste", "Amélie",
      "Romain", "Céline", "Pierre", "Anaïs", "Mathieu", "Léonie", "Benoît", "Margaux"],
    last: ["Martin", "Bernard", "Dubois", "Thomas", "Robert", "Richard", "Petit", "Durand", "Leroy", "Moreau",
      "Simon", "Laurent", "Lefebvre", "Michel", "Roux", "Fournier", "Girard", "Mercier", "Blanc", "Guérin",
      "Boyer", "Chevalier", "Lambert", "Fontaine", "Rousseau", "Vincent", "Perrin", "Dumont", "Bonneau", "Marchand"],
  },
  iberian: {
    first: ["Sofía", "Mateo", "Lucía", "Diego", "Valeria", "Alejandro", "Camila", "Javier", "Isabella", "Santiago",
      "Mariana", "Miguel", "Elena", "Rafael", "Beatriz", "Andrés", "Paula", "Ricardo", "Carmen", "Tomás",
      "João", "Ana", "Pedro", "Inês", "Tiago", "Rafaela", "Gustavo", "Larissa", "Felipe", "Juliana",
      "Rodrigo", "Bruno", "Carla", "Thiago", "Renata"],
    last: ["García", "Rodríguez", "Martínez", "López", "González", "Pérez", "Sánchez", "Ramírez", "Torres", "Flores",
      "Rivera", "Gómez", "Díaz", "Cruz", "Morales", "Ortiz", "Silva", "Santos", "Pereira", "Oliveira",
      "Souza", "Costa", "Ferreira", "Almeida", "Carvalho", "Ribeiro", "Alves", "Monteiro", "Barbosa", "Rocha",
      "Mendes", "Lima", "Araújo", "Cardoso", "Teixeira"],
  },
  indian: {
    first: ["Arjun", "Priya", "Rohan", "Ananya", "Vikram", "Neha", "Karan", "Aditi", "Rahul", "Divya",
      "Aditya", "Isha", "Siddharth", "Meera", "Nikhil", "Pooja", "Aarav", "Shreya", "Ravi", "Kavya",
      "Deepa", "Sanjay", "Nisha", "Varun", "Tara"],
    last: ["Sharma", "Patel", "Singh", "Kumar", "Gupta", "Reddy", "Iyer", "Nair", "Mehta", "Shah",
      "Desai", "Chopra", "Kapoor", "Malhotra", "Rao", "Verma", "Joshi", "Banerjee", "Mukherjee", "Chatterjee",
      "Pillai", "Menon", "Agarwal", "Bhatia", "Sethi"],
  },
  chinese: {
    first: ["Wei", "Mei", "Jing", "Hao", "Xin", "Yan", "Ming", "Jun", "Xiao", "Fang",
      "Lei", "Hui", "Tao", "Lan", "Chen", "Yun", "Bo", "Qian", "Shan", "Kevin",
      "Jessica", "Andrew", "Grace", "Eric", "Michelle", "Vivian", "Jason", "Emily"],
    last: ["Chen", "Wang", "Li", "Zhang", "Liu", "Yang", "Huang", "Zhao", "Wu", "Zhou",
      "Xu", "Sun", "Ma", "Zhu", "Hu", "Guo", "Lin", "He", "Gao", "Luo",
      "Zheng", "Leung", "Wong", "Lam", "Cheung", "Ng"],
  },
  japanese: {
    first: ["Haruki", "Sakura", "Ren", "Yui", "Sota", "Aoi", "Kaito", "Hina", "Yuto", "Rin",
      "Daiki", "Mio", "Takumi", "Saki", "Kenji", "Naomi", "Hiroshi", "Emi", "Shota", "Ayaka",
      "Riku", "Kana"],
    last: ["Sato", "Suzuki", "Takahashi", "Tanaka", "Watanabe", "Ito", "Yamamoto", "Nakamura", "Kobayashi", "Kato",
      "Yoshida", "Yamada", "Sasaki", "Yamaguchi", "Matsumoto", "Inoue", "Kimura", "Hayashi", "Shimizu", "Mori"],
  },
  korean: {
    first: ["Min-jun", "Seo-yeon", "Ji-hoon", "Ha-eun", "Jun-ho", "Soo-ah", "Dong-hyun", "Ye-jin", "Tae-yang", "Ji-woo"],
    last: ["Kim", "Lee", "Park", "Choi", "Jung", "Kang", "Cho", "Yoon", "Jang", "Lim"],
  },
  west_african: {
    first: ["Amara", "Emeka", "Chidinma", "Tunde", "Adaeze", "Ifeanyi", "Kemi", "Obinna", "Ngozi", "Segun",
      "Aisha", "Bola", "Chinedu", "Funmi", "Ikenna", "Nneka", "Tobi", "Yemi", "Kofi", "Ama",
      "Kwame", "Akosua", "Kojo", "Abena", "Efua"],
    last: ["Okafor", "Adeyemi", "Okonkwo", "Balogun", "Eze", "Adebayo", "Nwosu", "Ogunleye", "Chukwu", "Ojo",
      "Afolabi", "Ibrahim", "Mensah", "Owusu", "Asante", "Boateng", "Osei", "Darko", "Agyeman", "Appiah",
      "Bello", "Yakubu", "Sani", "Umar"],
  },
  east_african: {
    first: ["Wanjiru", "Brian", "Achieng", "Kevin", "Nyambura", "Dennis", "Akinyi", "Peter", "Wairimu", "Samuel",
      "Njeri", "Grace", "Otieno", "Faith", "Mwangi", "Mercy", "Alice", "Aline", "Eric", "Claudine",
      "Patrick", "Divine", "Jean"],
    last: ["Kamau", "Ochieng", "Mwangi", "Kariuki", "Njoroge", "Waweru", "Otieno", "Omondi", "Mutua", "Kiptoo",
      "Chebet", "Kimani", "Gatimu", "Mugisha", "Habimana", "Uwimana", "Niyonzima", "Mukamana", "Bizimana", "Nkurunziza"],
  },
  southern_african: {
    first: ["Thabo", "Lerato", "Sipho", "Naledi", "Mandla", "Zanele", "Kagiso", "Palesa", "Sibusiso", "Ayanda",
      "Tebogo", "Nomvula", "Lwazi", "Dineo", "Bongani", "Refilwe", "Johan", "Annelie", "Pieter", "Marlize"],
    last: ["Ndlovu", "Dlamini", "Mokoena", "Nkosi", "Khumalo", "Mbatha", "Zulu", "Mahlangu", "Botha", "van der Merwe",
      "Pretorius", "Nel", "du Plessis", "Mthembu", "Radebe", "Sithole", "Nkomo", "Maseko", "Jacobs", "Fourie"],
  },
  mena: {
    first: ["Omar", "Layla", "Yusuf", "Nour", "Tariq", "Salma", "Karim", "Hana", "Ahmed", "Mariam",
      "Hassan", "Dina", "Khalid", "Rania", "Ali", "Yasmin", "Mostafa", "Farida", "Amr", "Amina",
      "Saeed", "Reem"],
    last: ["Al Mansouri", "Al Suwaidi", "Hassan", "Ibrahim", "El Sayed", "Fahmy", "Nasser", "Khalil", "Haddad", "Saleh",
      "Al Rashid", "El Masry", "Abdel Rahman", "Farouk", "Hamdan", "Zayed", "Al Nuaimi", "Shafik", "Mansour", "Rizk"],
  },
  israeli: {
    first: ["Noa", "David", "Tamar", "Ariel", "Yael", "Eitan", "Shira", "Omer", "Maya", "Roi",
      "Michal", "Amir", "Lior", "Guy", "Dana", "Nadav", "Hila", "Yonatan", "Sivan", "Erez"],
    last: ["Cohen", "Levi", "Mizrahi", "Peretz", "Biton", "Dahan", "Avraham", "Friedman", "Shapiro", "Katz",
      "Ben-David", "Goldberg", "Weiss", "Rosen", "Barak", "Azoulay", "Ohayon", "Shalom", "Dayan", "Gabbai"],
  },
  se_asia: {
    first: ["Adi", "Siti", "Budi", "Dewi", "Rizky", "Putri", "Agus", "Indah", "Fajar", "Lestari",
      "Bayu", "Ayu", "Dian", "Rudi", "Minh", "Linh", "Anh", "Mai", "Somchai", "Ploy",
      "Arthit", "Nok"],
    last: ["Wijaya", "Santoso", "Pratama", "Kusuma", "Hidayat", "Saputra", "Nugroho", "Halim", "Gunawan", "Susanto",
      "Tan", "Lim", "Wong", "Nguyen", "Tran", "Le", "Pham", "Hoang", "Vu", "Dang",
      "Reyes", "Santos", "Cruz", "Bautista"],
  },
  east_europe: {
    first: ["Kertu", "Marek", "Kadri", "Tomasz", "Marta", "Andrei", "Elena", "Pavel", "Katarzyna", "Mihai",
      "Liis", "Jakub", "Agnieszka", "Ion", "Kristjan", "Piotr", "Alina", "Vlad", "Ewa", "Rares",
      "Triin", "Lukasz", "Ioana", "Petr", "Andra"],
    last: ["Tamm", "Saar", "Mägi", "Kask", "Kowalski", "Nowak", "Wiśniewski", "Wójcik", "Kamiński", "Lewandowski",
      "Zielinski", "Popescu", "Ionescu", "Popa", "Dumitru", "Stan", "Novák", "Svoboda", "Dvořák", "Procházka",
      "Petrov", "Ivanov", "Georgiev", "Marin", "Stoica"],
  },
};

const COUNTRY_NAME_GROUP = {
  "United States": "us_uk", "United Kingdom": "us_uk", Canada: "us_uk", Australia: "us_uk",
  Ireland: "us_uk", "New Zealand": "us_uk",
  Germany: "germanic", Netherlands: "germanic", Switzerland: "germanic", Austria: "germanic",
  Sweden: "nordic", Denmark: "nordic", Norway: "nordic", Finland: "nordic",
  France: "french", Belgium: "french", Luxembourg: "french",
  Spain: "iberian", Portugal: "iberian", Brazil: "iberian", Mexico: "iberian",
  Argentina: "iberian", Chile: "iberian", Colombia: "iberian",
  India: "indian",
  Singapore: "chinese", China: "chinese", "Hong Kong": "chinese", Taiwan: "chinese", Malaysia: "chinese",
  Japan: "japanese", "South Korea": "korean",
  Nigeria: "west_african", Ghana: "west_african",
  Kenya: "east_african", Rwanda: "east_african", Tanzania: "east_african", Uganda: "east_african",
  "South Africa": "southern_african", Zimbabwe: "southern_african", Botswana: "southern_african",
  "United Arab Emirates": "mena", "Saudi Arabia": "mena", Egypt: "mena", Qatar: "mena",
  Israel: "israeli",
  Indonesia: "se_asia", Philippines: "se_asia", Vietnam: "se_asia", Thailand: "se_asia",
  Estonia: "east_europe", Poland: "east_europe", Romania: "east_europe", "Czech Republic": "east_europe",
};

function pickPerson(country) {
  const group = NAME_GROUPS[COUNTRY_NAME_GROUP[country] || "us_uk"];
  return { first: pick(group.first), last: pick(group.last) };
}

const FIRM_A = [
  "Alder", "Amber", "Anchor", "Arbor", "Ascent", "Atlas", "Aurora", "Basalt", "Beacon", "Birch",
  "Bluebird", "Bridge", "Brio", "Cairn", "Canyon", "Cedar", "Celest", "Cinder", "Citrine", "Clover",
  "Cobalt", "Compass", "Copper", "Coral", "Crescent", "Cypress", "Delta", "Drift", "Elm", "Ember",
  "Evergreen", "Falcon", "Fern", "Field", "Finch", "Flint", "Forge", "Foxglove", "Garnet", "Glacier",
  "Granite", "Harbor", "Hazel", "Helix", "Hemlock", "Heron", "Hickory", "Horizon", "Indigo", "Iris",
  "Ivory", "Juniper", "Kestrel", "Keystone", "Kingfisher", "Larch", "Lattice", "Lighthouse", "Linden", "Lumen",
  "Magnet", "Maple", "Marlin", "Meridian", "Mica", "Mistral", "Monarch", "Moss", "Nimbus", "Northwind",
  "Oak", "Obsidian", "Orchid", "Orion", "Osprey", "Otter", "Owl", "Palladium", "Pebble", "Pelican",
  "Pine", "Pioneer", "Pivot", "Polaris", "Poplar", "Prairie", "Quartz", "Quill", "Raven", "Redwood",
  "Reef", "Ridge", "River", "Sable", "Sage", "Sapphire", "Sequoia", "Shale", "Silver", "Sparrow",
  "Spruce", "Starling", "Stone", "Summit", "Swan", "Sycamore", "Tern", "Thistle", "Timber", "Topaz",
  "Tundra", "Turtle", "Vale", "Vertex", "Violet", "Willow", "Wren", "Yarrow", "Zephyr", "Zircon",
];

const FIRM_B = [
  "Capital", "Ventures", "Partners", "Holdings", "Investments", "Equity", "Group",
  "Capital Partners", "Venture Partners", "Investment Group", "Growth Partners", "Founders Fund",
];

const FIRM_PREFIX = ["", "", "", "North", "South", "East", "West", "New", "True", "First"];

const TITLES_BY_TYPE = {
  venture_capital: ["Partner", "General Partner", "Managing Partner", "Principal", "Investment Director", "Associate", "Venture Partner"],
  micro_vc: ["Founding Partner", "General Partner", "Partner", "Principal"],
  private_equity: ["Partner", "Managing Director", "Principal", "Investment Director"],
  corporate_venture: ["Managing Director", "Investment Director", "Principal", "Head of Ventures"],
  family_office: ["Investment Director", "Principal", "Head of Investments", "Partner"],
  angel_syndicate: ["Syndicate Lead", "Founding Partner", "Angel Investor"],
  accelerator: ["Managing Director", "Programme Partner", "Investment Partner"],
  strategic_investor: ["Head of Investments", "Investment Director", "Corporate Development Lead"],
  impact_investor: ["Partner", "Investment Director", "Impact Lead"],
  fund_of_funds: ["Partner", "Investment Director", "Principal"],
  venture_studio: ["Founding Partner", "Studio Partner", "Venture Partner"],
  government_fund: ["Investment Director", "Fund Manager", "Portfolio Manager"],
  university_fund: ["Investment Director", "Fund Manager", "Associate"],
  incubator: ["Programme Director", "Investment Manager"],
  debt_investor: ["Credit Partner", "Investment Director", "Portfolio Manager"],
  angel_investor: ["Angel Investor", "Founder & Angel Investor", "Operator & Angel Investor", "Executive Angel"],
};

const THESIS_OPENERS = [
  "We back founders who are rebuilding a workflow from first principles",
  "We invest early, before the market has agreed on the category",
  "We look for evidence that the product is already pulling users in",
  "We partner with technical founders who understand their buyer",
  "We concentrate on businesses where data compounds with usage",
  "We prefer capital-efficient teams with a clear wedge",
  "We write first cheques into markets that are larger than they look",
  "We back operators turning a painful manual process into software",
  "We look for products that become the system of record",
  "We invest where distribution can be built, not bought",
];

const THESIS_CLOSERS = [
  "We lead rounds and stay close through the first two years.",
  "We reserve follow-on capital for our strongest performers.",
  "We co-invest with specialist funds and operator angels.",
  "We take board seats when the founder wants a working partner.",
  "We are comfortable being the first institutional cheque.",
  "We do not invest in businesses that require heavy inventory.",
  "We prefer to see revenue before we lead a round.",
  "We move quickly once we have conviction, usually two weeks.",
  "We underwrite the founder first and the market second.",
  "We believe the best companies are built in unglamorous categories.",
];

const LOSS_REASONS = null;
const NOISE = null;

// ---------------------------------------------------------------------------
// Generators
// ---------------------------------------------------------------------------
const STAGE_REQUIREMENT = {
  pre_seed: "pre-seed and seed",
  seed: "seed and pre-seed",
  series_a: "seed and Series A",
  series_b: "Series A and Series B",
  growth: "growth-stage",
};

function stageChequeRange(stage) {
  switch (stage) {
    case "pre_seed": return [25_000, 750_000];
    case "seed": return [250_000, 3_000_000];
    case "series_a": return [1_000_000, 10_000_000];
    case "series_b": return [3_000_000, 25_000_000];
    default: return [5_000_000, 50_000_000];
  }
}

function makeFirm(i) {
  const id = uuidFrom(`firm:${i}`);
  const type = weighted(FIRM_TYPE);
  const geo = weightedGeo();
  const city = pick(geo.cities);
  const baseName =
    pick(FIRM_PREFIX) && chance(0.25)
      ? `${pick(FIRM_PREFIX)} ${pick(FIRM_A)} ${pick(FIRM_B)}`
      : `${pick(FIRM_A)} ${pick(FIRM_B)}`;
  const name = baseName.replace(/\s+/g, " ").trim();
  const slug = slugify(name);
  const domain = `${slug}.example`;

  const stages =
    type === "fund_of_funds" || type === "growth_equity"
      ? pickMany(["series_b", "growth"], 1, 2)
      : stagesForProfile(3);
  const sectors = pickMany(SECTORS.map(([s]) => s), 2, 5);
  const geographies = pickMany(GEOGRAPHIES.map((g) => g.country), 1, 4);

  const [lo, hi] = stageChequeRange(pick(stages));
  const min_check = round(between(lo, hi * 0.5), 25_000);
  const max_check = round(Math.max(min_check * 1.5, between(lo * 1.5, hi)), 25_000);

  const fund_size =
    type === "family_office" || type === "corporate_venture"
      ? round(between(50_000_000, 2_000_000_000), 1_000_000)
      : round(between(15_000_000, 900_000_000), 1_000_000);

  return {
    id,
    name,
    domain,
    website: `https://${domain}`,
    linkedin_url: `https://demo.capitalos.example/company/${slug}`,
    description: `${name} is a ${type.replace(/_/g, " ")} investor based in ${city}, ${geo.country}. It backs ${sectors.slice(0, 3).join(", ")} companies, primarily at ${stages.map((s) => s.replace(/_/g, " ")).join(" and ")}.`,
    firm_type: type,
    headquarters: city,
    country: geo.country,
    region: geo.country === "United States" ? "North America" : geo.country,
    investment_stages: stages,
    investment_sectors: sectors,
    investment_geographies: geographies,
    min_check_size: min_check,
    max_check_size: max_check,
    currency: geo.country === "United States" ? "USD" : chance(0.7) ? "USD" : "EUR",
    fund_size,
    active_fund: `Fund ${["I", "II", "III", "IV", "V"][int(0, 4)]}`,
    founded_year: int(1998, 2023),
    portfolio_count: int(8, 240),
    team_size: int(3, 60),
    is_active: true,
    source: "synthetic_demo",
    source_id: `${BATCH}-firm-${i}`,
    source_provider: "capitalos_demo",
    is_synthetic: true,
    demo_batch: BATCH,
  };
}

function makeInvestor(i, firms) {
  const type = weighted(INVESTOR_TYPE);
  const firm = type === "angel_investor" ? (chance(0.6) ? pick(firms) : null) : pick(firms);
  const geo = weightedGeo();
  const city = pick(geo.cities);
  const { first, last } = pickPerson(geo.country);
  const full = `${first} ${last}`;
  const isAngel = type === "angel_investor";

  const stages = isAngel
    ? stagesForProfile(2)
    : firm?.investment_stages?.length
      ? pickMany(firm.investment_stages, 1, Math.min(3, firm.investment_stages.length))
      : stagesForProfile(2);

  const sectors = isAngel
    ? pickMany(SECTORS.map(([s]) => s), 1, 3)
    : firm?.investment_sectors?.length
      ? pickMany(firm.investment_sectors, 1, Math.min(3, firm.investment_sectors.length))
      : pickMany(SECTORS.map(([s]) => s), 1, 3);

  const primaryStage = stages[0] || "seed";
  const [lo, hi] = stageChequeRange(primaryStage);
  const min_check = round(between(lo, Math.max(lo * 1.2, hi * 0.45)), 5_000);
  const max_check = round(Math.max(min_check * 1.4, between(lo * 1.4, hi)), 5_000);

  const emailSlug = `${first}.${last}`.toLowerCase().replace(/[^a-z.]/g, "");
  const firmSlug = firm ? firm.domain.replace(".example", "") : "independent";
  const email = chance(0.74) ? `${emailSlug}@${firmSlug}.example` : null;

  const title = isAngel
    ? pick(TITLES_BY_TYPE.angel_investor)
    : pick(TITLES_BY_TYPE[type] || TITLES_BY_TYPE.venture_capital);

  const yearsActive = int(3, 20);
  const recent = chance(0.62);
  const lastInvestment = recent
    ? new Date(Date.now() - int(10, 520) * 86_400_000)
    : chance(0.5)
      ? new Date(Date.now() - int(520, 1500) * 86_400_000)
      : null;

  const thesis = `${pick(THESIS_OPENERS)}. We focus on ${sectors.slice(0, 2).map((s) => s.replace(/_/g, " ")).join(" and ")} at ${stages.map((s) => s.replace(/_/g, " ")).join(" and ")} across ${geo.country}. ${pick(THESIS_CLOSERS)}`;

  const qualityBase = 55 + (email ? 10 : 0) + (thesis ? 8 : 0) + (recent ? 8 : 0) + int(0, 12);
  const dataQuality = Math.min(98, qualityBase);
  // A synthetic address can never be verified: the domain does not exist. Marking
  // these rows verified would let the demo claim "verified contactable emails".
  const verified = false;
  const readiness = email && thesis && chance(0.62)
    ? "ready"
    : chance(0.65)
      ? "needs_verification"
      : "not_ready";

  return {
    id: uuidFrom(`investor:${i}`),
    full_name: full,
    first_name: first,
    last_name: last,
    email,
    linkedin_url: chance(0.7) ? `https://demo.capitalos.example/linkedin/${slugify(full)}` : null,
    job_title: title,
    bio: `${full} is a ${title}${firm ? ` at ${firm.name}` : " and an independent angel investor"}, investing in ${sectors.slice(0, 2).map((s) => s.replace(/_/g, " ")).join(" and ")} at ${STAGE_REQUIREMENT[primaryStage] || "early stage"}. ${thesis}`,
    location: `${city}, ${geo.country}`,
    country: geo.country,
    city,
    investor_type: type,
    current_firm_id: firm ? firm.id : null,
    investment_stages: stages,
    investment_sectors: sectors,
    investment_geographies: chance(0.3) ? [...new Set([geo.country, ...pickMany(GEOGRAPHIES.map((g) => g.country), 1, 2)])] : [geo.country],
    min_check_size: min_check,
    max_check_size: max_check,
    currency: geo.country === "United States" ? "USD" : chance(0.6) ? "USD" : "EUR",
    investment_thesis: thesis,
    thesis_source: "synthetic_demo",
    portfolio_count: isAngel ? int(2, 40) : int(5, 180),
    website_url: firm ? firm.website : null,
    is_active: chance(0.97),
    is_verified: verified,
    do_not_contact: chance(0.02),
    outreach_readiness: readiness,
    data_quality_score: dataQuality,
    fit_score: 0,
    last_investment_date: lastInvestment,
    recent_investment_count: recent ? int(1, 9) : int(0, 2),
    last_enriched_at: new Date(Date.now() - int(1, 300) * 86_400_000),
    source: "synthetic_demo",
    source_id: `${BATCH}-investor-${i}`,
    source_provider: "capitalos_demo",
    verification_status: verified ? "verified" : chance(0.5) ? "derived" : chance(0.5) ? "ai_classified" : "unknown",
    last_verified_at: verified ? new Date(Date.now() - int(1, 200) * 86_400_000) : null,
    lead_preference: isAngel ? chance(0.4) ? "lead" : "follower" : pick(["lead", "co_lead", "follower"]),
    email_verified: false,
    scope: "startup_investor",
    record_status: "valid",
    provenance: { kind: "synthetic", batch: BATCH, generator: "scripts/demo-data/seed.mjs" },
    is_synthetic: true,
    demo_batch: BATCH,
    created_at: new Date(Date.now() - int(1, 540) * 86_400_000),
    updated_at: new Date(Date.now() - int(0, 60) * 86_400_000),
  };
}

const INDUSTRIES = [
  ["SaaS", 18, "software"], ["AI / Machine Learning", 16, "ai"], ["FinTech", 12, "fintech"],
  ["HealthTech", 9, "healthtech"], ["ClimateTech", 7, "climate"], ["Consumer", 6, "consumer"],
  ["Marketplace", 5, "marketplace"], ["DeepTech", 5, "deeptech"], ["Cybersecurity", 4, "cybersecurity"],
  ["EdTech", 3, "edtech"], ["Enterprise Software", 5, "software"], ["PropTech", 3, "proptech"],
  ["Logistics", 2, "logistics"], ["Energy", 2, "energy"], ["Media", 2, "media"],
  ["Web3", 2, "web3"], ["Other", 2, "business_services"],
];

const BUSINESS_MODELS = ["SaaS", "Marketplace", "Hardware", "Services", "Consumer", "Other"];
const COMPANY_SUFFIX = ["Labs", "AI", "Health", "Systems", "Works", "Studio", "Technologies", "Cloud", "Data", "Software", "Group", "Ltd"];

// A company called "Amber Health" that is actually an energy company reads as
// generated noise. The suffix follows the industry so the demo stays coherent.
const SUFFIX_BY_INDUSTRY = {
  "SaaS": ["Labs", "Works", "Cloud", "Software"],
  "AI / Machine Learning": ["AI", "Labs", "Systems"],
  "FinTech": ["Pay", "Finance", "Ledger", "Capital"],
  "HealthTech": ["Health", "Care", "Clinic"],
  "ClimateTech": ["Energy", "Grid", "Carbon"],
  "Consumer": ["Studio", "Labs", "Goods"],
  "Marketplace": ["Market", "Exchange", "Trade"],
  "DeepTech": ["Systems", "Labs", "Dynamics"],
  "Cybersecurity": ["Security", "Shield", "Defense"],
  "EdTech": ["Learning", "Academy", "Skills"],
  "Enterprise Software": ["Systems", "Works", "Software"],
  "PropTech": ["Property", "Realty", "Estates"],
  "Logistics": ["Logistics", "Freight", "Route"],
  "Energy": ["Energy", "Grid", "Power"],
  "Media": ["Media", "Studio", "Press"],
  "Web3": ["Protocol", "Labs", "Chain"],
  "Other": ["Labs", "Works", "Group"],
};
const ONE_LINERS = {
  SaaS: "The revenue workspace for operations teams that have outgrown spreadsheets",
  "AI / Machine Learning": "Applied AI that turns unstructured documents into decisions",
  FinTech: "Infrastructure that makes cross-border payments settle in minutes",
  HealthTech: "A care coordination layer for clinics running on paper",
  ClimateTech: "Energy intelligence for buildings that waste 30% of what they buy",
  Consumer: "A daily habit product for people who want their time back",
  Marketplace: "The trusted marketplace for specialist B2B services",
  DeepTech: "A sensing platform that makes industrial inspection autonomous",
  Cybersecurity: "Continuous access review for teams that ship every day",
  EdTech: "Practice-based learning that proves competence, not attendance",
  "Enterprise Software": "The system of record for a workflow nobody wanted to own",
  PropTech: "Operations software for independent property managers",
  Logistics: "Routing software for fleets too small for enterprise tools",
  Energy: "Grid-aware scheduling for commercial energy storage",
  Media: "A publishing engine for niche expert communities",
  Web3: "Settlement infrastructure for programmable payouts",
  Other: "Software that makes a stubborn operational problem tractable",
};

function makeFounder(i) {
  const [industry, , sector] = pick(INDUSTRIES);
  const stage = weighted([["Pre-Seed", 44], ["Seed", 42], ["Series A", 14]]);
  const geo = weightedGeo();
  const city = pick(geo.cities);
  const { first, last } = pickPerson(geo.country);
  const founder = `${first} ${last}`;
  const company = `${pick(FIRM_A)} ${pick(SUFFIX_BY_INDUSTRY[industry] || COMPANY_SUFFIX)}`;
  const slug = slugify(company);
  const oneLiner = ONE_LINERS[industry] || ONE_LINERS.Other;

  const mrr =
    stage === "Pre-Seed"
      ? chance(0.45) ? 0 : round(between(2_000, 25_000), 100)
      : stage === "Seed"
        ? round(between(8_000, 80_000), 100)
        : round(between(40_000, 220_000), 100);
  const customers = mrr === 0 ? int(0, 20) : Math.max(3, Math.round(mrr / between(300, 1500)));
  const growth = mrr === 0 ? null : `${int(4, 28)}% MoM`;
  const funding =
    stage === "Pre-Seed" ? round(between(250_000, 1_200_000), 50_000)
      : stage === "Seed" ? round(between(1_000_000, 4_500_000), 100_000)
        : round(between(4_000_000, 12_000_000), 250_000);
  const readiness = Math.min(
    95,
    Math.round(
      30 +
      (mrr > 0 ? 18 : 0) +
      (customers > 10 ? 12 : 0) +
      (chance(0.7) ? 8 : 0) +
      int(0, 25)
    )
  );

  return {
    id: uuidFrom(`founder:${i}`),
    demo_batch: BATCH,
    company_name: company,
    website_url: `https://${slug}.example`,
    industry,
    sub_industry: sector,
    business_model: pick(BUSINESS_MODELS),
    company_stage: stage,
    country: geo.country,
    city,
    one_liner: oneLiner,
    description: `${company} is building ${oneLiner.toLowerCase()}. The team is ${chance(0.5) ? "two technical founders" : "a small product-led team"} based in ${city}, working with ${pick(["design partners", "early customers", "pilot accounts", "a handful of committed users"])} to prove the workflow before scaling.`,
    differentiator: pick([
      "Incumbent tools require a six-week implementation; this deploys in a day.",
      "The data model is built for the operator, not the analyst.",
      "Pricing is tied to outcomes, so small teams can start without procurement.",
      "The product works offline-first, which matters in the markets incumbents ignore.",
      "Integrations are native, so no data engineering is required to adopt it.",
    ]),
    target_customer: pick([
      "Operations leads at 20–200 person companies",
      "Independent clinics with 2–10 practitioners",
      "Finance teams still closing the month in spreadsheets",
      "Facilities managers running 10–100 sites",
      "Developer teams shipping to regulated environments",
    ]),
    currently_raising: true,
    funding_amount: funding,
    round_type: stage === "Pre-Seed" ? "Pre-Seed" : stage === "Seed" ? "Seed" : "Series A",
    target_geographies: pickMany(GEOGRAPHIES.map((g) => g.country), 1, 3),
    has_pitch_deck: chance(0.68),
    mrr,
    arr: mrr * 12,
    customer_count: customers,
    growth_rate: growth,
    employee_count: int(2, 45),
    founded_year: int(2019, 2025),
    milestones: pickMany(
      [
        "Public beta launched",
        "First 10 paying customers",
        "Design partner signed",
        "SOC 2 Type I in progress",
        "Seed extension closed",
        "Reached $10k MRR",
        "Hired first engineer",
      ],
      1,
      3
    ),
    readiness_score: readiness,
    founder_name: founder,
    founder_title: chance(0.8) ? "Founder & CEO" : "Co-founder",
    founder_email: `${first}.${last}`.toLowerCase().replace(/[^a-z.]/g, "") + "@founders.demo.capitalos.example",
    founder_linkedin_url: `https://demo.capitalos.example/linkedin/${slugify(founder)}`,
    is_synthetic: true,
  };
}

// A founder profile doubles as a waitlist entry: same person, same email
// domain. is_synthetic + demo_batch keep it out of every traction count.
function makeWaitlistRow(founder) {
  return {
    email: founder.founder_email,
    name: founder.founder_name,
    source: "demo_synthetic",
    status: "pending",
    founding_member: false,
    referral_code: `demo-${founder.id.slice(0, 8)}`,
    metadata: {
      demo_batch: BATCH,
      is_synthetic: true,
      company: founder.company_name,
      stage: founder.company_stage,
      country: founder.country,
      readiness: founder.readiness_score,
    },
    is_synthetic: true,
    demo_batch: BATCH,
    created_at: new Date(Date.now() - int(1, 120) * 86_400_000),
  };
}

// ---------------------------------------------------------------------------
// Persistence
// ---------------------------------------------------------------------------
function insertSql(table, rows) {
  const cols = Object.keys(rows[0]);
  const values = [];
  const tuples = rows.map((row, ri) => {
    const placeholders = cols.map((col, ci) => {
      values.push(row[col]);
      return `$${ri * cols.length + ci + 1}`;
    });
    return `(${placeholders.join(",")})`;
  });
  // Idempotent by primary key so a dropped connection can be retried safely.
  return {
    text: `insert into ${table} (${cols.join(",")}) values ${tuples.join(",")} on conflict (id) do nothing`,
    values,
  };
}

async function connectWithRetry(url) {
  let lastErr;
  for (let attempt = 1; attempt <= 4; attempt++) {
    const client = new pg.Client({
      connectionString: url,
      ssl: { rejectUnauthorized: false },
      statement_timeout: 0,
      connectionTimeoutMillis: 20000,
    });
    // pg emits 'error' on the client when the pooler drops an idle socket.
    // Without a listener that is an uncaught exception and the whole load dies.
    client.on("error", (err) => {
      console.log(`\n  socket error (will retry): ${err.message.slice(0, 80)}`);
    });
    try {
      await client.connect();
      return client;
    } catch (err) {
      lastErr = err;
      await client.end().catch(() => {});
      console.log(`connect attempt ${attempt} failed: ${err.message}`);
      await new Promise((r) => setTimeout(r, 1500 * attempt));
    }
  }
  throw lastErr;
}

async function main() {
  console.log(`batch ${BATCH} | firms ${N_FIRMS} | investors ${N_INVESTORS} | founders ${N_FOUNDERS} | seed ${SEED}`);

  const firms = Array.from({ length: N_FIRMS }, (_, i) => makeFirm(i));
  const investors = Array.from({ length: N_INVESTORS }, (_, i) => makeInvestor(i, firms));
  const founders = Array.from({ length: N_FOUNDERS }, (_, i) => makeFounder(i));
  const waitlistRows = WAITLIST ? founders.map(makeWaitlistRow) : [];

  // Emails must be unique per record; collisions would read as duplicates.
  const seenEmails = new Set();
  for (const inv of investors) {
    if (!inv.email) continue;
    let email = inv.email;
    let n = 2;
    while (seenEmails.has(email)) {
      email = inv.email.replace("@", `${n}@`);
      n++;
    }
    seenEmails.add(email);
    inv.email = email;
  }

  const stats = {
    firms: firms.length,
    investors: investors.length,
    founders: founders.length,
    waitlist: waitlistRows.length,
    with_email: investors.filter((i) => i.email).length,
    with_thesis: investors.filter((i) => i.investment_thesis).length,
    with_cheque: investors.filter((i) => i.max_check_size).length,
    verified: investors.filter((i) => i.is_verified).length,
    ready: investors.filter((i) => i.outreach_readiness === "ready").length,
    stages: [...new Set(investors.flatMap((i) => i.investment_stages))].length,
    sectors: [...new Set(investors.flatMap((i) => i.investment_sectors))].length,
    countries: [...new Set(investors.map((i) => i.country))].length,
    email_domains: [...new Set(investors.filter((i) => i.email).map((i) => i.email.split("@")[1]))].slice(0, 3),
  };
  console.log("generated:", JSON.stringify(stats, null, 1));

  if (DRY_RUN) {
    console.log("dry run: nothing written");
    return;
  }

  const ref = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).host.split(".")[0];
  const url = `postgresql://postgres.${ref}:${encodeURIComponent(process.env.SUPABASE_DB_PASSWORD)}@aws-1-eu-west-1.pooler.supabase.com:5432/postgres`;

  // The Supabase pooler drops long-lived connections mid-load. Every statement
  // goes through this wrapper, which reconnects and retries. Inserts are
  // idempotent (`on conflict (id) do nothing`), so a retried chunk cannot
  // duplicate rows, and deletes are idempotent by nature.
  let client = await connectWithRetry(url);
  const run = async (text, values) => {
    for (let attempt = 1; ; attempt++) {
      try {
        return await client.query(text, values);
      } catch (err) {
        await client.end().catch(() => {});
        if (attempt >= 5) throw err;
        console.log(`\n  retry ${attempt} after: ${err.message.slice(0, 80)}`);
        client = await connectWithRetry(url);
      }
    }
  };

  try {
    // Replace the batch atomically. Investors reference firms, so they go first.
    // Deleted in slices: one 50k-row delete plus FK cascades exceeds the pooler
    // statement timeout and looks like a hang.
    const deleteBatch = async (table, label) => {
      let total = 0;
      for (;;) {
        const res = await run(
          `delete from public.${table}
           where id in (select id from public.${table} where demo_batch = $1 limit 5000)`,
          [BATCH]
        );
        total += res.rowCount;
        if (res.rowCount === 0) break;
        process.stdout.write(`\rclearing ${label}: ${total}`);
      }
      console.log(`\rcleared ${label}: ${total}    `);
      return total;
    };

    await deleteBatch("investors", "investors");
    await deleteBatch("investor_firms", "firms");
    await deleteBatch("demo_founders", "founders");

    // Firms first (FK target), then founders, then investors.
    const chunk = async (label, table, rows, size) => {
      const started = Date.now();
      for (let i = 0; i < rows.length; i += size) {
        const slice = rows.slice(i, i + size);
        const { text, values } = insertSql(table, slice);
        await run(text, values);
        if ((i / size) % 10 === 0 || i + size >= rows.length) {
          const done = Math.min(i + size, rows.length);
          process.stdout.write(`\r${label}: ${done}/${rows.length}`);
        }
      }
      console.log(`\r${label}: ${rows.length}/${rows.length} (${((Date.now() - started) / 1000).toFixed(1)}s)`);
    };

    await chunk("firms", "public.investor_firms", firms, 400);
    await chunk("founders", "public.demo_founders", founders, 400);
    await chunk("investors", "public.investors", investors, 250);

    await run("select refresh_investor_facets()");
    console.log("facet rollup refreshed");

    const check = await run(
      `select
         (select count(*) from public.investors where demo_batch = $1)::int as investors,
         (select count(*) from public.investor_firms where demo_batch = $1)::int as firms,
         (select count(*) from public.demo_founders where demo_batch = $1)::int as founders,
         (select count(*) from public.investors)::int as investors_total`,
      [BATCH]
    );
    const got = check.rows[0];
    console.log("db now:", JSON.stringify(got));

    // A dropped connection that was not retried would leave the batch short;
    // say so loudly instead of reporting success on a partial load.
    if (
      got.investors !== investors.length ||
      got.firms !== firms.length ||
      got.founders !== founders.length
    ) {
      console.error(
        `INCOMPLETE: expected investors ${investors.length}, firms ${firms.length}, founders ${founders.length}`
      );
      process.exitCode = 1;
    }
  } catch (err) {
    console.error("\nseed failed:", err.message);
    process.exitCode = 1;
  } finally {
    await client.end().catch(() => {});
  }
}

if (CLEAR_ONLY) {
  const ref = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).host.split(".")[0];
  const url = `postgresql://postgres.${ref}:${encodeURIComponent(process.env.SUPABASE_DB_PASSWORD)}@aws-1-eu-west-1.pooler.supabase.com:5432/postgres`;
  const client = await connectWithRetry(url);
  const a = await client.query(`delete from public.investors where demo_batch = $1`, [BATCH]);
  const b = await client.query(`delete from public.investor_firms where demo_batch = $1`, [BATCH]);
  const c = await client.query(`delete from public.demo_founders where demo_batch = $1`, [BATCH]);
  await client.query("select refresh_investor_facets()");
  console.log(`cleared ${BATCH}: investors ${a.rowCount}, firms ${b.rowCount}, founders ${c.rowCount}`);
  await client.end();
} else {
  await main();
}
