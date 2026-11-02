/**
 * Barcode decoding engine for the vendor scanner.
 *
 * - Uses the browser's native `BarcodeDetector` when it exists AND supports
 *   the retail formats we need (Chrome on Android, Edge, recent macOS Chrome).
 * - Everywhere else (iOS Safari, Firefox, desktop Safari) it falls back to a
 *   WebAssembly build of ZXing-C++ via the `barcode-detector` ponyfill, which
 *   exposes the exact same API.
 *
 * The .wasm file is bundled and self-hosted (Vite `?url` import), so scanning
 * never depends on a third-party CDN and keeps working offline once cached by
 * the service worker.
 */
import wasmUrl from "zxing-wasm/reader/zxing_reader.wasm?url";

export const SCAN_FORMATS = [
  "ean_13",
  "ean_8",
  "upc_a",
  "upc_e",
  "code_128",
  "code_39",
  "itf",
  "qr_code",
] as const;

export interface DetectedBarcode {
  rawValue: string;
  format: string;
}

export interface Detector {
  detect(source: ImageBitmapSource | HTMLVideoElement): Promise<DetectedBarcode[]>;
  engine: "native" | "wasm";
}

interface NativeDetectorCtor {
  new (options?: { formats: string[] }): {
    detect(source: unknown): Promise<DetectedBarcode[]>;
  };
  getSupportedFormats?: () => Promise<string[]>;
}

declare global {
  interface Window {
    BarcodeDetector?: NativeDetectorCtor;
  }
}

let cached: Promise<Detector> | null = null;

async function nativeDetector(): Promise<Detector | null> {
  const Native = typeof window !== "undefined" ? window.BarcodeDetector : undefined;
  if (!Native) return null;
  try {
    const supported = (await Native.getSupportedFormats?.()) ?? [];
    // Some desktop builds expose the constructor but support only QR — not
    // good enough for EAN/UPC product barcodes.
    if (!supported.includes("ean_13")) return null;
    const formats = SCAN_FORMATS.filter((f) => supported.includes(f));
    const d = new Native({ formats: [...formats] });
    return { engine: "native", detect: (src) => d.detect(src) };
  } catch {
    return null;
  }
}

async function wasmDetector(): Promise<Detector> {
  const { BarcodeDetector, prepareZXingModule } = await import("barcode-detector/ponyfill");
  // Load + instantiate the wasm up front so a failure surfaces here, not on
  // the first frame.
  await prepareZXingModule({
    overrides: {
      locateFile: (path: string, prefix: string) => (path.endsWith(".wasm") ? wasmUrl : prefix + path),
    },
    fireImmediately: true,
  });
  const d = new BarcodeDetector({ formats: [...SCAN_FORMATS] });
  return { engine: "wasm", detect: (src) => d.detect(src as ImageBitmapSource) };
}

/** Resolve (once) the best available detector for this browser. */
export function getDetector(): Promise<Detector> {
  if (!cached) {
    cached = (async () => (await nativeDetector()) ?? (await wasmDetector()))();
    cached.catch(() => {
      cached = null; // allow a retry after a transient load failure
    });
  }
  return cached;
}

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

/** Short beep + haptic tick on a successful read. Both fail silently. */
export function scanFeedback() {
  try {
    navigator.vibrate?.(60);
  } catch {
    /* unsupported */
  }
  try {
    const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "square";
    osc.frequency.value = 1760;
    gain.gain.value = 0.04;
    osc.connect(gain).connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.08);
    osc.onended = () => void ctx.close();
  } catch {
    /* audio blocked */
  }
}
