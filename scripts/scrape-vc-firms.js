#!/usr/bin/env node
// EDGAR XBRL Scraper — Extract real firm websites from SEC 13F-HR filings
// Each 13F-HR filing has a company URL in the filing header

require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const https = require('https');
const http = require('http');

const sp = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

function fetchUrl(url, maxRedirects = 3) {
  return new Promise((resolve, reject) => {
    const mod = url.startsWith('https') ? https : http;
    const req = mod.get(url, {
      headers: {
        'User-Agent': 'CapitalOS Research Admin@capital-os-nine.vercel.app',
        'Accept': 'text/html,application/xhtml+xml',
      },
      timeout: 10000,
    }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location && maxRedirects > 0) {
        const next = res.headers.location.startsWith('http') ? res.headers.location : new URL(res.headers.location, url).href;
        resolve(fetchUrl(next, maxRedirects - 1));
        return;
      }
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve({ status: res.statusCode, body: data }));
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('timeout')); });
  });
}

async function extractTeamFromPage(url) {
  try {
    const { body } = await fetchUrl(url);
    // Look for common team/people/about page links
    const teamLinks = [];
    const linkRegex = /href=["']([^"']*(?:team|people|about|leadership|our-team|staff|partners|founding|management)[^"']*)/gi;
    let m;
    while ((m = linkRegex.exec(body)) !== null) {
      let href = m[1];
      if (href.startsWith('/')) {
        href = url.replace(/\/$/, '') + href;
      }
      if (href.startsWith('http')) teamLinks.push(href);
    }

    // Extract person names from the page itself (looking for heading patterns)
    const names = [];
    // Common patterns: <h3>John Smith</h3>, <h4 class="person">Jane Doe</h4>
    const nameRegex = /<(?:h[2-5]|span|p|div)[^>]*class=["'][^"']*(?:person|team|founder|partner|principal|associate|analyst|advisor|member|bio)[^"']*["'][^>]*>\s*([A-Z][a-z]+ [A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/gi;
    while ((m = nameRegex.exec(body)) !== null) {
      names.push(m[1].trim());
    }

    // Also look for email patterns
    const emails = [];
    const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
    while ((m = emailRegex.exec(body)) !== null) {
      const email = m[0].toLowerCase();
      if (!email.includes('example') && !email.includes('sentry') && !email.includes('wix')) {
        emails.push(email);
      }
    }

    return { teamLinks: [...new Set(teamLinks)].slice(0, 5), names: [...new Set(names)].slice(0, 20), emails: [...new Set(emails)].slice(0, 10) };
  } catch (e) {
    return { teamLinks: [], names: [], emails: [], error: e.message };
  }
}

const BATCH = 50; // process 50 at a time

(async () => {
  console.log(`\n🌐 EDGAR Team Page Scraper\n`);

  // Get investors with real websites (not GTM URLs)
  const { data: investors, error } = await sp
    .from('investors')
    .select('id, company_name, company_website, source')
    .not('company_website', 'is', null)
    .neq('company_website', '')
    .not('company_website', 'like', '%googletagmanager%')
    .not('company_website', 'like', '%null%')
    .not('company_website', 'like', '%undefined%')
    .range(0, BATCH - 1);

  if (error) {
    console.error('Error:', error.message);
    return;
  }

  console.log(`   Found ${investors.length} investors with real websites (sample of first ${BATCH})`);

  let totalTeamsFound = 0;
  let totalEmailsFound = 0;
  let totalNamesFound = 0;

  for (const inv of investors) {
    const url = inv.company_website;
    console.log(`\n   🔍 ${inv.company_name} → ${url}`);

    const result = await extractTeamFromPage(url);

    if (result.teamLinks.length > 0) {
      console.log(`      Team pages: ${result.teamLinks.length}`);
      // Scrape each team page
      for (const teamUrl of result.teamLinks.slice(0, 2)) {
        await new Promise(r => setTimeout(r, 500)); // Rate limit
        const teamResult = await extractTeamFromPage(teamUrl);
        result.names.push(...teamResult.names);
        result.emails.push(...teamResult.emails);
      }
    }

    if (result.names.length > 0) {
      console.log(`      Names: ${result.names.join(', ')}`);
      totalNamesFound += result.names.length;
    }
    if (result.emails.length > 0) {
      console.log(`      Emails: ${result.emails.join(', ')}`);
      totalEmailsFound += result.emails.length;
    }

    if (result.names.length > 0 || result.emails.length > 0) {
      totalTeamsFound++;
    }

    await new Promise(r => setTimeout(r, 800)); // Rate limit between firms
  }

  console.log(`\n📊 Results`);
  console.log(`   Firms scraped: ${investors.length}`);
  console.log(`   Firms with team data: ${totalTeamsFound}`);
  console.log(`   Individual names found: ${totalNamesFound}`);
  console.log(`   Emails found: ${totalEmailsFound}`);
})().catch(e => console.error('Fatal:', e));
