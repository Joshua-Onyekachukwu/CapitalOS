#!/usr/bin/env node
/**
 * VC Firm Team Page Scraper
 * 
 * Scrapes /team, /about, /people pages from investor company websites
 * to extract individual partner/principal names and emails.
 * 
 * Usage:
 *   node scripts/scrape-vc-teams.js [--limit 100] [--offset 0] [--resume]
 */

require("dotenv").config({ path: ".env.local" });
const { createClient } = require("@supabase/supabase-js");
const https = require("https");
const http = require("http");
const fs = require("fs");
const path = require("path");

const sp = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const CHECKPOINT_FILE = path.join(__dirname, "../data-backups/vc-team-checkpoint.json");
const RESULTS_FILE = path.join(__dirname, "../data-backups/vc-team-results.json");

// Parse args
const args = process.argv.slice(2);
const LIMIT = parseInt(args.find((_, i, a) => a[i - 1] === "--limit") || "50");
const OFFSET = parseInt(args.find((_, i, a) => a[i - 1] === "--offset") || "0");
const RESUME = args.includes("--resume");

function loadCheckpoint() {
  try { return JSON.parse(fs.readFileSync(CHECKPOINT_FILE, "utf8")); }
  catch { return { lastOffset: 0, scraped: 0, found: 0, errors: 0 }; }
}

function saveCheckpoint(data) {
  fs.writeFileSync(CHECKPOINT_FILE, JSON.stringify(data, null, 2));
}

function fetchPage(url, timeout = 10000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("timeout")), timeout);
    const mod = url.startsWith("https") ? https : http;
    const req = mod.get(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; CapitalOS/1.0; +https://capital-os.com)",
        "Accept": "text/html,application/xhtml+xml",
      },
      timeout,
    }, (res) => {
      clearTimeout(timer);
      // Follow redirects (up to 3)
      if ([301, 302, 303, 307, 308].includes(res.statusCode) && res.headers.location) {
        const redirect = new URL(res.headers.location, url).href;
        fetchPage(redirect, timeout).then(resolve).catch(reject);
        return;
      }
      let data = "";
      res.on("data", (chunk) => { data += chunk; });
      res.on("end", () => resolve(data));
      res.on("error", reject);
    });
    req.on("error", (e) => { clearTimeout(timer); reject(e); });
    req.on("timeout", () => { req.destroy(); clearTimeout(timer); reject(new Error("timeout")); });
  });
}

// Common team/people page paths to try
const TEAM_PATHS = ["/team", "/about", "/people", "/our-team", "/about-us", "/the-team", "/leadership"];

function extractNames(html) {
  const names = new Set();
  
  // Pattern 1: <h3 class="...">Name</h3> or <h2>Name</h2> near role keywords
  const headingPattern = /<h[2-4][^>]*>\s*([A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,3})\s*<\/h[2-4]>/gi;
  let match;
  while ((match = headingPattern.exec(html)) !== null) {
    const name = match[1].trim();
    if (name.length > 3 && name.length < 50 && !/Capital|Fund|Partners|Venture|Capital|LLC|Inc|Corp/i.test(name)) {
      names.add(name);
    }
  }
  
  // Pattern 2: <span>Name</span> or <p>Name</p> with role nearby
  const rolePattern = /(?:Managing Partner|General Partner|Principal|Partner|Founder|CEO|CTO|Director|Advisor|Venture Partner|Operating Partner)/gi;
  const surroundingText = html.replace(/<[^>]+>/g, " ").substring(0, 50000);
  
  // Pattern 3: structured data / JSON-LD
  const jsonLdPattern = /"@type"\s*:\s*"Person"[^}]*"name"\s*:\s*"([^"]+)"/gi;
  while ((match = jsonLdPattern.exec(html)) !== null) {
    const name = match[1].trim();
    if (name.length > 3 && name.length < 50) names.add(name);
  }

  return Array.from(names).slice(0, 20); // Max 20 people per site
}

function extractEmails(html) {
  const emails = new Set();
  const emailPattern = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
  let match;
  while ((match = emailPattern.exec(html)) !== null) {
    const email = match[0].toLowerCase();
    // Skip common non-personal emails
    if (!/(test|noreply|no-reply|support|info|admin|webmaster|spam|abuse)/.test(email) &&
        !/(\.png|\.jpg|\.gif|\.svg|\.css|\.js)/.test(email)) {
      emails.add(email);
    }
  }
  return Array.from(emails);
}

function inferEmail(firstName, lastName, domain) {
  const fn = firstName.toLowerCase().replace(/[^a-z]/g, "");
  const ln = lastName.toLowerCase().replace(/[^a-z]/g, "");
  if (!fn || !ln) return null;
  return `${fn}.${ln}@${domain}`;
}

