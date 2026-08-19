/* Lightweight, dependency-free charts tuned for the dark console. */

export function BarChart({
  data,
  height = 140,
  formatValue = (v: number) => String(v),
}: {
  data: { label: string; value: number }[];
  height?: number;
  formatValue?: (v: number) => string;
}) {
  const max = Math.max(1, ...data.map((d) => d.value));

  return (
    <div className="flex items-end gap-1.5" style={{ height }}>
      {data.map((d) => {
        const pct = (d.value / max) * 100;
        return (
          <div key={d.label} className="group flex h-full flex-1 flex-col justify-end gap-1.5">
            <div className="relative flex-1">
              <div
                className="absolute inset-x-0 bottom-0 rounded-t-[3px] bg-accent/25 transition-colors group-hover:bg-accent"
                style={{ height: `${Math.max(2, pct)}%` }}
              />
              <span className="pointer-events-none absolute inset-x-0 bottom-full mb-1 hidden justify-center text-[10px] font-semibold text-text group-hover:flex">
                {formatValue(d.value)}
              </span>
            </div>
            <span className="text-center text-[9.5px] text-faint">{d.label}</span>
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
            <stop offset="0%" stopColor="#a8e10c" stopOpacity="0.28" />
            <stop offset="100%" stopColor="#a8e10c" stopOpacity="0" />
          </linearGradient>
        </defs>
        {[0.25, 0.5, 0.75].map((g) => (
          <line key={g} x1="0" y1={h * g} x2={w} y2={h * g} stroke="#2a2a2e" strokeWidth="0.4" />
        ))}
        <path d={area} fill="url(#areaFill)" />
        <path
          d={line}
          fill="none"
          stroke="#a8e10c"
          strokeWidth="1.4"
          vectorEffect="non-scaling-stroke"
          strokeLinejoin="round"
          strokeLinecap="round"
        />
      </svg>
      <div className="mt-1.5 flex justify-between text-[9.5px] text-faint">
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
            <span className="min-w-0 truncate text-[12.5px] text-text">{d.label}</span>
            <span className="shrink-0 text-[12.5px] font-semibold text-text">
              {formatValue(d.value)}
              {d.sub && <span className="ml-1 text-[11px] font-normal text-faint">{d.sub}</span>}
            </span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-raised">
            <div
              className="h-full rounded-full bg-accent/70 transition-all duration-500"
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
            <span key={h} className="flex-1 text-center text-[9.5px] text-faint">
              {h % 12 === 0 ? 12 : h % 12}
              {h < 12 ? "a" : "p"}
            </span>
          ))}
        </div>
        {matrix.map((row, di) => (
          <div key={DAYS[di]} className="mt-1 flex items-center gap-1">
            <span className="w-8 shrink-0 text-[10px] text-faint">{DAYS[di]}</span>
            {row.map((v, hi) => (
              <div
                key={hi}
                title={`${DAYS[di]} ${hours[hi]}:00 — ${v} orders`}
                className="h-5 flex-1 rounded-[3px] transition"
                style={{
                  backgroundColor:
                    v === 0 ? "#1e1e22" : `rgb(168 225 12 / ${0.12 + (v / max) * 0.78})`,
                }}
              />
            ))}
          </div>
        ))}
        <div className="mt-3 flex items-center justify-end gap-1.5 text-[10px] text-faint">
          Less
          {[0.12, 0.35, 0.58, 0.8, 1].map((o) => (
            <span
              key={o}
              className="h-2.5 w-2.5 rounded-[2px]"
              style={{ backgroundColor: `rgb(168 225 12 / ${o})` }}
            />
          ))}
          More
        </div>
      </div>
    </div>
  );
}
