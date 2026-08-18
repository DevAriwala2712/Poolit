import { Icon } from "./Icon";
import type { IconName } from "./Icon";

type Tone = "accent" | "secondary" | "danger" | "primary";

interface StatCardProps {
  label: string;
  value: string;
  icon: IconName;
  tone?: Tone;
  delta?: { label: string; direction: "up" | "down" | "flat" };
}

const circleClasses: Record<Tone, string> = {
  accent: "bg-accent",
  secondary: "bg-secondary",
  danger: "bg-red-500",
  primary: "bg-primary",
};

const deltaClasses = {
  up: "bg-green-50 text-green-700",
  down: "bg-red-50 text-red-600",
  flat: "bg-surface text-muted",
};

export function StatCard({ label, value, icon, tone = "secondary", delta }: StatCardProps) {
  return (
    <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-black/5 transition hover:shadow-md">
      <div className="flex items-start justify-between gap-3">
        <p className="text-xs font-medium uppercase tracking-wide text-muted">{label}</p>
        <div
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-white ${circleClasses[tone]}`}
        >
          <Icon name={icon} className="h-[18px] w-[18px]" />
        </div>
      </div>

      <p className="mt-3 text-3xl font-bold leading-none text-body">{value}</p>

      {delta && (
        <span
          className={`mt-3 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold ${deltaClasses[delta.direction]}`}
        >
          {delta.direction !== "flat" && (
            <Icon
              name={delta.direction === "up" ? "trendUp" : "trendDown"}
              className="h-3 w-3"
              strokeWidth={2.5}
            />
          )}
          {delta.label}
        </span>
      )}
    </div>
  );
}
