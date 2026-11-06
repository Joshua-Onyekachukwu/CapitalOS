"use client";

import React, { useCallback, useEffect, useState } from "react";
import { Card, CardBody } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { toast } from "sonner";
import type { RoundMetrics } from "@/lib/services/pipeline/metrics";

// ── Formatting ──
// Compact currency, because a founder reads "$2.4M", not "$2,400,000.00".
export function formatMoney(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return "—";
  const abs = Math.abs(value);
  if (abs >= 1_000_000_000) return `$${(value / 1_000_000_000).toFixed(1).replace(/\.0$/, "")}B`;
  if (abs >= 1_000_000) return `$${(value / 1_000_000).toFixed(2).replace(/\.?0+$/, "")}M`;
  if (abs >= 1_000) return `$${Math.round(value / 1_000)}K`;
  return `$${Math.round(value).toLocaleString()}`;
}

function formatPercent(ratio: number | null): string {
  if (ratio === null || !Number.isFinite(ratio)) return "—";
  return `${(ratio * 100).toFixed(ratio >= 1 ? 0 : 1).replace(/\.0$/, "")}%`;
}

const INSTRUMENTS = ["", "SAFE", "Convertible note", "Priced equity", "Revenue-based", "Grant"];

// ── Round targets form ──
// The source of truth is company_profiles, so the round set here is the same
// round the readiness module and matching read. Nothing is duplicated locally.
export function RoundTargetsForm({ onSaved }: { onSaved: () => void }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    targetAmount: "",
    targetValuation: "",
    instrument: "",
    chequeMin: "",
    chequeMax: "",
  });

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/company/round");
      if (!res.ok) throw new Error("Failed to load round targets");
      const data = await res.json();
      const t = data.targets || {};
      setForm({
        targetAmount: t.targetAmount === null || t.targetAmount === undefined ? "" : String(t.targetAmount),
        targetValuation:
          t.targetValuation === null || t.targetValuation === undefined ? "" : String(t.targetValuation),
        instrument: t.instrument || "",
        chequeMin: t.chequeMin === null || t.chequeMin === undefined ? "" : String(t.chequeMin),
        chequeMax: t.chequeMax === null || t.chequeMax === undefined ? "" : String(t.chequeMax),
      });
    } catch {
      // The pipeline response still carries the targets, so only the form is
      // affected. Saying so beats a silently empty form that looks like "unset".
      setError("Could not load your round targets.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/company/round", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          targetAmount: form.targetAmount === "" ? null : Number(form.targetAmount),
          targetValuation: form.targetValuation === "" ? null : Number(form.targetValuation),
          instrument: form.instrument || null,
          chequeMin: form.chequeMin === "" ? null : Number(form.chequeMin),
          chequeMax: form.chequeMax === "" ? null : Number(form.chequeMax),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || "Failed to save round targets");
      toast.success("Round targets saved");
      setOpen(false);
      onSaved();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to save round targets";
      setError(message);
      toast.error(message);
    } finally {
      setSaving(false);
    }
  };

  const input =
    "w-full px-[10px] py-[7px] text-[13px] rounded-[8px] border border-gray-200 dark:border-gray-700 bg-white dark:bg-[#141824] text-[#06201b] dark:text-white";

  if (loading) {
    return <div className="animate-pulse h-[64px] bg-gray-100 dark:bg-gray-800 rounded-[12px] mb-[16px]" />;
  }

  return (
    <Card className="mb-[16px]">
      <CardBody>
        <div className="flex items-center justify-between gap-[12px]">
          <div>
            <p className="text-[13px] font-semibold text-[#06201b] dark:text-white !mb-[2px]">
              Round targets
            </p>
            <p className="text-[12px] text-gray-400 !mb-0">
              Every percentage on this page is measured against these numbers.
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={() => setOpen((v) => !v)}>
            {open ? "Close" : "Edit targets"}
          </Button>
        </div>

        {open && (
          <div className="mt-[16px] grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-[12px]">
            <label className="block">
              <span className="text-[11px] text-gray-500">Target raise</span>
              <input
                type="number"
                min={0}
                className={input}
                value={form.targetAmount}
                onChange={(e) => setForm((f) => ({ ...f, targetAmount: e.target.value }))}
                placeholder="2000000"
              />
            </label>
            <label className="block">
              <span className="text-[11px] text-gray-500">Target valuation (pre-money)</span>
              <input
                type="number"
                min={0}
                className={input}
                value={form.targetValuation}
                onChange={(e) => setForm((f) => ({ ...f, targetValuation: e.target.value }))}
                placeholder="12000000"
              />
            </label>
            <label className="block">
              <span className="text-[11px] text-gray-500">Instrument</span>
              <select
                className={input}
                value={form.instrument}
                onChange={(e) => setForm((f) => ({ ...f, instrument: e.target.value }))}
              >
                {INSTRUMENTS.map((i) => (
                  <option key={i} value={i}>
                    {i || "Not set"}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="text-[11px] text-gray-500">Smallest cheque</span>
              <input
                type="number"
                min={0}
                className={input}
                value={form.chequeMin}
                onChange={(e) => setForm((f) => ({ ...f, chequeMin: e.target.value }))}
                placeholder="25000"
              />
            </label>
            <label className="block">
              <span className="text-[11px] text-gray-500">Largest cheque</span>
              <input
                type="number"
                min={0}
                className={input}
                value={form.chequeMax}
                onChange={(e) => setForm((f) => ({ ...f, chequeMax: e.target.value }))}
                placeholder="250000"
              />
            </label>

            <div className="sm:col-span-2 lg:col-span-5 flex items-center gap-[12px]">
              <Button size="sm" loading={saving} onClick={save}>
                Save targets
              </Button>
              {error && <span className="text-[12px] text-red-600">{error}</span>}
            </div>
          </div>
        )}
      </CardBody>
    </Card>
  );
}

// ── Metric tile ──
function Tile({
  label,
  value,
  hint,
  tone = "default",
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: "default" | "good";
}) {
  return (
    <div className="p-[14px] rounded-[12px] border border-gray-200 dark:border-gray-800 bg-white dark:bg-[#1a1f2e]">
      <p className="text-[11px] font-semibold text-gray-500 dark:text-gray-400 !mb-[6px]">{label}</p>
      <p
        className={`text-[20px] font-bold !mb-[2px] ${
          tone === "good" ? "text-green-600" : "text-[#06201b] dark:text-white"
        }`}
      >
        {value}
      </p>
      {hint && <p className="text-[10px] text-gray-400 !mb-0">{hint}</p>}
    </div>
  );
}

// ── Round summary ──
// Every figure carries its basis. A weighted total computed from stage defaults
// says so, and a projection with no cheques set reads zero rather than looking
// like a real forecast.
export function RoundSummary({ round }: { round: RoundMetrics }) {
  const { targets, amountBasis } = round;
  const totalEntries = round.entryCount;

  return (
    <div className="mb-[24px]">
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-[12px]">
        <Tile
          label="Committed"
          value={formatMoney(round.committed)}
          hint={`${round.committedCount} investor${round.committedCount === 1 ? "" : "s"}`}
          tone={round.committed > 0 ? "good" : "default"}
        />
        <Tile
          label="Weighted pipeline"
          value={formatMoney(round.weightedPipeline)}
          hint={
            round.probabilityBasis.defaulted > 0
              ? `${round.probabilityBasis.defaulted} stage default${round.probabilityBasis.defaulted === 1 ? "" : "s"}`
              : "your probabilities"
          }
        />
        <Tile
          label="Projected total"
          value={formatMoney(round.projected)}
          hint="committed + weighted"
        />
        <Tile
          label="Of target"
          value={formatPercent(round.percentOfTarget)}
          hint={
            targets.targetAmount === null
              ? "no target set"
              : `target ${formatMoney(targets.targetAmount)}`
          }
        />
        <Tile
          label="Still to raise"
          value={targets.targetAmount === null ? "—" : formatMoney(round.remaining)}
          hint={
            targets.chequeMin || targets.chequeMax
              ? `cheque ${formatMoney(targets.chequeMin)}–${formatMoney(targets.chequeMax)}`
              : "cheque range not set"
          }
        />
      </div>

      <div className="flex flex-wrap items-center gap-x-[16px] gap-y-[4px] mt-[10px]">
        {amountBasis === "none" ? (
          <p className="text-[11px] text-amber-600 !mb-0">
            No expected cheque set on any of your {totalEntries} investor
            {totalEntries === 1 ? "" : "s"} — projections stay at {formatMoney(0)} until you add one.
          </p>
        ) : (
          <p className="text-[11px] text-gray-400 !mb-0">
            {round.withAmount} of {totalEntries} investor{totalEntries === 1 ? "" : "s"} have an
            expected cheque{amountBasis === "partial" ? " (partial coverage)" : ""}.
          </p>
        )}
        {targets.instrument && (
          <p className="text-[11px] text-gray-400 !mb-0">Instrument: {targets.instrument}</p>
        )}
        {targets.targetValuation !== null && (
          <p className="text-[11px] text-gray-400 !mb-0">
            Pre-money {formatMoney(targets.targetValuation)}
          </p>
        )}
        {round.lostReasons.length > 0 && (
          <p className="text-[11px] text-gray-400 !mb-0">
            Lost: {round.lostReasons.map((r) => `${r.reason} (${r.count})`).join(" · ")}
          </p>
        )}
      </div>

      {round.conversion.length > 0 && (
        <div className="mt-[12px] border border-gray-200 dark:border-gray-800 rounded-[12px] px-[14px] py-[10px] bg-gray-50 dark:bg-white/5">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-400 !mb-[6px]">
            Stage conversion
          </p>
          <div className="flex flex-wrap gap-x-[16px] gap-y-[4px]">
            {round.conversion.map((c) => (
              <span key={`${c.from}-${c.to}`} className="text-[12px] text-gray-500 dark:text-gray-400">
                {c.fromLabel} → {c.toLabel}:{" "}
                <span className="font-semibold">{formatPercent(c.rate)}</span>{" "}
                <span className="text-gray-400">
                  ({c.toCount}/{c.fromCount})
                </span>
              </span>
            ))}
          </div>
        </div>
      )}

      {amountBasis === "none" && totalEntries > 0 && (
        <p className="text-[11px] text-gray-400 !mt-[8px] !mb-0">
          Set an expected cheque on a card to turn counts into money.
        </p>
      )}
    </div>
  );
}

// ── Per-investor expected cheque ──
export function ChequeEditor({
  investorId,
  expectedAmount,
  probability,
  onSaved,
}: {
  investorId: string;
  expectedAmount: number | null;
  probability: number | null;
  onSaved: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [amount, setAmount] = useState(expectedAmount === null ? "" : String(expectedAmount));
  const [prob, setProb] = useState(probability === null ? "" : String(probability));

  useEffect(() => {
    setAmount(expectedAmount === null ? "" : String(expectedAmount));
    setProb(probability === null ? "" : String(probability));
  }, [expectedAmount, probability]);

  const save = async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/investors/pipeline", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          investorId,
          expectedAmount: amount === "" ? null : Number(amount),
          probability: prob === "" ? null : Number(prob),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || "Failed to save cheque");
      toast.success("Cheque saved");
      setOpen(false);
      onSaved();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save cheque");
    } finally {
      setSaving(false);
    }
  };

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-[4px] text-[11px] text-gray-400 hover:text-lime-600 hover:bg-lime-50 dark:hover:bg-lime-900/20 px-[8px] py-[4px] rounded-[6px] transition-all"
        title="Set the expected cheque for this investor"
      >
        <i className="ri-money-dollar-circle-line text-[13px]"></i>
        {expectedAmount === null ? "Set cheque" : formatMoney(expectedAmount)}
      </button>
    );
  }

  return (
    <div className="flex items-center gap-[4px]">
      <input
        type="number"
        min={0}
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
        placeholder="Amount"
        className="w-[92px] px-[6px] py-[3px] text-[11px] rounded-[6px] border border-gray-200 dark:border-gray-700 bg-white dark:bg-[#141824]"
      />
      <input
        type="number"
        min={0}
        max={100}
        value={prob}
        onChange={(e) => setProb(e.target.value)}
        placeholder="%"
        className="w-[46px] px-[6px] py-[3px] text-[11px] rounded-[6px] border border-gray-200 dark:border-gray-700 bg-white dark:bg-[#141824]"
        title="Probability 0–100. Leave blank to use the stage default."
      />
      <button
        onClick={save}
        disabled={saving}
        className="text-[11px] text-lime-700 hover:text-lime-800 px-[6px] py-[3px] rounded-[6px] bg-lime-50 dark:bg-lime-900/20 disabled:opacity-50"
      >
        {saving ? "…" : "Save"}
      </button>
      <button
        onClick={() => setOpen(false)}
        className="text-[11px] text-gray-400 hover:text-gray-600 px-[4px] py-[3px]"
        aria-label="Cancel"
      >
        <i className="ri-close-line"></i>
      </button>
    </div>
  );
}
