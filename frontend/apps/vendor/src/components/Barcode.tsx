import { encodeEAN13, isValidEAN13 } from "../lib/ean13";

/**
 * Scannable EAN-13 as SVG (crisp at any size and in print). Guard bars extend
 * below the digits like a retail label; 11-module quiet zones on both sides.
 * Non-EAN codes (e.g. a Code 128 a vendor linked by scanning) render as text.
 */
export function Barcode({ value, height = 64, className = "" }: { value: string; height?: number; className?: string }) {
  if (!isValidEAN13(value)) {
    return <p className={`font-mono text-body-md text-on-surface ${className}`}>{value}</p>;
  }
  const bits = encodeEAN13(value);
  const quiet = 11;
  const width = bits.length + quiet * 2;
  const barH = height - 14;
  const guard = (i: number) => i < 3 || (i >= 45 && i < 50) || i >= 92;
  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className={className}
      role="img"
      aria-label={`Barcode ${value}`}
      shapeRendering="crispEdges"
      style={{ background: "#fff" }}
    >
      <rect width={width} height={height} fill="#fff" />
      {bits.split("").map((b, i) =>
        b === "1" ? <rect key={i} x={quiet + i} y={0} width={1} height={guard(i) ? barH + 6 : barH} fill="#000" /> : null,
      )}
      <g fontFamily="ui-monospace, Menlo, monospace" fontSize="9" fill="#000" textAnchor="middle">
        <text x={quiet - 5} y={height - 2}>{value[0]}</text>
        <text x={quiet + 3 + 21} y={height - 2} letterSpacing="2.2">{value.slice(1, 7)}</text>
        <text x={quiet + 50 + 21} y={height - 2} letterSpacing="2.2">{value.slice(7)}</text>
      </g>
    </svg>
  );
}
