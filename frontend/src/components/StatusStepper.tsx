import type { OrderStatus } from "../domain/types";

const STEPS: { key: OrderStatus; label: string }[] = [
  { key: "placed", label: "Placed" },
  { key: "pooled", label: "Pooled" },
  { key: "dispatched", label: "Dispatched" },
  { key: "delivered", label: "Delivered" },
];

export function StatusStepper({ status }: { status: OrderStatus }) {
  const activeIndex = STEPS.findIndex((s) => s.key === status);

  return (
    <div className="flex items-center">
      {STEPS.map((step, i) => {
        const done = i <= activeIndex;
        const isLast = i === STEPS.length - 1;
        return (
          <div key={step.key} className={`flex items-center ${isLast ? "" : "flex-1"}`}>
            <div className="flex flex-col items-center">
              <div
                className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold ${
                  done ? "bg-accent text-white" : "bg-surface text-muted"
                }`}
              >
                {done ? "✓" : i + 1}
              </div>
              <p className={`mt-1 text-[10px] font-medium ${done ? "text-body" : "text-muted"}`}>
                {step.label}
              </p>
            </div>
            {!isLast && (
              <div className={`mx-1 h-0.5 flex-1 ${i < activeIndex ? "bg-accent" : "bg-surface"}`} />
            )}
          </div>
        );
      })}
    </div>
  );
}
