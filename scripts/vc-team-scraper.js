#!/usr/bin/env node
/**
 * VC Firm Team Page Scraper
 * 
 * Scrapes /team, /about, /people pages from VC firm websites
 * to extract individual partner names, titles, and emails.
 * 
 * Usage: node scripts/vc-team-scraper.js [--limit 100] [--dry-run]
 */

const fs = require("fs");
const path = require("path");
const https = require("https");
const http = require("http");

const DATA_DIR = path.join(__dirname, "..", "data-backups");
const OUTPUT_FILE = path.join(DATA_DIR, "vc-team-members.json");
const RATE_LIMIT_MS = 500; // Be polite

const TEAM_PATHS = ["/team", "/about", "/people", "/our-team", "/about-us", "/leadership", "/partners", "/staff"];

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function fetchUrl(url, timeout = 10000) {
  return new Promise((resolve, reject) => {
    const mod = url.startsWith("https") ? https : http;
    const req = mod.get(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; CapitalOS/1.0)",
        "Accept": "text/html,application/xhtml+xml",
      },
      timeout,
    }, (res) => {
      if (res.statusCode === 301 || res.statusCode === 302) {
        fetchUrl(res.headers.location, timeout).then(resolve).catch(reject);
        return;
      }
      if (res.statusCode !== 200) {
        reject(new Error(`HTTP ${res.statusCode}`));
        return;
      }
      let data = "";
      res.on("data", (chunk) => { data += chunk; if (data.length > 500000) res.destroy(); });
      res.on("end", () => resolve(data));
      res.on("error", reject);
    });
    req.on("error", reject);
    req.on("timeout", () => { req.destroy(); reject(new Error("timeout")); });
  });
}

function extractPeopleFromHtml(html, firmName) {
  const people = [];
  
  // Pattern 1: Look for team member cards with name + title
  // Common patterns: <h3 class="...">Name</h3> + <p class="...">Title</p>
  const cardPatterns = [
    /<h[2-4][^>]*>([^<]{2,50})<\/h[2-4]>\s*(?:<[^>]*>)*\s*<(?:p|span|div)[^>]*>(?:Partner|Principal|Managing|Senior|General|Founding|Venture|Associate|Analyst|Director|CEO|CTO|CFO|COO|VP|Head of|Founder)[^<]*/gi,
    /<div[^>]*class="[^"]*(?:team|member|person|staff|bio|profile)[^"]*"[^>]*>[\s\S]*?<h[2-5][^>]*>([^<]{2,50})<\/h[2-5]>/gi,
    /<(?:strong|b)[^>]*>([A-Z][a-z]+ [A-Z][a-z]+(?:\s[A-Z][a-z]+)?)<\/(?:strong|b)>/g,
  ];

  // Extract email addresses
  const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
  const emails = [...new Set(html.match(emailRegex) || [])];
  
  // Filter out common non-personal emails
  const filteredEmails = emails.filter(e => 
    !e.includes("example.com") && 
    !e.includes("test.com") && 
    !e.includes("sentry.io") &&
    !e.includes("wixpress.com") &&
    !e.includes("schema.org")
  );

  // Extract names from structured data
  const namePatterns = [
    /<h[2-4][^>]*class="[^"]*(?:name|title|heading)[^"]*"[^>]*>([A-Z][a-z]+ [A-Z][a-z]+(?:\s[A-Z][a-z]+)?)<\/h[2-4]>/gi,
    /<span[^>]*class="[^"]*(?:name|team-name|member-name)[^"]*"[^>]*>([A-Z][a-z]+ [A-Z][a-z]+(?:\s[A-Z][a-z]+)?)<\/span>/gi,
    /class="[^"]*(?:team|member|person)[^"]*"[^>]*>[\s\S]*?<(?:h[2-5]|strong|b)[^>]*>([A-Z][a-z]+ [A-Z][a-z]+(?:\s[A-Z][a-z]+)?)<\/(?:h[2-5]|strong|b)>/gi,
  ];

  const foundNames = new Set();
  
  for (const pattern of namePatterns) {
    const matches = html.matchAll(pattern);
    for (const match of matches) {
      const name = match[1].trim();
      // Validate it looks like a real name
      if (name.length >= 4 && name.length <= 50 && 
          !name.includes("©") && !name.includes("|") &&
          name.split(" ").length >= 2) {
        foundNames.add(name);
      }
    }
  }

  // Convert found names to people objects
  for (const name of foundNames) {
    const parts = name.split(" ");
    const firstName = parts[0];
    const lastName = parts.slice(1).join(" ");
    
    // Try to find an email that matches this person
    const personEmail = filteredEmails.find(e => {
      const local = e.split("@")[0].toLowerCase();
      return local.includes(firstName.toLowerCase().slice(0, 3)) || 
             local.includes(lastName.toLowerCase().slice(0, 4));
    });

    people.push({
      firstName,
      lastName,
      fullName: name,
      firmName,
      email: personEmail || null,
      source: "vc_team_page",
      scrapedAt: new Date().toISOString(),
      deduplicationKey: `${firstName.toLowerCase()}.${lastName.toLowerCase()}.${firmName.toLowerCase().replace(/[^a-z]/g, "")}`,
      status: "scraped",
      dataQualityScore: personEmail ? 70 : 40,
      confidence: personEmail ? 80 : 50,
      retryCount: 0,
      emailVerified: false,
    });
  }

  return people;
}

