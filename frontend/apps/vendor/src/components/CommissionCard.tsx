import { ApiError, api, rupees } from "@poolit/domain";
import type { FeeStatement } from "@poolit/domain";
import { useCallback, useEffect, useState } from "react";
import { useIsAdmin } from "../hooks/useIsAdmin";
import { useToast } from "../state/ToastContext";
import { Button, Card } from "./ui";

const iso = (d: Date) => {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};

/**
 * The store's commission statement for a date range: delivered orders, goods value and what
 * Poolit charges, straight from the ledger written when each order is delivered. Poolit admins
 * also get the form that sets the store's terms.
 */
export function CommissionCard({ vendorId }: { vendorId: string }) {
  const today = new Date();
  const [from, setFrom] = useState(iso(new Date(today.getFullYear(), today.getMonth(), 1)));
  const [to, setTo] = useState(iso(today));
  const [statement, setStatement] = useState<FeeStatement | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const admin = useIsAdmin();
  const { notify } = useToast();
  const [feeType, setFeeType] = useState<"percent" | "fixed_per_order">("percent");
  const [feeValue, setFeeValue] = useState("");
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setStatement(await api.getFeeStatement(vendorId, from, to));
    } catch (err) {
      setStatement(null);
      setError(
        err instanceof ApiError && err.status === 403
          ? "Only the store owner can see the commission statement."
          : err instanceof ApiError
            ? err.message
            : "Couldn't load the statement.",
      );
    } finally {
      setLoading(false);
    }
  }, [vendorId, from, to]);

  useEffect(() => {
    void load();
  }, [load]);

  async function saveTerms() {
    const value = Number(feeValue);
    if (!Number.isFinite(value) || value < 0) return;
    setSaving(true);
    try {
      await api.setFeeTerms(vendorId, feeType, value);
      notify("Commission saved. It applies to orders delivered from now on.", "success");
      setFeeValue("");
      await load();
    } catch (err) {
      notify(err instanceof ApiError ? err.message : "Couldn't save the commission.");
    } finally {
      setSaving(false);
    }
  }

  const termsText = statement?.terms
    ? statement.terms.feeType === "percent"
      ? `${statement.terms.feeValue}% of goods`
      : `${rupees(statement.terms.feeValue)} per delivered order`
    : "Not set yet";

  return (
    <Card icon="receipt_long" title="Commission statement" subtitle="What Poolit charges on delivered orders">
      <div className="grid grid-cols-2 gap-space-xs">
        <label className="block text-label-sm text-secondary">
          From
          <input
            type="date"
            value={from}
            max={to}
            onChange={(e) => setFrom(e.target.value)}
            className="mt-1 w-full rounded-lg bg-surface-container-low px-space-sm py-1.5 text-body-md text-on-surface outline-none focus:ring-2 focus:ring-primary"
          />
        </label>
        <label className="block text-label-sm text-secondary">
          To
          <input
            type="date"
            value={to}
            min={from}
            onChange={(e) => setTo(e.target.value)}
            className="mt-1 w-full rounded-lg bg-surface-container-low px-space-sm py-1.5 text-body-md text-on-surface outline-none focus:ring-2 focus:ring-primary"
          />
        </label>
      </div>

      {error && <p className="mt-space-sm text-body-sm text-error">{error}</p>}
      {statement && !error && (
        <dl className="mt-space-sm space-y-1.5 text-body-md" aria-busy={loading}>
          <Line label="Current terms" value={termsText} />
          <Line label="Delivered orders" value={String(statement.orders)} />
          <Line label="Goods sold" value={rupees(statement.goodsPaise / 100)} />
          <Line label="Commission" value={rupees(statement.commissionPaise / 100)} strong />
        </dl>
      )}
      <p className="mt-space-sm text-label-sm text-secondary">
        Each delivered order is written once, with the terms in force that day, so a later change never rewrites past orders.
      </p>

      {admin && (
        <div className="mt-space-md border-t border-surface-container-low pt-space-sm">
          <p className="text-label-sm uppercase tracking-wide text-secondary">Poolit team: set this store&apos;s commission</p>
          <div className="mt-space-xs flex flex-wrap items-center gap-space-xs">
            <select
              value={feeType}
              onChange={(e) => setFeeType(e.target.value as "percent" | "fixed_per_order")}
              aria-label="Commission type"
              className="rounded-lg bg-surface-container-low px-space-sm py-1.5 text-body-md text-on-surface outline-none focus:ring-2 focus:ring-primary"
            >
              <option value="percent">Percent of goods</option>
              <option value="fixed_per_order">Fixed rupees per order</option>
            </select>
            <input
              value={feeValue}
              onChange={(e) => setFeeValue(e.target.value.replace(/[^\d.]/g, ""))}
              inputMode="decimal"
              placeholder={feeType === "percent" ? "0 to 50" : "0 to 100"}
              aria-label="Commission value"
              className="w-24 rounded-lg bg-surface-container-low px-space-sm py-1.5 text-body-md text-on-surface outline-none focus:ring-2 focus:ring-primary"
            />
            <Button variant="primary" size="sm" onClick={() => void saveTerms()} disabled={saving || feeValue === ""}>
              {saving ? "Saving…" : "Save"}
            </Button>
          </div>
        </div>
      )}
    </Card>
  );
}

function Line({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-space-sm">
      <dt className="text-secondary">{label}</dt>
      <dd className={strong ? "font-mono text-headline-sm text-on-surface" : "font-mono text-on-surface"}>{value}</dd>
    </div>
  );
}
