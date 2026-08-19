import { FEE_TIERS, countdown, feeForOrderCount, nextTierFee, ordersUntilNextTier, rupees } from "@poolit/domain";
import { useEffect, useRef, useState } from "react";
import { useNow } from "../hooks/useNow";
import { Icon } from "./Icon";

/**
 * The live pooling fee — the product's core moment. As more students join the
 * same slot, the per-student delivery fee steps down the ladder, and the
 * counter animates when it crosses into a cheaper tier.
 */
export function PoolFeeCard({
  orderCount,
  closesAt,
  compact = false,
}: {
  orderCount: number;
  closesAt: number;
  compact?: boolean;
}) {
  const now = useNow();
  const fee = feeForOrderCount(orderCount);
  const remaining = ordersUntilNextTier(orderCount);
  const nextFee = nextTierFee(orderCount);
  const [dropped, setDropped] = useState(false);
  const prevFee = useRef(fee);

  useEffect(() => {
    if (fee < prevFee.current) {
      setDropped(true);
      const t = setTimeout(() => setDropped(false), 1200);
      prevFee.current = fee;
      return () => clearTimeout(t);
    }
    prevFee.current = fee;
  }, [fee]);

  // Progress across the whole ladder, for the segmented track.
  const activeTier = FEE_TIERS.findIndex((t) => orderCount <= t.maxOrders);

  return (
    <div
      className={`relative overflow-hidden rounded-[var(--radius-card)] bg-ink text-cream shadow-[var(--shadow-lift)] transition-transform duration-300 ${
        dropped ? "scale-[1.02]" : "scale-100"
      } ${compact ? "p-4" : "p-5"}`}
    >
      <div
        className="pointer-events-none absolute -right-10 -top-12 h-40 w-40 rounded-full opacity-25 blur-2xl"
        style={{ background: "var(--color-lime)" }}
      />

      <div className="relative flex items-start justify-between gap-3">
        <div>
          <p className="flex items-center gap-1.5 text-[12px] font-semibold text-cream/60">
            <Icon name="users" className="h-3.5 w-3.5" />
            {orderCount} {orderCount === 1 ? "student" : "students"} pooling now
          </p>
          <div className="mt-1 flex items-baseline gap-2">
            <span
              className={`text-[40px] font-extrabold leading-none tracking-tight transition-colors duration-300 ${
                fee === 0 || dropped ? "text-lime" : "text-cream"
              }`}
            >
              {fee === 0 ? "FREE" : rupees(fee)}
            </span>
            <span className="text-[12px] font-medium text-cream/50">delivery</span>
          </div>
        </div>

        <span className="flex shrink-0 items-center gap-1.5 rounded-full bg-cream/10 px-2.5 py-1.5 text-[12px] font-bold tabular-nums text-cream">
          <Icon name="clock" className="h-3.5 w-3.5 text-lime" />
          {countdown(closesAt, now)}
        </span>
      </div>

      {/* Segmented tier track */}
      <div className="relative mt-4 flex gap-1">
        {FEE_TIERS.map((tier, i) => (
          <div key={tier.fee} className="h-1.5 flex-1 overflow-hidden rounded-full bg-cream/15">
            <div
              className="h-full rounded-full bg-lime transition-all duration-500"
              style={{ width: i <= activeTier ? "100%" : "0%" }}
            />
          </div>
        ))}
      </div>

      <p className="relative mt-2.5 text-[12.5px] font-medium text-cream/70">
        {remaining === null ? (
          <span className="font-bold text-lime">Max pooling reached — delivery is free 🎉</span>
        ) : (
          <>
            <span className="font-bold text-lime">
              {remaining} more {remaining === 1 ? "order" : "orders"}
            </span>{" "}
            and everyone pays {nextFee === 0 ? "nothing" : rupees(nextFee ?? 0)}
          </>
        )}
      </p>
    </div>
  );
}
