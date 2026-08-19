import { TIP_PRESETS, rupees, useStore } from "@poolit/domain";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Icon } from "../components/Icon";
import type { IconName } from "../components/Icon";
import { Badge, Button, EmptyState } from "../components/ui";
import { useBill } from "../hooks/useBill";
import { useHostelContext } from "../hooks/useHostelContext";
import { useCart } from "../state/CartContext";
import { useProfile } from "../state/ProfileContext";
import { useToast } from "../state/ToastContext";
import { ScreenHeader } from "./Cart";

const PAYMENTS: { id: string; label: string; hint: string; icon: IconName }[] = [
  { id: "upi", label: "UPI", hint: "GPay · PhonePe · Paytm", icon: "bolt" },
  { id: "wallet", label: "Hostel wallet", hint: "Balance ₹480", icon: "wallet" },
  { id: "card", label: "Card", hint: "Visa · Mastercard · RuPay", icon: "shield" },
  { id: "cod", label: "Cash on delivery", hint: "Pay the rider directly", icon: "tag" },
];

export function Checkout() {
  const navigate = useNavigate();
  const cart = useCart();
  const toast = useToast();
  const { profile } = useProfile();
  const { hostel, slot, vendor } = useHostelContext();
  const { placeOrder } = useStore();

  const [tip, setTip] = useState(0);
  const [payment, setPayment] = useState("upi");
  const [note, setNote] = useState("");
  const [placing, setPlacing] = useState(false);
  const bill = useBill({ tip });

  if (bill.isEmpty) {
    return (
      <div>
        <ScreenHeader title="Checkout" onBack={() => navigate("/cart")} />
        <EmptyState art="🧾" title="Nothing to check out" body="Your cart is empty." action="Browse store" onAction={() => navigate("/categories")} />
      </div>
    );
  }

  async function confirm() {
    if (!slot || slot.status !== "open") {
      toast("This pool just closed — try the next slot", "info");
      return;
    }
    setPlacing(true);
    try {
      const order = await placeOrder({
        slotId: slot.id,
        studentName: profile.name || "Student",
        block: profile.block,
        room: profile.room,
        items: bill.lines.map((l) => ({ menuItemId: l.item.id, qty: l.qty })),
        tip,
        paymentMethod: PAYMENTS.find((p) => p.id === payment)?.label,
        note: note.trim() || undefined,
      });
      cart.clear();
      toast("Order placed — you're in the pool!");
      navigate(`/track/${order.id}`, { replace: true });
    } catch (err) {
      // Stock ran out, or the pool closed between render and submit.
      toast(err instanceof Error ? err.message : "Couldn't place that order", "info");
      setPlacing(false);
    }
  }

  return (
    <div className="pb-36">
      <ScreenHeader title="Checkout" onBack={() => navigate("/cart")} />

      {/* Address */}
      <section className="mx-4 rounded-[var(--radius-card)] bg-surface p-4 shadow-[var(--shadow-soft)]">
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-lime-soft text-[#4c6b04]">
            <Icon name="pin" className="h-5 w-5" strokeWidth={2.1} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[14px] font-bold text-ink">Deliver to {profile.name || "you"}</p>
            <p className="text-[12.5px] leading-snug text-ink-soft">
              {profile.block}, Room {profile.room}
              <br />
              {hostel.name}
            </p>
          </div>
          <button onClick={() => navigate("/")} className="text-[12.5px] font-bold text-coral">
            Change
          </button>
        </div>
      </section>

      {/* Payment */}
      <section className="mt-4 px-4">
        <h2 className="mb-2 text-[15px] font-bold text-ink">Payment method</h2>
        <div className="space-y-2">
          {PAYMENTS.map((p) => {
            const active = payment === p.id;
            return (
              <button
                key={p.id}
                onClick={() => setPayment(p.id)}
                className={`flex w-full items-center gap-3 rounded-2xl p-3.5 text-left transition ${
                  active ? "bg-surface ring-2 ring-lime" : "bg-surface shadow-[var(--shadow-soft)]"
                }`}
              >
                <span
                  className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
                    active ? "bg-lime text-ink" : "bg-cream-deep text-ink-soft"
                  }`}
                >
                  <Icon name={p.icon} className="h-[18px] w-[18px]" strokeWidth={2.1} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[14px] font-bold text-ink">{p.label}</span>
                  <span className="block text-[12px] text-ink-soft">{p.hint}</span>
                </span>
                <span
                  className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 ${
                    active ? "border-lime bg-lime" : "border-line"
                  }`}
                >
                  {active && <Icon name="check" className="h-3 w-3 text-ink" strokeWidth={3.2} />}
                </span>
              </button>
            );
          })}
        </div>
      </section>

      {/* Tip */}
      <section className="mx-4 mt-4 rounded-[var(--radius-card)] bg-surface p-4 shadow-[var(--shadow-soft)]">
        <div className="flex items-baseline justify-between">
          <h2 className="text-[15px] font-bold text-ink">Tip your rider</h2>
          <span className="text-[13px] font-extrabold text-ink">{tip === 0 ? "—" : rupees(tip)}</span>
        </div>
        <p className="mt-0.5 text-[12px] text-ink-soft">
          100% goes to the rider bringing your hostel's pooled run.
        </p>
        <div className="mt-3 flex gap-2">
          {TIP_PRESETS.map((amount) => (
            <button
              key={amount}
              onClick={() => setTip(amount)}
              className={`min-h-[40px] flex-1 rounded-xl text-[13px] font-bold transition ${
                tip === amount ? "bg-ink text-cream" : "bg-cream-deep text-ink-soft"
              }`}
            >
              {amount === 0 ? "None" : `₹${amount}`}
            </button>
          ))}
        </div>
      </section>

      {/* Note */}
      <section className="mx-4 mt-4 rounded-[var(--radius-card)] bg-surface p-4 shadow-[var(--shadow-soft)]">
        <h2 className="text-[15px] font-bold text-ink">Delivery instructions</h2>
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value.slice(0, 140))}
          rows={2}
          placeholder="e.g. Call when you reach the gate, don't ring the bell"
          className="mt-2 w-full resize-none rounded-xl bg-cream px-3 py-2.5 text-[13.5px] text-ink outline-none placeholder:text-ink-faint focus:ring-2 focus:ring-lime"
        />
      </section>

      {/* Bill */}
      <section className="mx-4 mt-4 rounded-[var(--radius-card)] bg-surface p-4 shadow-[var(--shadow-soft)]">
        <p className="text-[15px] font-bold text-ink">Bill summary</p>
        <dl className="mt-3 space-y-2 text-[13.5px]">
          <Row label={`Item total (${bill.lines.length} items)`} value={rupees(bill.itemTotal)} />
          <Row
            label="Delivery fee"
            value={bill.deliveryFee === 0 ? "FREE" : rupees(bill.deliveryFee)}
            accent={bill.deliveryFee === 0}
          />
          <Row label="Platform fee" value={rupees(bill.platformFee)} />
          {tip > 0 && <Row label="Rider tip" value={rupees(tip)} />}
        </dl>
        <div className="mt-3 flex items-baseline justify-between border-t border-line pt-3">
          <span className="text-[15px] font-bold text-ink">To pay</span>
          <span className="text-[20px] font-extrabold text-ink">{rupees(bill.total)}</span>
        </div>
        {bill.savedVsSolo > 0 && (
          <div className="mt-2 flex justify-end">
            <Badge tone="lime">You saved {rupees(bill.savedVsSolo)} by pooling</Badge>
          </div>
        )}
      </section>

      <p className="mt-3 px-6 text-center text-[11.5px] leading-relaxed text-ink-faint">
        Your fee is locked in when the pool closes. If more students join before then, it drops
        further — automatically.
      </p>

      <div className="fixed inset-x-0 bottom-0 z-40 mx-auto max-w-md border-t border-line bg-cream/95 px-4 pb-[calc(env(safe-area-inset-bottom)+12px)] pt-3 backdrop-blur">
        <Button full onClick={() => void confirm()} disabled={placing}>
          {placing ? "Placing…" : `Place order · ${rupees(bill.total)}`}
          {!placing && <Icon name="arrowRight" className="h-4 w-4" strokeWidth={2.4} />}
        </Button>
        <p className="mt-1.5 text-center text-[11px] text-ink-faint">
          Joining {vendor?.name}'s pool for {hostel.name}
        </p>
      </div>
    </div>
  );
}

function Row({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="text-ink-soft">{label}</dt>
      <dd className={`font-semibold ${accent ? "text-[#4c6b04]" : "text-ink"}`}>{value}</dd>
    </div>
  );
}
