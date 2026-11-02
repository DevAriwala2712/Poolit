import { CATEGORIES, rupees, stockState, useStore } from "@poolit/domain";
import type { MenuItem } from "@poolit/domain";
import { useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { AddItemModal } from "../components/AddItemModal";
import { BarcodeLabelDrawer, printLabels } from "../components/BarcodeLabels";
import { KpiCard } from "../components/KpiCard";
import { MaterialIcon } from "../components/MaterialIcon";
import { Badge, Button, Card, EmptyState, Td, Th } from "../components/ui";
import { downloadCSV } from "../lib/csv";
import { useUIMode } from "../state/UIModeContext";
import { useVendor } from "../state/VendorContext";

const QUICK = [10, 25];

export function Inventory() {
  const [params, setParams] = useSearchParams();
  const { vendor, allVendors } = useVendor();
  const { restockItem, setItemPrice, generateBarcode, generateMissingBarcodes } = useStore();
  const { advancedMode } = useUIMode();

  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<string>("all");
  const [status, setStatus] = useState<string>(params.get("status") ?? "all");
  const [scope, setScope] = useState<"store" | "all">("store");
  const [editing, setEditing] = useState<string | null>(null);
  const [draftPrice, setDraftPrice] = useState("");
  const [customAmounts, setCustomAmounts] = useState<Record<string, string>>({});
  const navigate = useNavigate();
  const [addItemOpen, setAddItemOpen] = useState(false);
  const [labelItemId, setLabelItemId] = useState<string | null>(null);
  const [generating, setGenerating] = useState<string | null>(null);

  const pool = useMemo(
    () =>
      scope === "store"
        ? vendor.menu.map((item) => ({ item, vendorName: vendor.name, vendorId: vendor.id }))
        : allVendors.flatMap((v) =>
            v.menu.map((item) => ({ item, vendorName: v.name, vendorId: v.id })),
          ),
    [scope, vendor, allVendors],
  );

  const rows = useMemo(
    () =>
      pool.filter(({ item }) => {
        if (category !== "all" && item.category !== category) return false;
        if (status === "low" && stockState(item) !== "low") return false;
        if (status === "out" && stockState(item) !== "out") return false;
        if (status === "ok" && stockState(item) !== "ok") return false;
        if (query.trim() && !item.name.toLowerCase().includes(query.trim().toLowerCase()))
          return false;
        return true;
      }),
    [pool, category, status, query],
  );

  const low = pool.filter(({ item }) => stockState(item) === "low").length;
  const out = pool.filter(({ item }) => stockState(item) === "out").length;
  const stockValue = pool.reduce((sum, { item }) => sum + item.price * item.stockQty, 0);

  function commitPrice(vendorId: string, item: MenuItem) {
    const next = Number(draftPrice);
    if (Number.isFinite(next) && next > 0) setItemPrice(vendorId, item.id, Math.round(next));
    setEditing(null);
    setDraftPrice("");
  }

  function commitCustomRestock(vendorId: string, item: MenuItem) {
    const raw = customAmounts[item.id];
    const amount = Number(raw);
    if (!raw || !Number.isFinite(amount) || !Number.isInteger(amount) || amount <= 0) return;
    void restockItem(vendorId, item.id, amount);
    setCustomAmounts((prev) => ({ ...prev, [item.id]: "" }));
  }

  const missingBarcodes = vendor.menu.filter((m) => !m.barcode).length;
  const labelItem = labelItemId ? pool.find(({ item }) => item.id === labelItemId)?.item ?? null : null;

  async function generateFor(item: MenuItem) {
    setGenerating(item.id);
    try {
      await generateBarcode(item.id);
      setLabelItemId(item.id);
    } catch {
      // failure already shown as a toast by the store
    } finally {
      setGenerating(null);
    }
  }

  async function generateAllMissing() {
    setGenerating("all");
    try {
      await generateMissingBarcodes(vendor.id);
    } catch {
      // toast shown by the store
    } finally {
      setGenerating(null);
    }
  }

  /** Barcode line under an item: open its label, or generate one. */
  function barcodeLine(item: MenuItem) {
    return item.barcode ? (
      <button
        onClick={() => setLabelItemId(item.id)}
        className="mt-0.5 inline-flex max-w-full items-center gap-1 rounded text-label-sm text-tertiary hover:underline"
        title="View / print barcode label"
      >
        <MaterialIcon name="barcode" className="text-[14px]" />
        <span className="truncate font-mono">{item.barcode}</span>
      </button>
    ) : (
      <button
        onClick={() => void generateFor(item)}
        disabled={generating !== null}
        className="mt-0.5 inline-flex items-center gap-1 rounded text-label-sm text-primary hover:underline disabled:opacity-50"
      >
        <MaterialIcon name="add_circle" className="text-[14px]" />
        {generating === item.id ? "Generating…" : "Generate barcode"}
      </button>
    );
  }

  function categoryCount(c: string) {
    return c === "all" ? pool.length : pool.filter(({ item }) => item.category === c).length;
  }

  function exportLedger() {
    downloadCSV(
      `${vendor.name.replace(/\s+/g, "-").toLowerCase()}-inventory-${new Date().toISOString().slice(0, 10)}.csv`,
      rows.map(({ item, vendorName }) => ({
        Name: item.name,
        Store: vendorName,
        Category: item.category,
        "Price (₹)": item.price,
        "Stock qty": item.stockQty,
        "Low-stock threshold": item.lowStockThreshold,
        Barcode: item.barcode ?? "",
      })),
    );
  }

  return (
    <div className="space-y-space-md">
      <div>
        <p className="text-label-sm uppercase tracking-wide text-secondary">{vendor.name} / SKU Realtime Stock & Prep</p>
        <h1 className="hidden text-headline-lg text-on-surface md:block">Inventory Management</h1>
      </div>

      <div className="grid grid-cols-2 gap-space-sm md:gap-space-md lg:grid-cols-4">
        <KpiCard label="Active SKUs" value={String(pool.length)} icon="inventory_2" hint={scope === "store" ? vendor.name : "all stores"} />
        <KpiCard label="Prep Valuation" value={rupees(stockValue)} icon="account_balance_wallet" hint="at current price" />
        <KpiCard label="Low Stock Alerts" value={String(low)} icon="warning" hint={low > 0 ? "Immediate restock suggested" : "healthy"} />
        <KpiCard label="Out of Stock" value={String(out)} icon="do_not_disturb_on" hint={out > 0 ? "unavailable to students" : "all available"} />
      </div>

      <Card flush>
        <div className="flex flex-col gap-space-sm border-b border-surface-container-low p-space-md">
          <div className="flex flex-wrap items-center gap-space-sm">
            <div className="flex w-full items-center gap-space-sm rounded-lg bg-surface-container-low px-space-sm py-space-xs md:w-auto">
              <MaterialIcon name="search" className="text-[16px] text-secondary" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search SKU, ingredient, category…"
                className="w-full min-w-0 bg-transparent text-[16px] md:w-56 md:text-body-lg text-on-surface outline-none placeholder:text-secondary"
              />
            </div>
            <Select value={scope} onChange={(v) => setScope(v as "store" | "all")}>
              <option value="store">This Store</option>
              <option value="all">All Campus Hubs</option>
            </Select>
            <Button
              variant="primary"
              size="sm"
              icon="qr_code_scanner"
              className="ml-auto"
              onClick={() => navigate("/scan")}
            >
              Scan barcode
            </Button>
            <Button size="sm" icon="add" onClick={() => setAddItemOpen(true)}>
              Add item
            </Button>
            {missingBarcodes > 0 && (
              <Button size="sm" icon="add_circle" onClick={() => void generateAllMissing()} disabled={generating !== null}>
                {generating === "all" ? "Generating…" : `Generate ${missingBarcodes} missing barcode${missingBarcodes === 1 ? "" : "s"}`}
              </Button>
            )}
            <Button
              size="sm"
              icon="print"
              onClick={() => printLabels(rows.map((r) => r.item), vendor.name)}
              disabled={!rows.some((r) => r.item.barcode)}
            >
              Print labels
            </Button>
            {advancedMode && (
              <Button size="sm" icon="download" onClick={exportLedger} disabled={rows.length === 0}>
                Export Ledger
              </Button>
            )}

          </div>

          <div className="flex flex-wrap items-center gap-space-xs">
            {["all", ...CATEGORIES].map((c) => (
              <button
                key={c}
                onClick={() => setCategory(c)}
                className={`flex items-center gap-space-xs rounded px-space-sm py-space-xs text-body-md transition ${
                  category === c ? "bg-inverse-surface text-inverse-on-surface" : "text-secondary hover:bg-surface-container"
                }`}
              >
                {c === "all" ? "All Items" : c}
                <span className="rounded-full bg-surface-container-highest px-space-xs text-label-sm text-on-surface">
                  {categoryCount(c)}
                </span>
              </button>
            ))}
          </div>

          <div className="flex items-center gap-space-xs">
            {[
              { key: "all", label: "All Status" },
              { key: "ok", label: `In Stock (${pool.length - low - out})` },
              { key: "low", label: `Low (${low})` },
              { key: "out", label: `Out (${out})` },
            ].map((s) => (
              <button
                key={s.key}
                onClick={() => {
                  setStatus(s.key);
                  setParams(s.key === "all" ? {} : { status: s.key }, { replace: true });
                }}
                className={`rounded px-space-sm py-space-xs text-body-sm transition ${
                  status === s.key ? "bg-surface-container-high text-on-surface" : "text-secondary hover:bg-surface-container"
                }`}
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>

        {rows.length === 0 ? (
          <EmptyState icon="inventory_2" title="No items match" body="Adjust the filters to see more stock." />
        ) : (
          <>
          {/* Phone: one card per item, big tap targets for restocking. */}
          <ul className="divide-y divide-surface-container-low md:hidden">
            {rows.map(({ item, vendorName, vendorId }) => {
              const state = stockState(item);
              return (
                <li key={item.id} className="space-y-space-sm px-space-md py-space-sm">
                  <div className="flex items-center gap-space-sm">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded bg-surface-container text-lg">{item.art}</span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-body-lg text-on-surface">{item.name}</p>
                      <p className="truncate text-label-sm text-secondary">
                        {rupees(item.price)} · {item.unit}
                        {scope === "all" && ` · ${vendorName}`}
                      </p>
                      {barcodeLine(item)}
                    </div>
                    <div className="text-right">
                      <p className="font-mono text-headline-sm text-on-surface">{item.stockQty}</p>
                      <Badge tone={state === "out" ? "error" : state === "low" ? "primary" : "ready"}>
                        {state === "out" ? "Out" : state === "low" ? "Low" : "OK"}
                      </Badge>
                    </div>
                  </div>
                  <div className="flex items-center gap-space-xs">
                    {QUICK.map((amount) => (
                      <button
                        key={amount}
                        onClick={() => void restockItem(vendorId, item.id, amount)}
                        className="h-10 flex-1 rounded bg-surface-container text-body-md text-on-surface active:bg-surface-container-high"
                      >
                        +{amount}
                      </button>
                    ))}
                    <input
                      type="text"
                      inputMode="numeric"
                      value={customAmounts[item.id] ?? ""}
                      onChange={(e) => setCustomAmounts((prev) => ({ ...prev, [item.id]: e.target.value.replace(/\D/g, "") }))}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") commitCustomRestock(vendorId, item);
                      }}
                      placeholder="Qty"
                      aria-label={`Custom restock amount for ${item.name}`}
                      className="h-10 w-16 rounded bg-surface-container-low px-2 text-[16px] text-on-surface outline-none ring-1 ring-surface-container-high focus:ring-2 focus:ring-primary"
                    />
                    <button
                      onClick={() => commitCustomRestock(vendorId, item)}
                      disabled={!customAmounts[item.id]}
                      className="h-10 rounded bg-primary-container px-3 text-body-md text-on-primary-container disabled:opacity-40"
                    >
                      Add
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
          <div className="hidden overflow-x-auto md:block">
            <table className="w-full min-w-[900px] border-collapse">
              <thead>
                <tr>
                  <Th>Product Name & SKU</Th>
                  {scope === "all" && <Th>Store</Th>}
                  <Th>Category</Th>
                  <Th>In-Store Price</Th>
                  <Th>Current Stock Level</Th>
                  <Th>Status</Th>
                  <Th>Quick Restock</Th>
                </tr>
              </thead>
              <tbody>
                {rows.map(({ item, vendorName, vendorId }) => {
                  const state = stockState(item);
                  const capacity = Math.max(item.stockQty, item.lowStockThreshold * 4);
                  const pct = Math.min(100, (item.stockQty / capacity) * 100);
                  return (
                    <tr
                      key={item.id}
                      className="border-b border-surface-container-low transition-colors last:border-0 hover:bg-surface-container-low"
                    >
                      <Td>
                        <div className="flex items-center gap-space-sm">
                          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded bg-surface-container text-base">
                            {item.art}
                          </span>
                          <div>
                            <p className="text-body-md text-on-surface">{item.name}</p>
                            <p className="font-label-sm text-label-sm text-secondary">SKU: {item.id.slice(0, 8).toUpperCase()}</p>
                            {barcodeLine(item)}
                          </div>
                        </div>
                      </Td>
                      {scope === "all" && <Td className="text-secondary">{vendorName}</Td>}
                      <Td>
                        <span className="rounded bg-surface-container px-space-xs py-space-2xs text-label-sm text-secondary">{item.category}</span>
                      </Td>
                      <Td>
                        {editing === item.id ? (
                          <input
                            autoFocus
                            value={draftPrice}
                            onChange={(e) => setDraftPrice(e.target.value.replace(/\D/g, ""))}
                            onBlur={() => commitPrice(vendorId, item)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") commitPrice(vendorId, item);
                              if (e.key === "Escape") setEditing(null);
                            }}
                            className="w-20 rounded bg-surface-container-low px-1.5 py-1 text-body-md text-on-surface outline-none ring-2 ring-primary"
                          />
                        ) : (
                          <button
                            onClick={() => { setEditing(item.id); setDraftPrice(String(item.price)); }}
                            className="rounded px-1.5 py-1 text-body-md text-on-surface transition hover:bg-surface-container-low"
                            title="Click to edit price"
                          >
                            {rupees(item.price)}
                          </button>
                        )}
                      </Td>
                      <Td>
                        <div className="w-32">
                          <div className="flex items-baseline justify-between text-body-sm">
                            <span className="font-semibold text-on-surface">{item.stockQty}</span>
                            <span className="text-label-sm text-secondary">units</span>
                          </div>
                          <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-surface-container">
                            <div
                              className={`h-full rounded-full ${state === "out" ? "bg-error" : state === "low" ? "bg-primary" : "bg-tertiary"}`}
                              style={{ width: `${Math.max(3, pct)}%` }}
                            />
                          </div>
                        </div>
                      </Td>
                      <Td>
                        <Badge tone={state === "out" ? "error" : state === "low" ? "primary" : "ready"}>
                          {state === "out" ? "Out of Stock" : state === "low" ? "Low Stock" : "In Stock"}
                        </Badge>
                      </Td>
                      <Td>
                        <div className="flex items-center gap-1">
                          {QUICK.map((amount) => (
                            <button
                              key={amount}
                              onClick={() => restockItem(vendorId, item.id, amount)}
                              className="rounded bg-surface-container px-2 py-1 text-label-sm text-secondary transition hover:bg-surface-container-high hover:text-on-surface"
                            >
                              +{amount}
                            </button>
                          ))}
                          <input
                            type="text"
                            inputMode="numeric"
                            value={customAmounts[item.id] ?? ""}
                            onChange={(e) =>
                              setCustomAmounts((prev) => ({
                                ...prev,
                                [item.id]: e.target.value.replace(/\D/g, ""),
                              }))
                            }
                            onKeyDown={(e) => {
                              if (e.key === "Enter") commitCustomRestock(vendorId, item);
                            }}
                            placeholder="Qty"
                            aria-label={`Custom restock amount for ${item.name}`}
                            className="w-14 rounded bg-surface-container-low px-1.5 py-1 text-label-sm text-on-surface outline-none ring-1 ring-surface-container-high focus:ring-2 focus:ring-primary"
                          />
                          <button
                            onClick={() => commitCustomRestock(vendorId, item)}
                            disabled={!customAmounts[item.id]}
                            className="rounded bg-surface-container px-2 py-1 text-label-sm text-secondary transition hover:bg-surface-container-high hover:text-on-surface disabled:cursor-not-allowed disabled:opacity-40"
                          >
                            Add
                          </button>
                        </div>
                      </Td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          </>
        )}
        <div className="px-space-md py-space-sm text-label-sm text-secondary">Showing {rows.length} of {pool.length} items</div>
      </Card>

      {/* Decorative — future hardware/automation integrations */}
      {advancedMode && (
        <div className="grid grid-cols-1 gap-space-md lg:grid-cols-3">
          <Card title="Auto-Order Webhook" action={<Badge tone="ready" dot={false}>Ready</Badge>}>
            <p className="text-body-sm text-secondary">
              Trigger vendor delivery slips directly once minimum inventory threshold is crossed on Campus Central DB.
            </p>
            <div className="mt-space-sm flex items-center justify-between text-body-sm">
              <span className="text-secondary">Supplier: Metro Cash & Fresh Prep</span>
              <span className="text-primary">Configure →</span>
            </div>
          </Card>
          <Card title="Cold Holding Storage #02" action={<span className="flex items-center gap-space-2xs text-body-sm text-tertiary"><span className="h-2 w-2 rounded-full bg-tertiary" />3.8°C</span>}>
            <p className="text-body-sm text-secondary">
              Refrigeration sensor reading steady within safe compliance bounds for raw meat & dairy bases.
            </p>
            <div className="mt-space-sm flex items-center justify-between text-body-sm">
              <span className="text-secondary">Chamber: Unit E-Walkin</span>
              <span className="text-tertiary">Nominal</span>
            </div>
          </Card>
          <Card title="Prep Consumption Run" action={<span className="text-body-sm text-secondary">1.4x Rush Factor</span>}>
            <div className="h-1.5 overflow-hidden rounded-full bg-surface-container">
              <div className="h-full w-[78%] rounded-full bg-primary" />
            </div>
            <div className="mt-space-sm flex items-center justify-between text-body-sm">
              <span className="text-secondary">Peak rush: 12:30 PM - 2:00 PM</span>
              <span className="text-primary">78% cap</span>
            </div>
          </Card>
        </div>
      )}

      <AddItemModal
        open={addItemOpen}
        onClose={() => setAddItemOpen(false)}
        vendorId={vendor.id}
        onCreated={(id) => {
          setScope("store");
          setLabelItemId(id);
        }}
      />
      <BarcodeLabelDrawer item={labelItem} storeName={vendor.name} onClose={() => setLabelItemId(null)} />
    </div>
  );
}

function Select({
  value,
  onChange,
  children,
}: {
  value: string;
  onChange: (v: string) => void;
  children: React.ReactNode;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="rounded-lg bg-surface-container-low px-space-sm py-1.5 text-body-md text-on-surface outline-none focus:ring-2 focus:ring-primary"
    >
      {children}
    </select>
  );
}
