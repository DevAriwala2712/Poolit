/**
 * EAN-13 encoding (no dependencies). Ported from dummy-barcodes/generate.js.
 * encodeEAN13("2900000000018") → 95-character string of "1" (bar) / "0" (space).
 */
const L = ["0001101", "0011001", "0010011", "0111101", "0100011", "0110001", "0101111", "0111011", "0110111", "0001011"];
const R = L.map((b) => b.replace(/[01]/g, (c) => (c === "0" ? "1" : "0")));
const G = R.map((b) => b.split("").reverse().join(""));
const PARITY = ["LLLLLL", "LLGLGG", "LLGGLG", "LLGGGL", "LGLLGG", "LGGLLG", "LGGGLL", "LGLGLG", "LGLGGL", "LGGLGL"];

export function ean13CheckDigit(first12: string): number {
  let sum = 0;
  for (let i = 0; i < 12; i++) sum += Number(first12[i]) * (i % 2 === 0 ? 1 : 3);
  return (10 - (sum % 10)) % 10;
}

export function isValidEAN13(code: string): boolean {
  return /^\d{13}$/.test(code) && ean13CheckDigit(code.slice(0, 12)) === Number(code[12]);
}

export function encodeEAN13(code: string): string {
  if (!isValidEAN13(code)) throw new Error(`Not a valid EAN-13: ${code}`);
  const d = code.split("").map(Number);
  const parity = PARITY[d[0]];
  let bits = "101";
  for (let i = 1; i <= 6; i++) bits += parity[i - 1] === "L" ? L[d[i]] : G[d[i]];
  bits += "01010";
  for (let i = 7; i <= 12; i++) bits += R[d[i]];
  return bits + "101";
}

/** Standalone SVG markup for printing/downloading (same drawing as <Barcode>). */
export function ean13Svg(code: string, height = 64): string {
  const bits = encodeEAN13(code);
  const quiet = 11;
  const width = bits.length + quiet * 2;
  const barH = height - 14;
  const guard = (i: number) => i < 3 || (i >= 45 && i < 50) || i >= 92;
  let bars = "";
  for (let i = 0; i < bits.length; i++) {
    if (bits[i] === "1") bars += `<rect x="${quiet + i}" y="0" width="1" height="${guard(i) ? barH + 6 : barH}"/>`;
  }
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" shape-rendering="crispEdges">` +
    `<rect width="${width}" height="${height}" fill="#fff"/><g fill="#000">${bars}</g>` +
    `<g font-family="ui-monospace, Menlo, monospace" font-size="9" fill="#000" text-anchor="middle">` +
    `<text x="${quiet - 5}" y="${height - 2}">${code[0]}</text>` +
    `<text x="${quiet + 24}" y="${height - 2}" letter-spacing="2.2">${code.slice(1, 7)}</text>` +
    `<text x="${quiet + 71}" y="${height - 2}" letter-spacing="2.2">${code.slice(7)}</text></g></svg>`
  );
}
