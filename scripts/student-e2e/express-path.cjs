// Proves the student app's DEFAULT backend (Express) still behaves as it did before
// the VITE_BACKEND switch existed: that is the rollback path.
//
// The app is built with the default backend and pointed at http://localhost:5057,
// which this script fakes in the browser (page.route) with canned Express-shaped
// answers. Checks the app renders from them and makes the same fan-out of calls
// per poll as before (hostels, stores, then one pool + one pool size per hostel,
// every 5 s), and makes no Supabase function calls at all.
//
// Usage: node express-path.cjs <built-student-dist-dir>
const http = require("http");
const fs = require("fs");
const path = require("path");
const { chromium } = require("playwright");

const dist = process.argv[2];
let failed = 0;
const check = (name, ok, detail = "") => {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${ok ? "" : "  -> " + detail}`);
  if (!ok) failed++;
};

const now = new Date().toISOString();
const hostel = (n, name) => ({ id: `h-${n}`, name, blocks: ["A"], createdAt: now, updatedAt: now });
const item = (v, n, name, price) => ({
  id: `i-${v}-${n}`, vendorId: `v-${v}`, name, category: "Snacks", price, unit: "pack", rating: 4.4, ratingCount: 10,
  isVeg: true, art: "🍪", tint: "#FFF1D6", stockQty: 20, lowStockThreshold: 5, createdAt: now, updatedAt: now,
});
const vendor = (n) => ({
  id: `v-${n}`, name: `Store ${n}`, hostelId: `h-${n}`, prepMinutes: 6, acceptingOrders: true, poolWindowMinutes: 10,
  createdAt: now, updatedAt: now, menu: [item(n, 1, `Chips ${n}`, 20), item(n, 2, `Biscuits ${n}`, 35)],
});
const slot = (n) => ({
  id: `s-${n}`, hostelId: `h-${n}`, vendorId: `v-${n}`, status: "open", opensAt: Date.now(), closesAt: Date.now() + 600000, createdAt: now, updatedAt: now,
});
const HOSTELS = [hostel(1, "Ganga Hostel"), hostel(2, "Yamuna Hostel")];
const VENDORS = [vendor(1), vendor(2)];

(async () => {
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
  await ctx.addInitScript(() => {
    localStorage.setItem(
      "poolit-student-profile-v1",
      JSON.stringify({ name: "Anaya", hostelId: "h-2", block: "A", room: "204", onboarded: true, favorites: [], walletBalance: 480 }),
    );
  });

  const expressCalls = [];
  const rpcCalls = [];
  await ctx.route("http://localhost:5057/**", async (route) => {
    const url = new URL(route.request().url());
    const p = url.pathname;
    expressCalls.push(`${route.request().method()} ${p}`);
    const json = (body, status = 200) => route.fulfill({ status, contentType: "application/json", headers: { "access-control-allow-origin": "*" }, body: JSON.stringify(body) });
    if (route.request().method() === "OPTIONS") return route.fulfill({ status: 204, headers: { "access-control-allow-origin": "*", "access-control-allow-headers": "*" } });
    if (p === "/hostels") return json(HOSTELS);
    if (p === "/vendors") return json(VENDORS);
    let m;
    if ((m = /^\/hostels\/h-(\d)\/current-slot$/.exec(p))) return json({ slot: slot(m[1]), vendor: VENDORS[m[1] - 1] });
    if ((m = /^\/slots\/s-(\d)\/live-fee$/.exec(p))) return json({ orderCount: Number(m[1]), fee: 10 });
    return json({ message: "unexpected " + p }, 404);
  });
  ctx.on("request", (r) => {
    if (/\/rest\/v1\/rpc\//.test(r.url())) rpcCalls.push(r.url());
  });

  const page = await ctx.newPage();
  page.on("pageerror", (e) => console.log("PAGE ERROR", e.message));
  await page.goto(base + "/");
  await page.waitForSelector('[aria-label^="View "]', { timeout: 20000 });
  const names = await page.$$eval('[aria-label^="View "]', (els) => els.map((e) => e.getAttribute("aria-label")));

  check("the app renders from Express-shaped answers", names.length === 2 && names.every((n) => /2/.test(n)), JSON.stringify(names));

  const round = (list) => ({
    hostels: list.filter((c) => c === "GET /hostels").length,
    vendors: list.filter((c) => c === "GET /vendors").length,
    pools: list.filter((c) => /current-slot$/.test(c)).length,
    sizes: list.filter((c) => /live-fee$/.test(c)).length,
  });
  const first = round(expressCalls);
  check("first load: hostels, stores, one pool and one size per hostel (as before)", first.hostels === 1 && first.vendors === 1 && first.pools === 2 && first.sizes === 2, JSON.stringify(first));
  check("no Supabase function calls on the Express backend", rpcCalls.length === 0, rpcCalls.join());

  const before = expressCalls.length;
  await page.waitForTimeout(6500);
  const second = round(expressCalls.slice(before));
  check("it polls again after about 5 s with the same set of calls", second.hostels === 1 && second.pools === 2 && second.sizes === 2, JSON.stringify(second));

  check("the pool size from Express shows on screen", /\b2\b/.test((await page.textContent("body")) || ""));
  await browser.close();
  web.close();
  process.exit(failed ? 1 : 0);
})();
