#!/usr/bin/env node
// =============================================
// Contact Enrichment Pipeline
// =============================================
// Infers emails from investor names + company domains.
// Uses common email patterns: first.last@, first@, info@, etc.
// Verifies MX records to confirm the domain accepts email.

require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const dns = require('dns').promises;
const fs = require('fs');
const path = require('path');

const sp = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const BATCH_SIZE = 200;
const CHECKPOINT_FILE = path.join(__dirname, '../data-backups/enrich-checkpoint.json');
const OUTPUT_DIR = path.join(__dirname, '../data-backups/enriched-contacts');
const MAX_ENRICH = 10000; // Process up to 10K investors per run

if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR, { recursive: true });

// Known free email providers (skip these for domain inference)
const FREE_EMAIL_PROVIDERS = new Set([
  'gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com', 'aol.com',
  'icloud.com', 'mail.com', 'protonmail.com', 'proton.me', 'zoho.com',
  'yandex.com', 'gmx.com', 'live.com', 'msn.com', 'me.com',
  'yahoo.co.uk', 'gmail.co.uk', 'hotmail.co.uk', 'outlook.co.uk',
]);

// Common email patterns for investors
const EMAIL_PATTERNS = [
  (first, last, domain) => `${first}.${last}@${domain}`,
  (first, last, domain) => `${first}${last}@${domain}`,
  (first, last, domain) => `${first[0]}${last}@${domain}`,
  (first, last, domain) => `${first}@${domain}`,
  (first, last, domain) => `info@${domain}`,
  (first, last, domain) => `contact@${domain}`,
];

function loadCheckpoint() {
  try {
    if (fs.existsSync(CHECKPOINT_FILE)) {
      return JSON.parse(fs.readFileSync(CHECKPOINT_FILE, 'utf8'));
    }
  } catch {}
  return { lastId: null, processed: 0, enriched: 0, errors: 0 };
}

function saveCheckpoint(cp) {
  fs.writeFileSync(CHECKPOINT_FILE, JSON.stringify(cp, null, 2));
}

function normalizeName(name) {
  return (name || '').toLowerCase().trim()
    .replace(/[^a-z\s]/g, '')
    .replace(/\s+/g, ' ');
}

function extractFirstLast(fullName) {
  const parts = normalizeName(fullName).split(' ').filter(Boolean);
  if (parts.length === 0) return { first: '', last: '' };
  if (parts.length === 1) return { first: parts[0], last: '' };
  return { first: parts[0], last: parts[parts.length - 1] };
}

function extractDomain(companyName, companyWebsite) {
  // Try to get domain from website URL
  if (companyWebsite && companyWebsite !== 'https://null' && !companyWebsite.includes('googletagmanager')) {
    try {
      const url = companyWebsite.startsWith('http') ? companyWebsite : `https://${companyWebsite}`;
      const hostname = new URL(url).hostname.replace(/^www\./, '');
      if (!FREE_EMAIL_PROVIDERS.has(hostname) && hostname !== 'null') return hostname;
    } catch {}
  }

  // Generate domain from company name
  if (companyName) {
    const cleaned = companyName.toLowerCase()
      .replace(/[^a-z0-9\s]/g, '')
      .replace(/\s+/g, '')
      .replace(/(inc|llc|ltd|corp|lp|vc|partners|capital|fund|ventures|advisors|holdings|group|associates|management|advisory|ventures)/g, '')
      .trim();
    if (cleaned.length > 2 && cleaned.length < 40) return `${cleaned}.com`;
  }

  return null;
}

async function checkMxDomain(domain) {
  try {
    const mxRecords = await dns.resolveMx(domain);
    return mxRecords && mxRecords.length > 0;
  } catch {
    return false;
  }
}

async function enrichInvestor(investor) {
  const { first, last } = extractFirstLast(investor.full_name);
  if (!first || !last) return null;

  const domain = extractDomain(investor.company_name, investor.company_website);
  if (!domain) return null;

  // Check if domain has MX records (skip for generated domains)
  const isRealDomain = investor.company_website &&
    investor.company_website !== 'https://null' &&
    !investor.company_website.includes('googletagmanager');

  let hasMx = false;
  if (isRealDomain) {
    hasMx = await checkMxDomain(domain);
    if (!hasMx) return null;
  }

  // Generate email candidates
  const candidates = EMAIL_PATTERNS.map(fn => fn(first, last, domain));

  // Return the most likely pattern (first.last is most common for investors)
  return {
    investorId: investor.id,
    inferredEmail: candidates[0],
    domain,
    hasMx,
    confidence: isRealDomain ? 'high' : 'medium',
    source: 'name_domain_inference',
    allCandidates: candidates,
  };
}

async function main() {
  const checkpoint = loadCheckpoint();
  console.log(`📧 Contact Enrichment Pipeline`);
  console.log(`   Resuming from ID: ${checkpoint.lastId || 'start'}`);
  console.log(`   Previously processed: ${checkpoint.processed}, enriched: ${checkpoint.enriched}\n`);

  // Get investors with company names but no emails
  let query = sp
    .from('investors')
    .select('id, full_name, company_name, company_website, email')
    .is('email', null)
    .not('company_name', 'is', null)
    .not('full_name', 'is', null)
    .order('id', { ascending: true })
    .limit(BATCH_SIZE);

  if (checkpoint.lastId) {
    query = query.gt('id', checkpoint.lastId);
  }

  const { data: investors } = await query;

  if (!investors?.length) {
    console.log('✅ No more investors to enrich');
    return;
  }

  console.log(`   Processing ${investors.length} investors...\n`);

  let processed = checkpoint.processed;
  let enriched = checkpoint.enriched;
  let errors = checkpoint.errors;
  const newEmails = [];

  for (const investor of investors) {
    try {
      const result = await enrichInvestor(investor);
      if (result) {
        newEmails.push(result);
        enriched++;
      }
      processed++;
    } catch (err) {
      errors++;
    }

    if (processed % 100 === 0) {
      console.log(`   Processed: ${processed}, Enriched: ${enriched}, Errors: ${errors}`);
      saveCheckpoint({ lastId: investor.id, processed, enriched, errors });
    }

    // Rate limit DNS lookups
    await new Promise(r => setTimeout(r, 50));
  }

  // Save final checkpoint
  saveCheckpoint({
    lastId: investors[investors.length - 1]?.id,
    processed,
    enriched,
    errors,
  });

  // Save enriched contacts
  if (newEmails.length > 0) {
    const outFile = path.join(OUTPUT_DIR, `enriched-${Date.now()}.json`);
    fs.writeFileSync(outFile, JSON.stringify(newEmails, null, 2));
    console.log(`\n💾 Saved ${newEmails.length} enriched contacts to ${outFile}`);

    // Update Supabase with inferred emails
    let updated = 0;
    for (const email of newEmails) {
      const { error } = await sp
        .from('investors')
        .update({
          email: email.inferredEmail,
          email_source: 'inferred',
          email_verification_status: 'inferred',
          updated_at: new Date().toISOString(),
        })
        .eq('id', email.investorId);

      if (!error) updated++;
    }
    console.log(`   Updated ${updated} investors in Supabase with inferred emails`);
  }

  console.log(`\n✅ Enrichment Complete`);
  console.log(`   Processed: ${processed}`);
  console.log(`   Enriched: ${enriched}`);
  console.log(`   Errors: ${errors}`);

  // Show current stats
  const { count: totalEmails } = await sp
    .from('investors')
    .select('id', { count: 'exact', head: true })
    .not('email', 'is', null);

  console.log(`   Total with email now: ${totalEmails}`);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
