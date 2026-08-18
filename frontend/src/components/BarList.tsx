interface BarListItem {
  label: string;
  value: number;
}

export function BarList({ items, unit = "" }: { items: BarListItem[]; unit?: string }) {
  const max = Math.max(1, ...items.map((i) => i.value));
  const sorted = [...items].sort((a, b) => b.value - a.value);

  return (
    <div className="space-y-3.5">
      {sorted.map((item) => (
        <div key={item.label}>
          <div className="mb-1.5 flex items-baseline justify-between gap-3">
            <span className="min-w-0 truncate text-sm font-medium text-body">{item.label}</span>
            <span className="shrink-0 text-sm font-semibold text-body">
              {item.value}
              <span className="text-xs font-normal text-muted">{unit}</span>
            </span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-surface">
            <div
              className="h-full rounded-full bg-gradient-to-r from-secondary to-[#4a9db8] transition-all duration-500"
              style={{ width: `${Math.max(4, (item.value / max) * 100)}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}
