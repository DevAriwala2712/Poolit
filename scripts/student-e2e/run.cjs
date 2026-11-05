// End-to-end run of the real student app on the Supabase backend.
//
//   browser (Chromium) -> student app (VITE_BACKEND=supabase) -> supabase-js
//     -> fake-postgrest.cjs -> the real api_* functions on a local Postgres
//
// Usage: node run.cjs <built-student-dist-dir> <postgres-db> [psql args...]
// See run.sh, which builds everything and calls this.
const http = require("http");
const fs = require("fs");
const path = require("path");
const { chromium } = require("playwright");
const { spawnSync } = require("child_process");
const { start } = require("./fake-postgrest.cjs");

const [dist, db, ...psqlArgs] = process.argv.slice(2);
const REST_PORT = 54400;
const STUDENT = "c0000000-0000-4000-8000-000000000001";
const YAMUNA = "a0000000-0000-4000-8000-000000000002";

const b64 = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");
const jwt = (claims) => `x.${b64(claims)}.y`;
const sql = (q) => spawnSync("psql", [...psqlArgs, "-d", db, "-X", "-At", "-c", q], { encoding: "utf8" }).stdout.trim();

let failed = 0;
const check = (name, ok, detail = "") => {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${ok ? "" : "  -> " + detail}`);
  if (!ok) failed++;
};

(async () => {
  const rest = await start({ port: REST_PORT, db, psqlArgs });

  // serve the built app (single-page: unknown paths get index.html)
  const types = { ".js": "text/javascript", ".css": "text/css", ".svg": "image/svg+xml", ".html": "text/html" };
  const web = http.createServer((req, res) => {
    let p = path.join(dist, decodeURIComponent(req.url.split("?")[0]));
    if (!fs.existsSync(p) || fs.statSync(p).isDirectory()) p = path.join(dist, "index.html");
    res.setHeader("content-type", types[path.extname(p)] || "application/octet-stream");
    res.end(fs.readFileSync(p));
  });
  await new Promise((r) => web.listen(0, r));
  const base = `http://localhost:${web.address().port}`;

  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });

  // A signed-in student who has finished onboarding, on Yamuna Hostel.
  const accessToken = jwt({ sub: STUDENT, role: "authenticated", exp: Math.floor(Date.now() / 1000) + 3600 });
  await ctx.addInitScript(
    ({ accessToken, student, hostel }) => {
      localStorage.setItem(
        "poolit-student-auth",
        JSON.stringify({
          access_token: accessToken,
          refresh_token: "r",
          token_type: "bearer",
          expires_in: 3600,
          expires_at: Math.floor(Date.now() / 1000) + 3600,
          user: { id: student, aud: "authenticated", role: "authenticated", phone: "919876543210", app_metadata: {}, user_metadata: {} },
        }),
      );
      localStorage.setItem(
        "poolit-student-profile-v1",
        JSON.stringify({ name: "Anaya", hostelId: hostel, block: "A", room: "204", onboarded: true, favorites: [], walletBalance: 480 }),
      );
    },
    { accessToken, student: STUDENT, hostel: YAMUNA },
  );

  const page = await ctx.newPage();
  const calls = []; // every data call the app makes: [seconds since start, function, status]
  const t0 = Date.now();
  page.on("response", (r) => {
    const m = /\/rest\/v1\/rpc\/(\w+)/.exec(r.url());
    if (m) {
      let body = "";
      try { body = r.request().postData() || ""; } catch { /* no body */ }
      calls.push([Math.round((Date.now() - t0) / 1000), m[1], r.status(), body]);
    }
  });
  page.on("pageerror", (e) => console.log("PAGE ERROR", e.message));

  // ---- 1. browsing ----
  await page.goto(base + "/");
  await page.waitForSelector('[aria-label^="View "]', { timeout: 20000 });
  const names = await page.$$eval('[aria-label^="View "]', (els) => els.map((e) => e.getAttribute("aria-label")));
  check("the store's products appear", names.length >= 4 && names.some((n) => /Maggi/.test(n)), JSON.stringify(names));

  const firstLoad = calls.map((c) => c[1]);
  check("loading the home screen uses one data call for the catalogue and pool", firstLoad.filter((f) => f === "api_student_view").length === 1, firstLoad.join());
  check("no per-hostel fan-out (the old app made 2N+3 calls)", !firstLoad.includes("api_current_slot") && !firstLoad.includes("api_live_fee") && !firstLoad.includes("api_vendors"), firstLoad.join());

  const viewBodies = calls.filter((c) => c[1] === "api_student_view").map((c) => c[3]);
  check("every catalogue call asks for the student's own hostel", viewBodies.length > 0 && viewBodies.every((b) => b.includes(YAMUNA)), JSON.stringify(viewBodies));

  // ---- 2. the view holds only this hostel's store, and no other hostel's data ----
  const view = await page.evaluate(async (accessToken) => {
    const r = await fetch("http://localhost:54400/rest/v1/rpc/api_student_view", {
      method: "POST",
      headers: { "content-type": "application/json", authorization: "Bearer " + accessToken },
      body: JSON.stringify({ p_hostel_id: "a0000000-0000-4000-8000-000000000002" }),
    });
    return r.json();
  }, accessToken);
  check("the response has Yamuna's store only", view.vendors.length === 1 && view.vendors[0].name === "Yamuna Store", JSON.stringify(view.vendors.map((v) => v.name)));
  check("but still lists every hostel for the pickers", view.hostels.length === 3, String(view.hostels.length));

  // ---- 3. ordering ----
  await page.getByRole("button", { name: "Add one" }).first().click().catch(() => {});
  // product cards may need an "Add" button first
  if ((await page.$$('[aria-label="Remove one"]')).length === 0) {
    const add = page.getByRole("button", { name: /^add$/i }).first();
    if (await add.count()) await add.click();
  }
  await page.goto(base + "/cart");
  const hasCart = await page.getByText(/maggi|lays|coca|colgate/i).first().isVisible().catch(() => false);
  check("the item is in the cart", hasCart);

  await page.getByRole("button", { name: /checkout|proceed|continue/i }).first().click().catch(() => {});
  await page.waitForURL(/checkout/, { timeout: 8000 }).catch(() => {});
  const place = page.getByRole("button", { name: /Place order/i });
  await place.waitFor({ timeout: 8000 }).catch(() => {});
  const before = calls.length;
  await place.click().catch(() => {});
  await page.waitForTimeout(2500);
  const afterCalls = calls.slice(before).map((c) => `${c[1]}:${c[2]}`);
  check("placing the order calls api_place_order and succeeds", afterCalls.includes("api_place_order:200"), afterCalls.join());

  const order = sql(`select student_id || '|' || student_name || '|' || status || '|' || coalesce(subtotal_paise::text,'') from orders order by created_at desc limit 1`);
  check("the order is saved against the signed-in student", order.startsWith(STUDENT + "|"), order);
  check("the order has the frozen price (subtotal in paise)", /\|\d+$/.test(order) && Number(order.split("|")[3]) > 0, order);

  // ---- 4. polling ----
  const viewCallsBefore = calls.filter((c) => c[1] === "api_student_view").length;
  await page.waitForTimeout(16000);
  const viewCallsAfter = calls.filter((c) => c[1] === "api_student_view").length;
  check("while idle it polls with a single call about every 15 s", viewCallsAfter - viewCallsBefore >= 1 && viewCallsAfter - viewCallsBefore <= 2, `${viewCallsAfter - viewCallsBefore} calls in 16 s`);

  // ---- 5. orders screen shows the order, from the one view call ----
  await page.goto(base + "/orders");
  await page.waitForTimeout(1500);
  const ordersText = (await page.textContent("body")) || "";
  check("the Orders screen shows the order", /Maggi|Lays|Coca|Colgate|₹/.test(ordersText) && !/No orders/i.test(ordersText), ordersText.slice(0, 120));

  const errors = calls.filter((c) => c[2] >= 400 && c[1] !== "api_place_order");
  check("no failed data calls during the whole run", errors.length === 0, JSON.stringify(errors));

  console.log("\ndata calls in order:", calls.map((c) => `${c[0]}s ${c[1]}${c[1] === "api_student_view" ? " " + c[3] : ""}`).join(" | "));
  await browser.close();
  rest.close();
  web.close();
  process.exit(failed ? 1 : 0);
})();