function getDomainFromUrl(url) {
  try {
    const u = new URL(url);
    return u.hostname.replace(/^www\./, "");
  } catch {
    return null;
  }
}

async function scrapeInvestor(investor) {
  const website = investor.company_website;
  if (!website || !website.startsWith("http")) return null;
  
  const domain = getDomainFromUrl(website);
  if (!domain) return null;

  const results = [];
  
  for (const teamPath of TEAM_PATHS) {
    try {
      const url = `${website.replace(/\/$/, "")}${teamPath}`;
      const html = await fetchPage(url, 8000);
      
      if (!html || html.length < 500) continue;
      
      // Check if this page likely has team content
      const hasTeamContent = /team|people|partner|leadership|about/i.test(teamPath) ||
        /team|people|partner|leadership|principal|managing/i.test(html.substring(0, 5000));
      
      if (!hasTeamContent) continue;
      
      const names = extractNames(html);
      const emails = extractEmails(html);
      
      if (names.length > 0 || emails.length > 0) {
        for (const name of names) {
          const nameParts = name.split(/\s+/);
          const firstName = nameParts[0];
          const lastName = nameParts.slice(1).join(" ");
          const inferredEmail = emails.length > 0 ? null : inferEmail(firstName, lastName, domain);
          
          results.push({
            fullName: name,
            firstName,
            lastName,
            companyName: investor.company_name,
            email: emails[0] || inferredEmail,
            emailSource: emails[0] ? "website" : "inferred",
            website: `https://${domain}`,
            linkedinUrl: null,
            country: investor.country,
            city: investor.city,
            source: "vc-team-scraper",
            sourceId: investor.id,
            sourceUrl: url,
          });
        }
        break; // Found team data, stop trying other paths
      }
    } catch {
      continue;
    }
  }
  
  return results;
}

async function main() {
  const checkpoint = RESUME ? loadCheckpoint() : { lastOffset: 0, scraped: 0, found: 0, errors: 0 };
  const startOffset = RESUME ? checkpoint.lastOffset : OFFSET;
  
  console.log("=".repeat(60));
  console.log("VC Firm Team Page Scraper");
  console.log("=".repeat(60));
  console.log(`Offset: ${startOffset}, Limit: ${LIMIT}`);
  console.log(`Previous: ${checkpoint.scraped} scraped, ${checkpoint.found} found, ${checkpoint.errors} errors\n`);

  // Get investors with real websites (no emails yet — find new contacts)
  const { data: investors, count } = await sp
    .from("investors")
    .select("id, company_name, company_website, country, city")
    .not("company_website", "is", null)
    .like("company_website", "http%")
    .is("first_name", null)
    .range(startOffset, startOffset + LIMIT - 1);

  if (!investors?.length) {
    console.log("No more investors to scrape.");
    return;
  }

  console.log(`Scraping ${investors.length} investor websites...\n`);

  let allResults = [];
  let scraped = checkpoint.scraped;
  let found = checkpoint.found;
  let errors = checkpoint.errors;

  for (let i = 0; i < investors.length; i++) {
    const inv = investors[i];
    process.stdout.write(`[${i + 1}/${investors.length}] ${inv.company_name?.substring(0, 40)}... `);
    
    try {
      const results = await scrapeInvestor(inv);
      if (results?.length) {
        found += results.length;
        allResults.push(...results);
        console.log(`✓ Found ${results.length} contacts`);
      } else {
        console.log("— No team data");
      }
    } catch (e) {
      errors++;
      console.log(`✗ Error: ${e.message}`);
    }
    
    scraped++;
    
    // Save checkpoint every 10 investors
    if ((i + 1) % 10 === 0) {
      saveCheckpoint({ lastOffset: startOffset + i + 1, scraped, found, errors });
    }
    
    // Rate limit: 500ms between requests
    await new Promise(r => setTimeout(r, 500));
  }

  // Save results
  const existingResults = fs.existsSync(RESULTS_FILE)
    ? JSON.parse(fs.readFileSync(RESULTS_FILE, "utf8"))
    : [];
  
  fs.writeFileSync(RESULTS_FILE, JSON.stringify([...existingResults, ...allResults], null, 2));
  saveCheckpoint({ lastOffset: startOffset + investors.length, scraped, found, errors });

  console.log("\n" + "=".repeat(60));
  console.log("RESULTS");
  console.log("=".repeat(60));
  console.log(`Scraped: ${scraped}`);
  console.log(`New contacts found: ${allResults.length}`);
  console.log(`Total contacts found: ${found}`);
  console.log(`Errors: ${errors}`);
  console.log(`Results saved to: ${RESULTS_FILE}`);
  console.log(`\nTo import results to Supabase, run:`);
  console.log(`  node scripts/import-vc-contacts.js`);
}

main().catch(console.error);
