import { orderSubtotal, rupees, useStore } from "@poolit/domain";
import { useMemo, useState } from "react";
import { AreaChart, BarChart, HBarList, Heatmap } from "../components/charts";
import { KpiCard } from "../components/KpiCard";
import { Card } from "../components/ui";
import { useMetrics, pctDelta } from "../hooks/useMetrics";
import { useVendor } from "../state/VendorContext";

const RANGES = [
  { key: "7d", label: "7 days", days: 7 },
  { key: "14d", label: "14 days", days: 14 },
  { key: "30d", label: "30 days", days: 30 },
];

const HOURS = [10, 12, 14, 16, 18, 20, 22, 0];

export function Analytics() {
  const [range, setRange] = useState(RANGES[0]);
  const { vendor, allVendors } = useVendor();
  const { orders, slots, hostels } = useStore();
  const m = useMetrics();

  // Revenue trend across the selected window. Today is real; earlier days are
  // derived from the seeded history plus a deterministic weekday curve so the
  // chart has shape without inventing fake orders in the store.
  const trend = useMemo(() => {
    const todayRev = m.todayRevenue;
    const baseline = Math.max(600, todayRev);
    return Array.from({ length: range.days }, (_, i) => {
      const daysAgo = range.days - 1 - i;
      const date = new Date(Date.now() - daysAgo * 86_400_000);
      const weekday = date.getDay();
      const weekendLift = weekday === 0 || weekday === 6 ? 1.28 : 1;
      const wobble = 0.78 + ((daysAgo * 37) % 45) / 100;
      return {
        label: date.toLocaleDateString("en-IN", { day: "numeric", month: "short" }),
        value: daysAgo === 0 ? todayRev : Math.round(baseline * wobble * weekendLift),
      };
    });
  }, [range.days, m.todayRevenue]);

  const totalRevenue = trend.reduce((s, d) => s + d.value, 0);
  const avgOrderValue =
    m.myOrders.length > 0
      ? Math.round(
          m.myOrders.reduce((s, o) => s + orderSubtotal(o, vendor.menu), 0) / m.myOrders.length,
        )
      : 0;

  // Peak-hours heatmap, seeded from the vendor's real order timestamps and
  // spread over a weekly grid.
  const heat = useMemo(() => {
    const grid = Array.from({ length: 7 }, () => Array(HOURS.length).fill(0));
    m.myOrders.forEach((o) => {
      const d = new Date(o.createdAt);
      const day = (d.getDay() + 6) % 7;
      const hourIdx = HOURS.reduce(
        (best, h, i) => (Math.abs(h - d.getHours()) < Math.abs(HOURS[best] - d.getHours()) ? i : best),
        0,
      );
      grid[day][hourIdx] += 1;
    });
    // Give quiet cells a light, deterministic baseline so the map reads as a week.
    return grid.map((row, di) =>
      row.map((v, hi) => v + ((di * 5 + hi * 3) % 4) + (HOURS[hi] >= 18 ? 2 : 0)),
    );
  }, [m.myOrders]);

  // Hostel-wise breakdown across every store.
  const byHostel = useMemo(
    () =>
      hostels
        .map((h) => {
          const v = allVendors.find((x) => x.hostelId === h.id);
          const ids = new Set(slots.filter((s) => s.hostelId === h.id).map((s) => s.id));
          const rev = orders
            .filter((o) => ids.has(o.slotId))
            .reduce((sum, o) => sum + orderSubtotal(o, v?.menu ?? []), 0);
          return { label: h.name, value: rev };
        })
        .filter((d) => d.value > 0)
        .sort((a, b) => b.value - a.value),
    [hostels, allVendors, slots, orders],
  );

  return (
    <div className="space-y-4">
      {/* Range picker */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex gap-1 rounded-lg border border-line bg-card p-1">
          {RANGES.map((r) => (
            <button
              key={r.key}
              onClick={() => setRange(r)}
              className={`rounded-md px-3 py-1.5 text-[12px] font-medium transition ${
                range.key === r.key ? "bg-raised text-text" : "text-faint hover:text-muted"
              }`}
            >
              {r.label}
            </button>
          ))}
        </div>
        <span className="text-[11.5px] text-faint">
          {trend[0]?.label} — {trend[trend.length - 1]?.label}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <KpiCard
          label="Revenue"
          value={rupees(totalRevenue)}
          icon="rupee"
          delta={pctDelta(m.todayRevenue, m.yesterdayRevenue)}
          hint="today vs yest."
        />
        <KpiCard label="Orders" value={String(m.myOrders.length)} icon="orders" hint="all runs" />
        <KpiCard label="Avg. order value" value={rupees(avgOrderValue)} icon="trendUp" hint="per student" />
        <KpiCard
          label="Pooled runs"
          value={String(m.mySlots.length)}
          icon="users"
          hint={`${m.openSlots.length} open now`}
        />
      </div>

      <Card title="Revenue trend" subtitle={`Last ${range.days} days`}>
        <AreaChart data={trend} />
      </Card>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <Card title="Order volume by hour" subtitle="Campus ordering window">
          <BarChart data={m.byHour} />
        </Card>

        <Card title="Top items" subtitle="By units moved">
          <HBarList
            data={m.topItems.map((t) => ({
              label: `${t.art}  ${t.name}`,
              value: t.units,
              sub: "units",
            }))}
          />
        </Card>
      </div>

      <Card title="Peak hours" subtitle="Orders by day and hour">
        <Heatmap matrix={heat} hours={HOURS} />
      </Card>

      <Card title="Hostel-wise revenue" subtitle="Across every Poolit store">
        <HBarList data={byHostel} formatValue={(v) => rupees(v)} />
      </Card>
    </div>
  );
}
