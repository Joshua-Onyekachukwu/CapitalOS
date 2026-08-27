#!/usr/bin/env node
// =============================================
// Email Verification Checker
// =============================================
// Verifies inferred emails by checking:
// 1. Format validity (regex)
// 2. MX record existence
// 3. Disposable email domain detection
// 4. Role-based address detection (info@, admin@, etc.)

require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const dns = require('dns').promises;

const sp = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const BATCH_SIZE = 200;

// Disposable email domains
const DISPOSABLE_DOMAINS = new Set([
  'tempmail.com', 'throwaway.email', 'guerrillamail.com', 'mailinator.com',
  'yopmail.com', 'temp-mail.org', 'fakeinbox.com', 'sharklasers.com',
  'guerrillamailblock.com', 'grr.la', 'dispostable.com', 'maildrop.cc',
  'trashmail.com', '10minutemail.com', 'tempmail.net', 'mohmal.com',
]);

// Role-based email prefixes (not personal)
const ROLE_PREFIXES = new Set([
  'info', 'admin', 'support', 'sales', 'contact', 'hello', 'hi',
  'team', 'office', 'mail', 'webmaster', 'postmaster', 'hostmaster',
  'abuse', 'noc', 'security', 'billing', 'help', 'service',
  'marketing', 'press', 'media', 'jobs', 'career', 'hr',
  'legal', 'compliance', 'feedback', 'suggestion', 'bug',
]);

const FREE_EMAIL_PROVIDERS = new Set([
  'gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com', 'aol.com',
  'icloud.com', 'mail.com', 'protonmail.com', 'proton.me', 'zoho.com',
]);

function isValidEmailFormat(email) {
  const regex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
  return regex.test(email);
}

function isDisposableDomain(domain) {
  return DISPOSABLE_DOMAINS.has(domain.toLowerCase());
}

function isRoleBasedAddress(email) {
  const prefix = email.split('@')[0].toLowerCase();
  return ROLE_PREFIXES.has(prefix);
}

function isFreeEmail(domain) {
  return FREE_EMAIL_PROVIDERS.has(domain.toLowerCase());
}

async function verifyEmail(email) {
  const result = {
    email,
    valid: false,
    reason: '',
    checks: [],
  };

  // 1. Format check
  if (!isValidEmailFormat(email)) {
    result.reason = 'invalid_format';
    return result;
  }
  result.checks.push('format_valid');

  const domain = email.split('@')[1];

  // 2. Disposable check
  if (isDisposableDomain(domain)) {
    result.reason = 'disposable_domain';
    return result;
  }
  result.checks.push('not_disposable');

  // 3. Role-based check
  if (isRoleBasedAddress(email)) {
    result.checks.push('role_based');
    result.reason = 'role_based_address';
    // Don't reject — just flag it
  }

  // 4. Free email check
  if (isFreeEmail(domain)) {
    result.checks.push('free_email');
  }

  // 5. MX record check
  try {
    const mxRecords = await dns.resolveMx(domain);
    if (mxRecords && mxRecords.length > 0) {
      result.checks.push('mx_valid');
      result.valid = true;
    } else {
      result.reason = 'no_mx_records';
    }
  } catch {
    result.reason = 'dns_lookup_failed';
  }

  return result;
}

async function main() {
  console.log('🔍 Email Verification Checker\n');

  // Get inferred emails to verify
  const { data: investors } = await sp
    .from('investors')
    .select('id, email, email_verification_status')
    .eq('email_verification_status', 'inferred')
    .not('email', 'is', null)
    .limit(BATCH_SIZE);

  if (!investors?.length) {
    console.log('✅ No inferred emails to verify');
    return;
  }

  console.log(`   Verifying ${investors.length} inferred emails...\n`);

  let verified = 0;
  let invalid = 0;
  let flagged = 0;
  const results = [];

  for (const investor of investors) {
    const result = await verifyEmail(investor.email);
    results.push({ ...result, investorId: investor.id });

    if (result.valid) {
      verified++;
      // Update to verified status
      await sp.from('investors').update({
        email_verification_status: result.checks.includes('role_based') ? 'role_based' : 'format_valid',
        updated_at: new Date().toISOString(),
      }).eq('id', investor.id);
    } else {
      invalid++;
      // Mark as invalid
      await sp.from('investors').update({
        email_verification_status: 'invalid',
        email_source: `invalid_${result.reason}`,
        updated_at: new Date().toISOString(),
      }).eq('id', investor.id);
    }

    if (result.checks.includes('role_based')) flagged++;

    // Rate limit DNS
    await new Promise(r => setTimeout(r, 30));
  }

  console.log(`\n✅ Verification Complete`);
  console.log(`   Verified: ${verified}`);
  console.log(`   Invalid: ${invalid}`);
  console.log(`   Role-based (flagged): ${flagged}`);

  // Show final stats
  const { count: totalVerified } = await sp
    .from('investors')
    .select('id', { count: 'exact', head: true })
    .eq('email_verification_status', 'format_valid');

  const { count: totalInferred } = await sp
    .from('investors')
    .select('id', { count: 'exact', head: true })
    .eq('email_verification_status', 'inferred');

  const { count: totalInvalid } = await sp
    .from('investors')
    .select('id', { count: 'exact', head: true })
    .eq('email_verification_status', 'invalid');

  console.log(`\n📊 Current Status:`);
  console.log(`   Format valid: ${totalVerified}`);
  console.log(`   Still inferred: ${totalInferred}`);
  console.log(`   Invalid: ${totalInvalid}`);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
