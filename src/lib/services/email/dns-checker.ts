// =============================================
// DNS Checker Service
// =============================================
// Verifies SPF, DKIM, DMARC, and MX records for email domains.

import { createClient } from "@supabase/supabase-js";
import { promises as dns } from "dns";

function getSp() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export interface DomainHealth {
  domain: string;
  spfValid: boolean;
  spfRecord: string | null;
  dkimValid: boolean;
  dkimRecord: string | null;
  dmarcValid: boolean;
  dmarcRecord: string | null;
  mxValid: boolean;
  mxRecords: string[];
  overallStatus: "good" | "needs_attention" | "failing" | "unchecked";
  lastCheckedAt: string;
  details: Record<string, any>;
}

// =============================================
// Check Domain Health
// =============================================

export async function checkDomainHealth(
  userId: string,
  domain: string
): Promise<DomainHealth> {
  const normalizedDomain = domain.toLowerCase().trim();

  const [spfResult, dkimResult, dmarcResult, mxResult] = await Promise.allSettled([
    checkSPF(normalizedDomain),
    checkDKIM(normalizedDomain),
    checkDMARC(normalizedDomain),
    checkMX(normalizedDomain),
  ]);

  const spf = spfResult.status === "fulfilled" ? spfResult.value : { valid: false, record: null };
  const dkim = dkimResult.status === "fulfilled" ? dkimResult.value : { valid: false, record: null };
  const dmarc = dmarcResult.status === "fulfilled" ? dmarcResult.value : { valid: false, record: null };
  const mx = mxResult.status === "fulfilled" ? mxResult.value : { valid: false, records: [] };

  const totalChecks = 4;
  const passedChecks = [spf.valid, dkim.valid, dmarc.valid, mx.valid].filter(Boolean).length;

  let overallStatus: DomainHealth["overallStatus"];
  if (passedChecks === totalChecks) overallStatus = "good";
  else if (passedChecks >= 2) overallStatus = "needs_attention";
  else if (passedChecks >= 1) overallStatus = "needs_attention";
  else overallStatus = "failing";

  const health: DomainHealth = {
    domain: normalizedDomain,
    spfValid: spf.valid,
    spfRecord: spf.record,
    dkimValid: dkim.valid,
    dkimRecord: dkim.record,
    dmarcValid: dmarc.valid,
    dmarcRecord: dmarc.record,
    mxValid: mx.valid,
    mxRecords: mx.records,
    overallStatus,
    lastCheckedAt: new Date().toISOString(),
    details: {
      spf: spf,
      dkim: dkim,
      dmarc: dmarc,
      mx: { valid: mx.valid, records: mx.records },
    },
  };

  // Store in database
  const sp = getSp();
  await sp.from("email_domain_health").upsert({
    user_id: userId,
    domain: normalizedDomain,
    spf_valid: spf.valid,
    spf_record: spf.record,
    dkim_valid: dkim.valid,
    dkim_record: dkim.record,
    dmarc_valid: dmarc.valid,
    dmarc_record: dmarc.record,
    mx_valid: mx.valid,
    mx_records: mx.records,
    overall_status: overallStatus,
    last_checked_at: new Date().toISOString(),
    details: health.details,
  }, { onConflict: "user_id,domain" });

  return health;
}

// =============================================
// Individual DNS Checks
// =============================================

async function checkSPF(domain: string): Promise<{ valid: boolean; record: string | null }> {
  try {
    const records = await dns.resolveTxt(domain);
    const spfRecord = records
      .flat()
      .find(r => r.toLowerCase().includes("v=spf1"));

    if (spfRecord) {
      return { valid: true, record: spfRecord };
    }
    return { valid: false, record: null };
  } catch {
    return { valid: false, record: null };
  }
}

async function checkDKIM(domain: string): Promise<{ valid: boolean; record: string | null }> {
  // Check common DKIM selectors
  const selectors = ["default", "google", "selector1", "selector2", "k1", "dkim", "mandrill"];

  for (const selector of selectors) {
    try {
      const dkimDomain = `${selector}._domainkey.${domain}`;
      const records = await dns.resolveTxt(dkimDomain);
      const dkimRecord = records.flat().find(r => r.toLowerCase().includes("v=dkim1"));

      if (dkimRecord) {
        return { valid: true, record: dkimRecord };
      }
    } catch {
      // Continue to next selector
    }
  }

  return { valid: false, record: null };
}

async function checkDMARC(domain: string): Promise<{ valid: boolean; record: string | null }> {
  try {
    const records = await dns.resolveTxt(`_dmarc.${domain}`);
    const dmarcRecord = records
      .flat()
      .find(r => r.toLowerCase().includes("v=dmarc1"));

    if (dmarcRecord) {
      return { valid: true, record: dmarcRecord };
    }
    return { valid: false, record: null };
  } catch {
    return { valid: false, record: null };
  }
}

async function checkMX(domain: string): Promise<{ valid: boolean; records: string[] }> {
  try {
    const records = await dns.resolveMx(domain);
    const mxRecords = records
      .sort((a, b) => a.priority - b.priority)
      .map(r => r.exchange);

    return {
      valid: mxRecords.length > 0,
      records: mxRecords,
    };
  } catch {
    return { valid: false, records: [] };
  }
}

// =============================================
// Get stored domain health
// =============================================

export async function getStoredDomainHealth(
  userId: string,
  domain: string
): Promise<DomainHealth | null> {
  const sp = getSp();
  const { data } = await sp
    .from("email_domain_health")
    .select("*")
    .eq("user_id", userId)
    .eq("domain", domain.toLowerCase().trim())
    .limit(1)
    .single();

  if (!data) return null;

  return {
    domain: data.domain,
    spfValid: data.spf_valid,
    spfRecord: data.spf_record,
    dkimValid: data.dkim_valid,
    dkimRecord: data.dkim_record,
    dmarcValid: data.dmarc_valid,
    dmarcRecord: data.dmarc_record,
    mxValid: data.mx_valid,
    mxRecords: data.mx_records || [],
    overallStatus: data.overall_status,
    lastCheckedAt: data.last_checked_at,
    details: data.details || {},
  };
}
