export interface DonutSegment {
  label: string;
  value: number;
}

/** Brand-family palette — stays within the Poolit teal/coral system. */
export const DONUT_COLORS = ["#1c7293", "#ff6b4a", "#0e3e4a", "#4a9db8", "#ffa591"];

interface DonutProps {
  segments: DonutSegment[];
  centerValue: string;
  centerLabel: string;
  formatValue?: (value: number) => string;
}

const RADIUS = 60;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

export function Donut({ segments, centerValue, centerLabel, formatValue }: DonutProps) {
  const total = segments.reduce((sum, s) => sum + s.value, 0);

  if (total === 0) {
    return <p className="py-8 text-center text-sm text-muted">No data yet.</p>;
  }

  let offset = 0;

  return (
    <div className="flex flex-wrap items-center justify-center gap-6">
      <svg viewBox="0 0 160 160" className="h-40 w-40 shrink-0 -rotate-90">
        <circle cx="80" cy="80" r={RADIUS} fill="none" stroke="#f3f6f7" strokeWidth="20" />
        {segments.map((segment, i) => {
          const length = (segment.value / total) * CIRCUMFERENCE;
          const dash = `${length} ${CIRCUMFERENCE - length}`;
          const circle = (
            <circle
              key={segment.label}
              cx="80"
              cy="80"
              r={RADIUS}
              fill="none"
              stroke={DONUT_COLORS[i % DONUT_COLORS.length]}
              strokeWidth="20"
              strokeDasharray={dash}
              strokeDashoffset={-offset}
            />
          );
          offset += length;
          return circle;
        })}
        <text
          x="80"
          y="74"
          textAnchor="middle"
          className="rotate-90 fill-body text-[20px] font-bold"
          style={{ transformOrigin: "80px 80px" }}
        >
          {centerValue}
        </text>
        <text
          x="80"
          y="92"
          textAnchor="middle"
          className="rotate-90 fill-muted text-[9px]"
          style={{ transformOrigin: "80px 80px" }}
        >
          {centerLabel}
        </text>
      </svg>

      <ul className="min-w-0 space-y-2">
        {segments.map((segment, i) => (
          <li key={segment.label} className="flex items-center gap-2.5 text-sm">
            <span
              className="h-2.5 w-2.5 shrink-0 rounded-full"
              style={{ backgroundColor: DONUT_COLORS[i % DONUT_COLORS.length] }}
            />
            <span className="min-w-0 flex-1 truncate text-body">{segment.label}</span>
            <span className="shrink-0 font-semibold text-body">
              {formatValue ? formatValue(segment.value) : segment.value}
            </span>
            <span className="w-9 shrink-0 text-right text-xs text-muted">
              {Math.round((segment.value / total) * 100)}%
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
