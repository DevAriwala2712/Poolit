import { Icon } from "./Icon";
import type { IconName } from "./Icon";

export function KpiCard({
  label,
  value,
  icon,
  delta,
  hint,
  spark,
}: {
  label: string;
  value: string;
  icon: IconName;
  delta?: { value: string; direction: "up" | "down" | "flat" };
  hint?: string;
  spark?: number[];
}) {
  const deltaTone =
    delta?.direction === "up" ? "text-ok" : delta?.direction === "down" ? "text-bad" : "text-faint";

  return (
    <div className="rounded-[var(--radius-card)] border border-line bg-card p-4 transition hover:border-[#34343a]">
      <div className="flex items-start justify-between gap-3">
        <p className="text-[11.5px] font-medium uppercase tracking-wider text-faint">{label}</p>
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-raised text-muted">
          <Icon name={icon} className="h-3.5 w-3.5" strokeWidth={2} />
        </span>
      </div>

      <p className="mt-2.5 text-[26px] font-semibold leading-none tracking-tight text-text">
        {value}
      </p>

      <div className="mt-2.5 flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          {delta && (
            <span className={`inline-flex items-center gap-1 text-[11.5px] font-medium ${deltaTone}`}>
              {delta.direction !== "flat" && (
                <Icon
                  name={delta.direction === "up" ? "trendUp" : "trendDown"}
                  className="h-3 w-3"
                  strokeWidth={2.2}
                />
              )}
              {delta.value}
            </span>
          )}
          {hint && <span className="text-[11.5px] text-faint">{hint}</span>}
        </div>
        {spark && spark.length > 1 && <Sparkline data={spark} />}
      </div>
    </div>
  );
}

function Sparkline({ data }: { data: number[] }) {
  const max = Math.max(1, ...data);
  const step = 60 / (data.length - 1);
  const d = data
    .map((v, i) => `${i === 0 ? "M" : "L"}${i * step},${20 - (v / max) * 18}`)
    .join(" ");

  return (
    <svg viewBox="0 0 60 20" className="h-5 w-[60px] shrink-0">
      <path
        d={d}
        fill="none"
        stroke="#a8e10c"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity="0.8"
      />
    </svg>
  );
}
