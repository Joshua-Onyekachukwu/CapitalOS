"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";

interface DomainHealth {
  domain: string;
  spfValid: boolean;
  spfRecord: string | null;
  dkimValid: boolean;
  dkimRecord: string | null;
  dmarcValid: boolean;
  dmarcRecord: string | null;
  mxValid: boolean;
  mxRecords: string[];
  overallStatus: string;
  lastCheckedAt: string;
}

export default function DomainHealthPage() {
  const [domain, setDomain] = useState("");
  const [health, setHealth] = useState<DomainHealth | null>(null);
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState("");

  const checkDomain = async (forceRefresh = false) => {
    if (!domain.trim()) return;
    setChecking(true);
    setError("");

    try {
      const url = `/api/email/domain-check?domain=${encodeURIComponent(domain.trim())}${forceRefresh ? "&refresh=true" : ""}`;
      const resp = await fetch(url);
      const data = await resp.json();

      if (data.error) {
        setError(data.error);
      } else {
        setHealth(data.domain);
      }
    } catch {
      setError("Failed to check domain health");
    } finally {
      setChecking(false);
    }
  };

  return (
    <div className="p-6 max-w-[800px] mx-auto">
      <div className="mb-6">
        <Link href="/dashboard/email-health" className="text-sm text-gray-500 hover:text-gray-700 mb-2 inline-flex items-center gap-1">
          <i className="ri-arrow-left-line"></i> Back to Email Health
        </Link>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Domain Health</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          Verify your email authentication records (SPF, DKIM, DMARC, MX)
        </p>
      </div>

      {/* Domain Input */}
      <div className="bg-white dark:bg-[#111827] rounded-xl border border-gray-100 dark:border-gray-800 p-6 mb-6">
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Check Domain
        </label>
        <div className="flex gap-3">
          <input
            type="text"
            value={domain}
            onChange={(e) => setDomain(e.target.value)}
            placeholder="e.g., yourcompany.com"
            className="flex-1 px-4 py-2.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-lime-500"
            onKeyDown={(e) => e.key === "Enter" && checkDomain(true)}
          />
          <button
            onClick={() => checkDomain(true)}
            disabled={checking || !domain.trim()}
            className="px-5 py-2.5 text-sm font-medium bg-lime-500 text-black rounded-lg hover:bg-lime-600 disabled:opacity-50 flex items-center gap-2"
          >
            {checking ? (
              <><i className="ri-loader-4-line animate-spin"></i> Checking...</>
            ) : (
              <><i className="ri-search-line"></i> Check</>
            )}
          </button>
        </div>
        {error && (
          <p className="text-sm text-red-500 mt-2">{error}</p>
        )}
      </div>

      {/* Results */}
      {health && (
        <div className="bg-white dark:bg-[#111827] rounded-xl border border-gray-100 dark:border-gray-800 p-6">
          {/* Overall Status */}
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">{health.domain}</h2>
              <p className="text-sm text-gray-500">
                Last checked: {new Date(health.lastCheckedAt).toLocaleString()}
              </p>
            </div>
            <span className={`px-4 py-2 rounded-full text-sm font-medium ${
              health.overallStatus === "good" ? "bg-green-100 text-green-700" :
              health.overallStatus === "needs_attention" ? "bg-amber-100 text-amber-700" :
              health.overallStatus === "failing" ? "bg-red-100 text-red-700" :
              "bg-gray-100 text-gray-700"
            }`}>
              {health.overallStatus === "good" ? "All Records Valid" :
               health.overallStatus === "needs_attention" ? "Needs Attention" :
               health.overallStatus === "failing" ? "Failing" : "Unchecked"}
            </span>
          </div>

          {/* DNS Records */}
          <div className="space-y-4">
            <DnsRecord
              name="SPF"
              description="Sender Policy Framework — Authorizes which servers can send email for your domain"
              valid={health.spfValid}
              record={health.spfRecord}
              helpUrl="https://www.cloudflare.com/learning/email-security/dmarc-dkim-spf/"
            />
            <DnsRecord
              name="DKIM"
              description="DomainKeys Identified Mail — Proves your email hasn't been tampered with"
              valid={health.dkimValid}
              record={health.dkimRecord}
              helpUrl="https://www.cloudflare.com/learning/email-security/dmarc-dkim-spf/"
            />
            <DnsRecord
              name="DMARC"
              description="Domain-based Message Authentication — Tells receivers what to do with unauthenticated mail"
              valid={health.dmarcValid}
              record={health.dmarcRecord}
              helpUrl="https://www.cloudflare.com/learning/email-security/dmarc-dkim-spf/"
            />
            <DnsRecord
              name="MX"
              description="Mail Exchange — Routes incoming email to your mail server"
              valid={health.mxValid}
              record={health.mxRecords.join(", ") || null}
            />
          </div>
        </div>
      )}
    </div>
  );
}

function DnsRecord({
  name,
  description,
  valid,
  record,
  helpUrl,
}: {
  name: string;
  description: string;
  valid: boolean;
  record: string | null;
  helpUrl?: string;
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className={`border rounded-lg p-4 ${
      valid
        ? "border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-900/10"
        : "border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/10"
    }`}>
      <div
        className="flex items-center justify-between cursor-pointer"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center gap-3">
          <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
            valid ? "bg-green-500 text-white" : "bg-red-500 text-white"
          }`}>
            <i className={`ri-${valid ? "check" : "close"}-line`}></i>
          </div>
          <div>
            <p className="font-medium text-gray-900 dark:text-white">{name}</p>
            <p className="text-xs text-gray-500 dark:text-gray-400">{description}</p>
          </div>
        </div>
        <i className={`ri-arrow-down-s-line text-gray-400 transition-transform ${expanded ? "rotate-180" : ""}`}></i>
      </div>

      {expanded && (
        <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700">
          {record ? (
            <div className="bg-white dark:bg-gray-900 rounded-lg p-3">
              <p className="text-xs text-gray-500 mb-1">Record:</p>
              <code className="text-xs text-gray-800 dark:text-gray-200 break-all">{record}</code>
            </div>
          ) : (
            <p className="text-sm text-red-600 dark:text-red-400">
              No {name} record found. Configure this record to improve email authentication.
            </p>
          )}
          {helpUrl && (
            <a
              href={helpUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-sm text-lime-600 hover:underline mt-2"
            >
              Learn more about {name} <i className="ri-external-link-line"></i>
            </a>
          )}
        </div>
      )}
    </div>
  );
}
