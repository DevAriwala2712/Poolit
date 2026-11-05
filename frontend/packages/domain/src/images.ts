/**
 * Product picture addresses.
 *
 * Pictures live in the public Supabase Storage bucket `product-images`. The
 * database stores only a path ("<store id>/<hash>.webp"); the 400 px thumbnail
 * has the same name with ".thumb" before the extension. Set VITE_IMAGE_BASE_URL
 * to serve them through a CDN or cache instead (no other change is needed).
 */
const SUPABASE_URL =
  (import.meta.env?.VITE_SUPABASE_URL as string | undefined) ?? "https://icnkzzjnuoyfupaydian.supabase.co";

export const IMAGE_BASE_URL: string = (
  (import.meta.env?.VITE_IMAGE_BASE_URL as string | undefined) ??
  `${SUPABASE_URL}/storage/v1/object/public/product-images`
).replace(/\/$/, "");

const PATH = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\/[0-9a-f]{16}\.(webp|jpg)$/;

/** True for a path the upload rules would have accepted. */
export function isProductImagePath(path: unknown): path is string {
  return typeof path === "string" && PATH.test(path);
}

/** Thumbnail path for a full-size picture path. */
export function thumbPath(path: string): string {
  return path.replace(/\.(webp|jpg)$/, ".thumb.$1");
}

/**
 * Address of a picture, or undefined if there is none (or the path looks
 * wrong), so callers fall back to the emoji tile.
 * `thumb` (about 400 px) is for grids and lists; `full` (about 800 px) is for
 * the product page.
 */
export function productImageUrl(path: string | undefined | null, size: "thumb" | "full" = "thumb"): string | undefined {
  if (!isProductImagePath(path)) return undefined;
  return `${IMAGE_BASE_URL}/${size === "thumb" ? thumbPath(path) : path}`;
}
