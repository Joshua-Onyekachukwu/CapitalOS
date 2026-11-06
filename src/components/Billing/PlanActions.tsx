"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";

interface PlanActionsProps {
  planSlug: string;
  interval: "month" | "year";
  label: string;
  variant?: "primary" | "outline";
}

/**
 * Starts a Stripe Checkout session. The API answers 503 with a plain reason
 * when Stripe is not configured; that message is shown verbatim rather than
 * being replaced with a generic "something went wrong", because "add
 * STRIPE_SECRET_KEY" is the actually useful instruction.
 */
export function CheckoutButton({ planSlug, interval, label, variant = "primary" }: PlanActionsProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const start = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planSlug, interval }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.url) {
        window.location.href = data.url;
        return;
      }
      setError(data.error || `Checkout unavailable (${res.status})`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Checkout failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <Button onClick={start} loading={loading} variant={variant}>
        {label}
      </Button>
      {error && (
        <p className="text-[12px] text-amber-700 dark:text-amber-400 mt-[8px] !mb-0">{error}</p>
      )}
    </div>
  );
}

/** Opens the Stripe-hosted portal (cards, invoices, cancellation). */
export function PortalButton() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const open = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/billing/portal", { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.url) {
        window.location.href = data.url;
        return;
      }
      setError(data.error || `Billing portal unavailable (${res.status})`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Billing portal failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <Button onClick={open} loading={loading} variant="outline">
        <i className="ri-bank-card-line text-[16px] mr-[6px]"></i>
        Manage billing
      </Button>
      {error && (
        <p className="text-[12px] text-amber-700 dark:text-amber-400 mt-[8px] !mb-0">{error}</p>
      )}
    </div>
  );
}
