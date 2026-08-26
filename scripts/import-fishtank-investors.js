#!/usr/bin/env node
// =============================================
// Import FishTank VC Investors into Supabase
// =============================================
// Imports 18K+ investor profiles from FishTank scraped data.
// Maps FishTank fields to Supabase investors table schema.

require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const sp = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const BATCH_SIZE = 500;
const FISHTANK_FILE = path.join(__dirname, '../data-backups/fishtank/fishtank-investors-v2.json');

// Generate a deterministic ID from name + source
function generateId(name, source) {
  const crypto = require('crypto');
  const hash = crypto.createHash('md5').update(`${name}|${source}`).digest('hex');
  return `${hash.slice(0, 8)}-${hash.slice(8, 12)}-${hash.slice(12, 16)}-${hash.slice(16, 20)}-${hash.slice(20, 32)}`;
}

async function main() {
  console.log('🐟 Loading FishTank data...');
  const fishtank = JSON.parse(fs.readFileSync(FISHTANK_FILE, 'utf8'));
  console.log(`   ${fishtank.length} records in FishTank file`);

  // Filter out records that are just category pages (no real name)
  const validRecords = fishtank.filter(inv => {
    const name = (inv.full_name || '').trim();
    // Skip category pages, empty names, and very short names
    if (!name || name.length < 3) return false;
    if (['Angels', 'Venture Capital', 'Private Equity', 'Family Office', 'Accelerator', 'Corporate'].includes(name)) return false;
    return true;
  });

  console.log(`   ${validRecords.length} valid investor records (${fishtank.length - validRecords.length} category/empty records filtered)`);

  // Get existing investors from Supabase to dedup
  console.log('🔍 Checking existing records...');
  const existing = new Set();
  let offset = 0;
  let hasMore = true;

  while (hasMore) {
    const { data } = await sp
      .from('investors')
      .select('full_name, source')
      .range(offset, offset + 999);

    if (!data || data.length === 0) {
      hasMore = false;
    } else {
      for (const inv of data) {
        existing.add(`${(inv.full_name || '').toLowerCase().trim()}|${inv.source || ''}`);
      }
      offset += data.length;
      if (data.length < 1000) hasMore = false;
    }
  }

  console.log(`   ${existing.size} existing records in Supabase`);

  // Filter out duplicates
  const toImport = validRecords.filter(inv => {
    const name = (inv.full_name || '').trim();
    const key = `${name.toLowerCase()}|fishtank`;
    return !existing.has(key);
  });

  console.log(`\n📥 ${toImport.length} new FishTank records to import`);

  if (toImport.length === 0) {
    console.log('✅ Nothing to import!');
    return;
  }

  // Map FishTank records to Supabase schema
  const mapped = toImport.map(inv => {
    const name = (inv.full_name || '').trim();
    const id = generateId(name, 'fishtank');

    return {
      id,
      full_name: name,
      first_name: inv.first_name || null,
      last_name: inv.last_name || null,
      investor_type: inv.investor_type || 'unknown',
      company_name: inv.company_name || null,
      company_website: inv.website || null,
      linkedin_url: inv.linkedin_url || null,
      personal_website: inv.website || null,
      country: inv.country || null,
      city: inv.city || null,
      location: inv.location || null,
      email: null,
      fund_size: inv.fund_size || null,
      aum: inv.aum || null,
      investment_stages: inv.investment_stages || [],
      investment_sectors: inv.investment_sectors || [],
      investment_geographies: inv.investment_geographies || [],
      investment_thesis: inv.description || null,
      number_of_investments: inv.number_of_investments || 0,
      fit_score: 0,
      data_quality_score: inv.data_quality_score || 50,
      outreach_readiness: 'not_ready',
      source: 'fishtank',
      source_id: inv.source_url || null,
      is_verified: false,
      email_verified: false,
      created_at: inv.scraped_at || new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
  });

  // Import in batches
  let imported = 0;
  let errors = 0;

  for (let i = 0; i < mapped.length; i += BATCH_SIZE) {
    const batch = mapped.slice(i, i + BATCH_SIZE);
    const { data, error } = await sp.from('investors').upsert(batch, {
      onConflict: 'id',
      ignoreDuplicates: true,
    });

    if (error) {
      console.error(`\n   ❌ Batch ${Math.floor(i / BATCH_SIZE) + 1} failed:`, error.message);
      errors += batch.length;
    } else {
      imported += batch.length;
      process.stdout.write(`\r   Imported ${imported}/${mapped.length}...`);
    }
  }

  console.log(`\n\n✅ FishTank import complete!`);
  console.log(`   Imported: ${imported}`);
  console.log(`   Errors: ${errors}`);

  // Verify final count
  const { count } = await sp.from('investors').select('id', { count: 'exact', head: true });
  console.log(`   Total in Supabase: ${count}`);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
