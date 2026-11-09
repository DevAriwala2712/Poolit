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
  const fontFiles = await page.evaluate(() => performance.getEntriesByType("resource").map((e) => e.name).filter((n) => /\.woff2/.test(n)));
  check("the text fonts are served by the app itself, not a third party", fontFiles.some((n) => /geist/.test(n) && n.startsWith(base)) && fontFiles.some((n) => /jetbrains/.test(n) && n.startsWith(base)), JSON.stringify(fontFiles));
  check("and are actually applied", await page.evaluate(() => document.fonts.check('16px "Geist Variable"') && document.fonts.check('12px "JetBrains Mono Variable"')));
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
  // the first row is Kabir's cash on delivery order: the screen says how much to collect
  const beforeText = (await page.textContent("body")) || "";
  const dueRupees = Number(sql(`select (subtotal_paise + round((delivery_fee_charged + tip) * 100)::int + 400)/100 from orders where student_name='Kabir'`));
  const at = beforeText.indexOf("ollect");
  check("a cash on delivery order shows how much cash to collect", new RegExp(`ollect\\s*₹\\s*${dueRupees}(?!\\d)`).test(beforeText), `due ${dueRupees}; text length ${beforeText.length}; near "ollect": ${at < 0 ? "(not found)" : beforeText.slice(Math.max(0, at - 20), at + 40)}`);
  await handOver.click().catch(() => {});
  await page.waitForTimeout(2500);
  check("handing over a cash order records the cash taken, equal to the amount due", sql(`select cash_collected_paise from orders where student_name='Kabir'`) === String(dueRupees * 100), sql(`select cash_collected_paise from orders where student_name='Kabir'`));
  await page.waitForTimeout(1500);
  const cashLine = (await page.getByTestId("cash-today").textContent().catch(() => "")) || "";
  check("the Orders screen shows today's cash", new RegExp(`Cash today: ₹\\s*${dueRupees} of ₹\\s*${dueRupees}`).test(cashLine), cashLine);
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

  // ---------- stock corrections, undo, and speed on a slow connection ----------
  rest.delayMs = 1500; // every call is answered 1.5 s late
  const row = page.locator("tbody tr").first();
  const sku = ((await row.getByText(/^SKU: /).textContent()) || "").replace("SKU: ", "").toLowerCase();
  const itemId = sql(`select id from menu_items where id::text like '${sku}%'`);
  const shown = async () => Number(((await row.locator("td").nth(3).locator("span.font-semibold").first().textContent()) || "").trim());
  const dbStock = () => Number(sql(`select stock_qty from menu_items where id='${itemId}'`));
  const start0 = dbStock();
  check("the first row on screen matches the database before we start", (await shown()) === start0, `screen ${await shown()} db ${start0}`);

  // 1. speed: the new count is on screen before the server has answered
  await row.getByRole("button", { name: /^\+10$/ }).click();
  await page.waitForTimeout(250);
  check("pressing +10 updates the screen at once, before the server has answered", (await shown()) === start0 + 10 && dbStock() === start0, `screen ${await shown()} db ${dbStock()} start0 ${start0}`);
  await page.waitForTimeout(3500);
  check("and the server then confirms it", dbStock() === start0 + 10 && (await shown()) === start0 + 10, `screen ${await shown()} db ${dbStock()}`);
  check("an Undo button is offered", await page.getByRole("button", { name: "Undo" }).isVisible());

  // 2. undo an accidental restock
  await page.getByRole("button", { name: "Undo" }).click();
  await page.waitForTimeout(250);
  check("Undo takes the 10 off the screen at once", (await shown()) === start0, `screen ${await shown()}`);
  await page.waitForTimeout(3500);
  check("and in the database, recorded as a correction", dbStock() === start0 && sql(`select count(*) from stock_adjustments where menu_item_id='${itemId}' and reason='correction' and delta=-10`) === "1", `db ${dbStock()}`);

  // 3. Fix stock: take away
  await row.getByRole("button", { name: "Fix stock" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("button", { name: "−5" }).click();
  check("the panel shows what the stock will be", ((await dialog.textContent()) || "").includes(`Stock will be ${start0 - 5}`), (await dialog.textContent()) || "");
  await dialog.getByRole("button", { name: "Remove", exact: true }).click();
  await page.waitForTimeout(250);
  check("the screen shows the lower count at once", (await shown()) === start0 - 5, `screen ${await shown()}`);
  await page.waitForTimeout(3500);
  check("the database has the lower count and the panel closed", dbStock() === start0 - 5 && (await dialog.count()) === 0, `db ${dbStock()}`);
  check("the removal is in the stock history", sql(`select count(*) from stock_adjustments where menu_item_id='${itemId}' and delta=-5`) === "1");
  await page.getByRole("button", { name: "Undo" }).click();
  await page.waitForTimeout(3500);
  check("Undo after a removal puts the 5 back", dbStock() === start0, `db ${dbStock()}`);

  // 4. Fix stock: set an exact count
  await row.getByRole("button", { name: "Fix stock" }).click();
  await dialog.getByRole("button", { name: "Set exact count" }).click();
  await dialog.getByRole("textbox").fill("7");
  await dialog.getByRole("button", { name: "Set count" }).click();
  await page.waitForTimeout(3500);
  check("setting an exact count of 7 works", dbStock() === 7 && sql(`select count(*) from stock_adjustments where menu_item_id='${itemId}' and reason='count'`) === "1", `db ${dbStock()}`);
  await page.getByRole("button", { name: "Undo" }).click();
  await page.waitForTimeout(3500);
  check("and Undo restores the earlier count", dbStock() === start0, `db ${dbStock()}`);

  // 5. cannot take away more than there is
  await row.getByRole("button", { name: "Fix stock" }).click();
  await dialog.getByRole("textbox").fill(String(start0 + 500));
  check("taking away more than is in stock is refused before sending", /Only \d+ in stock/.test((await dialog.textContent()) || "") && (await dialog.getByRole("button", { name: "Remove", exact: true }).isDisabled()));
  await dialog.getByRole("button", { name: "Cancel" }).click();

  // 6. a change the server rejects is rolled back on screen, with the reason
  sql(`update menu_items set stock_qty=3 where id='${itemId}'`); // the screen still says ${start0}
  await row.getByRole("button", { name: "Fix stock" }).click();
  await dialog.getByRole("button", { name: "−5" }).click();
  await dialog.getByRole("button", { name: "Remove", exact: true }).click();
  await page.waitForTimeout(3800);
  const toastText = (await page.textContent("body")) || "";
  check("a rejected removal shows the reason", /Only 3 in stock/.test(toastText), toastText.slice(0, 200));
  check("and the screen goes back to the true count (3)", (await shown()) === 3, `screen ${await shown()}`);
  sql(`update menu_items set stock_qty=${start0} where id='${itemId}'`);
  rest.delayMs = 0;
  await ctx.close();

  // ---------- 1b. commission statement, fee settings and the activity log ----------
  const ADMIN = "d0000000-0000-4000-8000-000000000009";
  sql(`insert into auth.users (id, email) values ('${ADMIN}', 'admin@example.com') on conflict do nothing; insert into vendor_users (user_id, vendor_id, role) values ('${ADMIN}', '${YAMUNA_STORE}', 'owner') on conflict do nothing; insert into platform_admins (user_id) values ('${ADMIN}') on conflict do nothing`);

  const ownerCtx = await newContext(OWNER);
  const op = await ownerCtx.newPage();
  op.on("pageerror", (e) => console.log("PAGE ERROR", e.message));
  await op.goto(base + "/settings");
  await op.getByText("Commission statement").waitFor({ timeout: 15000 }).catch(() => {});
  const ownerSettings = (await op.textContent("body")) || "";
  check("the store's Settings has a commission statement", /Commission statement/.test(ownerSettings) && /Delivered orders/.test(ownerSettings), ownerSettings.slice(0, 120));
  check("with no terms set it says so", /Current terms\s*Not set yet/.test(ownerSettings), ownerSettings.slice(0, 300));
  check("the made-up settlement card is gone", !/Razorpay Campus Treasury|42,680/.test(ownerSettings));
  check("Settings no longer shows invented hardware, tabs or algorithm labels", !/Peripheral Topology|Star Micronics|Settlement & Hardware|Algo v4/.test(ownerSettings));
  check("an ordinary owner gets no fee form and no activity link", !/set this store.s commission/i.test(ownerSettings) && !/Open the activity log/.test(ownerSettings));
  await op.goto(base + "/activity");
  await op.getByText("Poolit team only").waitFor({ timeout: 10000 }).catch(() => {});
  check("an ordinary owner cannot open the activity log", /Poolit team only/.test((await op.textContent("body")) || ""));
  await op.evaluate(() => { setTimeout(() => { throw new Error("e2e boom vendor"); }, 0); });
  await op.waitForTimeout(1500);
  check("an uncaught error in the vendor console is reported", sql(`select app from client_errors where message = 'e2e boom vendor'`) === "vendor");
  await ownerCtx.close();

  const adminCtx = await newContext(ADMIN);
  const ap = await adminCtx.newPage();
  ap.on("pageerror", (e) => console.log("PAGE ERROR", e.message));
  await ap.goto(base + "/settings");
  await ap.getByLabel("Commission value").waitFor({ timeout: 15000 }).catch(() => {});
  check("a Poolit admin sees the fee form", (await ap.getByLabel("Commission value").count()) === 1);
  check("and the link to the activity log", (await ap.getByText("Open the activity log").count()) === 1);
  await ap.getByLabel("Commission value").fill("10");
  await ap.getByRole("button", { name: "Save", exact: true }).click();
  await ap.waitForTimeout(2500);
  check("saving sets 10 percent for the store in the database", sql(`select fee_type || ':' || fee_value from vendor_fee_terms where vendor_id = '${YAMUNA_STORE}'`) === "percent:10", sql(`select count(*) from vendor_fee_terms`));
  check("and the statement now shows the new terms", /Current terms\s*10% of goods/.test((await ap.textContent("body")) || ""));

  await ap.getByText("Open the activity log").click();
  await ap.getByText("e2e boom vendor").waitFor({ timeout: 10000 }).catch(() => {});
  check("an admin sees the crash report in the activity screen", (await ap.getByText("e2e boom vendor").count()) >= 1 && (await ap.getByText("Crash reports").count()) === 1);
  await ap.getByText("Activity log").first().waitFor({ timeout: 10000 }).catch(() => {});
  await ap.waitForTimeout(1500);
  const logText = (await ap.textContent("body")) || "";
  check("the activity log shows the fee change, with who made it", /vendor_fee_terms/.test(logText) && /admin@example\.com/.test(logText), logText.slice(0, 200));
  check("and shows personal details only as ***", !/Rohan|Meera|Kabir/.test(logText.replace(/Activity log/g, "")) && /\*\*\*/.test(logText));
  await ap.getByLabel("Filter by table").selectOption("vendor_fee_terms");
  await ap.waitForTimeout(1500);
  const filtered = (await ap.locator("li").allTextContents()).join("\n");
  check("filtering by table shows only that table", /vendor_fee_terms/.test(filtered) && !/orders/.test(filtered.replace(/Delivered orders/g, "")), filtered.slice(0, 160));
  sql(`insert into audit_log (table_name, op, row_id) select 'hostels', 'UPDATE', g::text from generate_series(1, 40) g`); // enough to fill more than one page
  await ap.getByLabel("Filter by table").selectOption("");
  await ap.waitForTimeout(1200);
  const before50 = await ap.locator("li").count();
  const older = ap.getByRole("button", { name: "Load older" });
  check("a full page offers Load older", before50 >= 50 && (await older.count()) === 1, `rows ${before50}`);
  await older.click();
  await ap.waitForTimeout(1500);
  check("and loading older adds more rows", (await ap.locator("li").count()) > before50);
  await adminCtx.close();

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
