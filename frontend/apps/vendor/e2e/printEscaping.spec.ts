import { expect, test } from "@playwright/test";
import { mockBackend, signIn } from "./mockApi";

// Student-typed text must reach the Batch KOT print window as text, never as markup.
// The window shares the console's origin, so markup there could read the store's session.
const NOTE = `<svg onload="opener.document.title='INJECTED'">`;
const NAME = `<img src=x onerror="opener.document.title='INJECTED'">`;

test.use({ viewport: { width: 1280, height: 800 }, isMobile: false, hasTouch: false });

test("Batch KOT shows hostile order text literally and runs none of it", async ({ page }) => {
  await mockBackend(page);
  await page.addInitScript(
    ({ note, name }) => {
      localStorage.setItem("poolit-vendor-advanced-mode-v1", "true");
      const realFetch = window.fetch.bind(window);
      window.fetch = async (...args: Parameters<typeof fetch>) => {
        const res = await realFetch(...args);
        const url = typeof args[0] === "string" ? args[0] : ((args[0] as Request).url ?? String(args[0]));
        if (!url.includes("/vendor/overview")) return res;
        const body = await res.clone().json();
        for (const o of body.orders ?? []) Object.assign(o, { note, studentName: name });
        return new Response(JSON.stringify(body), { status: res.status, headers: { "Content-Type": "application/json" } });
      };
      window.print = () => undefined;
    },
    { note: NOTE, name: NAME },
  );

  await signIn(page);
  await page.goto("/orders");
  const popupPromise = page.waitForEvent("popup");
  await page.getByRole("button", { name: /Batch KOT/i }).click();
  const popup = await popupPromise;

  await expect(popup.locator(".note")).toHaveText(`Note: ${NOTE}`);
  await expect(popup.locator(".ticket p").first()).toContainText(NAME);
  expect(await popup.locator("svg, img").count()).toBe(0);
  await page.waitForTimeout(500);
  expect(await page.title()).not.toBe("INJECTED");
});
