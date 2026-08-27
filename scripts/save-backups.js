#!/usr/bin/env node
// Save comprehensive local backups of all investor data
// Creates both JSON and CSV files for redundancy

require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const sp = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const BACKUP_DIR = path.join(__dirname, '..', 'data-backups');
const BATCH = 1000;

(async () => {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  console.log(`\n💾 Saving Investor Data Backups — ${timestamp}\n`);

  fs.mkdirSync(BACKUP_DIR, { recursive: true });

  // Fetch all investors in batches
  let allInvestors = [];
  let offset = 0;
  let hasMore = true;

  while (hasMore) {
    const { data, error } = await sp
      .from('investors')
      .select('*')
      .range(offset, offset + BATCH - 1);

    if (error) {
      console.error('Fetch error:', error.message);
      break;
    }
    if (!data || data.length === 0) {
      hasMore = false;
      break;
    }

    allInvestors.push(...data);
    process.stdout.write(`\r   Fetched ${allInvestors.length} investors...`);

    offset += BATCH;
    if (data.length < BATCH) hasMore = false;
  }

  console.log(`\n   Total fetched: ${allInvestors.length}`);

  // Save JSON backup
  const jsonFile = path.join(BACKUP_DIR, `investors-full-backup-${timestamp}.json`);
  fs.writeFileSync(jsonFile, JSON.stringify(allInvestors, null, 2));
  console.log(`   ✅ JSON: ${jsonFile} (${(fs.statSync(jsonFile).size / 1024 / 1024).toFixed(1)} MB)`);

  // Save CSV backup
  if (allInvestors.length > 0) {
    const csvFile = path.join(BACKUP_DIR, `investors-full-backup-${timestamp}.csv`);
    const headers = Object.keys(allInvestors[0]);
    const csvLines = [headers.join(',')];
    for (const inv of allInvestors) {
      const row = headers.map(h => {
        const val = inv[h];
        if (val === null || val === undefined) return '';
        const str = String(val).replace(/"/g, '""');
        return `"${str}"`;
      });
      csvLines.push(row.join(','));
    }
    fs.writeFileSync(csvFile, csvLines.join('\n'));
    console.log(`   ✅ CSV: ${csvFile} (${(fs.statSync(csvFile).size / 1024 / 1024).toFixed(1)} MB)`);
  }

  // Save summary statistics
  const stats = {
    timestamp,
    total: allInvestors.length,
    withEmail: allInvestors.filter(i => i.email && i.email.trim()).length,
    emailVerified: allInvestors.filter(i => i.email_verified === true).length,
    withLinkedIn: allInvestors.filter(i => i.linkedin_url && i.linkedin_url.trim()).length,
    withPhone: allInvestors.filter(i => i.phone && i.phone.trim()).length,
    withWebsite: allInvestors.filter(i => i.company_website && i.company_website.trim() && !i.company_website.includes('googletagmanager')).length,
    sources: {},
    investorTypes: {},
  };

  allInvestors.forEach(inv => {
    stats.sources[inv.source || 'unknown'] = (stats.sources[inv.source || 'unknown'] || 0) + 1;
    stats.investorTypes[inv.investor_type || 'unknown'] = (stats.investorTypes[inv.investor_type || 'unknown'] || 0) + 1;
  });

  const statsFile = path.join(BACKUP_DIR, `investors-stats-${timestamp}.json`);
  fs.writeFileSync(statsFile, JSON.stringify(stats, null, 2));
  console.log(`   ✅ Stats: ${statsFile}`);

  // Save verified emails list
  const verifiedEmails = allInvestors
    .filter(i => i.email_verified === true && i.email)
    .map(i => ({ email: i.email, name: i.full_name || i.company_name, source: i.source }));

  const emailsFile = path.join(BACKUP_DIR, `verified-emails-${timestamp}.json`);
  fs.writeFileSync(emailsFile, JSON.stringify(verifiedEmails, null, 2));
  console.log(`   ✅ Verified Emails: ${emailsFile} (${verifiedEmails.length} emails)`);

  console.log(`\n📊 Backup Summary`);
  console.log(`   Total investors: ${stats.total}`);
  console.log(`   With email: ${stats.withEmail} (${Math.round(stats.withEmail/stats.total*100)}%)`);
  console.log(`   Email verified: ${stats.emailVerified} (${Math.round(stats.emailVerified/stats.withEmail*100)}%)`);
  console.log(`   With LinkedIn: ${stats.withLinkedIn}`);
  console.log(`   With phone: ${stats.withPhone}`);
  console.log(`   With real website: ${stats.withWebsite}`);
  console.log(`\n   Sources:`);
  Object.entries(stats.sources).sort((a,b)=>b[1]-a[1]).forEach(([k,v])=>console.log(`     ${k}: ${v}`));
  console.log(`\n   Investor Types:`);
  Object.entries(stats.investorTypes).sort((a,b)=>b[1]-a[1]).forEach(([k,v])=>console.log(`     ${k}: ${v}`));
})().catch(e => console.error('Fatal:', e));
