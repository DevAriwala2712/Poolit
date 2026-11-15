import { rupees } from "@poolit/domain";
import type { MenuItem } from "@poolit/domain";
import { ean13Svg, isValidEAN13 } from "../lib/ean13";
import { escapeHtml } from "../lib/html";
import { Barcode } from "./Barcode";
import { Drawer } from "./Drawer";
import { Button } from "./ui";

const esc = escapeHtml;

/** Opens a print-ready A4 sheet of shelf labels (3 per row, 63.5 × 38 mm). */
export function printLabels(items: MenuItem[], storeName: string) {
  const labels = items
    .filter((i) => i.barcode && isValidEAN13(i.barcode))
    .map(
      (i) => `<div class="label">
        <div class="name">${esc(i.name)}</div>
        <div class="meta">${esc(i.unit)} · ${rupees(i.price)}${i.mrp ? ` · MRP ${rupees(i.mrp)}` : ""}</div>
        ${ean13Svg(i.barcode!)}
      </div>`,
    )
    .join("");
  const win = window.open("", "_blank", "width=820,height=900");
  if (!win) return false;
  win.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>Labels — ${esc(storeName)}</title>
    <style>
      @page { size: A4; margin: 10mm; }
      body { margin: 0; font-family: system-ui, sans-serif; }
      .sheet { display: grid; grid-template-columns: repeat(3, 63.5mm); gap: 2mm; }
      .label { height: 38mm; box-sizing: border-box; padding: 2mm 3mm; border: 0.2mm dashed #bbb; break-inside: avoid; display: flex; flex-direction: column; }
      .name { font-size: 10pt; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
      .meta { font-size: 8pt; color: #333; margin: 0.5mm 0 1mm; }
      svg { flex: 1; width: 100%; min-height: 0; }
      @media print { .label { border-color: #eee; } .hint { display: none; } }
    </style></head><body>
    <p class="hint" style="font-size:12px;color:#555">Print on A4 (3 × 7 labels). Scan any label in the Poolit Scan screen to see and update its quantity.</p>
    <div class="sheet">${labels}</div>
    <script>window.onload = () => setTimeout(() => window.print(), 300);</script>
    </body></html>`);
  win.document.close();
  return true;
}

function downloadSvg(item: MenuItem) {
  const blob = new Blob([ean13Svg(item.barcode!)], { type: "image/svg+xml" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${item.name.replace(/[^\w]+/g, "-").toLowerCase()}-${item.barcode}.svg`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Drawer preview of one item's label with print / download actions. */
export function BarcodeLabelDrawer({
  item,
  storeName,
  onClose,
}: {
  item: MenuItem | null;
  storeName: string;
  onClose: () => void;
}) {
  if (!item?.barcode) return null;
  const printable = isValidEAN13(item.barcode);
  return (
    <Drawer
      open
      onClose={onClose}
      title="Barcode label"
      subtitle={`${item.name} · ${storeName}`}
      footer={
        <div className="flex gap-space-sm">
          <Button variant="primary" icon="print" className="!h-10 flex-1" disabled={!printable} onClick={() => printLabels([item], storeName)}>
            Print label
          </Button>
          <Button icon="download" className="!h-10" disabled={!printable} onClick={() => downloadSvg(item)}>
            SVG
          </Button>
        </div>
      }
    >
      <div className="mx-auto w-full max-w-xs rounded-lg border border-dashed border-surface-container-highest bg-white p-space-md">
        <p className="truncate text-headline-sm text-black">{item.name}</p>
        <p className="text-body-sm text-neutral-600">
          {item.unit} · {rupees(item.price)}
          {item.mrp ? ` · MRP ${rupees(item.mrp)}` : ""}
        </p>
        <Barcode value={item.barcode} className="mt-space-sm w-full" height={70} />
      </div>
      <p className="mt-space-md text-body-sm text-secondary">
        Stick this on the shelf or product. Scanning it on the Scan screen shows the live quantity and lets you add,
        count or remove stock.
      </p>
      {!printable && (
        <p className="mt-space-sm text-body-sm text-secondary">
          This item uses a manufacturer barcode that isn't EAN-13, so there's no label to print — scan the product itself.
        </p>
      )}
    </Drawer>
  );
}
