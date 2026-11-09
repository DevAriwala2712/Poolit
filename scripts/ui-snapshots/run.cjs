// Usage: node run.cjs <student-dist> <vendor-dist> <db> <out-dir> <baseline-dir|""> [psql args...]  (see run.sh)
const http = require("http");
const fs = require("fs");
const path = require("path");
const { chromium } = require("playwright");
const { spawnSync } = require("child_process");
const { start } = require("../student-e2e/fake-postgrest.cjs");

const [studentDist, vendorDist, db, outDir, baselineDir, ...psqlArgs] = process.argv.slice(2);
const STUDENT = "c0000000-0000-4000-8000-000000000001";
const OWNER = "d0000000-0000-4000-8000-000000000001";
const ADMIN = "d0000000-0000-4000-8000-000000000009";
const YAMUNA = "a0000000-0000-4000-8000-000000000002";
const YAMUNA_STORE = "b0000000-0000-4000-8000-000000000002";

const sql = (q) => {
  const r = spawnSync("psql", [...psqlArgs, "-d", db, "-X", "-At", "-c", q], { encoding: "utf8" });
  if (r.status !== 0) throw new Error(r.stderr);
  return r.stdout.trim();
};
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");
const jwt = (sub) => `x.${b64({ sub, role: "authenticated", exp: Math.floor(Date.now() / 1000) + 7200 })}.y`;
const serve = (dist) =>
  new Promise((resolve) => {
    const types = { ".js": "text/javascript", ".css": "text/css", ".svg": "image/svg+xml", ".html": "text/html", ".wasm": "application/wasm", ".woff2": "font/woff2", ".webmanifest": "application/json" };
    const s = http.createServer((req, res) => {
      let p = path.join(dist, decodeURIComponent(req.url.split("?")[0]));
      if (!fs.existsSync(p) || fs.statSync(p).isDirectory()) p = path.join(dist, "index.html");
      res.setHeader("content-type", types[path.extname(p)] || "application/octet-stream");
      res.end(fs.readFileSync(p));
    });
    s.listen(0, () => resolve(s));
  });

// Things that change from run to run and would make every screenshot differ.
const STILL = `*,*::before,*::after{animation:none!important;transition:none!important;caret-color:transparent!important}
::-webkit-scrollbar{display:none}`;

