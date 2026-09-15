import { CATEGORIES, useStore } from "@poolit/domain";
import { useState } from "react";
import { MaterialIcon } from "./MaterialIcon";
import { Button } from "./ui";

export function AddItemModal({
  open,
  onClose,
  vendorId,
}: {
  open: boolean;
  onClose: () => void;
  vendorId: string;
}) {
  const { createMenuItem } = useStore();

  const [name, setName] = useState("");
  const [category, setCategory] = useState<string>(CATEGORIES[0]);
  const [price, setPrice] = useState("");
  const [unit, setUnit] = useState("");
  const [stockQty, setStockQty] = useState("0");
  const [lowStockThreshold, setLowStockThreshold] = useState("5");
  const [art, setArt] = useState("📦");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!open) return null;

  const priceNum = Number(price);
  const valid = name.trim() && unit.trim() && Number.isFinite(priceNum) && priceNum > 0;

  function reset() {
    setName("");
    setCategory(CATEGORIES[0]);
    setPrice("");
    setUnit("");
    setStockQty("0");
    setLowStockThreshold("5");
    setArt("📦");
    setError(null);
  }

  function handleClose() {
    reset();
    onClose();
  }

  async function submit() {
    if (!valid) return;
    setSaving(true);
    setError(null);
    try {
      await createMenuItem(vendorId, {
        name: name.trim(),
        category,
        price: priceNum,
        unit: unit.trim(),
        stockQty: Number(stockQty) || 0,
        lowStockThreshold: Number(lowStockThreshold) || 0,
        art: art.trim() || "📦",
      });
      handleClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create item");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-space-md">
      <button
        aria-label="Close"
        onClick={handleClose}
        className="animate-fade absolute inset-0 bg-inverse-surface/40 backdrop-blur-[2px]"
      />
      <div className="animate-fade relative flex w-full max-w-md flex-col overflow-hidden rounded-lg bg-surface-container-lowest shadow-[0_4px_6px_-1px_rgba(15,23,42,0.08)]">
        <header className="flex items-center justify-between border-b border-surface-container-low px-space-md py-space-sm">
          <div className="flex items-center gap-space-xs">
            <MaterialIcon name="add_box" className="text-[18px] text-primary" />
            <h2 className="text-headline-sm text-on-surface">Add new item</h2>
          </div>
          <button
            onClick={handleClose}
            className="flex h-7 w-7 items-center justify-center rounded text-secondary transition hover:bg-surface-container hover:text-on-surface"
          >
            <MaterialIcon name="close" className="text-[16px]" />
          </button>
        </header>

        <div className="max-h-[70vh] space-y-space-sm overflow-y-auto p-space-md">
          <Field label="Name">
            <input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Maggi 2-Minute Noodles"
              className="w-full rounded-lg bg-surface-container-low px-space-sm py-1.5 text-body-md text-on-surface outline-none focus:ring-2 focus:ring-primary"
            />
          </Field>

          <div className="grid grid-cols-2 gap-space-sm">
            <Field label="Category">
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full rounded-lg bg-surface-container-low px-space-sm py-1.5 text-body-md text-on-surface outline-none focus:ring-2 focus:ring-primary"
              >
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </Field>
            <Field label="Art (emoji)">
              <input
                value={art}
                onChange={(e) => setArt(e.target.value)}
                maxLength={4}
                className="w-full rounded-lg bg-surface-container-low px-space-sm py-1.5 text-body-md text-on-surface outline-none focus:ring-2 focus:ring-primary"
              />
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-space-sm">
            <Field label="Price (₹)">
              <input
                inputMode="numeric"
                value={price}
                onChange={(e) => setPrice(e.target.value.replace(/[^\d]/g, ""))}
                placeholder="54"
                className="w-full rounded-lg bg-surface-container-low px-space-sm py-1.5 text-body-md text-on-surface outline-none focus:ring-2 focus:ring-primary"
              />
            </Field>
            <Field label="Unit / pack size">
              <input
                value={unit}
                onChange={(e) => setUnit(e.target.value)}
                placeholder="e.g. 70 g pack"
                className="w-full rounded-lg bg-surface-container-low px-space-sm py-1.5 text-body-md text-on-surface outline-none focus:ring-2 focus:ring-primary"
              />
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-space-sm">
            <Field label="Starting stock">
              <input
                inputMode="numeric"
                value={stockQty}
                onChange={(e) => setStockQty(e.target.value.replace(/\D/g, ""))}
                className="w-full rounded-lg bg-surface-container-low px-space-sm py-1.5 text-body-md text-on-surface outline-none focus:ring-2 focus:ring-primary"
              />
            </Field>
            <Field label="Low-stock threshold">
              <input
                inputMode="numeric"
                value={lowStockThreshold}
                onChange={(e) => setLowStockThreshold(e.target.value.replace(/\D/g, ""))}
                className="w-full rounded-lg bg-surface-container-low px-space-sm py-1.5 text-body-md text-on-surface outline-none focus:ring-2 focus:ring-primary"
              />
            </Field>
          </div>

          {error && <p className="text-body-sm text-error">{error}</p>}

          <Button
            variant="primary"
            className="w-full justify-center"
            disabled={!valid || saving}
            onClick={() => void submit()}
          >
            {saving ? "Adding…" : "Add item"}
          </Button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-label-sm uppercase tracking-wide text-secondary">{label}</span>
      {children}
    </label>
  );
}
