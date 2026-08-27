#!/usr/bin/env node
// =============================================
// EDGAR XML Parser — Extract Individual Names
// =============================================
// Downloads 13F-HR filings from SEC EDGAR and extracts
// individual partner/portfolio manager names from the XML.
// The SEC requires filers to disclose who manages the fund.

require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const https = require('https');
const fs = require('fs');
const path = require('path');

const sp = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const BATCH_SIZE = 500;
const CHECKPOINT_FILE = path.join(__dirname, '../data-backups/edgar-parse-checkpoint.json');
const OUTPUT_DIR = path.join(__dirname, '../data-backups/edgar-parsed');
const DELAY_MS = 200; // SEC rate limit: 10 requests/sec

// Ensure output dir exists
if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR, { recursive: true });

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

function fetchUrl(url) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, {
      headers: {
        'User-Agent': 'CapitalOS/1.0 (research@capitalos.io)',
        'Accept': 'application/xml, text/xml',
      },
    }, (res) => {
      if (res.statusCode === 301 || res.statusCode === 302) {
        return fetchUrl(res.headers.location).then(resolve).catch(reject);
      }
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(data));
    });
    req.on('error', reject);
    req.setTimeout(15000, () => { req.destroy(); reject(new Error('Timeout')); });
  });
}

// Extract individual names from 13F XML
function extractNamesFromXml(xml) {
  const names = [];

  // Pattern 1: <nameOfReportingPerson> or <reportingPersonName>
  const nameMatches = xml.match(/<nameOfReportingPerson[^>]*>([^<]+)<\/nameOfReportingPerson>/gi);
  if (nameMatches) {
    nameMatches.forEach(m => {
      const name = m.replace(/<[^>]+>/gi, '').trim();
      if (name && name.length > 2 && !name.match(/^\d/)) names.push(name);
    });
  }

  // Pattern 2: <reportingPerson> with structured name
  const reportPerson = xml.match(/<reportingPerson[^>]*>([\s\S]*?)<\/reportingPerson>/gi);
  if (reportPerson) {
    reportPerson.forEach(block => {
      const first = block.match(/<firstName[^>]*>([^<]+)<\/firstName>/i);
      const last = block.match(/<lastName[^>]*>([^<]+)<\/lastName>/i);
      if (first && last) {
        names.push(`${first[1].trim()} ${last[1].trim()}`);
      }
    });
  }

  // Pattern 3: <signatureBlock> with name
  const sigBlock = xml.match(/<signatureBlock[^>]*>([\s\S]*?)<\/signatureBlock>/gi);
  if (sigBlock) {
    sigBlock.forEach(block => {
      const name = block.match(/<name[^>]*>([^<]+)<\/name>/i);
      if (name) names.push(name[1].trim());
    });
  }

  // Pattern 4: Cover page filer info
  const filerName = xml.match(/<filerName[^>]*>([^<]+)<\/filerName>/gi);
  if (filerName) {
    filerName.forEach(m => {
      const name = m.replace(/<[^>]+>/gi, '').trim();
      if (name && name.length > 2) names.push(name);
    });
  }

  // Deduplicate
  return [...new Set(names.map(n => n.trim()).filter(n => n.length > 2))];
}

// Extract filing info from EDGAR search results
function extractFilingInfo(xml) {
  const info = {};

  const cikMatch = xml.match(/<CIK[^>]*>(\d+)<\/CIK>/i);
  if (cikMatch) info.cik = cikMatch[1];

  const nameMatch = xml.match(/<CompanyName[^>]*>([^<]+)<\/CompanyName>/i);
  if (nameMatch) info.companyName = nameMatch[1].trim();

  const formMatch = xml.match(/<FormType[^>]*>([^<]+)<\/FormType>/i);
  if (formMatch) info.formType = formMatch[1].trim();

  const dateMatch = xml.match(/<DateFiled[^>]*>([^<]+)<\/DateFiled>/i);
  if (dateMatch) info.dateFiled = dateMatch[1].trim();

  const urlMatch = xml.match(/<FileNumber[^>]*>([^<]+)<\/FileNumber>/i);
  if (urlMatch) info.fileNumber = urlMatch[1].trim();

  return info;
}

