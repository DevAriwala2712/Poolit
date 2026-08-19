import { CATEGORIES, rupees, stockState, useStore } from "@poolit/domain";
import type { MenuItem } from "@poolit/domain";
import { useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Icon } from "../components/Icon";
import { KpiCard } from "../components/KpiCard";
import { Badge, Button, Card, EmptyState, Td, Th } from "../components/ui";
import { useVendor } from "../state/VendorContext";

const QUICK = [10, 25, 50];

export function Inventory() {
  const [params, setParams] = useSearchParams();
  const { vendor, allVendors } = useVendor();
  const { restockItem, setItemPrice } = useStore();

  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<string>("all");
  const [status, setStatus] = useState<string>(params.get("status") ?? "all");
  const [scope, setScope] = useState<"store" | "all">("store");
  const [editing, setEditing] = useState<string | null>(null);
  const [draftPrice, setDraftPrice] = useState("");

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

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <KpiCard label="SKUs" value={String(pool.length)} icon="box" hint={scope === "store" ? vendor.name : "all stores"} />
        <KpiCard label="Stock value" value={rupees(stockValue)} icon="rupee" hint="at current price" />
        <KpiCard label="Low stock" value={String(low)} icon="alert" hint={low > 0 ? "needs restock" : "healthy"} />
        <KpiCard label="Out of stock" value={String(out)} icon="close" hint={out > 0 ? "unavailable" : "all available"} />
      </div>

      <Card flush>
        <div className="flex flex-wrap items-center gap-2.5 border-b border-line-soft px-4 py-3">
          <div className="flex items-center gap-2 rounded-lg border border-line bg-raised px-2.5 py-1.5">
            <Icon name="search" className="h-3.5 w-3.5 text-faint" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search items…"
              className="w-44 bg-transparent text-[12.5px] text-text outline-none placeholder:text-faint"
            />
          </div>

          <Select value={scope} onChange={(v) => setScope(v as "store" | "all")}>
            <option value="store">This store</option>
            <option value="all">All stores</option>
          </Select>

          <Select value={category} onChange={setCategory}>
            <option value="all">All categories</option>
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </Select>

          <Select
            value={status}
            onChange={(v) => {
              setStatus(v);
              setParams(v === "all" ? {} : { status: v }, { replace: true });
            }}
          >
            <option value="all">All status</option>
            <option value="ok">In stock</option>
            <option value="low">Low stock</option>
            <option value="out">Out of stock</option>
          </Select>

          <span className="ml-auto text-[11.5px] text-faint">{rows.length} items</span>
          <Button size="sm" icon="download">
            Export
          </Button>
        </div>

        {rows.length === 0 ? (
          <EmptyState icon="box" title="No items match" body="Adjust the filters to see more stock." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] border-collapse">
              <thead>
                <tr className="border-b border-line-soft bg-panel/40">
                  <Th>SKU</Th>
                  <Th>Item</Th>
                  {scope === "all" && <Th>Store</Th>}
                  <Th>Category</Th>
                  <Th>Price</Th>
                  <Th>Stock</Th>
                  <Th>Status</Th>
                  <Th>Restock</Th>
                </tr>
              </thead>
              <tbody>
                {rows.map(({ item, vendorName, vendorId }) => {
                  const state = stockState(item);
                  return (
                    <tr
                      key={item.id}
                      className="border-b border-line-soft transition-colors last:border-0 hover:bg-raised/50"
                    >
                      <Td className="font-mono text-[11px] text-faint">{item.id.toUpperCase()}</Td>
                      <Td>
                        <div className="flex items-center gap-2.5">
                          <span className="text-base">{item.art}</span>
                          <div>
                            <p className="text-[12.5px] text-text">{item.name}</p>
                            <p className="text-[11px] text-faint">{item.unit}</p>
                          </div>
                        </div>
                      </Td>
                      {scope === "all" && <Td className="text-muted">{vendorName}</Td>}
                      <Td className="text-muted">{item.category}</Td>
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
                            className="w-20 rounded border border-accent bg-raised px-1.5 py-1 text-[12.5px] text-text outline-none"
                          />
                        ) : (
                          <button
                            onClick={() => {
                              setEditing(item.id);
                              setDraftPrice(String(item.price));
                            }}
                            className="rounded px-1.5 py-1 text-[12.5px] text-text transition hover:bg-raised"
                            title="Click to edit price"
                          >
                            {rupees(item.price)}
                          </button>
                        )}
                      </Td>
                      <Td className="font-medium text-text">
                        {item.stockQty}
                        <span className="ml-1 text-[11px] font-normal text-faint">units</span>
                      </Td>
                      <Td>
                        <Badge tone={state === "out" ? "bad" : state === "low" ? "warn" : "ok"}>
                          {state === "out" ? "Out of stock" : state === "low" ? "Low stock" : "In stock"}
                        </Badge>
                      </Td>
                      <Td>
                        <div className="flex items-center gap-1">
                          {QUICK.map((amount) => (
                            <button
                              key={amount}
                              onClick={() => restockItem(vendorId, item.id, amount)}
                              className="rounded-md border border-line bg-raised px-2 py-1 text-[11px] font-medium text-muted transition hover:border-accent/40 hover:text-accent"
                            >
                              +{amount}
                            </button>
                          ))}
                        </div>
                      </Td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
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
      className="rounded-lg border border-line bg-raised px-2.5 py-1.5 text-[12.5px] text-text outline-none focus:border-accent"
    >
      {children}
    </select>
  );
}
