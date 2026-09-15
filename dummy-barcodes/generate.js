#!/usr/bin/env node
// Generates scannable EAN-13 barcode SVGs for testing the vendor console's
// "Scan barcode" feature (Inventory screen). No dependencies — implements
// the EAN-13 encoding table directly. Run with: node generate.js
//
// Output: one .svg per code in this folder, plus an index.html you can
// open and print, or screenshot/photograph to scan with the camera in
// Inventory > Scan barcode.

const fs = require("fs");
const path = require("path");

// 7-module binary patterns for digits 0-9, per encoding set.
// R = bitwise complement of L. G = reverse of R (equivalently, reverse then
// complement of L — complement and reverse commute since complement acts
// per-bit independent of position).
const L_CODES = [
  "0001101", "0011001", "0010011", "0111101", "0100011",
  "0110001", "0101111", "0111011", "0110111", "0001011",
];
const complement = (bits) => bits.split("").map((b) => (b === "0" ? "1" : "0")).join("");
const reverse = (bits) => bits.split("").reverse().join("");
const R_CODES = L_CODES.map(complement);
const G_CODES = R_CODES.map(reverse);

// For the first digit (not itself encoded), which of L/G each of the next
// six digits uses.
const PARITY = [
  "LLLLLL", "LLGLGG", "LLGGLG", "LLGGGL", "LGLLGG",
  "LGGLLG", "LGGGLL", "LGLGLG", "LGLGGL", "LGGLGL",
];

function checkDigit(digits12) {
  let sum = 0;
  for (let i = 0; i < 12; i++) {
    sum += Number(digits12[i]) * (i % 2 === 0 ? 1 : 3);
  }
  return (10 - (sum % 10)) % 10;
}

/** Build a valid 13-digit EAN-13 code from a 12-digit prefix (adds the check digit). */
function makeEAN13(prefix12) {
  if (!/^\d{12}$/.test(prefix12)) throw new Error(`Expected 12 digits, got "${prefix12}"`);
  return prefix12 + String(checkDigit(prefix12));
}

function encode(code13) {
  const digits = code13.split("");
  const first = Number(digits[0]);
  const parity = PARITY[first];
  const left = digits.slice(1, 7);
  const right = digits.slice(7, 13);

  let bits = "101"; // start guard
  left.forEach((d, i) => {
    bits += parity[i] === "L" ? L_CODES[Number(d)] : G_CODES[Number(d)];
  });
  bits += "01010"; // center guard
  right.forEach((d) => {
    bits += R_CODES[Number(d)];
  });
  bits += "101"; // end guard
  return bits;
}

/** Decode our own bit pattern back to digits, as a round-trip self-check. */
function decode(bits) {
  if (bits.slice(0, 3) !== "101") throw new Error("bad start guard");
  if (bits.slice(45, 50) !== "01010") throw new Error("bad center guard");
  if (bits.slice(bits.length - 3) !== "101") throw new Error("bad end guard");

  const leftBits = bits.slice(3, 45);
  const rightBits = bits.slice(50, bits.length - 3);

  let leftDigits = "";
  let parityPattern = "";
  for (let i = 0; i < 6; i++) {
    const chunk = leftBits.slice(i * 7, i * 7 + 7);
    let found = L_CODES.indexOf(chunk);
    if (found !== -1) {
      parityPattern += "L";
    } else {
      found = G_CODES.indexOf(chunk);
      if (found === -1) throw new Error(`unrecognized left pattern: ${chunk}`);
      parityPattern += "G";
    }
    leftDigits += found;
  }

  const firstDigit = PARITY.indexOf(parityPattern);
  if (firstDigit === -1) throw new Error(`unrecognized parity pattern: ${parityPattern}`);

  let rightDigits = "";
  for (let i = 0; i < 6; i++) {
    const chunk = rightBits.slice(i * 7, i * 7 + 7);
    const found = R_CODES.indexOf(chunk);
    if (found === -1) throw new Error(`unrecognized right pattern: ${chunk}`);
    rightDigits += found;
  }

  return String(firstDigit) + leftDigits + rightDigits;
}

