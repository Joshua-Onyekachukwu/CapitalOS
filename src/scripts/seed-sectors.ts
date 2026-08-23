import { query, closePool } from "./db";

const sectors = [
  { name: "Artificial Intelligence", slug: "ai" },
  { name: "AI Infrastructure", slug: "ai-infrastructure" },
  { name: "Machine Learning", slug: "ml" },
  { name: "Developer Tools", slug: "devtools" },
  { name: "FinTech", slug: "fintech" },
  { name: "HealthTech", slug: "healthtech" },
  { name: "ClimateTech", slug: "climatetech" },
  { name: "CleanTech", slug: "cleantech" },
  { name: "EdTech", slug: "edtech" },
  { name: "Cybersecurity", slug: "cybersecurity" },
  { name: "SaaS", slug: "saas" },
  { name: "Enterprise Software", slug: "enterprise" },
  { name: "Consumer", slug: "consumer" },
  { name: "Marketplace", slug: "marketplace" },
  { name: "DeepTech", slug: "deeptech" },
  { name: "Robotics", slug: "robotics" },
  { name: "SpaceTech", slug: "spacetech" },
  { name: "PropTech", slug: "proptech" },
  { name: "AgriTech", slug: "agritech" },
  { name: "Logistics", slug: "logistics" },
  { name: "Mobility", slug: "mobility" },
  { name: "Energy", slug: "energy" },
  { name: "Media", slug: "media" },
  { name: "Web3", slug: "web3" },
];

async function main() {
  console.log("🌱 Seeding investor sectors...\n");

  let inserted = 0;
  for (const sector of sectors) {
    try {
      await query(
        `INSERT INTO investor_sectors (name, slug) VALUES ($1, $2) ON CONFLICT (name) DO NOTHING`,
        [sector.name, sector.slug]
      );
      inserted++;
      console.log(`   - ${sector.name} (${sector.slug})`);
    } catch (err: any) {
      console.error(`   ❌ ${sector.name}: ${err.message}`);
    }
  }

  console.log(`\n✅ ${inserted} sectors seeded successfully`);
  await closePool();
}

main();
