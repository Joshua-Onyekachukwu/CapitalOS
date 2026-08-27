#!/usr/bin/env node
// =============================================
// Verify All Inferred Emails
// =============================================
// Checks MX records, format, and disposable domains
// for all inferred emails in batches.

require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const dns = require('dns').promises;

const sp = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const DISPOSABLE = new Set([
  'tempmail.com', 'throwaway.email', 'guerrillamail.com', 'mailinator.com',
  'yopmail.com', 'temp-mail.org', 'fakeinbox.com', 'sharklasers.com',
  'dispostable.com', 'maildrop.cc', 'trashmail.com', '10minutemail.com',
]);

const ROLE = new Set([
  'info', 'admin', 'support', 'sales', 'contact', 'hello', 'team',
  'office', 'mail', 'webmaster', 'postmaster', 'hostmaster', 'abuse',
]);

async function verifyEmail(email) {
  if (!email || !email.includes('@')) return { valid: false, reason: 'no_at_sign' };

  const domain = email.split('@')[1]?.toLowerCase();
  if (!domain) return { valid: false, reason: 'no_domain' };

  // Disposable check
  if (DISPOSABLE.has(domain)) return { valid: false, reason: 'disposable' };

  // Role-based check
  const prefix = email.split('@')[0]?.toLowerCase();
  if (ROLE.has(prefix)) return { valid: false, reason: 'role_based' };

  // MX check
  try {
    const mx = await dns.resolveMx(domain);
    if (mx && mx.length > 0) return { valid: true, reason: 'mx_valid' };
    return { valid: false, reason: 'no_mx' };
  } catch {
    return { valid: false, reason: 'dns_fail' };
  }
}

async function main() {
  console.log('🔍 Verifying inferred emails\n');

  const BATCH = 200;
  let offset = 0;
  let verified = 0;
  let invalid = 0;
  let roleBased = 0;
  let totalChecked = 0;

  while (true) {
    const { data: investors } = await sp
      .from('investors')
      .select('id, email')
      .eq('email_source', 'inferred')
      .not('email', 'is', null)
      .range(offset, offset + BATCH - 1);

    if (!investors || investors.length === 0) break;

    for (const inv of investors) {
      const result = await verifyEmail(inv.email);

      if (result.valid) {
        verified++;
        await sp.from('investors').update({
          email_verification_status: 'format_valid',
          updated_at: new Date().toISOString(),
        }).eq('id', inv.id);
      } else if (result.reason === 'role_based') {
        roleBased++;
        await sp.from('investors').update({
          email_verification_status: 'role_based',
          updated_at: new Date().toISOString(),
        }).eq('id', inv.id);
      } else {
        invalid++;
        await sp.from('investors').update({
          email_verification_status: 'invalid',
          updated_at: new Date().toISOString(),
        }).eq('id', inv.id);
      }

      totalChecked++;

      // Rate limit DNS
      await new Promise(r => setTimeout(r, 20));
    }

    offset += BATCH;
    console.log(`   Checked: ${totalChecked}, Valid: ${verified}, Role: ${roleBased}, Invalid: ${invalid}`);

    if (investors.length < BATCH) break;
  }

  console.log(`\n✅ Verification Complete`);
  console.log(`   Total checked: ${totalChecked}`);
  console.log(`   Valid (MX exists): ${verified}`);
  console.log(`   Role-based: ${roleBased}`);
  console.log(`   Invalid (no MX / disposable): ${invalid}`);

  // Final stats
  const { count: withEmail } = await sp.from('investors').select('id', { count: 'exact', head: true }).not('email', 'is', null);
  const { count: formatValid } = await sp.from('investors').select('id', { count: 'exact', head: true }).eq('email_verification_status', 'format_valid');
  const { count: inferred } = await sp.from('investors').select('id', { count: 'exact', head: true }).eq('email_verification_status', 'inferred');
  const { count: invalidCount } = await sp.from('investors').select('id', { count: 'exact', head: true }).eq('email_verification_status', 'invalid');

  console.log(`\n📊 Final Email Status:`);
  console.log(`   Total with email: ${withEmail}`);
  console.log(`   Format valid: ${formatValid}`);
  console.log(`   Still inferred (pending): ${inferred}`);
  console.log(`   Invalid: ${invalidCount}`);
}

main().catch(err => {
  console.error('Fatal:', err);
  process.exit(1);
});
