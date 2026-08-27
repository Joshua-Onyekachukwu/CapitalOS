#!/usr/bin/env node
// Fix email verification — re-check ALL investors with emails, not just null ones

require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const sp = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const DISPOSABLE = new Set([
  'guerrillamail.com','tempmail.com','throwaway.email','temp-mail.org','fakeinbox.com',
  'sharklasers.com','dispostable.com','mailinator.com','yopmail.com','yopmail.fr',
  'tempail.com','discard.email','discardmail.com','maildrop.cc','mailnesia.com',
  'tempinbox.com','10minutemail.com','getairmail.com','mytempemail.com','tmpmail.org',
  'trashmail.com','trashmail.de','trashmail.net','trashmail.org','trashmail.me',
  'trashmailer.com','trashymail.com','trashymail.net','mailcatch.com','jetable.com',
  'jetable.fr','jetable.net','jetable.org','spamgourmet.com','spambob.com',
  'spambox.us','spambox.info','spamhole.com','spamify.com','spaml.com',
  'spamoff.de','spamspot.com','spamthis.co.uk','spamthisplease.com',
  'wegwerfemail.com','wegwerfmail.de','wegwerfmail.net',
  'whyspam.me','you-spam.com','mail333.com','mail4trash.com','mailbidon.com',
  'mailblocks.com','mailblog.biz','mailbucket.org','mailcat.biz','maildx.com',
  'maileater.com','mailexpire.com','mailforspam.com','mailguard.me','mailinator.net',
  'mailinator.org','mailinator2.com','mailmetrash.com','mailnator.com','mailnull.com',
  'mailpick.biz','mailquack.com','mailrock.biz','mailshell.com','mailsiphon.com',
  'mailslite.com','mailtemp.info','mailtrash.net','mailzilla.com','meltmail.com',
  'moakt.com','mymailoasis.com','mymailuk.com','mytrashmail.com','neomailbox.com',
  'noclickemail.com','nomail2me.com','nomorespamemails.com','nospammail.net',
  'pookmail.com','quickinbox.com','reallymymail.com','rejectmail.com','rhyta.com',
  'safe-mail.net','safetymail.info','scatmail.com','selfdestructingmail.com',
  'sendspamhere.com','shiftmail.com','shitmail.me','shitmail.org','shitware.nl',
  'shortmail.net','sibmail.com','sinnlos-mail.de','sneakemail.com','sneakymail.de',
  'spam.la','spam.su','spam4.me','spamcannon.com','spamcero.com',
  'spamcorptastic.com','spamcowboy.com','spamday.com','spamex.com','spamgoes.in',
  'spamherelots.com','spamhereplease.com','superrito.com',
  'tempail.com','tempalias.com','tempemail.biz','tempemail.net',
  'tempmail.it','tempmailer.com','tempmailer.de','tempomail.fr',
  'temporaryemail.net','temporaryemail.us','temporaryinbox.com',
  'trash-me.com','trash2009.com','trashdevil.com','trashemail.de','trashmail.at',
  'zippymail.info','fakeinbox.com',
  'get-mail.cf','get-mail.ga','get-mail.xyz','tmpmail.org','tmpmail.net',
  'weg-werf-email.de','maildrop.cc',
]);

function isValidEmail(email) {
  if (!email || typeof email !== 'string') return false;
  const e = email.toLowerCase().trim();
  // Basic format check
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) return false;
  const domain = e.split('@')[1];
  // Disposable check
  if (DISPOSABLE.has(domain)) return false;
  // Test/example/null
  if (e.startsWith('test@') || e.startsWith('example@') || e.startsWith('null@')) return false;
  // Double dots
  if (e.includes('..')) return false;
  return true;
}

const BATCH = 500;

(async () => {
  console.log(`\n📧 Email Verification — Full Re-check\n`);

  let offset = 0;
  let totalValid = 0;
  let totalInvalid = 0;
  let hasMore = true;

  while (hasMore) {
    const { data: batch, error } = await sp
      .from('investors')
      .select('id, email')
      .not('email', 'is', null)
      .neq('email', '')
      .range(offset, offset + BATCH - 1);

    if (error) {
      console.error('Error:', error.message);
      break;
    }
    if (!batch || batch.length === 0) {
      hasMore = false;
      break;
    }

    const validIds = [];
    const invalidIds = [];

    for (const inv of batch) {
      if (isValidEmail(inv.email)) {
        validIds.push(inv.id);
      } else {
        invalidIds.push(inv.id);
      }
    }

    // Bulk update in chunks of 100
    for (let i = 0; i < validIds.length; i += 100) {
      const chunk = validIds.slice(i, i + 100);
      await sp.from('investors').update({ email_verified: true }).in('id', chunk);
    }
    for (let i = 0; i < invalidIds.length; i += 100) {
      const chunk = invalidIds.slice(i, i + 100);
      await sp.from('investors').update({ email_verified: false }).in('id', chunk);
    }

    totalValid += validIds.length;
    totalInvalid += invalidIds.length;

    process.stdout.write(`\r   Offset ${offset}: ${totalValid} valid, ${totalInvalid} invalid`);

    offset += BATCH;
    if (batch.length < BATCH) hasMore = false;
  }

  // Final counts
  const { count: total } = await sp.from('investors').select('*', { count: 'exact', head: true });
  const { count: withEmail } = await sp.from('investors').select('*', { count: 'exact', head: true }).not('email', 'is', null).neq('email', '');
  const { count: verified } = await sp.from('investors').select('*', { count: 'exact', head: true }).eq('email_verified', true);
  const { count: invalid } = await sp.from('investors').select('*', { count: 'exact', head: true }).eq('email_verified', false).not('email', 'is', null).neq('email', '');

  console.log(`\n\n📊 Final Verification Summary`);
  console.log(`   Total investors: ${total}`);
  console.log(`   With email: ${withEmail} (${Math.round((withEmail/total)*100)}%)`);
  console.log(`   ✅ Verified: ${verified} (${Math.round((verified/withEmail)*100)}% of emails)`);
  console.log(`   ❌ Invalid: ${invalid}`);
  console.log(`   📝 Marked valid this run: ${totalValid}`);
  console.log(`   🚫 Marked invalid this run: ${totalInvalid}`);
})().catch(e => console.error('Fatal:', e));
