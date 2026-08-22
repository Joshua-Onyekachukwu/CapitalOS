import "./load-env";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

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

  const { data, error } = await supabase
    .from("investor_sectors")
    .upsert(sectors, { onConflict: "name" })
    .select();

  if (error) {
    console.error("❌ Error:", error.message);
    process.exit(1);
  }

  console.log(`✅ ${data?.length || 0} sectors seeded successfully\n`);
  data?.forEach((s) => console.log(`   - ${s.name} (${s.slug})`));
}

main();
