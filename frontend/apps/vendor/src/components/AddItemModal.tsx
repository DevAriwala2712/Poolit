import { CATEGORIES, useStore } from "@poolit/domain";
import { useState } from "react";
import { usePhotoUpload } from "../hooks/usePhotoUpload";
import { MaterialIcon } from "./MaterialIcon";
import { Button } from "./ui";

export function AddItemModal({
  open,
  onClose,
  vendorId,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  vendorId: string;
  /** Called with the new item's id once it (and its barcode) is saved. */
  onCreated?: (itemId: string) => void;
}) {
  const { createMenuItem, generateBarcode, setItemBarcode } = useStore();
  const uploadPhoto = usePhotoUpload();
  const [photo, setPhoto] = useState<File | null>(null);
  const [barcodeMode, setBarcodeMode] = useState<"auto" | "existing" | "none">("auto");
  const [existingCode, setExistingCode] = useState("");

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
  const valid =
    name.trim() && unit.trim() && Number.isFinite(priceNum) && priceNum > 0 &&
    (barcodeMode !== "existing" || existingCode.trim().length >= 4);

  function reset() {
    setName("");
    setCategory(CATEGORIES[0]);
    setPrice("");
    setUnit("");
    setStockQty("0");
    setLowStockThreshold("5");
    setArt("📦");
    setBarcodeMode("auto");
    setExistingCode("");
    setPhoto(null);
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
      const item = await createMenuItem(vendorId, {
        name: name.trim(),
        category,
        price: priceNum,
        unit: unit.trim(),
        stockQty: Number(stockQty) || 0,
        lowStockThreshold: Number(lowStockThreshold) || 0,
        art: art.trim() || "📦",
      });
      // The item exists now; a barcode failure is reported but doesn't lose it.
      try {
        if (barcodeMode === "auto") await generateBarcode(item.id);
        if (barcodeMode === "existing") await setItemBarcode(vendorId, item.id, existingCode.trim());
      } catch (err) {
        setError(`Item added, but the barcode couldn't be saved: ${err instanceof Error ? err.message : "try again from Inventory"}`);
        return;
      }
      if (photo) {
        try {
          await uploadPhoto(vendorId, item.id, photo);
        } catch (err) {
          setError(`Item added, but the photo couldn't be saved: ${err instanceof Error ? err.message : "add it again from Inventory"}`);
          return;
        }
      }
      handleClose();
      onCreated?.(item.id);
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

          <Field label="Photo (optional)">
            <input
              type="file"
              accept="image/*"
              data-testid="add-item-photo"
              onChange={(e) => setPhoto(e.target.files?.[0] ?? null)}
              className="block w-full text-body-sm text-secondary file:mr-space-sm file:rounded file:border-0 file:bg-surface-container file:px-space-sm file:py-1 file:text-body-sm file:text-on-surface"
            />
            <p className="mt-1 text-label-sm text-secondary">One clear photo of the pack. It is shrunk on this phone before it is uploaded.</p>
          </Field>

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

          <div>
            <span className="mb-1 block text-label-sm uppercase tracking-wide text-secondary">Barcode</span>
            <div className="grid grid-cols-3 gap-1 rounded-lg bg-surface-container-low p-1">
              {([
                ["auto", "Generate"],
                ["existing", "Has one"],
                ["none", "None"],
              ] as const).map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setBarcodeMode(key)}
                  className={`h-8 rounded-md text-body-sm transition ${barcodeMode === key ? "bg-surface-container-lowest text-on-surface shadow-sm" : "text-secondary"}`}
                >
                  {label}
                </button>
              ))}
            </div>
            {barcodeMode === "auto" && (
              <p className="mt-1 text-label-sm text-secondary">A unique in-store barcode is created and its label opens for printing.</p>
            )}
            {barcodeMode === "existing" && (
              <input
                inputMode="numeric"
                value={existingCode}
                onChange={(e) => setExistingCode(e.target.value.trim())}
                placeholder="Type the code printed on the pack"
                className="mt-1 w-full rounded-lg bg-surface-container-low px-space-sm py-1.5 text-[16px] text-on-surface outline-none focus:ring-2 focus:ring-primary md:text-body-md"
              />
            )}
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
