import { Icon } from "./Icon";

interface QtyStepperProps {
  qty: number;
  max: number;
  onAdd: () => void;
  onRemove: () => void;
  size?: "sm" | "md";
  disabled?: boolean;
}

/**
 * Blinkit-style ADD control: a compact "ADD" pill that swaps to a
 * −/qty/+ stepper once the item is in the cart.
 */
export function QtyStepper({
  qty,
  max,
  onAdd,
  onRemove,
  size = "sm",
  disabled,
}: QtyStepperProps) {
  const h = size === "sm" ? "h-9" : "h-11";
  const w = size === "sm" ? "min-w-[74px]" : "min-w-[104px]";

  if (disabled) {
    return (
      <span
        className={`inline-flex ${h} ${w} items-center justify-center rounded-xl bg-cream-deep text-[12px] font-bold text-ink-faint`}
      >
        Sold out
      </span>
    );
  }

  if (qty === 0) {
    return (
      <button
        onClick={onAdd}
        className={`inline-flex ${h} ${w} items-center justify-center rounded-xl bg-lime-soft text-[13px] font-extrabold tracking-wide text-[#4c6b04] ring-1 ring-lime/50 transition active:scale-95`}
      >
        ADD
      </button>
    );
  }

  return (
    <div
      className={`inline-flex ${h} ${w} animate-pop items-center justify-between rounded-xl bg-lime px-1 text-ink`}
    >
      <button
        onClick={onRemove}
        aria-label="Remove one"
        className="flex h-full w-8 items-center justify-center active:scale-90"
      >
        <Icon name="minus" className="h-4 w-4" strokeWidth={2.6} />
      </button>
      <span className="text-[14px] font-extrabold tabular-nums">{qty}</span>
      <button
        onClick={onAdd}
        disabled={qty >= max}
        aria-label="Add one"
        className="flex h-full w-8 items-center justify-center disabled:opacity-40 active:scale-90"
      >
        <Icon name="plus" className="h-4 w-4" strokeWidth={2.6} />
      </button>
    </div>
  );
}
