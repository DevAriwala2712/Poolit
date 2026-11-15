import { useStore } from "@poolit/domain";
import type { MenuItem, StockAdjustmentReason } from "@poolit/domain";
import { useState } from "react";
import { useToast } from "../state/ToastContext";
import { MaterialIcon } from "./MaterialIcon";
import { Button } from "./ui";

type Mode = "remove" | "set";

const REASONS: { key: StockAdjustmentReason; label: string }[] = [
  { key: "correction", label: "Added by mistake" },
  { key: "damaged", label: "Damaged" },
  { key: "expired", label: "Expired" },
  { key: "other", label: "Other" },
];

const QUICK_REMOVE = [1, 5, 10];

/**
 * Take stock down after an accidental press, or set it to the number actually counted.
 * Every change is recorded in the item's stock history by the database, and the toast
 * that follows offers Undo.
 */
export function StockFixModal({ item, onClose }: { item: MenuItem | null; onClose: () => void }) {
  const { adjustStock, restockItem } = useStore();
  const { notify } = useToast();
  const [mode, setMode] = useState<Mode>("remove");
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState<StockAdjustmentReason>("correction");
  const [busy, setBusy] = useState(false);

  if (!item) return null;

  const qty = amount === "" ? NaN : Number(amount);
  const whole = Number.isInteger(qty) && qty >= 0 && qty <= 100000;
  const tooMany = mode === "remove" && whole && qty > item.stockQty;
  const valid = whole && (mode === "remove" ? qty >= 1 && !tooMany : true);
  const after = !valid ? null : mode === "remove" ? item.stockQty - qty : qty;

  function close() {
    setAmount("");
    setMode("remove");
    setReason("correction");
    onClose();
  }

  async function submit() {
    if (!item || !valid || busy) return;
    const before = item.stockQty;
    const name = item.name;
    const itemId = item.id;
    const vendorId = item.vendorId;
    setBusy(true);
    try {
      if (mode === "remove") {
        await adjustStock(itemId, { mode: "remove", qty, reason });
        notify(`Removed ${qty} from ${name} (now ${before - qty})`, "success", {
          label: "Undo",
          onClick: () => void restockItem(vendorId, itemId, qty).catch(() => undefined),
        });
      } else {
        await adjustStock(itemId, { mode: "set", qty, reason: "count" });
        notify(`${name} set to ${qty}`, "success", {
          label: "Undo",
          onClick: () => void adjustStock(itemId, { mode: "set", qty: before, reason: "correction" }).catch(() => undefined),
        });
      }
      close();
    } catch {
      // the store already showed the reason as a toast; stay open so it can be corrected
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-space-md">
      <button
        aria-label="Close"
        onClick={close}
        className="animate-fade absolute inset-0 bg-inverse-surface/40 backdrop-blur-[2px]"
      />
      <div
        role="dialog"
        aria-label={`Fix stock for ${item.name}`}
        className="animate-fade relative flex w-full max-w-md flex-col overflow-hidden rounded-lg bg-surface-container-lowest shadow-[0_4px_6px_-1px_rgba(15,23,42,0.08)]"
      >
        <header className="flex items-center justify-between border-b border-surface-container-low px-space-md py-space-sm">
          <div className="flex min-w-0 items-center gap-space-xs">
            <MaterialIcon name="tune" className="text-[18px] text-primary" />
            <h2 className="truncate text-headline-sm text-on-surface">Fix stock · {item.name}</h2>
          </div>
          <button
            onClick={close}
            aria-label="Close"
            className="flex h-7 w-7 items-center justify-center rounded text-secondary transition hover:bg-surface-container hover:text-on-surface"
          >
            <MaterialIcon name="close" className="text-[16px]" />
          </button>
        </header>

        <div className="space-y-space-sm p-space-md">
          <p className="text-body-md text-secondary">
            Now in stock: <span className="font-mono text-on-surface">{item.stockQty}</span> {item.unit && `· ${item.unit}`}
          </p>

          <div className="grid grid-cols-2 gap-1 rounded-lg bg-surface-container-low p-1">
            {(
              [
                ["remove", "Take away"],
                ["set", "Set exact count"],
              ] as const
            ).map(([key, label]) => (
              <button
                key={key}
                onClick={() => {
                  setMode(key);
                  setAmount("");
                }}
                className={`h-9 rounded-md text-body-md transition ${
                  mode === key ? "bg-surface-container-lowest text-on-surface shadow-sm" : "text-secondary"
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {mode === "remove" && (
            <div className="flex gap-2">
              {QUICK_REMOVE.map((n) => (
                <button
                  key={n}
                  onClick={() => setAmount(String(n))}
                  className="h-10 flex-1 rounded bg-surface-container text-body-md text-on-surface active:bg-surface-container-high"
                >
                  −{n}
                </button>
              ))}
            </div>
          )}

          <label className="block">
            <span className="mb-1 block text-label-sm text-secondary">
              {mode === "remove" ? "How many to take away" : "How many are on the shelf"}
            </span>
            <input
              autoFocus
              type="text"
              inputMode="numeric"
              value={amount}
              onChange={(e) => setAmount(e.target.value.replace(/\D/g, ""))}
              onKeyDown={(e) => {
                if (e.key === "Enter") void submit();
              }}
              placeholder="0"
              className="w-full rounded-lg bg-surface-container-low px-space-sm py-2 text-[16px] text-on-surface outline-none focus:ring-2 focus:ring-primary"
            />
          </label>

          {mode === "remove" && (
            <div className="flex flex-wrap gap-2">
              {REASONS.map((r) => (
                <button
                  key={r.key}
                  onClick={() => setReason(r.key)}
                  className={`h-9 rounded-lg px-3 text-body-md transition ${
                    reason === r.key ? "bg-error-container text-on-error-container" : "bg-surface-container-low text-secondary"
                  }`}
                >
                  {r.label}
                </button>
              ))}
            </div>
          )}

          {tooMany && <p className="text-body-sm text-error">Only {item.stockQty} in stock, so you can't take away {qty}.</p>}
          {after !== null && (
            <p className="text-body-md text-on-surface">
              Stock will be <span className="font-mono font-semibold">{after}</span>
            </p>
          )}
        </div>

        <footer className="flex justify-end gap-space-xs border-t border-surface-container-low px-space-md py-space-sm">
          <Button onClick={close}>Cancel</Button>
          <Button variant="primary" onClick={() => void submit()} disabled={!valid || busy}>
            {busy ? "Saving…" : mode === "remove" ? "Remove" : "Set count"}
          </Button>
        </footer>
      </div>
    </div>
  );
}
