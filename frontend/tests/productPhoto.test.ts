import assert from "node:assert/strict";
import test from "node:test";
import { isProductImagePath } from "../packages/domain/src/images.ts";
import {
  type EncodedImage,
  FULL_EDGE,
  NotAnImageError,
  PHOTO_CACHE_CONTROL,
  PHOTO_LIMIT_BYTES,
  PhotoTooLargeError,
  THUMB_EDGE,
  contentHash,
  fitWithin,
  makeStorageUploader,
  photoPaths,
  uploadProductPhoto,
} from "../apps/vendor/src/lib/productPhoto.ts";

const VENDOR = "3d098ff9-2192-4c11-8a0b-1f2e3d4c5b6a";
const ITEM = "0dd5fce2-39a5-4bc5-bd2a-171b21655e8d";
const bytes = (s: string) => new TextEncoder().encode(s);
const img = (s: string, type: EncodedImage["type"] = "image/webp"): EncodedImage => ({ bytes: bytes(s), type });

// ---- sizing ----

test("a landscape photo is scaled so its long edge fits", () => {
  assert.deepEqual(fitWithin(4000, 3000, 800), { width: 800, height: 600 });
});

test("a portrait photo is scaled by its height", () => {
  assert.deepEqual(fitWithin(3000, 4000, 800), { width: 600, height: 800 });
});

test("a small photo is never enlarged", () => {
  assert.deepEqual(fitWithin(300, 200, 800), { width: 300, height: 200 });
});

test("sizes are whole pixels and never zero", () => {
  assert.deepEqual(fitWithin(10001, 3, 400), { width: 400, height: 1 });
});

test("the two sizes are 800 and 400 pixels", () => {
  assert.equal(FULL_EDGE, 800);
  assert.equal(THUMB_EDGE, 400);
});

// ---- file names ----

test("the content name is the first 16 hex characters of the SHA-256", async () => {
  assert.equal(await contentHash(bytes("abc")), "ba7816bf8f01cfea");
});

test("different content gets a different name", async () => {
  assert.notEqual(await contentHash(bytes("abc")), await contentHash(bytes("abd")));
});

test("paths follow the rule the database and the app accept", async () => {
  const hash = await contentHash(bytes("abc"));
  const webp = photoPaths(VENDOR, hash, "image/webp");
  assert.equal(webp.full, `${VENDOR}/ba7816bf8f01cfea.webp`);
  assert.equal(webp.thumb, `${VENDOR}/ba7816bf8f01cfea.thumb.webp`);
  assert.ok(isProductImagePath(webp.full));
  const jpg = photoPaths(VENDOR, hash, "image/jpeg");
  assert.equal(jpg.full, `${VENDOR}/ba7816bf8f01cfea.jpg`);
  assert.equal(jpg.thumb, `${VENDOR}/ba7816bf8f01cfea.thumb.jpg`);
  assert.ok(isProductImagePath(jpg.full));
});

// ---- the whole upload ----

function fakeDeps(over: Partial<{ upload: (p: string, i: EncodedImage) => Promise<"uploaded" | "exists">; resizeType: EncodedImage["type"]; fullSize: number }> = {}) {
  const calls: string[] = [];
  const uploaded: { path: string; image: EncodedImage }[] = [];
  const deps = {
    async resize(_file: Blob, maxEdge: number) {
      calls.push(`resize:${maxEdge}`);
      const type = over.resizeType ?? "image/webp";
      if (maxEdge === FULL_EDGE) return { bytes: new Uint8Array(over.fullSize ?? 3000).fill(7), type };
      return { bytes: new Uint8Array(900).fill(9), type };
    },
    upload:
      over.upload ??
      (async (path: string, image: EncodedImage) => {
        calls.push(`upload:${path}`);
        uploaded.push({ path, image });
        return "uploaded" as const;
      }),
    async setItemImage(itemId: string, path: string) {
      calls.push(`set:${itemId}:${path}`);
    },
  };
  return { deps, calls, uploaded };
}

const photo = () => new Blob([new Uint8Array(10)], { type: "image/jpeg" });

