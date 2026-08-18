import { useMemo, useState } from "react";
import { Card } from "../../components/Card";
import { Icon } from "../../components/Icon";
import { Pill } from "../../components/Pill";
import type { PillTone } from "../../components/Pill";
import { StatCard } from "../../components/StatCard";
import { useStore } from "../../domain/store";
import type { MenuItem, Vendor } from "../../domain/types";

const QUICK_AMOUNTS = [10, 25, 50];

function stockTone(item: MenuItem): PillTone {
  if (item.stockQty === 0) return "danger";
  if (item.stockQty <= item.lowStockThreshold) return "warning";
  return "success";
}

function stockLabel(item: MenuItem): string {
  if (item.stockQty === 0) return "Out of stock";
  if (item.stockQty <= item.lowStockThreshold) return "Low stock";
  return "In stock";
}

function RestockCell({ vendorId, item }: { vendorId: string; item: MenuItem }) {
  const { restockItem } = useStore();
  const [customAmount, setCustomAmount] = useState("");

  function addCustom() {
    const amount = Number(customAmount);
    if (!Number.isFinite(amount) || amount <= 0) return;
    restockItem(vendorId, item.id, Math.floor(amount));
    setCustomAmount("");
  }

  return (
    <div className="flex items-center gap-1.5 whitespace-nowrap">
      {QUICK_AMOUNTS.map((amount) => (
        <button
          key={amount}
          onClick={() => restockItem(vendorId, item.id, amount)}
          className="rounded-lg bg-secondary/10 px-2.5 py-1 text-xs font-semibold text-secondary hover:bg-secondary/20"
        >
          +{amount}
        </button>
      ))}
      <input
        value={customAmount}
        onChange={(e) => setCustomAmount(e.target.value.replace(/[^0-9]/g, ""))}
        placeholder="Custom"
        className="w-16 rounded-lg border border-secondary/30 px-2 py-1 text-xs outline-none focus:border-secondary"
      />
      <button
        onClick={addCustom}
        className="rounded-lg bg-primary px-2.5 py-1 text-xs font-semibold text-white"
      >
        Restock
      </button>
    </div>
  );
}

interface Row {
  vendor: Vendor;
  item: MenuItem;
}

export function Inventory() {
  const { vendors, hostels } = useStore();
  const [vendorFilter, setVendorFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [search, setSearch] = useState("");

  const allRows: Row[] = useMemo(
    () => vendors.flatMap((vendor) => vendor.menu.map((item) => ({ vendor, item }))),
    [vendors],
  );

  const totalLow = allRows.filter((r) => r.item.stockQty > 0 && r.item.stockQty <= r.item.lowStockThreshold).length;
  const totalOut = allRows.filter((r) => r.item.stockQty === 0).length;

  const rows = allRows.filter(({ vendor, item }) => {
    if (vendorFilter !== "all" && vendor.id !== vendorFilter) return false;
    if (statusFilter === "low" && !(item.stockQty > 0 && item.stockQty <= item.lowStockThreshold)) return false;
    if (statusFilter === "out" && item.stockQty !== 0) return false;
    if (search && !item.name.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        <StatCard label="Menu Items" value={String(allRows.length)} icon="list" tone="primary" />
        <StatCard label="Vendors" value={String(vendors.length)} icon="store" tone="secondary" />
        <StatCard
          label="Low Stock"
          value={String(totalLow)}
          icon="alert"
          tone={totalLow > 0 ? "danger" : "secondary"}
          delta={{ label: totalLow > 0 ? "Needs restocking" : "All healthy", direction: totalLow > 0 ? "down" : "flat" }}
        />
        <StatCard
          label="Out of Stock"
          value={String(totalOut)}
          icon="box"
          tone={totalOut > 0 ? "danger" : "secondary"}
          delta={{ label: totalOut > 0 ? "Unavailable to students" : "Everything available", direction: totalOut > 0 ? "down" : "flat" }}
        />
      </div>

      <Card flush>
        <div className="flex flex-wrap items-center gap-3 border-b border-surface px-5 py-3.5">
          <div className="flex items-center gap-2 rounded-lg bg-surface px-3 py-1.5">
            <Icon name="search" className="h-4 w-4 text-muted" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search items…"
              className="w-44 bg-transparent text-sm text-body outline-none placeholder:text-muted"
            />
          </div>

          <label className="flex items-center gap-2 text-sm text-muted">
            Vendor:
            <select
              value={vendorFilter}
              onChange={(e) => setVendorFilter(e.target.value)}
              className="rounded-lg border border-black/10 bg-white px-2 py-1.5 text-sm text-body outline-none focus:border-secondary"
            >
              <option value="all">All vendors</option>
              {vendors.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.name}
                </option>
              ))}
            </select>
          </label>

          <label className="flex items-center gap-2 text-sm text-muted">
            Status:
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="rounded-lg border border-black/10 bg-white px-2 py-1.5 text-sm text-body outline-none focus:border-secondary"
            >
              <option value="all">All</option>
              <option value="low">Low stock</option>
              <option value="out">Out of stock</option>
            </select>
          </label>

          <span className="ml-auto text-xs font-medium text-muted">{rows.length} items</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[860px] border-collapse text-sm">
            <thead>
              <tr className="bg-surface/60 text-left text-[11px] uppercase tracking-wide whitespace-nowrap text-muted">
                <th className="px-5 py-2.5 font-semibold">SKU</th>
                <th className="px-5 py-2.5 font-semibold">Item</th>
                <th className="px-5 py-2.5 font-semibold">Vendor</th>
                <th className="px-5 py-2.5 font-semibold">Category</th>
                <th className="px-5 py-2.5 font-semibold">Price</th>
                <th className="px-5 py-2.5 font-semibold">Stock</th>
                <th className="px-5 py-2.5 font-semibold">Status</th>
                <th className="px-5 py-2.5 font-semibold">Restock</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(({ vendor, item }) => {
                const hostel = hostels.find((h) => h.id === vendor.hostelId);
                return (
                  <tr
                    key={item.id}
                    className="border-b border-surface transition-colors last:border-0 hover:bg-surface/50"
                  >
                    <td className="px-5 py-3.5 whitespace-nowrap font-mono text-xs text-muted">{item.id.toUpperCase()}</td>
                    <td className="px-5 py-3.5 whitespace-nowrap font-medium text-body">{item.name}</td>
                    <td className="px-5 py-3.5 whitespace-nowrap text-muted">
                      {vendor.name}
                      <span className="block text-xs text-muted/70">{hostel?.name}</span>
                    </td>
                    <td className="px-5 py-3.5 whitespace-nowrap text-muted">{item.category}</td>
                    <td className="px-5 py-3.5 whitespace-nowrap text-body">₹{item.price}</td>
                    <td className="px-5 py-3.5 whitespace-nowrap font-medium text-body">
                      {item.stockQty}{" "}
                      <span className="text-xs font-normal text-muted">
                        {item.unit}
                        {item.stockQty !== 1 ? "s" : ""}
                      </span>
                    </td>
                    <td className="px-5 py-3.5">
                      <Pill tone={stockTone(item)}>{stockLabel(item)}</Pill>
                    </td>
                    <td className="px-5 py-3.5">
                      <RestockCell vendorId={vendor.id} item={item} />
                    </td>
                  </tr>
                );
              })}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-sm text-muted">
                    No items match your filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
