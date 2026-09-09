/* Lightweight, dependency-free charts tuned for the operations console. */

export function BarChart({
  data,
  height = 140,
  formatValue = (v: number) => String(v),
  peakIndex,
}: {
  data: { label: string; value: number }[];
  height?: number;
  formatValue?: (v: number) => string;
  peakIndex?: number;
}) {
  const max = Math.max(1, ...data.map((d) => d.value));

  return (
    <div className="flex items-end gap-1.5" style={{ height }}>
      {data.map((d, i) => {
        const pct = (d.value / max) * 100;
        const isPeak = peakIndex === i;
        return (
          <div key={d.label} className="group flex h-full flex-1 flex-col justify-end gap-1.5">
            <div className="relative flex-1">
              <div
                className={`absolute inset-x-0 bottom-0 rounded-t-sm transition-colors ${
                  isPeak ? "bg-primary" : "bg-surface-container-highest group-hover:bg-primary/60"
                }`}
                style={{ height: `${Math.max(2, pct)}%` }}
              />
              <span className="pointer-events-none absolute inset-x-0 bottom-full mb-1 hidden justify-center text-label-sm text-on-surface group-hover:flex">
                {formatValue(d.value)}
              </span>
            </div>
            <span className="text-center text-label-sm text-secondary">{d.label}</span>
          </div>
        );
      })}
    </div>
  );
}

export function AreaChart({
  data,
  height = 160,
}: {
  data: { label: string; value: number }[];
  height?: number;
}) {
  if (data.length < 2) return null;
  const max = Math.max(1, ...data.map((d) => d.value));
  const w = 100;
  const h = 100;
  const step = w / (data.length - 1);

  const points = data.map((d, i) => [i * step, h - (d.value / max) * h] as const);
  const line = points.map(([x, y], i) => `${i === 0 ? "M" : "L"}${x},${y}`).join(" ");
  const area = `${line} L${w},${h} L0,${h} Z`;

  return (
    <div style={{ height }} className="relative w-full">
      <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" className="h-full w-full">
        <defs>
          <linearGradient id="areaFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#a33900" stopOpacity="0.22" />
            <stop offset="100%" stopColor="#a33900" stopOpacity="0" />
          </linearGradient>
        </defs>
        {[0.25, 0.5, 0.75].map((g) => (
          <line key={g} x1="0" y1={h * g} x2={w} y2={h * g} stroke="#dce9ff" strokeWidth="0.4" />
        ))}
        <path d={area} fill="url(#areaFill)" />
        <path
          d={line}
          fill="none"
          stroke="#a33900"
          strokeWidth="1.4"
          vectorEffect="non-scaling-stroke"
          strokeLinejoin="round"
          strokeLinecap="round"
        />
      </svg>
      <div className="mt-1.5 flex justify-between text-label-sm text-secondary">
        {data.map((d, i) =>
          i === 0 || i === data.length - 1 || i === Math.floor(data.length / 2) ? (
            <span key={d.label}>{d.label}</span>
          ) : null,
        )}
      </div>
    </div>
  );
}

export function HBarList({
  data,
  formatValue = (v: number) => String(v),
}: {
  data: { label: string; value: number; sub?: string }[];
  formatValue?: (v: number) => string;
}) {
  const max = Math.max(1, ...data.map((d) => d.value));

  return (
    <div className="space-y-2.5">
      {data.map((d) => (
        <div key={d.label}>
          <div className="mb-1 flex items-baseline justify-between gap-3">
            <span className="min-w-0 truncate text-body-md text-on-surface">{d.label}</span>
            <span className="shrink-0 text-tabular-metric !text-body-md text-on-surface">
              {formatValue(d.value)}
              {d.sub && <span className="ml-1 text-body-sm font-normal text-secondary">{d.sub}</span>}
            </span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-surface-container">
            <div
              className="h-full rounded-full bg-primary-container transition-all duration-500"
              style={{ width: `${Math.max(3, (d.value / max) * 100)}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export function Heatmap({ matrix, hours }: { matrix: number[][]; hours: number[] }) {
  const max = Math.max(1, ...matrix.flat());

  return (
    <div className="overflow-x-auto">
      <div className="min-w-[520px]">
        <div className="flex gap-1 pl-9">
          {hours.map((h) => (
            <span key={h} className="flex-1 text-center text-label-sm text-secondary">
              {h % 12 === 0 ? 12 : h % 12}
              {h < 12 ? "a" : "p"}
            </span>
          ))}
        </div>
        {matrix.map((row, di) => (
          <div key={DAYS[di]} className="mt-1 flex items-center gap-1">
            <span className="w-8 shrink-0 text-label-sm text-secondary">{DAYS[di]}</span>
            {row.map((v, hi) => (
              <div
                key={hi}
                title={`${DAYS[di]} ${hours[hi]}:00 — ${v} orders`}
                className="h-5 flex-1 rounded-sm transition"
                style={{
                  backgroundColor:
                    v === 0 ? "#e5eeff" : `rgb(163 57 0 / ${0.1 + (v / max) * 0.8})`,
                }}
              />
            ))}
          </div>
        ))}
        <div className="mt-3 flex items-center justify-end gap-1.5 text-label-sm text-secondary">
          Muted
          {[0.1, 0.32, 0.55, 0.78, 1].map((o) => (
            <span
              key={o}
              className="h-2.5 w-2.5 rounded-sm"
              style={{ backgroundColor: `rgb(163 57 0 / ${o})` }}
            />
          ))}
          Critical Rush
        </div>
      </div>
    </div>
  );
}
