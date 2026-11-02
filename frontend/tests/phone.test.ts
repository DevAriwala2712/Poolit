import assert from "node:assert/strict";
import test from "node:test";
import { formatIndianPhone, otpErrorMessage, toIndianE164 } from "../apps/student/src/lib/phone.ts";

test("normalises Indian mobile numbers to E.164", () => {
  assert.equal(toIndianE164("98765 43210"), "+919876543210");
  assert.equal(toIndianE164("+91 98765-43210"), "+919876543210");
  assert.equal(toIndianE164("09876543210"), "+919876543210");
  assert.equal(toIndianE164("919876543210"), "+919876543210");
});

test("rejects numbers that aren't Indian mobiles", () => {
  assert.equal(toIndianE164("12345 67890"), null); // must start 6-9
  assert.equal(toIndianE164("98765"), null);
  assert.equal(toIndianE164("98765432101"), null);
  assert.equal(toIndianE164(""), null);
});

test("formats for display", () => {
  assert.equal(formatIndianPhone("+919876543210"), "+91 98765 43210");
  assert.equal(formatIndianPhone(null), "");
});

test("maps auth errors to plain messages", () => {
  assert.match(otpErrorMessage("Token has expired or is invalid"), /wrong or has expired/);
  assert.match(otpErrorMessage("For security purposes, you can only request this after 45 seconds"), /Too many attempts/);
  assert.match(otpErrorMessage("Unsupported phone provider"), /isn't available/);
});
