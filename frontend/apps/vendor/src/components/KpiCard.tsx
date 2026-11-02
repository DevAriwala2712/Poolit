import { MaterialIcon } from "./MaterialIcon";

export function KpiCard({
  label,
  value,
  unit,
  icon,
  delta,
  hint,
}: {
  label: string;
  value: string;
  unit?: string;
  icon: string;
  delta?: { value: string; direction: "up" | "down" | "flat" };
  hint?: string;
}) {
  const deltaTone =
    delta?.direction === "up" ? "text-tertiary" : delta?.direction === "down" ? "text-error" : "text-secondary";

  return (
    <div className="flex min-w-0 flex-col justify-between rounded-lg bg-surface-container-lowest p-space-md shadow-sm">
      <div className="flex items-center justify-between">
        <span className="min-w-0 truncate text-label-sm uppercase tracking-wide text-secondary">{label}</span>
        <MaterialIcon name={icon} className="text-[18px] text-secondary" />
      </div>
      <div className="mt-space-sm">
        <div className="text-tabular-metric leading-none text-on-surface">
          {value} {unit && <span className="text-body-md text-secondary">{unit}</span>}
        </div>
        <div className="mt-space-xs flex min-w-0 flex-wrap items-center gap-space-xs text-body-sm text-secondary">
          {delta && (
            <span className={`flex items-center font-label-sm text-label-sm ${deltaTone}`}>
              {delta.direction === "up" ? "↑" : delta.direction === "down" ? "↓" : ""} {delta.value}
            </span>
          )}
          {hint && <span className="min-w-0 truncate">{hint}</span>}
        </div>
      </div>
    </div>
  );
}