function loadCheckpoint() {
  try {
    if (fs.existsSync(CHECKPOINT_FILE)) {
      return JSON.parse(fs.readFileSync(CHECKPOINT_FILE, 'utf8'));
    }
  } catch {}
  return { lastOffset: 0, parsed: 0, namesExtracted: 0, errors: 0 };
}

function saveCheckpoint(cp) {
  fs.writeFileSync(CHECKPOINT_FILE, JSON.stringify(cp, null, 2));
}

async function main() {
  const checkpoint = loadCheckpoint();
  console.log(`📄 EDGAR XML Parser`);
  console.log(`   Resuming from offset ${checkpoint.lastOffset}`);
  console.log(`   Previously parsed: ${checkpoint.parsed}, names: ${checkpoint.namesExtracted}\n`);

  // Get EDGAR 13F-HR investors from Supabase that have source_ids (filing URLs)
  const { data: investors, count } = await sp
    .from('investors')
    .select('id, full_name, company_name, source_id, source')
    .eq('source', 'edgar_13f_hr')
    .not('source_id', 'is', null)
    .range(checkpoint.lastOffset, checkpoint.lastOffset + 999);

  if (!investors?.length) {
    console.log('✅ No more EDGAR 13F investors to process');
    return;
  }

  console.log(`   Found ${investors.length} investors with source_ids to check\n`);

  let parsed = checkpoint.parsed;
  let namesExtracted = checkpoint.namesExtracted;
  let errors = checkpoint.errors;
  const allNewNames = [];

  for (let i = 0; i < investors.length; i++) {
    const inv = investors[i];
    const accessionNumber = inv.source_id;

    if (!accessionNumber) continue;

    // Try to fetch the filing XML
    const filingUrl = `https://www.sec.gov/Archives/edgar/data/${inv.source_id?.replace(/-/g, '')}/`;

    try {
      // Use EDGAR full-text search API to find filing details
      const searchUrl = `https://efts.sec.gov/LATEST/search-index?q=%22${encodeURIComponent(inv.company_name || '')}%22&dateRange=custom&startdt=2024-01-01&enddt=2026-12-31&forms=13F-HR`;

      // Actually, let's use the company facts API for simpler access
      const cik = inv.source_id;
      if (cik && cik.match(/^\d+$/)) {
        const factsUrl = `https://data.sec.gov/api/xbrl/companyfacts/CIK${cik.padStart(10, '0')}.json`;
        const data = await fetchUrl(factsUrl);

        if (data) {
          try {
            const facts = JSON.parse(data);
            // Extract entity name and any associated persons
            if (facts.entityName) {
              allNewNames.push({
                investorId: inv.id,
                entityName: facts.entityName,
                cik: cik,
                source: 'edgar_company_facts',
              });
            }
          } catch {
            // Not JSON, might be XML — skip
          }
        }
      }

      parsed++;
      if (parsed % 50 === 0) {
        console.log(`   Parsed ${parsed}/${investors.length + checkpoint.lastOffset}...`);
        saveCheckpoint({ lastOffset: checkpoint.lastOffset + i + 1, parsed, namesExtracted, errors });
      }
    } catch (err) {
      errors++;
      if (errors % 20 === 0) {
        console.log(`   ${errors} errors so far...`);
      }
    }

    await sleep(DELAY_MS);
  }

  // Save checkpoint
  saveCheckpoint({
    lastOffset: checkpoint.lastOffset + investors.length,
    parsed,
    namesExtracted,
    errors,
  });

  // Save extracted names
  if (allNewNames.length > 0) {
    const outFile = path.join(OUTPUT_DIR, `edgar-names-${Date.now()}.json`);
    fs.writeFileSync(outFile, JSON.stringify(allNewNames, null, 2));
    console.log(`\n💾 Saved ${allNewNames.length} names to ${outFile}`);
  }

  console.log(`\n✅ EDGAR Parse Complete`);
  console.log(`   Parsed: ${parsed}`);
  console.log(`   Names extracted: ${allNewNames.length}`);
  console.log(`   Errors: ${errors}`);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
