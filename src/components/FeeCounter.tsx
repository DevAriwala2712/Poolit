import { useEffect, useRef, useState } from "react";
import { ordersUntilNextTier } from "../domain/feeLadder";

interface FeeCounterProps {
  fee: number;
  orderCount: number;
}

export function FeeCounter({ fee, orderCount }: FeeCounterProps) {
  const [justDropped, setJustDropped] = useState(false);
  const prevFee = useRef(fee);

  useEffect(() => {
    if (fee < prevFee.current) {
      setJustDropped(true);
      const t = setTimeout(() => setJustDropped(false), 900);
      prevFee.current = fee;
      return () => clearTimeout(t);
    }
    prevFee.current = fee;
  }, [fee]);

  const remaining = ordersUntilNextTier(orderCount);

  return (
    <div
      className={`rounded-2xl bg-primary p-6 text-center text-white shadow-md transition-transform duration-300 ${
        justDropped ? "scale-105" : "scale-100"
      }`}
    >
      <p className="text-sm font-medium text-white/70">Your delivery fee right now</p>
      <p
        className={`mt-1 text-5xl font-bold transition-colors duration-300 ${
          justDropped ? "text-accent" : "text-white"
        }`}
      >
        {fee === 0 ? "Free" : `₹${fee}`}
      </p>
      <p className="mt-2 text-sm text-white/70">
        {orderCount} {orderCount === 1 ? "order" : "orders"} pooled so far
      </p>
      {remaining !== null ? (
        <p className="mt-1 text-sm font-medium text-accent">
          {remaining} more {remaining === 1 ? "order" : "orders"} and the fee drops again
        </p>
      ) : (
        <p className="mt-1 text-sm font-medium text-accent">Max pooling reached — delivery is free!</p>
      )}
    </div>
  );
}
