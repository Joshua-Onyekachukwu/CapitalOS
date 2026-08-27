#!/usr/bin/env node
// =============================================
// Bulk Email Enrichment
// =============================================
// Processes all investors without emails, inferring
// emails from first.last@company.com patterns.

require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const sp = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

function getDomain(companyName) {
  if (!companyName) return null;
  const cleaned = companyName.toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, '')
    .replace(/(inc|llc|ltd|corp|lp|vc|partners|capital|fund|ventures|advisors|holdings|group|associates|management|advisory)/g, '')
    .trim();
  return cleaned.length > 2 && cleaned.length < 40 ? `${cleaned}.com` : null;
}

function getEmail(first, last, domain) {
  return `${first}.${last}@${domain}`;
}

async function processBatch(offset, batchSize) {
  const { data: investors } = await sp
    .from('investors')
    .select('id, full_name, company_name')
    .is('email', null)
    .not('company_name', 'is', null)
    .not('full_name', 'is', null)
    .order('id', { ascending: true })
    .range(offset, offset + batchSize - 1);

  if (!investors?.length) return 0;

  const updates = [];
  for (const inv of investors) {
    const parts = (inv.full_name || '').toLowerCase().trim().split(' ').filter(Boolean);
    if (parts.length < 2) continue;
    const first = parts[0];
    const last = parts[parts.length - 1];
    const domain = getDomain(inv.company_name);
    if (!domain) continue;
    updates.push({ id: inv.id, email: getEmail(first, last, domain) });
  }

  // Batch update using upsert-like approach
  let updated = 0;
  for (const u of updates) {
    const { error } = await sp
      .from('investors')
      .update({
        email: u.email,
        email_source: 'inferred',
        email_verification_status: 'inferred',
        updated_at: new Date().toISOString(),
      })
      .eq('id', u.id);
    if (!error) updated++;
  }

  return updated;
}

async function main() {
  console.log('📧 Bulk Email Enrichment\n');

  const BATCH = 1000;
  let offset = 0;
  let totalEnriched = 0;
  let totalProcessed = 0;

  while (true) {
    const enriched = await processBatch(offset, BATCH);
    totalEnriched += enriched;
    totalProcessed += BATCH;

    console.log(`   Processed: ${totalProcessed}, Enriched: ${totalEnriched}`);

    if (enriched === 0 && offset > 0) break;
    offset += BATCH;

    // Safety limit
    if (offset > 100000) break;
  }

  const { count } = await sp
    .from('investors')
    .select('id', { count: 'exact', head: true })
    .not('email', 'is', null);

  console.log(`\n✅ Complete`);
  console.log(`   Total enriched: ${totalEnriched}`);
  console.log(`   Total with email now: ${count}`);
}

main().catch(err => {
  console.error('Fatal:', err);
  process.exit(1);
});
