#!/usr/bin/env node
// =============================================
// Import Backup Investors into Supabase
// =============================================
// Imports investors from the backup JSON file that don't already exist in Supabase.
// Uses full_name + investor_type + source as dedup key.

require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const sp = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const BATCH_SIZE = 500;
const BACKUP_FILE = path.join(__dirname, '../data-backups/investors-backup-2026-08-25T05-48-56.json');

async function main() {
  console.log('📦 Loading backup data...');
  const backup = JSON.parse(fs.readFileSync(BACKUP_FILE, 'utf8'));
  console.log(`   ${backup.length} records in backup file`);

  // Get existing investors from Supabase
  console.log('🔍 Fetching existing investors from Supabase...');
  const existing = new Set();
  let offset = 0;
  let hasMore = true;

  while (hasMore) {
    const { data } = await sp
      .from('investors')
      .select('full_name, investor_type, source')
      .range(offset, offset + 999);

    if (!data || data.length === 0) {
      hasMore = false;
    } else {
      for (const inv of data) {
        existing.add(`${(inv.full_name || '').toLowerCase()}|${inv.investor_type || ''}|${inv.source || ''}`);
      }
      offset += data.length;
      if (data.length < 1000) hasMore = false;
    }
  }

  console.log(`   ${existing.size} existing records in Supabase`);

  // Filter out duplicates
  const toImport = backup.filter(inv => {
    const key = `${(inv.full_name || '').toLowerCase()}|${inv.investor_type || ''}|${inv.source || ''}`;
    return !existing.has(key);
  });

  console.log(`\n📥 ${toImport.length} new records to import (${backup.length - toImport.length} already exist)`);

  if (toImport.length === 0) {
    console.log('✅ Nothing to import!');
    return;
  }

  // Map backup records to Supabase schema
  const mapped = toImport.map(inv => ({
    id: inv.id || undefined,
    full_name: inv.full_name || `${inv.first_name || ''} ${inv.last_name || ''}`.trim() || 'Unknown',
    first_name: inv.first_name || null,
    last_name: inv.last_name || null,
    investor_type: inv.investor_type || 'unknown',
    company_name: inv.company_name || null,
    company_website: inv.company_website || null,
    linkedin_url: inv.linkedin_url || null,
    personal_website: inv.personal_website || null,
    country: inv.country || null,
    city: inv.city || null,
    location: inv.location || null,
    email: inv.email || null,
    phone: inv.phone || null,
    fund_size: inv.fund_size || null,
    aum: inv.aum || null,
    investment_stages: inv.investment_stages || [],
    investment_sectors: inv.investment_sectors || [],
    investment_geographies: inv.investment_geographies || [],
    investment_thesis: inv.investment_thesis || null,
    number_of_investments: inv.number_of_investments || 0,
    fit_score: inv.fit_score || 0,
    data_quality_score: inv.data_quality_score || 0,
    outreach_readiness: inv.outreach_readiness || 'not_ready',
    source: inv.source || 'backup_import',
    source_id: inv.source_id || null,
    is_verified: inv.is_verified || false,
    email_verified: inv.email_verified || false,
    email_verification_status: inv.email_verification_status || 'unknown',
    created_at: inv.created_at || new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }));

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
      console.error(`   ❌ Batch ${Math.floor(i / BATCH_SIZE) + 1} failed:`, error.message);
      errors += batch.length;
    } else {
      imported += batch.length;
      process.stdout.write(`\r   Imported ${imported}/${mapped.length}...`);
    }
  }

  console.log(`\n\n✅ Import complete!`);
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
