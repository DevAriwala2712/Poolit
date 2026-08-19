import { CATEGORIES, stockState } from "@poolit/domain";
import type { MenuCategory, MenuItem } from "@poolit/domain";
import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Icon } from "../components/Icon";
import { ProductCard } from "../components/ProductCard";
import { Sheet } from "../components/Sheet";
import { Button, Chip, EmptyState, ProductGridSkeleton } from "../components/ui";
import { useHostelContext } from "../hooks/useHostelContext";

type SortKey = "relevance" | "priceLow" | "priceHigh" | "rating";
type DietKey = "all" | "veg" | "nonveg";

const SORTS: { key: SortKey; label: string }[] = [
  { key: "relevance", label: "Relevance" },
  { key: "priceLow", label: "Price: low to high" },
  { key: "priceHigh", label: "Price: high to low" },
  { key: "rating", label: "Rating" },
];

export function Categories() {
  const [params, setParams] = useSearchParams();
  const { vendor } = useHostelContext();
  const inputRef = useRef<HTMLInputElement>(null);

  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<MenuCategory | "All">(
    (params.get("c") as MenuCategory) ?? "All",
  );
  const [sort, setSort] = useState<SortKey>("relevance");
  const [diet, setDiet] = useState<DietKey>("all");
  const [maxPrice, setMaxPrice] = useState(200);
  const [inStockOnly, setInStockOnly] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  const menu = useMemo(() => vendor?.menu ?? [], [vendor]);
  const eta = vendor?.prepMinutes ?? 8;

  // Brief skeleton so the loading state is real, not decorative.
  useEffect(() => {
    setLoading(true);
    const t = setTimeout(() => setLoading(false), 260);
    return () => clearTimeout(t);
  }, [category, query, sort, diet, maxPrice, inStockOnly]);

  useEffect(() => {
    if (params.get("focus")) inputRef.current?.focus();
  }, [params]);

  const results = useMemo(() => {
    let list: MenuItem[] = menu;
    if (category !== "All") list = list.filter((m) => m.category === category);
    if (query.trim()) {
      const q = query.trim().toLowerCase();
      list = list.filter((m) => m.name.toLowerCase().includes(q) || m.category.toLowerCase().includes(q));
    }
    if (diet === "veg") list = list.filter((m) => m.isVeg);
    if (diet === "nonveg") list = list.filter((m) => !m.isVeg);
    if (inStockOnly) list = list.filter((m) => m.stockQty > 0);
    list = list.filter((m) => m.price <= maxPrice);

    const sorted = [...list];
    if (sort === "priceLow") sorted.sort((a, b) => a.price - b.price);
    if (sort === "priceHigh") sorted.sort((a, b) => b.price - a.price);
    if (sort === "rating") sorted.sort((a, b) => b.rating - a.rating);
    return sorted;
  }, [menu, category, query, diet, inStockOnly, maxPrice, sort]);

  const activeFilterCount =
    (diet !== "all" ? 1 : 0) + (inStockOnly ? 1 : 0) + (maxPrice < 200 ? 1 : 0) + (sort !== "relevance" ? 1 : 0);

  return (
    <div className="pb-6">
      <header className="sticky top-0 z-30 bg-cream/95 px-4 pb-3 pt-[calc(env(safe-area-inset-top)+12px)] backdrop-blur">
        <div className="flex items-center gap-2">
          <div className="flex min-h-[46px] flex-1 items-center gap-2.5 rounded-2xl bg-surface px-3.5 shadow-[var(--shadow-soft)]">
            <Icon name="search" className="h-[18px] w-[18px] text-ink-faint" />
            <input
              ref={inputRef}
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                if (params.get("focus")) setParams({}, { replace: true });
              }}
              placeholder="Search the store"
              className="w-full bg-transparent text-[14px] font-medium text-ink outline-none placeholder:text-ink-faint"
            />
            {query ? (
              <button onClick={() => setQuery("")} aria-label="Clear">
                <Icon name="close" className="h-4 w-4 text-ink-faint" strokeWidth={2.4} />
              </button>
            ) : (
              <Icon name="mic" className="h-[18px] w-[18px] text-coral" />
            )}
          </div>
          <button
            onClick={() => setFiltersOpen(true)}
            className="relative flex h-[46px] w-[46px] shrink-0 items-center justify-center rounded-2xl bg-surface shadow-[var(--shadow-soft)]"
            aria-label="Filters"
          >
            <Icon name="filter" className="h-[18px] w-[18px] text-ink" />
            {activeFilterCount > 0 && (
              <span className="absolute -right-1 -top-1 flex h-[17px] min-w-[17px] items-center justify-center rounded-full bg-coral px-1 text-[10px] font-extrabold text-white">
                {activeFilterCount}
              </span>
            )}
          </button>
        </div>

        <div className="no-scrollbar -mx-4 mt-3 flex gap-2 overflow-x-auto px-4">
          <Chip active={category === "All"} onClick={() => setCategory("All")}>
            All
          </Chip>
          {CATEGORIES.map((c) => (
            <Chip key={c} active={category === c} onClick={() => setCategory(c)}>
              {c}
            </Chip>
          ))}
        </div>
      </header>

      <p className="px-4 pb-2 pt-1 text-[12.5px] font-medium text-ink-soft">
        {loading ? "Searching…" : `${results.length} ${results.length === 1 ? "item" : "items"}`}
      </p>

      {loading ? (
        <ProductGridSkeleton />
      ) : results.length === 0 ? (
        <EmptyState
          art="🔍"
          title="Nothing matched"
          body={query ? `We couldn't find "${query}" in this store.` : "Try loosening your filters."}
          action="Clear filters"
          onAction={() => {
            setQuery("");
            setCategory("All");
            setDiet("all");
            setMaxPrice(200);
            setInStockOnly(false);
            setSort("relevance");
          }}
        />
      ) : (
        <div className="grid grid-cols-2 gap-3 px-4">
          {results.map((item) => (
            <ProductCard key={item.id} item={item} etaMinutes={eta} />
          ))}
        </div>
      )}

      <Sheet
        open={filtersOpen}
        onClose={() => setFiltersOpen(false)}
        title="Filters"
        footer={
          <div className="flex gap-3">
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => {
                setDiet("all");
                setMaxPrice(200);
                setInStockOnly(false);
                setSort("relevance");
              }}
            >
              Reset
            </Button>
            <Button className="flex-1" onClick={() => setFiltersOpen(false)}>
              Show {results.length} items
            </Button>
          </div>
        }
      >
        <div className="space-y-5 py-1">
          <div>
            <p className="mb-2 text-[12px] font-bold uppercase tracking-wide text-ink-soft">Sort by</p>
            <div className="flex flex-wrap gap-2">
              {SORTS.map((s) => (
                <Chip key={s.key} active={sort === s.key} onClick={() => setSort(s.key)}>
                  {s.label}
                </Chip>
              ))}
            </div>
          </div>

          <div>
            <p className="mb-2 text-[12px] font-bold uppercase tracking-wide text-ink-soft">Preference</p>
            <div className="flex flex-wrap gap-2">
              <Chip active={diet === "all"} onClick={() => setDiet("all")}>All</Chip>
              <Chip active={diet === "veg"} onClick={() => setDiet("veg")}>Veg only</Chip>
              <Chip active={diet === "nonveg"} onClick={() => setDiet("nonveg")}>Non-veg</Chip>
            </div>
          </div>

          <div>
            <div className="mb-2 flex items-baseline justify-between">
              <p className="text-[12px] font-bold uppercase tracking-wide text-ink-soft">Max price</p>
              <span className="text-[13px] font-bold text-ink">₹{maxPrice}</span>
            </div>
            <input
              type="range"
              min={20}
              max={200}
              step={10}
              value={maxPrice}
              onChange={(e) => setMaxPrice(Number(e.target.value))}
              className="w-full accent-[var(--color-coral)]"
            />
          </div>

          <button
            onClick={() => setInStockOnly((v) => !v)}
            className="flex w-full items-center justify-between rounded-2xl bg-surface p-3.5 shadow-[var(--shadow-soft)]"
          >
            <span className="text-[14px] font-semibold text-ink">In stock only</span>
            <span
              className={`flex h-6 w-11 items-center rounded-full p-0.5 transition ${
                inStockOnly ? "bg-lime" : "bg-line"
              }`}
            >
              <span
                className={`h-5 w-5 rounded-full bg-surface shadow transition-transform ${
                  inStockOnly ? "translate-x-5" : "translate-x-0"
                }`}
              />
            </span>
          </button>

          <p className="text-[12px] text-ink-faint">
            {menu.filter((m) => stockState(m) === "out").length} items are currently sold out in this store.
          </p>
        </div>
      </Sheet>
    </div>
  );
}
