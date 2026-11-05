import assert from "node:assert/strict";
import test from "node:test";
import { IMAGE_BASE_URL, isProductImagePath, productImageUrl, thumbPath } from "../packages/domain/src/images.ts";

const STORE = "3d098ff9-2192-4c11-8a0b-1f2e3d4c5b6a";
const PATH = `${STORE}/0123456789abcdef.webp`;

test("builds full and thumbnail addresses from a stored path", () => {
  assert.equal(productImageUrl(PATH, "full"), `${IMAGE_BASE_URL}/${PATH}`);
  assert.equal(productImageUrl(PATH, "thumb"), `${IMAGE_BASE_URL}/${STORE}/0123456789abcdef.thumb.webp`);
  assert.equal(productImageUrl(PATH), productImageUrl(PATH, "thumb"));
});

test("works for the JPEG fallback too", () => {
  assert.equal(thumbPath(`${STORE}/0123456789abcdef.jpg`), `${STORE}/0123456789abcdef.thumb.jpg`);
  assert.ok(productImageUrl(`${STORE}/0123456789abcdef.jpg`, "full")?.endsWith(".jpg"));
});

test("no picture, or a path that could not have been uploaded, gives no address", () => {
  assert.equal(productImageUrl(undefined), undefined);
  assert.equal(productImageUrl(null), undefined);
  assert.equal(productImageUrl(""), undefined);
  assert.equal(productImageUrl("../../etc/passwd"), undefined);
  assert.equal(productImageUrl(`${STORE}/0123456789abcdef.png`), undefined);
  assert.equal(productImageUrl(`${STORE}/short.webp`), undefined);
  assert.equal(productImageUrl(`https://evil.example/${PATH}`), undefined);
  assert.equal(isProductImagePath(PATH), true);
  assert.equal(isProductImagePath(123), false);
});

test("the base address points at the public product-images bucket", () => {
  assert.match(IMAGE_BASE_URL, /\/storage\/v1\/object\/public\/product-images$/);
});