test("uploads both sizes, then attaches the full-size path to the item", async () => {
  const { deps, calls, uploaded } = fakeDeps();
  const { path } = await uploadProductPhoto({ vendorId: VENDOR, itemId: ITEM, file: photo(), deps });
  assert.ok(isProductImagePath(path));
  assert.equal(uploaded.length, 2);
  assert.deepEqual(uploaded.map((u) => u.path).sort(), [path, path.replace(/\.(webp|jpg)$/, ".thumb.$1")].sort());
  // attaching comes last, so the database never points at a missing file
  assert.equal(calls[calls.length - 1], `set:${ITEM}:${path}`);
  assert.equal(calls.filter((c) => c.startsWith("set:")).length, 1);
});

test("the name comes from the full-size picture, so the same photo gives the same path", async () => {
  const a = await uploadProductPhoto({ vendorId: VENDOR, itemId: ITEM, file: photo(), deps: fakeDeps().deps });
  const b = await uploadProductPhoto({ vendorId: VENDOR, itemId: ITEM, file: photo(), deps: fakeDeps().deps });
  assert.equal(a.path, b.path);
  const c = await uploadProductPhoto({ vendorId: VENDOR, itemId: ITEM, file: photo(), deps: fakeDeps({ fullSize: 3001 }).deps });
  assert.notEqual(a.path, c.path);
});

test("when the browser can only produce JPEG, the files are JPEG", async () => {
  const { deps, uploaded } = fakeDeps({ resizeType: "image/jpeg" });
  const { path } = await uploadProductPhoto({ vendorId: VENDOR, itemId: ITEM, file: photo(), deps });
  assert.ok(path.endsWith(".jpg"));
  assert.ok(uploaded.every((u) => u.path.endsWith(".jpg") && u.image.type === "image/jpeg"));
});

test("a picture that already exists is not an error", async () => {
  const { deps, calls } = fakeDeps({ upload: async () => "exists" });
  const { path } = await uploadProductPhoto({ vendorId: VENDOR, itemId: ITEM, file: photo(), deps });
  assert.ok(calls.includes(`set:${ITEM}:${path}`));
});

test("if an upload fails, the item is left alone", async () => {
  const { deps, calls } = fakeDeps({
    upload: async () => {
      throw new Error("network down");
    },
  });
  await assert.rejects(() => uploadProductPhoto({ vendorId: VENDOR, itemId: ITEM, file: photo(), deps }), /network down/);
  assert.equal(calls.filter((c) => c.startsWith("set:")).length, 0);
});

test("a picture over the size limit is refused before anything is uploaded", async () => {
  const { deps, calls } = fakeDeps({ fullSize: PHOTO_LIMIT_BYTES + 1 });
  await assert.rejects(() => uploadProductPhoto({ vendorId: VENDOR, itemId: ITEM, file: photo(), deps }), PhotoTooLargeError);
  assert.equal(calls.filter((c) => c.startsWith("upload:") || c.startsWith("set:")).length, 0);
});

test("something that is not an image is refused straight away", async () => {
  const { deps, calls } = fakeDeps();
  const pdf = new Blob([new Uint8Array(10)], { type: "application/pdf" });
  await assert.rejects(() => uploadProductPhoto({ vendorId: VENDOR, itemId: ITEM, file: pdf, deps }), NotAnImageError);
  assert.equal(calls.length, 0);
});

// ---- the storage call ----

test("uploads with a one-year cache header, the right type, and no overwrite", async () => {
  const seen: { path: string; body: unknown; opts: Record<string, unknown> }[] = [];
  const bucket = {
    async upload(path: string, body: unknown, opts: Record<string, unknown>) {
      seen.push({ path, body, opts });
      return { data: { path }, error: null };
    },
  };
  const result = await makeStorageUploader(bucket)("a/b.webp", img("x"));
  assert.equal(result, "uploaded");
  assert.equal(seen[0].path, "a/b.webp");
  assert.equal(seen[0].opts.cacheControl, PHOTO_CACHE_CONTROL);
  assert.equal(PHOTO_CACHE_CONTROL, "31536000");
  assert.equal(seen[0].opts.contentType, "image/webp");
  assert.equal(seen[0].opts.upsert, false);
});

test("storage saying the file already exists counts as success; other errors are thrown", async () => {
  const exists = { upload: async () => ({ data: null, error: { statusCode: "409", message: "The resource already exists" } }) };
  assert.equal(await makeStorageUploader(exists)("a/b.webp", img("x")), "exists");
  const denied = { upload: async () => ({ data: null, error: { statusCode: "403", message: "new row violates row-level security policy" } }) };
  await assert.rejects(() => makeStorageUploader(denied)("a/b.webp", img("x")), /row-level security/);
});
