import { expect, test } from "@playwright/test";
import { mockBackend, signIn } from "./mockApi";

test("vendor signs in and sees the store and its live order", async ({ page }) => {
  await mockBackend(page);
  await signIn(page);
  await expect(page.getByRole("button", { name: /close pool/i }).first()).toBeVisible();
  await expect(page.getByText("Asha").first()).toBeVisible();
});

test("restock from inventory sends one idempotent request and updates the count", async ({ page }) => {
  const state = await mockBackend(page);
  await signIn(page);
  await page.goto("/inventory");
  await expect(page.getByText("Colgate Strong Teeth").first()).toBeVisible();

  await page.getByRole("button", { name: "+10" }).first().click();
  await expect.poll(() => state.stock).toBe(13);

  const restocks = state.calls.filter((c) => c.path.endsWith("/restock"));
  expect(restocks).toHaveLength(1);
  expect(restocks[0].body).toEqual({ amount: 10 });
  expect(restocks[0].headers["idempotency-key"]).toMatch(/^[\w-]{8,}$/);
  expect(restocks[0].headers["authorization"]).toBe("Bearer test-token");
  await expect(page.getByText("13").first()).toBeVisible();
});

test("a failed restock is reported to the vendor, not swallowed", async ({ page }) => {
  const state = await mockBackend(page);
  await signIn(page);
  await page.goto("/inventory");
  await expect(page.getByText("Colgate Strong Teeth").first()).toBeVisible();

  state.failNextRestock = true;
  await page.getByRole("button", { name: "+10" }).first().click();
  await expect(page.getByText(/Database is busy/i)).toBeVisible();
  expect(state.stock).toBe(3);
});

test("close pool → dispatch → deliver walks the order through its states", async ({ page }) => {
  const state = await mockBackend(page);
  await signIn(page);

  await page.getByRole("button", { name: /close pool/i }).first().click();
  await expect.poll(() => state.orderStatus).toBe("pooled");

  await page.getByRole("button", { name: /dispatch/i }).first().click();
  await expect.poll(() => state.orderStatus).toBe("dispatched");

  await page.goto("/orders");
  await page.getByRole("button", { name: /hand over to student/i }).click();
  await expect.poll(() => state.orderStatus).toBe("delivered");
});
