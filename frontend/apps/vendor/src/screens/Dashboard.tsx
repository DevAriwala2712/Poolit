import { clockTime, countdown, orderItemCount, orderSubtotal, rupees, useStore } from "@poolit/domain";
import { useNavigate } from "react-router-dom";
import { BarChart } from "../components/charts";
import { KpiCard } from "../components/KpiCard";
import { MaterialIcon } from "../components/MaterialIcon";
import { Badge, Button, Card, EmptyState } from "../components/ui";
import { useMetrics, pctDelta, poolStats } from "../hooks/useMetrics";
import { useNow } from "../hooks/useNow";
import { downloadCSV } from "../lib/csv";
import { useUIMode } from "../state/UIModeContext";
import { useVendor } from "../state/VendorContext";

const TODAY = new Date().toLocaleDateString("en-IN", { weekday: "long", month: "long", day: "numeric" });

export function Dashboard() {
  const navigate = useNavigate();
  const now = useNow();
  const { vendor, hostel } = useVendor();
  const { orders, closeSlot, dispatchSlot, restockItem } = useStore();
  const { advancedMode } = useUIMode();
  const m = useMetrics();

  const kitchenAction = m.myOrders.filter((o) => o.status === "placed").length;
  const inPools = m.myOrders.filter((o) => o.status === "pooled").length;
  const peakIdx = m.byHour.reduce((best, b, i) => (b.value > m.byHour[best].value ? i : best), 0);

  const activePools = m.mySlots
    .filter((s) => s.status !== "dispatched")
    .sort((a, b) => a.closesAt - b.closesAt);

  const criticalStock = [...m.outOfStock, ...m.lowStock].slice(0, 6);

  function exportShiftCSV() {
    downloadCSV(
      `${vendor.name.replace(/\s+/g, "-").toLowerCase()}-shift-${new Date().toISOString().slice(0, 10)}.csv`,
      m.todayOrders.map((o) => ({
        "Order ID": o.id,
        Student: o.studentName,
        Block: o.block ?? "",
        Room: o.room ?? "",
        Items: orderItemCount(o),
        "Amount (₹)": orderSubtotal(o, vendor.menu) + (o.deliveryFeeCharged ?? 0) + (o.tip ?? 0),
        Status: o.status,
        Time: clockTime(o.createdAt),
      })),
    );
  }

  return (
    <div className="space-y-space-md">
      {/* Dispatch command header strip */}
      <section className="flex flex-col gap-space-sm rounded-lg bg-surface-container-lowest p-space-md shadow-sm sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-col gap-space-2xs">
          <div className="flex flex-wrap items-center gap-space-xs">
            <span className="text-label-sm uppercase tracking-wide text-secondary">Dispatch Command</span>
            <span className="font-label-sm text-secondary">/</span>
            <h1 className="text-headline-sm text-on-surface">
              {TODAY} · {hostel?.name} pool
            </h1>
          </div>
          <p className="text-body-sm text-secondary">
            Real-time batch dispatching, hostel delivery clusters & inventory telemetry.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-space-xs self-start sm:self-auto">
          <div className="flex items-center gap-space-2xs rounded-full bg-surface-container px-space-sm py-space-2xs text-label-sm text-on-surface-variant">
            <span className="h-2 w-2 animate-live rounded-full bg-tertiary" />
            <span>Live Sync: Active · 0ms lag</span>
          </div>
          <div className="flex items-center gap-space-2xs rounded-full bg-surface-container-low px-space-sm py-space-2xs text-label-sm text-primary">
            <MaterialIcon name="bolt" className="text-[14px]" />
            <span>Shift: Operational Normal</span>
          </div>
        </div>
      </section>

      {/* KPI row */}
      <div className="grid grid-cols-1 gap-space-md sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          label="Today's Orders"
          value={String(m.todayOrders.length)}
          icon="receipt_long"
          delta={pctDelta(m.todayOrders.length, m.yesterdayOrders.length)}
          hint="vs yesterday"
        />
        <KpiCard
          label="Gross Revenue"
          value={rupees(m.todayRevenue)}
          icon="payments"
          delta={pctDelta(m.todayRevenue, m.yesterdayRevenue)}
          hint="vs yesterday"
        />
        <KpiCard
          label="Avg Prep Speed"
          value={m.avgPrep.toFixed(1)}
          unit="min"
          icon="timer"
          hint={`Target ${vendor.prepMinutes} min`}
        />
        <KpiCard
          label="Pending Queue"
          value={String(m.pending)}
          unit="tickets"
          icon="pending_actions"
          hint={`${kitchenAction} Kitchen Action · ${inPools} in Pools`}
        />
      </div>

      {/* 60/40 split */}
      <div className="grid grid-cols-1 gap-space-md lg:grid-cols-12">
        <div className="flex flex-col gap-space-md lg:col-span-7">
          {/* Live pooling engine */}
          <Card
            icon="hub"
            title="Campus Delivery Pooling Engine"
            subtitle="Combined orders reducing runner campus transit times. Micro-dispatched by building corridors."
            action={
              <span className="rounded bg-surface-container px-space-xs py-space-2xs text-label-sm uppercase text-secondary">
                {activePools.length} Clusters Live
              </span>
            }
          >
            {activePools.length === 0 ? (
              <EmptyState
                icon="hub"
                title="No active pools"
                body="When students start ordering, their pooled run appears here in real time."
              />
            ) : (
              <div className="mt-space-sm flex flex-col gap-space-sm">
                {activePools.map((slot) => {
                  const { count, fee } = poolStats(slot, orders);
                  const slotOrders = orders.filter((o) => o.slotId === slot.id);
                  const isOpen = slot.status === "open";
                  return (
                    <div key={slot.id} className="flex flex-col gap-space-xs rounded-lg bg-surface-container-low p-space-sm transition-all hover:bg-surface-container">
                      <div className="flex flex-wrap items-center justify-between gap-space-xs">
                        <div className="flex items-center gap-space-xs">
                          <span className="rounded bg-surface-container-highest px-space-xs py-space-2xs font-bold text-label-sm text-on-surface">
                            #{slot.id.slice(0, 4)}
                          </span>
                          <span className="text-body-lg font-headline-sm text-on-surface">{hostel?.name}</span>
                          <span className="text-label-sm text-secondary">
                            · {count} Orders ({fee === 0 ? "free" : rupees(fee)} avg fee)
                          </span>
                        </div>
                        {isOpen ? (
                          <span className="flex items-center gap-space-2xs rounded bg-surface-container-high px-space-xs py-space-2xs font-semibold text-label-sm text-primary">
                            <span className="h-1.5 w-1.5 animate-live rounded-full bg-primary" />
                            OPEN · closes in {countdown(slot.closesAt, now)}
                          </span>
                        ) : (
                          <span className="flex items-center gap-space-2xs rounded bg-tertiary-fixed px-space-xs py-space-2xs font-semibold text-label-sm text-on-tertiary-fixed">
                            <span className="h-1.5 w-1.5 rounded-full bg-tertiary" />
                            READY FOR DISPATCH
                          </span>
                        )}
                      </div>
                      <div className="flex flex-wrap items-center justify-between gap-space-xs pt-space-xs">
                        <div className="flex flex-wrap items-center gap-space-2xs">
                          {slotOrders.slice(0, 3).map((o) => (
                            <span key={o.id} className="rounded bg-surface-container-lowest px-space-xs py-space-2xs text-label-sm text-secondary">
                              #{o.id.slice(0, 5)}
                            </span>
                          ))}
                          {slotOrders.length > 3 && (
                            <span className="rounded bg-surface-container-lowest px-space-xs py-space-2xs text-label-sm text-secondary">
                              +{slotOrders.length - 3} more
                            </span>
                          )}
                          <span className="ml-space-xs text-body-sm text-secondary">
                            {slotOrders.reduce((n, o) => n + orderItemCount(o), 0)} total items
                          </span>
                        </div>
                        <div className="flex items-center gap-space-xs">
                          {isOpen ? (
                            <Button size="sm" onClick={() => closeSlot(slot.id)}>
                              Close Pool
                            </Button>
                          ) : (
                            <Button size="sm" variant="primary" onClick={() => dispatchSlot(slot.id)}>
                              Dispatch Batch
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </Card>

          {/* Hourly throughput */}
          {advancedMode && (
            <Card
              title="Hourly Throughput & Kitchen Load"
              subtitle="24-hour service curve, across all runs today"
              action={
                <div className="flex items-center gap-space-sm text-label-sm text-secondary">
                  <span className="flex items-center gap-space-2xs">
                    <span className="h-2.5 w-2.5 rounded bg-primary" /> Peak Orders
                  </span>
                  <span className="flex items-center gap-space-2xs">
                    <span className="h-2.5 w-2.5 rounded bg-surface-container-highest" /> Off-Peak
                  </span>
                </div>
              }
            >
              <BarChart data={m.byHour} height={176} peakIndex={peakIdx} />
            </Card>
          )}
        </div>

        <div className="flex flex-col gap-space-md lg:col-span-5">
          {/* Critical stock alerts */}
          <Card
            icon="notification_important"
            title="Critical Stock Alerts"
            action={
              <span className="rounded bg-error-container px-space-xs py-space-2xs text-label-sm text-on-error-container">
                {criticalStock.length} Attention
              </span>
            }
          >
            {criticalStock.length === 0 ? (
              <EmptyState icon="check_circle" title="Everything stocked" body="No items need attention." />
            ) : (
              <div className="mt-space-sm flex flex-col gap-space-xs">
                {criticalStock.map((item) => (
                  <div key={item.id} className="flex items-center justify-between rounded bg-surface-container-low p-space-xs">
                    <div className="flex min-w-0 flex-col">
                      <span className="truncate text-body-sm font-headline-sm text-on-surface">{item.name}</span>
                      <span className="text-label-sm font-semibold text-error">
                        {item.stockQty === 0 ? "OUT OF STOCK · Depleted" : `Low Stock: ${item.stockQty} left`}
                      </span>
                    </div>
                    <div className="flex shrink-0 items-center gap-space-2xs">
                      <Button
                        size="sm"
                        variant={item.stockQty === 0 ? "primary" : "surface"}
                        onClick={() => restockItem(vendor.id, item.id, 25)}
                      >
                        {item.stockQty === 0 ? "Mark In Stock" : "+25 Restock"}
                      </Button>
                      <Button
                        size="sm"
                        variant="surface"
                        onClick={() =>
                          navigate(`/inventory?status=${item.stockQty === 0 ? "out" : "low"}`)
                        }
                        title="Restock a custom amount from Inventory"
                      >
                        Custom
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>

          {/* Top velocity items */}
          {advancedMode && (
            <Card icon="leaderboard" title="Top Velocity Items" action={<span className="text-label-sm text-secondary">Today's Cumulative</span>}>
              {m.topItems.length === 0 ? (
                <EmptyState icon="inventory_2" title="No sales yet" body="Top items appear once orders come in." />
              ) : (
                <div className="mt-space-sm flex flex-col gap-space-2xs">
                  {m.topItems.map((t, i) => (
                    <div key={t.id} className="flex items-center justify-between py-space-2xs">
                      <div className="flex min-w-0 items-center gap-space-sm">
                        <span className={`font-bold text-label-sm ${i === 0 ? "text-primary" : "text-secondary"}`}>
                          {String(i + 1).padStart(2, "0")}
                        </span>
                        <div className="flex min-w-0 flex-col">
                          <span className="truncate text-body-sm font-headline-sm text-on-surface">
                            {t.art} {t.name}
                          </span>
                          <span className="text-label-sm text-secondary">{t.units} orders dispatched</span>
                        </div>
                      </div>
                      <span className="text-tabular-metric !text-body-sm text-on-surface">{rupees(t.revenue)}</span>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          )}
        </div>
      </div>

      {/* Recent incoming orders */}
      <Card
        flush
        icon="sync_alt"
        title="Recent Incoming Orders"
        action={
          <div className="ml-auto flex items-center gap-space-xs">
            <span className="rounded bg-surface-container px-space-xs py-space-2xs text-label-sm text-secondary">Auto-syncing (3s)</span>
            <Button size="sm" onClick={() => navigate("/orders")}>Filter Kitchen Ready</Button>
            {advancedMode && (
              <Button size="sm" onClick={exportShiftCSV} disabled={m.todayOrders.length === 0}>
                Export Shift CSV
              </Button>
            )}
          </div>
        }
      >
        <div className="mt-space-sm w-full overflow-x-auto">
          {m.myOrders.length === 0 ? (
            <EmptyState icon="receipt_long" title="No orders yet" body="Orders will stream in here." />
          ) : (
            <table className="w-full min-w-[700px] border-collapse text-left">
              <thead>
                <tr className="bg-surface-container-low text-label-sm uppercase text-secondary">
                  <th className="px-space-sm py-space-xs font-semibold">Order ID</th>
                  <th className="px-space-sm py-space-xs font-semibold">Items & Details</th>
                  <th className="px-space-sm py-space-xs font-semibold">Destination</th>
                  <th className="px-space-sm py-space-xs text-right font-semibold">Amount</th>
                  <th className="px-space-sm py-space-xs font-semibold">Status</th>
                  <th className="px-space-sm py-space-xs text-right font-semibold">Action</th>
                </tr>
              </thead>
              <tbody className="text-body-sm">
                {[...m.myOrders]
                  .sort((a, b) => b.createdAt - a.createdAt)
                  .slice(0, 6)
                  .map((order) => (
                    <tr key={order.id} className="border-b border-surface-container-low transition-colors hover:bg-surface-container-low">
                      <td className="px-space-sm py-space-sm font-bold font-label-sm text-label-sm text-on-surface">#{order.id.slice(0, 5)}</td>
                      <td className="px-space-sm py-space-sm">
                        <div className="flex flex-col">
                          <span className="text-body-sm font-headline-sm text-on-surface">
                            {order.studentName} · {orderItemCount(order)} items
                          </span>
                          <span className="text-label-sm text-secondary">
                            {order.block}, Room {order.room} · {clockTime(order.createdAt)}
                          </span>
                        </div>
                      </td>
                      <td className="px-space-sm py-space-sm text-secondary">{order.block} · Room {order.room}</td>
                      <td className="px-space-sm py-space-sm text-right text-tabular-metric !text-body-sm text-on-surface">
                        {rupees(orderSubtotal(order, vendor.menu))}
                      </td>
                      <td className="px-space-sm py-space-sm">
                        <Badge tone={order.status === "placed" ? "error" : order.status === "pooled" ? "prep" : order.status === "dispatched" ? "dispatched" : "delivered"}>
                          {order.status === "placed" ? "Needs Kitchen Action" : order.status}
                        </Badge>
                      </td>
                      <td className="px-space-sm py-space-sm text-right">
                        <Button size="sm" onClick={() => navigate("/orders")}>View Drawer</Button>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          )}
        </div>
        <div className="mt-space-sm flex flex-wrap items-center justify-between gap-space-xs px-space-md pb-space-md text-label-sm text-secondary">
          <div className="flex items-center gap-space-xs">
            <span className="h-2 w-2 rounded-full bg-tertiary" />
            <span>Kitchen Line 01 (Fryer/Curry) & Line 02 (Grill/Tandoor) operating at 68% rated capacity</span>
          </div>
          <div className="flex items-center gap-space-sm">
            <span>Press <kbd className="rounded bg-surface-container px-space-xs py-space-2xs">⌘K</kbd> to search order index</span>
          </div>
        </div>
      </Card>
    </div>
  );
}
