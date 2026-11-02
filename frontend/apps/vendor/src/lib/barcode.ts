/** Pure barcode helpers — no browser APIs, so they run under plain Node tests. */

/**
 * Validate the check digit of EAN-13 / EAN-8 / UPC-A codes. Misreads on a
 * blurry frame almost always fail this, so we drop them instead of showing
 * the vendor a bogus "unknown barcode".
 */
export function isPlausibleBarcode(code: string, format?: string): boolean {
  if (!code) return false;
  const numeric = /^\d+$/.test(code);
  const gtin = format ? ["ean_13", "ean_8", "upc_a"].includes(format) : numeric && [8, 12, 13].includes(code.length);
  if (!gtin) return code.trim().length >= 4;
  if (!numeric) return false;
  const digits = code.split("").map(Number);
  const check = digits.pop()!;
  const sum = digits
    .reverse()
    .reduce((acc, d, i) => acc + d * (i % 2 === 0 ? 3 : 1), 0);
  return (10 - (sum % 10)) % 10 === check;
}