(async () => {
  const rest = await start({ port: 54400, db, psqlArgs });
  const studentWeb = await serve(studentDist);
  const vendorWeb = await serve(vendorDist);
  const sBase = `http://localhost:${studentWeb.address().port}`;
  const vBase = `http://localhost:${vendorWeb.address().port}`;

  // Demo data on top of the fixtures: an admin who is also a store owner, and one order by the student.
  sql(`insert into auth.users (id, email) values ('${ADMIN}', 'admin@example.com') on conflict do nothing; insert into vendor_users (user_id, vendor_id, role) values ('${ADMIN}', '${YAMUNA_STORE}', 'owner') on conflict do nothing; insert into platform_admins (user_id) values ('${ADMIN}') on conflict do nothing`);
  const maggi = sql(`select id from menu_items where vendor_id = '${YAMUNA_STORE}' and name like 'Maggi%'`);
  const slot = sql(`select id from slots where hostel_id = '${YAMUNA}' and status = 'open'`);
  const orderId = sql(`select (place_order('${slot}', 'Anaya', 'A', '204', 0, 'Cash on delivery', null, '[{"menuItemId":"${maggi}","qty":2}]'::jsonb, '${STUDENT}')).id`);
  sql(`update orders set created_at = '2026-11-09 09:00:00+00' where id = '${orderId}'`);
  const lays = sql(`select id from menu_items where vendor_id = '${YAMUNA_STORE}' and name like 'Lays%'`);

  const browser = await chromium.launch();
  const shots = [];
  async function shoot(ctx, base, route, name, size, { wait = 1800, full = true } = {}) {
    const page = await ctx.newPage();
    await page.setViewportSize(size);
    await page.goto(base + route);
    await page.addStyleTag({ content: STILL }).catch(() => {});
    await page.waitForTimeout(wait);
    await page.addStyleTag({ content: STILL }).catch(() => {});
    const file = `${name}-${size.width}.png`;
    await page.screenshot({ path: path.join(outDir, file), fullPage: full });
    shots.push(file);
    await page.close();
  }

  // ---------- student ----------
  const studentCtx = async (extra = {}) => {
    const ctx = await browser.newContext({ deviceScaleFactor: 1 });
    await ctx.addInitScript(
      ({ token, student, hostel, extra }) => {
        localStorage.setItem("poolit-student-auth", JSON.stringify({ access_token: token, refresh_token: "r", token_type: "bearer", expires_in: 7200, expires_at: Math.floor(Date.now() / 1000) + 7200, user: { id: student, aud: "authenticated", role: "authenticated", phone: "919876543210", app_metadata: {}, user_metadata: {} } }));
        localStorage.setItem("poolit-student-profile-v1", JSON.stringify({ name: "Anaya", hostelId: hostel, block: "A", room: "204", onboarded: true, favorites: [] }));
        localStorage.setItem("poolit-consent:" + student, "2026-11");
        for (const [k, v] of Object.entries(extra)) localStorage.setItem(k, v);
      },
      { token: jwt(STUDENT), student: STUDENT, hostel: YAMUNA, extra },
    );
    return ctx;
  };
  const cartLines = JSON.stringify({ [maggi]: 2, [lays]: 1 });
  for (const width of [360, 390, 430]) {
    const size = { width, height: Math.round(width * 2.15) };
    const ctx = await studentCtx({ "poolit-student-cart-v1": cartLines });
    for (const [route, name] of [["/", "student-home"], ["/categories", "student-categories"], ["/cart", "student-cart"], ["/checkout", "student-checkout"], ["/orders", "student-orders"], [`/track/${orderId}`, "student-track"], [`/product/${maggi}`, "student-product"], ["/profile", "student-profile"], ["/legal", "student-legal"], ["/legal/privacy", "student-legal-privacy"]]) {
      await shoot(ctx, sBase, route, name, size);
    }
    await ctx.close();
    const anon = await browser.newContext({ deviceScaleFactor: 1 });
    await shoot(anon, sBase, "/login", "student-login", size, { full: false });
    await anon.close();
    const fresh = await browser.newContext({ deviceScaleFactor: 1 });
    await shoot(fresh, sBase, "/onboarding", "student-onboarding", size, { full: false });
    await fresh.close();
  }

  // ---------- vendor ----------
  const session = (sub) => ({ access_token: jwt(sub), refresh_token: "r", token_type: "bearer", expires_in: 7200, expires_at: Math.floor(Date.now() / 1000) + 7200, user: { id: sub, aud: "authenticated", role: "authenticated", email: "x@example.com", app_metadata: {}, user_metadata: {} } });
  for (const size of [{ width: 390, height: 844 }, { width: 1280, height: 860 }]) {
    const ctx = await browser.newContext({ deviceScaleFactor: 1 });
    await ctx.addInitScript((s) => { localStorage.setItem("sb-localhost-auth-token", JSON.stringify(s)); localStorage.setItem("poolit-vendor-ui-mode", "advanced"); }, session(ADMIN));
    for (const [route, name] of [["/", "vendor-dashboard"], ["/orders", "vendor-orders"], ["/inventory", "vendor-inventory"], ["/analytics", "vendor-analytics"], ["/settings", "vendor-settings"], ["/activity", "vendor-activity"]]) {
      await shoot(ctx, vBase, route, name, size, { wait: 2500 });
    }
    await ctx.close();
  }
  const anon = await browser.newContext({ deviceScaleFactor: 1 });
  await shoot(anon, vBase, "/", "vendor-login", { width: 390, height: 844 }, { full: false });
  await anon.close();

  console.log(`captured ${shots.length} screenshots in ${outDir}`);

  // ---------- compare with a baseline, pixel by pixel, in the browser ----------
  if (baselineDir) {
    fs.mkdirSync(path.join(outDir, "diff"), { recursive: true });
    const page = await browser.newPage();
    const url = (f) => "data:image/png;base64," + fs.readFileSync(f).toString("base64");
    let changed = 0;
    for (const file of shots) {
      const base = path.join(baselineDir, file);
      if (!fs.existsSync(base)) { console.log(`NEW      ${file}`); continue; }
      const r = await page.evaluate(async ([a, b]) => {
        const load = (src) => new Promise((res) => { const i = new Image(); i.onload = () => res(i); i.src = src; });
        const [ia, ib] = [await load(a), await load(b)];
        const w = Math.max(ia.width, ib.width), h = Math.max(ia.height, ib.height);
        const draw = (img) => { const c = document.createElement("canvas"); c.width = w; c.height = h; const x = c.getContext("2d"); x.fillStyle = "#f0f"; x.fillRect(0, 0, w, h); x.drawImage(img, 0, 0); return [c, x.getImageData(0, 0, w, h).data]; };
        const [, da] = draw(ia), [, db] = draw(ib);
        const out = document.createElement("canvas"); out.width = w; out.height = h; const ox = out.getContext("2d"); const od = ox.createImageData(w, h);
        let diff = 0;
        for (let p = 0; p < da.length; p += 4) {
          const d = Math.abs(da[p] - db[p]) + Math.abs(da[p + 1] - db[p + 1]) + Math.abs(da[p + 2] - db[p + 2]);
          if (d > 24) { diff++; od.data[p] = 255; od.data[p + 1] = 0; od.data[p + 2] = 0; od.data[p + 3] = 255; } else { od.data[p] = da[p]; od.data[p + 1] = da[p + 1]; od.data[p + 2] = da[p + 2]; od.data[p + 3] = 90; }
        }
        ox.putImageData(od, 0, 0);
        return { diff, total: w * h, sizeChanged: ia.width !== ib.width || ia.height !== ib.height, dims: [ib.width, ib.height, ia.width, ia.height], overlay: out.toDataURL("image/png") };
      }, [url(path.join(outDir, file)), url(base)]);
      const pct = (100 * r.diff) / r.total;
      if (r.diff > 0 || r.sizeChanged) {
        changed++;
        fs.writeFileSync(path.join(outDir, "diff", file), Buffer.from(r.overlay.split(",")[1], "base64"));
        console.log(`CHANGED  ${file}  ${pct.toFixed(2)}% of pixels${r.sizeChanged ? `  (size ${r.dims[2]}x${r.dims[3]} -> was ${r.dims[0]}x${r.dims[1]})` : ""}`);
      } else console.log(`same     ${file}`);
    }
    console.log(`\n${changed} of ${shots.length} screens differ from the baseline`);
  }
  await browser.close();
  rest.close(); studentWeb.close(); vendorWeb.close();
  process.exit(0);
})();
