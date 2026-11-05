/**
 * Product photos: shrink on the vendor's phone, name by content, upload both
 * sizes, then attach to the item.
 *
 * Why in the browser: a raw phone photo is several MB. The storage bucket
 * refuses anything over 200 KB, so the shrink happens here, once, before upload.
 *
 * Files are named after their content (`<store id>/<16 hex>.<webp|jpg>`, with
 * `.thumb` before the extension for the 400 px copy) and uploaded with a
 * one-year cache header: a file never changes under its name, so every phone
 * downloads each picture once. The rule matches
 * supabase/migrations/20261105000000_product_images.sql and
 * packages/domain/src/images.ts (a test keeps them in step).
 *
 * This file has no imports on purpose, so it runs under plain Node in tests.
 * The canvas work is in productPhotoBrowser.ts.
 */

/** Must equal the bucket's file_size_limit. */
export const PHOTO_LIMIT_BYTES = 204800;
/** One year, in seconds. */
export const PHOTO_CACHE_CONTROL = "31536000";
/** Long edge of the picture shown on a product page. */
export const FULL_EDGE = 800;
/** Long edge of the grid thumbnail. */
export const THUMB_EDGE = 400;

export type EncodedImage = { bytes: Uint8Array; type: "image/webp" | "image/jpeg" };

export type PhotoDeps = {
  /** Shrinks to at most `maxEdge` pixels on the long side and encodes. */
  resize(file: Blob, maxEdge: number): Promise<EncodedImage>;
  /** "exists" when the identical file was uploaded before. Throws on any other failure. */
  upload(path: string, image: EncodedImage): Promise<"uploaded" | "exists">;
  setItemImage(itemId: string, path: string): Promise<void>;
};

export class NotAnImageError extends Error {
  constructor() {
    super("Choose a photo (JPEG, PNG or WebP).");
    this.name = "NotAnImageError";
  }
}

export class PhotoTooLargeError extends Error {
  constructor() {
    super("That photo is still too large after shrinking. Try a simpler background or another photo.");
    this.name = "PhotoTooLargeError";
  }
}

/** Largest size that fits `max` on the long side, in whole pixels, never enlarging. */
export function fitWithin(width: number, height: number, max: number): { width: number; height: number } {
  const scale = Math.min(1, max / Math.max(width, height));
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) };
}

/** First 16 hex characters of the SHA-256 of the bytes. */
export async function contentHash(bytes: Uint8Array): Promise<string> {
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", bytes as BufferSource));
  return Array.from(digest.subarray(0, 8), (b) => b.toString(16).padStart(2, "0")).join("");
}

export function photoPaths(vendorId: string, hash: string, type: EncodedImage["type"]): { full: string; thumb: string } {
  const ext = type === "image/webp" ? "webp" : "jpg";
  return { full: `${vendorId}/${hash}.${ext}`, thumb: `${vendorId}/${hash}.thumb.${ext}` };
}

export async function uploadProductPhoto(args: {
  vendorId: string;
  itemId: string;
  file: Blob;
  deps: PhotoDeps;
}): Promise<{ path: string }> {
  const { vendorId, itemId, file, deps } = args;
  if (!file.type.startsWith("image/")) throw new NotAnImageError();

  const full = await deps.resize(file, FULL_EDGE);
  const thumb = await deps.resize(file, THUMB_EDGE);
  if (full.bytes.length > PHOTO_LIMIT_BYTES || thumb.bytes.length > PHOTO_LIMIT_BYTES) throw new PhotoTooLargeError();

  const paths = photoPaths(vendorId, await contentHash(full.bytes), full.type);
  await deps.upload(paths.thumb, thumb);
  await deps.upload(paths.full, full);
  // Last, so the database never points at a file that is not there.
  await deps.setItemImage(itemId, paths.full);
  return { path: paths.full };
}

/** The slice of a Supabase Storage bucket this code uses (`supabase.storage.from("product-images")`). */
type Bucket = {
  upload(
    path: string,
    body: Uint8Array,
    options: { contentType: string; cacheControl: string; upsert: boolean },
  ): Promise<{ error: { statusCode?: string | number; message: string } | null }>;
};

export function makeStorageUploader(bucket: Bucket): PhotoDeps["upload"] {
  return async (path, image) => {
    const { error } = await bucket.upload(path, image.bytes, {
      contentType: image.type,
      cacheControl: PHOTO_CACHE_CONTROL,
      upsert: false,
    });
    if (!error) return "uploaded";
    if (String(error.statusCode) === "409" || /already exists/i.test(error.message)) return "exists";
    throw new Error(error.message);
  };
}
