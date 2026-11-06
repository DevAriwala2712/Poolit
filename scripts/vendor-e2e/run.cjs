// End-to-end run of the real vendor console on the Supabase backend.
//
//   browser (Chromium) -> vendor console (VITE_BACKEND=supabase) -> supabase-js
//     -> scripts/student-e2e/fake-postgrest.cjs -> the real api_* functions on a local Postgres
//
// Usage: node run.cjs <built-vendor-dist-dir> <postgres-db> [psql args...]   (see run.sh)
const http = require("http");
const fs = require("fs");
const path = require("path");
const { chromium } = require("playwright");
const { spawnSync } = require("child_process");
const { start } = require("../student-e2e/fake-postgrest.cjs");

const [dist, db, ...psqlArgs] = process.argv.slice(2);
const OWNER = "d0000000-0000-4000-8000-000000000001";
const YAMUNA_STORE = "b0000000-0000-4000-8000-000000000002";
const STUDENT = "c0000000-0000-4000-8000-000000000001"; // a student, not a vendor

const b64 = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");
const jwt = (sub) => `x.${b64({ sub, role: "authenticated", exp: Math.floor(Date.now() / 1000) + 3600 })}.y`;
const sql = (q) => spawnSync("psql", [...psqlArgs, "-d", db, "-X", "-At", "-c", q], { encoding: "utf8" }).stdout.trim();

