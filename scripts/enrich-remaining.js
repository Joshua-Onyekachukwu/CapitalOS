#!/usr/bin/env node
// =============================================
// Enrich Remaining Investors
// =============================================
// Processes the last 4,591 investors without emails
// by inferring emails from name + company domain.

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
    .replace(/(inc|llc|ltd|corp|lp|vc|partners|capital|fund|ventures|advisors|holdings|group|associates|management|advisory|ventures|investments|enterprises|solutions|technologies)/g, '')
    .trim();
  return cleaned.length > 2 && cleaned.length < 40 ? `${cleaned}.com` : null;
}

function getEmail(first, last, domain) {
  return `${first}.${last}@${domain}`;
}

async function main() {
  console.log('📧 Enriching remaining investors without emails\n');

  let totalEnriched = 0;
  let totalProcessed = 0;
  const BATCH = 500;
  let offset = 0;

  while (true) {
    const { data: investors } = await sp
      .from('investors')
      .select('id, full_name, company_name')
      .is('email', null)
      .not('company_name', 'is', null)
      .not('full_name', 'is', null)
      .order('id', { ascending: true })
      .range(offset, offset + BATCH - 1);

    if (!investors || investors.length === 0) break;

    // Build all updates first
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

    // Apply updates in sub-batches of 50
    for (let i = 0; i < updates.length; i += 50) {
      const subBatch = updates.slice(i, i + 50);
      const promises = subBatch.map(u =>
        sp.from('investors').update({
          email: u.email,
          email_source: 'inferred',
          email_verification_status: 'inferred',
          updated_at: new Date().toISOString(),
        }).eq('id', u.id)
      );
      const results = await Promise.all(promises);
      totalEnriched += results.filter(r => !r.error).length;
    }

    totalProcessed += investors.length;
    offset += BATCH;

    console.log(`   Processed: ${totalProcessed}, Enriched: ${totalEnriched}`);

    if (investors.length < BATCH) break;
  }

  const { count } = await sp
    .from('investors')
    .select('id', { count: 'exact', head: true })
    .not('email', 'is', null);

  console.log(`\n✅ Complete`);
  console.log(`   Total enriched this run: ${totalEnriched}`);
  console.log(`   Total with email now: ${count}`);
}

main().catch(err => {
  console.error('Fatal:', err);
  process.exit(1);
});
