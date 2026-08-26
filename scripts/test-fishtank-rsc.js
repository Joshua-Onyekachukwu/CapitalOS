// Quick test: extract RSC data from a FishTank profile page
const https = require("https");

function fetch(url) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { "User-Agent": "CapitalOS/1.0" } }, (res) => {
      let d = "";
      res.on("data", (c) => (d += c));
      res.on("end", () => resolve(d));
    }).on("error", reject);
  });
}

async function main() {
  const html = await fetch("https://www.fishtank.vc/resources/investor-profiles/sosv");

  // Extract __next_f chunks
  const chunks = [];
  const re = /self\.__next_f\.push\(\[(\d+),"([\s\S]*?)"\]\)/g;
  let m;
  while ((m = re.exec(html)) !== null) {
    try {
      const raw = m[2]
        .replace(/\\n/g, "\n")
        .replace(/\\"/g, '"')
        .replace(/\\\\/g, "\\");
      chunks.push(raw);
    } catch {}
  }

  const data = chunks.join("");

  // Find all JSON-like objects in the RSC data
  // Look for patterns with investor info
  console.log("RSC data length:", data.length);

  // Try to find the investor data object
  const nameMatches = [...data.matchAll(/"name"\s*:\s*"([^"]+)"/g)];
  console.log("\nName fields found:", nameMatches.length);
  nameMatches.slice(0, 10).forEach((m) => console.log("  -", m[1]));

  const typeMatches = [...data.matchAll(/"(?:type|investorType|category)"\s*:\s*"([^"]+)"/g)];
  console.log("\nType fields found:", typeMatches.length);
  typeMatches.slice(0, 10).forEach((m) => console.log("  -", m[1]));

  const descMatches = [...data.matchAll(/"description"\s*:\s*"([^"]{0,150})"/g)];
  console.log("\nDescription fields found:", descMatches.length);
  descMatches.slice(0, 5).forEach((m) => console.log("  -", m[1].substring(0, 100)));

  // Look for location
  const locMatches = [...data.matchAll(/"(?:location|city|country|headquarters)"\s*:\s*"([^"]+)"/g)];
  console.log("\nLocation fields found:", locMatches.length);
  locMatches.slice(0, 10).forEach((m) => console.log("  -", m[1]));

  // Look for website/linkedin
  const linkMatches = [...data.matchAll(/"(?:website|url|linkedin|linkedInUrl)"\s*:\s*"(https?:\/\/[^"]+)"/g)];
  console.log("\nLink fields found:", linkMatches.length);
  linkMatches.slice(0, 10).forEach((m) => console.log("  -", m[1]));

  // Look for stage/sector arrays
  const stageMatches = [...data.matchAll(/"(?:stages?|investmentStages?)"\s*:\s*\[([^\]]{0,300})\]/g)];
  console.log("\nStage arrays found:", stageMatches.length);
  stageMatches.slice(0, 3).forEach((m) => console.log("  -", m[1].substring(0, 150)));

  const sectorMatches = [...data.matchAll(/"(?:sectors?|industries?|focusAreas?)"\s*:\s*\[([^\]]{0,300})\]/g)];
  console.log("\nSector arrays found:", sectorMatches.length);
  sectorMatches.slice(0, 3).forEach((m) => console.log("  -", m[1].substring(0, 150)));
}

main().catch(console.error);