let failed = 0;
const check = (name, ok, detail = "") => {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${ok ? "" : "  -> " + detail}`);
  if (!ok) failed++;
};

(async () => {
  const rest = await start({ port: 54400, db, psqlArgs });
  const types = { ".js": "text/javascript", ".css": "text/css", ".svg": "image/svg+xml", ".html": "text/html", ".wasm": "application/wasm", ".webmanifest": "application/json" };
  const web = http.createServer((req, res) => {
    let p = path.join(dist, decodeURIComponent(req.url.split("?")[0]));
    if (!fs.existsSync(p) || fs.statSync(p).isDirectory()) p = path.join(dist, "index.html");
    res.setHeader("content-type", types[path.extname(p)] || "application/octet-stream");
    res.end(fs.readFileSync(p));
  });
  await new Promise((r) => web.listen(0, r));
  const base = `http://localhost:${web.address().port}`;
  const browser = await chromium.launch();

  const session = (sub) => ({
    access_token: jwt(sub), refresh_token: "r", token_type: "bearer", expires_in: 3600,
    expires_at: Math.floor(Date.now() / 1000) + 3600,
    user: { id: sub, aud: "authenticated", role: "authenticated", email: "x@example.com", app_metadata: {}, user_metadata: {} },
  });
  const newContext = async (sub) => {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 860 } });
    // supabase-js keeps the login under sb-<first part of the host>-auth-token
    await ctx.addInitScript((s) => localStorage.setItem("sb-localhost-auth-token", JSON.stringify(s)), session(sub));
    await ctx.addInitScript(() => localStorage.setItem("poolit-vendor-ui-mode", "advanced"));
    return ctx;
  };

  // ---------- 1. a store owner runs the pool ----------
  const ctx = await newContext(OWNER);
  const page = await ctx.newPage();
  const calls = [];
  const t0 = Date.now();
  page.on("response", (r) => {
    const m = /\/rest\/v1\/rpc\/(\w+)/.exec(r.url());
    if (m) calls.push([Math.round((Date.now() - t0) / 1000), m[1], r.status()]);
  });
  const expressCalls = [];
  page.on("request", (r) => { if (/:5057\//.test(r.url())) expressCalls.push(r.url()); });
  page.on("pageerror", (e) => console.log("PAGE ERROR", e.message));

  await page.goto(base + "/");
  await page.getByText("Close Pool", { exact: false }).first().waitFor({ timeout: 25000 }).catch(() => {});
  check("the console loads the owner's store through one overview call", calls.filter((c) => c[1] === "api_vendor_overview").length >= 1 && calls.every((c) => c[2] === 200), JSON.stringify(calls));
  check("no call to the old Express API", expressCalls.length === 0, expressCalls.join());
  const body = (await page.textContent("body")) || "";
  check("the store and its waiting orders are on screen", /Yamuna/i.test(body) && /Rohan|Meera|Kabir|3 orders|3 /.test(body), body.slice(0, 160));

  // close the pool
  await page.getByRole("button", { name: /^Close Pool$/i }).first().click();
  await page.waitForTimeout(2500);
  check("closing the pool calls api_close_slot", calls.some((c) => c[1] === "api_close_slot" && c[2] === 200), JSON.stringify(calls.slice(-4)));
  check("the pool is closed and each order's fee is locked in the database", sql(`select count(*) from orders o join slots s on s.id=o.slot_id where s.vendor_id='${YAMUNA_STORE}' and s.status='closed' and o.status='pooled' and o.delivery_fee_charged is not null`) === "3", sql(`select string_agg(o.status || ':' || coalesce(o.delivery_fee_charged::text,'-'), ',') from orders o join slots s on s.id=o.slot_id where s.vendor_id='${YAMUNA_STORE}'`));

  // dispatch the batch
  await page.getByRole("button", { name: /Dispatch Batch/i }).first().click();
  await page.waitForTimeout(2500);
  check("dispatching calls api_dispatch_slot", calls.some((c) => c[1] === "api_dispatch_slot" && c[2] === 200), JSON.stringify(calls.slice(-4)));
  check("the orders are now dispatched", sql(`select count(*) from orders o join slots s on s.id=o.slot_id where s.vendor_id='${YAMUNA_STORE}' and o.status='dispatched'`) === "3");

  // hand over (deliver) one order from the Orders screen
  await page.goto(base + "/orders");
  const handOver = page.getByRole("button", { name: /^Hand Over$/ }).first();
  await handOver.waitFor({ timeout: 15000 }).catch(() => {});
  await handOver.click().catch(() => {});
  await page.waitForTimeout(2500);
  check("handing over calls api_mark_delivered", calls.some((c) => c[1] === "api_mark_delivered" && c[2] === 200), JSON.stringify(calls.slice(-5)));
  check("exactly one order is delivered", sql(`select count(*) from orders o join slots s on s.id=o.slot_id where s.vendor_id='${YAMUNA_STORE}' and o.status='delivered'`) === "1");

  // restock from Inventory (the first +25 button, whichever item that is)
  await page.goto(base + "/inventory");
  const plus25 = page.getByRole("button", { name: /^\+25$/ }).first();
  await plus25.waitFor({ timeout: 15000 }).catch(() => {});
  const stockBefore = Number(sql(`select sum(stock_qty) from menu_items where vendor_id='${YAMUNA_STORE}'`));
  await plus25.click().catch(() => {});
  await page.waitForTimeout(2500);
  const stockAfter = Number(sql(`select sum(stock_qty) from menu_items where vendor_id='${YAMUNA_STORE}'`));
  check("a quick restock adds exactly 25 through api_restock_item", calls.some((c) => c[1] === "api_restock_item" && c[2] === 200) && stockAfter - stockBefore === 25, `before ${stockBefore} after ${stockAfter}; ${JSON.stringify(calls.slice(-3))}`);
  check("a restock log entry of 25 was written", sql(`select count(*) from restock_logs where vendor_id='${YAMUNA_STORE}' and amount=25`) === "1");

  // polling
  const before = calls.filter((c) => c[1] === "api_vendor_overview").length;
  await page.waitForTimeout(16000);
  const polls = calls.filter((c) => c[1] === "api_vendor_overview").length - before;
  check("while open it refreshes with a single overview call about every 15 s", polls >= 1 && polls <= 2, `${polls} in 16 s`);
  check("no failed data calls during the owner's whole session", calls.every((c) => c[2] < 400), JSON.stringify(calls.filter((c) => c[2] >= 400)));
  await ctx.close();

  // ---------- 2. a student (not a vendor) cannot use the console ----------
  const sctx = await newContext(STUDENT);
  const spage = await sctx.newPage();
  const sCalls = [];
  spage.on("response", async (r) => {
    const m = /\/rest\/v1\/rpc\/(\w+)/.exec(r.url());
    if (m) sCalls.push([m[1], r.status()]);
  });
  await spage.goto(base + "/");
  await spage.waitForTimeout(4000);
  check("a student account is refused with 403 by the overview call", sCalls.some((c) => c[0] === "api_vendor_overview" && c[1] === 403), JSON.stringify(sCalls));
  const sBody = (await spage.textContent("body")) || "";
  check("and sees no store data", !/Yamuna Store/.test(sBody), sBody.slice(0, 120));
  await sctx.close();

  // ---------- 3. another store's owner sees only their own store ----------
  const octx = await newContext("d0000000-0000-4000-8000-000000000002");
  const opage = await octx.newPage();
  await opage.goto(base + "/");
  await opage.waitForTimeout(4000);
  const oBody = (await opage.textContent("body")) || "";
  check("the other store's owner sees their store, not Yamuna's", /Ganga/i.test(oBody) && !/Yamuna Store/.test(oBody), oBody.slice(0, 160));
  await octx.close();

  console.log("\ndata calls in order:", calls.map((c) => `${c[0]}s ${c[1]}`).join(" | "));
  await browser.close();
  rest.close();
  web.close();
  process.exit(failed ? 1 : 0);
})();