async function main() {
  console.log("=== VC Firm Team Page Scraper ===\n");

  const args = process.argv.slice(2);
  const limit = parseInt(args.find((a, i) => args[i - 1] === "--limit") || "200");
  const dryRun = args.includes("--dry-run");

  // Load existing investors to find firms with websites
  const investorsFile = path.join(DATA_DIR, "investors-backup.json");
  let investors = [];
  if (fs.existsSync(investorsFile)) {
    investors = JSON.parse(fs.readFileSync(investorsFile, "utf-8"));
  }

  // Get unique firms with real websites
  const firmsWithWebsites = new Map();
  for (const inv of investors) {
    const website = inv.website || inv.company_url || inv.firm_website;
    if (website && website.startsWith("http") && !website.includes("null")) {
      const firmName = inv.firm_name || inv.companyName || inv.full_name;
      if (!firmsWithWebsites.has(firmName)) {
        firmsWithWebsites.set(firmName, website);
      }
    }
  }

  console.log(`Found ${firmsWithWebsites.size} firms with websites`);
  console.log(`Processing limit: ${limit}\n`);

  // Load existing team members
  let existingMembers = [];
  if (fs.existsSync(OUTPUT_FILE)) {
    existingMembers = JSON.parse(fs.readFileSync(OUTPUT_FILE, "utf-8"));
  }
  const existingKeys = new Set(existingMembers.map(m => m.deduplicationKey));
  
  const newMembers = [];
  let processed = 0;
  let errors = 0;

  for (const [firmName, website] of firmsWithWebsites.entries()) {
    if (processed >= limit) break;

    const baseUrl = website.replace(/\/+$/, "");
    
    for (const teamPath of TEAM_PATHS) {
      try {
        const url = `${baseUrl}${teamPath}`;
        const html = await fetchUrl(url);
        
        if (html.length > 1000) { // Ignore empty/redirect pages
          const people = extractPeopleFromHtml(html, firmName);
          
          for (const person of people) {
            if (!existingKeys.has(person.deduplicationKey)) {
              existingKeys.add(person.deduplicationKey);
              newMembers.push(person);
            }
          }

          if (people.length > 0) {
            console.log(`  ✓ ${firmName} (${teamPath}): found ${people.length} people`);
            break; // Found team page, no need to try other paths
          }
        }
      } catch {
        // Skip errors silently
      }
      await sleep(RATE_LIMIT_MS);
    }

    processed++;
    if (processed % 25 === 0) {
      console.log(`\nProgress: ${processed}/${Math.min(firmsWithWebsites.size, limit)} firms, ${newMembers.length} new members found\n`);
    }
  }

  // Save results
  const allMembers = [...existingMembers, ...newMembers];
  
  if (!dryRun) {
    fs.writeFileSync(OUTPUT_FILE, JSON.stringify(allMembers, null, 2));
  }

  console.log("\n=== Results ===");
  console.log(`Firms scraped: ${processed}`);
  console.log(`New team members found: ${newMembers.length}`);
  console.log(`Total team members: ${allMembers.length}`);
  console.log(`Errors: ${errors}`);

  // Summary
  const withEmail = newMembers.filter(m => m.email).length;
  console.log(`\nWith email: ${withEmail}`);
  console.log(`Without email: ${newMembers.length - withEmail}`);
}

main().catch(console.error);