function selfTest() {
  // Two independently-verifiable real-world EAN-13s (checksum hand-verified
  // against the standard algorithm) — confirms both the encode/decode
  // round-trip AND that checkDigit() matches the real EAN-13 checksum.
  const knownGood = ["4006381333931", "0012345678905"];
  for (const code of knownGood) {
    const expectedCheck = checkDigit(code.slice(0, 12));
    if (String(expectedCheck) !== code[12]) {
      throw new Error(`checkDigit() disagrees with known-good code ${code}: got ${expectedCheck}`);
    }
    const decoded = decode(encode(code));
    if (decoded !== code) {
      throw new Error(`Self-test failed: encoded ${code} but decoded back to ${decoded}`);
    }
  }
  console.log(`Self-test passed: checksum + encode/decode round-trip verified against ${knownGood.length} known-good EAN-13 codes.`);
}

function toSVG(code13, label) {
  const bits = encode(code13);
  const moduleWidth = 3;
  const height = 90;
  const quietZone = 10 * moduleWidth;
  const width = bits.length * moduleWidth + quietZone * 2;
  const totalHeight = height + 30;

  let bars = "";
  let x = quietZone;
  for (const bit of bits) {
    if (bit === "1") {
      bars += `<rect x="${x}" y="0" width="${moduleWidth}" height="${height}" fill="#000"/>`;
    }
    x += moduleWidth;
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${totalHeight}" width="${width}" height="${totalHeight}">
  <rect x="0" y="0" width="${width}" height="${totalHeight}" fill="#fff"/>
  <g>${bars}</g>
  <text x="${width / 2}" y="${height + 20}" font-family="monospace" font-size="18" text-anchor="middle" fill="#000" letter-spacing="2">${code13}</text>
  ${label ? `<text x="${width / 2}" y="${totalHeight - 2}" font-family="sans-serif" font-size="11" text-anchor="middle" fill="#555">${label}</text>` : ""}
</svg>`;
}

// A fixed, memorable set of dummy codes — not real UPC/EAN registrations,
// just valid-checksum EAN-13s safe to reuse in this demo.
const DUMMY = [
  { prefix: "890103082101", label: "Dummy item A" },
  { prefix: "890103082102", label: "Dummy item B" },
  { prefix: "890103082103", label: "Dummy item C" },
  { prefix: "890103082104", label: "Dummy item D" },
  { prefix: "890103082105", label: "Dummy item E" },
  { prefix: "890103082106", label: "Dummy item F" },
  { prefix: "890103082107", label: "Dummy item G" },
  { prefix: "890103082108", label: "Dummy item H" },
];

selfTest();

const outDir = __dirname;
const results = DUMMY.map(({ prefix, label }) => {
  const code = makeEAN13(prefix);
  const svg = toSVG(code, label);
  fs.writeFileSync(path.join(outDir, `${code}.svg`), svg);
  return { code, label };
});

const indexHtml = `<!doctype html>
<html><head><meta charset="utf-8"><title>Poolit dummy barcodes</title>
<style>
  body { font-family: sans-serif; background: #f4f4f4; padding: 24px; }
  .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: 16px; }
  .card { background: #fff; border-radius: 8px; padding: 12px; text-align: center; box-shadow: 0 1px 4px rgba(0,0,0,.08); }
  .card img { max-width: 100%; }
  @media print { body { background: #fff; } .card { box-shadow: none; border: 1px solid #ddd; } }
</style></head>
<body>
  <h1>Poolit dummy barcodes</h1>
  <p>Print this page, or point the Inventory &gt; Scan barcode camera at your screen. Each code is a valid EAN-13 checksum but not a real registered product.</p>
  <div class="grid">
    ${results.map(({ code, label }) => `<div class="card"><img src="${code}.svg" alt="${code}"><p>${label}</p></div>`).join("\n    ")}
  </div>
</body></html>`;
fs.writeFileSync(path.join(outDir, "index.html"), indexHtml);

console.log(`Generated ${results.length} barcodes in ${outDir}:`);
results.forEach(({ code, label }) => console.log(`  ${code}  ${label}`));
