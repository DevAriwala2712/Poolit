import { clockTime, countdown, orderItemCount, orderSubtotal, rupees, useStore } from "@poolit/domain";
import { useNavigate } from "react-router-dom";
import { BarChart, HBarList } from "../components/charts";
import { Icon } from "../components/Icon";
import { KpiCard } from "../components/KpiCard";
import { Badge, Button, Card, EmptyState } from "../components/ui";
import { useMetrics, pctDelta, poolStats } from "../hooks/useMetrics";
import { useNow } from "../hooks/useNow";
import { useVendor } from "../state/VendorContext";

export function Dashboard() {
  const navigate = useNavigate();
  const now = useNow();
  const { vendor, hostel } = useVendor();
  const { orders, closeSlot, dispatchSlot } = useStore();
  const m = useMetrics();

  const revenueSpark = m.byHour.map((b) => b.value);

  return (
    <div className="space-y-4">
      {/* KPI row */}
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <KpiCard
          label="Today's orders"
          value={String(m.todayOrders.length)}
          icon="orders"
          delta={pctDelta(m.todayOrders.length, m.yesterdayOrders.length)}
          hint="vs yesterday"
          spark={revenueSpark}
        />
        <KpiCard
          label="Revenue"
          value={rupees(m.todayRevenue)}
          icon="rupee"
          delta={pctDelta(m.todayRevenue, m.yesterdayRevenue)}
          hint="vs yesterday"
        />
        <KpiCard
          label="Avg. prep time"
          value={`${m.avgPrep.toFixed(1)} min`}
          icon="clock"
          hint={`target ${vendor.prepMinutes} min`}
        />
        <KpiCard
          label="Pending"
          value={String(m.pending)}
          icon="alert"
          hint={m.pending > 0 ? "awaiting pool close" : "all clear"}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        {/* Live order feed */}
        <Card
          className="xl:col-span-2"
          flush
          title="Live pools"
          subtitle={`${hostel?.name} · ${vendor.name}`}
          action={
            <Button size="sm" icon="external" onClick={() => navigate("/orders")}>
              All orders
            </Button>
          }
        >
          {m.mySlots.filter((s) => s.status !== "dispatched").length === 0 ? (
            <EmptyState
              icon="orders"
              title="No active pools"
              body="When students start ordering, their pooled run appears here in real time."
            />
          ) : (
            <ul className="divide-y divide-line-soft">
              {m.mySlots
                .filter((s) => s.status !== "dispatched")
                .sort((a, b) => a.closesAt - b.closesAt)
                .map((slot) => {
                  const { count, fee } = poolStats(slot, orders);
                  const slotOrders = orders.filter((o) => o.slotId === slot.id);
                  const revenue = slotOrders.reduce(
                    (sum, o) => sum + orderSubtotal(o, vendor.menu),
                    0,
                  );
                  const isOpen = slot.status === "open";

                  return (
                    <li key={slot.id} className="flex flex-wrap items-center gap-3 px-4 py-3.5">
                      <span
                        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-[13px] font-semibold ${
                          isOpen ? "bg-accent/12 text-accent" : "bg-raised text-muted"
                        }`}
                      >
                        {count}
                      </span>

                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <p className="truncate text-[13px] font-medium text-text">
                            {hostel?.name} pool
                          </p>
                          <Badge tone={isOpen ? "accent" : "info"} live={isOpen}>
                            {isOpen ? "Open" : "Ready to pack"}
                          </Badge>
                        </div>
                        <p className="mt-0.5 text-[11.5px] text-faint">
                          {count} orders · {rupees(revenue)} · {fee === 0 ? "free" : rupees(fee)}/student
                          {isOpen && ` · closes in ${countdown(slot.closesAt, now)}`}
                        </p>
                      </div>

                      {isOpen ? (
                        <Button size="sm" onClick={() => closeSlot(slot.id)}>
                          Close pool
                        </Button>
                      ) : (
                        <Button size="sm" variant="accent" onClick={() => dispatchSlot(slot.id)}>
                          Mark dispatched
                        </Button>
                      )}
                    </li>
                  );
                })}
            </ul>
          )}
        </Card>

        {/* Low stock alerts */}
        <Card
          flush
          title="Stock alerts"
          subtitle={`${m.lowStock.length} low · ${m.outOfStock.length} out`}
          action={
            <Button size="sm" onClick={() => navigate("/inventory?status=low")}>
              Manage
            </Button>
          }
        >
          {m.lowStock.length === 0 && m.outOfStock.length === 0 ? (
            <EmptyState icon="check" title="Everything stocked" body="No items need attention." />
          ) : (
            <ul className="max-h-[280px] divide-y divide-line-soft overflow-y-auto">
              {[...m.outOfStock, ...m.lowStock].slice(0, 10).map((item) => (
                <li key={item.id} className="flex items-center gap-2.5 px-4 py-2.5">
                  <span className="text-base">{item.art}</span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[12.5px] text-text">{item.name}</p>
                    <p className="text-[11px] text-faint">{item.unit}</p>
                  </div>
                  <Badge tone={item.stockQty === 0 ? "bad" : "warn"}>
                    {item.stockQty === 0 ? "Out" : `${item.stockQty} left`}
                  </Badge>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <Card className="xl:col-span-2" title="Orders by hour" subtitle="Across all runs today">
          <BarChart data={m.byHour} />
        </Card>

        <Card title="Top sellers" subtitle="By units moved">
          {m.topItems.length === 0 ? (
            <EmptyState icon="box" title="No sales yet" body="Top items appear once orders come in." />
          ) : (
            <HBarList
              data={m.topItems.map((t) => ({
                label: `${t.art}  ${t.name}`,
                value: t.units,
                sub: "units",
              }))}
            />
          )}
        </Card>
      </div>

      {/* Recent orders */}
      <Card
        flush
        title="Recent orders"
        subtitle="Newest first"
        action={
          <Button size="sm" icon="external" onClick={() => navigate("/orders")}>
            View all
          </Button>
        }
      >
        {m.myOrders.length === 0 ? (
          <EmptyState icon="orders" title="No orders yet" body="Orders will stream in here." />
        ) : (
          <ul className="divide-y divide-line-soft">
            {[...m.myOrders]
              .sort((a, b) => b.createdAt - a.createdAt)
              .slice(0, 6)
              .map((order, i) => (
                <li
                  key={order.id}
                  className={`flex items-center gap-3 px-4 py-3 ${i === 0 && order.status === "placed" ? "animate-new-row" : ""}`}
                >
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-raised text-[11px] font-semibold text-muted">
                    {order.studentName.charAt(0)}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[12.5px] text-text">{order.studentName}</p>
                    <p className="text-[11px] text-faint">
                      {order.block}, Room {order.room} · {orderItemCount(order)} items
                    </p>
                  </div>
                  <span className="hidden text-[11.5px] text-faint sm:block">
                    {clockTime(order.createdAt)}
                  </span>
                  <span className="text-[12.5px] font-medium text-text">
                    {rupees(orderSubtotal(order, vendor.menu))}
                  </span>
                  <Icon name="chevronRight" className="h-3.5 w-3.5 text-faint" />
                </li>
              ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
