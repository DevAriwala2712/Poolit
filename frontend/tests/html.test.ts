import assert from "node:assert/strict";
import test from "node:test";
import { escapeHtml } from "../apps/vendor/src/lib/html.ts";

test("escapes every character that can open a tag or an attribute", () => {
  assert.equal(escapeHtml(`<svg onload="x()">'&`), "&lt;svg onload=&quot;x()&quot;&gt;&#39;&amp;");
});

test("turns missing values into empty text and numbers into text", () => {
  assert.equal(escapeHtml(undefined), "");
  assert.equal(escapeHtml(null), "");
  assert.equal(escapeHtml(3), "3");
});
