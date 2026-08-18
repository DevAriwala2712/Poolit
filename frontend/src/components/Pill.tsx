export type PillTone = "success" | "warning" | "danger" | "info" | "neutral";

const toneClasses: Record<PillTone, string> = {
  success: "bg-green-50 text-green-700",
  warning: "bg-accent/15 text-accent",
  danger: "bg-red-50 text-red-600",
  info: "bg-secondary/10 text-secondary",
  neutral: "bg-muted/15 text-muted",
};

const dotClasses: Record<PillTone, string> = {
  success: "bg-green-500",
  warning: "bg-accent",
  danger: "bg-red-500",
  info: "bg-secondary",
  neutral: "bg-muted",
};

/** Capitalizes a lowercase status enum for display, e.g. "open" → "Open". */
export function titleCase(status: string): string {
  return status.charAt(0).toUpperCase() + status.slice(1);
}

export function Pill({ tone, children }: { tone: PillTone; children: React.ReactNode }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold ${toneClasses[tone]}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${dotClasses[tone]}`} />
      {children}
    </span>
  );
}
