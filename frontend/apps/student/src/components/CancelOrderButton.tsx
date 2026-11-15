import { ApiError, BACKEND, useStore } from "@poolit/domain";
import { useState } from "react";
import { useToast } from "../state/ToastContext";
import { ConfirmSheet } from "./ConfirmSheet";

/**
 * "Cancel order", offered only while the order is still waiting for its pool to close
 * (the database refuses it afterwards). Not shown on the old Express backend.
 */
export function CancelOrderButton({ orderId, className = "" }: { orderId: string; className?: string }) {
  const { orders, cancelOrder } = useStore();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const order = orders.find((o) => o.id === orderId);
  if (BACKEND !== "supabase" || !order || order.status !== "placed") return null;

  async function confirm() {
    setBusy(true);
    setError(null);
    try {
      await cancelOrder(orderId);
      setOpen(false);
      toast("Order cancelled. You were not charged.");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't cancel the order. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className={`flex w-full items-center justify-center rounded-xl bg-coral-soft py-2.5 text-body-sm font-bold text-coral active:scale-[0.99] ${className}`}
      >
        Cancel order
      </button>
      <ConfirmSheet
        open={open}
        onClose={() => setOpen(false)}
        title="Cancel this order?"
        message="Your pool has not closed yet, so you can cancel for free. The items go back in stock."
        confirmLabel="Cancel order"
        busy={busy}
        error={error}
        onConfirm={() => void confirm()}
      />
    </>
  );
}
