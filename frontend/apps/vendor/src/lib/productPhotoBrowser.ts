/**
 * Canvas side of the product photo pipeline (see productPhoto.ts for the rules).
 * Needs a browser, so it is checked in a real browser rather than under Node.
 */
import { type EncodedImage, PHOTO_LIMIT_BYTES, fitWithin } from "./productPhoto";

/** Quality steps tried in order until the file fits the bucket's limit. */
const WEBP_QUALITY = [0.8, 0.65, 0.5];
const JPEG_QUALITY = [0.82, 0.65, 0.5];

async function encode(canvas: HTMLCanvasElement | OffscreenCanvas, type: EncodedImage["type"], quality: number): Promise<Blob> {
  if ("convertToBlob" in canvas) return canvas.convertToBlob({ type, quality });
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Could not encode the photo"))), type, quality),
  );
}

/**
 * Shrinks a photo so its long edge is at most `maxEdge`, as WebP when the
 * browser can encode it (Safari may not, so it falls back to JPEG), trying
 * lower quality until the file fits the bucket's size limit. If nothing fits,
 * the smallest result is returned and the caller refuses it.
 */
export async function resizeInBrowser(file: Blob, maxEdge: number): Promise<EncodedImage> {
  // Read the photo's own size first (cheap: only the header), so a small photo
  // is never enlarged, then decode straight to the target size so a 50 MP photo
  // is never held in memory at full size. The camera's rotation is applied.
  const natural = await naturalSize(file);
  const { width, height } = fitWithin(natural.width, natural.height, maxEdge);
  const bitmap = await createImageBitmap(file, { resizeWidth: width, resizeHeight: height, resizeQuality: "high" });
  try {
    const canvas: HTMLCanvasElement | OffscreenCanvas =
      typeof OffscreenCanvas !== "undefined" ? new OffscreenCanvas(width, height) : Object.assign(document.createElement("canvas"), { width, height });
    const ctx = canvas.getContext("2d") as CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D | null;
    if (!ctx) throw new Error("Could not prepare the photo");
    // Transparent areas would turn black in a JPEG.
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, width, height);
    ctx.drawImage(bitmap, 0, 0, width, height);

    let best: EncodedImage | null = null;
    // Try WebP first; if the browser quietly returns something else, use JPEG.
    for (const [type, steps] of [
      ["image/webp", WEBP_QUALITY],
      ["image/jpeg", JPEG_QUALITY],
    ] as const) {
      for (const q of steps) {
        const blob = await encode(canvas, type, q);
        if (blob.type !== type) break; // this format is not supported here
        const candidate: EncodedImage = { bytes: new Uint8Array(await blob.arrayBuffer()), type };
        if (!best || candidate.bytes.length < best.bytes.length) best = candidate;
        if (candidate.bytes.length <= PHOTO_LIMIT_BYTES) return candidate;
      }
      if (best) break; // WebP worked but nothing fit: do not switch to a bigger format
    }
    if (!best) throw new Error("Could not encode the photo");
    return best;
  } finally {
    bitmap.close();
  }
}

/** Width and height as the user sees the photo (rotation applied), without decoding the whole picture. */
function naturalSize(file: Blob): Promise<{ width: number; height: number }> {
  const url = URL.createObjectURL(file);
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve({ width: img.naturalWidth, height: img.naturalHeight });
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("That file could not be read as a photo"));
    };
    img.src = url;
  });
}
