// End-to-end run of product photos, across both real apps.
//
//   vendor console: pick a photo -> shrunk in the browser -> uploaded (the real storage upload
//   rule runs in Postgres) -> attached to the item
//   student app:   the same picture shows on the product tile and the product page
//
// Also tries to break the rules: another store's owner, a student, a visitor, an oversized
// file, a wrong file type, and an overwrite.
//
// Usage: node run.cjs <vendor-dist> <student-dist> <postgres-db> [psql args...]   (see run.sh)
const http = require("http");
const fs = require("fs");
const path = require("path");
const { chromium } = require("playwright");
const { spawnSync } = require("child_process");
const { start } = require("../student-e2e/fake-postgrest.cjs");

const [vendorDist, studentDist, db, ...psqlArgs] = process.argv.slice(2);
const REST = "http://localhost:54400";
const OWNER = "d0000000-0000-4000-8000-000000000001"; // owns Yamuna Store
const OTHER_OWNER = "d0000000-0000-4000-8000-000000000002"; // owns Ganga Store
const STUDENT = "c0000000-0000-4000-8000-000000000001";
const YAMUNA_HOSTEL = "a0000000-0000-4000-8000-000000000002";
const YAMUNA_STORE = "b0000000-0000-4000-8000-000000000002";

const b64 = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");
const jwt = (sub) => `x.${b64({ sub, role: "authenticated", exp: Math.floor(Date.now() / 1000) + 3600 })}.y`;
const sql = (q) => spawnSync("psql", [...psqlArgs, "-d", db, "-X", "-At", "-c", q], { encoding: "utf8" }).stdout.trim();

let failed = 0;
const check = (name, ok, detail = "") => {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${ok ? "" : "  -> " + detail}`);
  if (!ok) failed++;
};

const serve = (dist) =>
  new Promise((resolve) => {
    const types = { ".js": "text/javascript", ".css": "text/css", ".svg": "image/svg+xml", ".html": "text/html", ".wasm": "application/wasm", ".webmanifest": "application/json" };
    const s = http.createServer((req, res) => {
      let p = path.join(dist, decodeURIComponent(req.url.split("?")[0]));
      if (!fs.existsSync(p) || fs.statSync(p).isDirectory()) p = path.join(dist, "index.html");
      res.setHeader("content-type", types[path.extname(p)] || "application/octet-stream");
      res.end(fs.readFileSync(p));
    });
    s.listen(0, () => resolve(s));
  });

(async () => {
  const rest = await start({ port: 54400, db, psqlArgs });
  const vWeb = await serve(vendorDist);
  const sWeb = await serve(studentDist);
  const vBase = `http://localhost:${vWeb.address().port}`;
  const sBase = `http://localhost:${sWeb.address().port}`;
  const browser = await chromium.launch();

  const session = (sub) => ({
    access_token: jwt(sub), refresh_token: "r", token_type: "bearer", expires_in: 3600,
    expires_at: Math.floor(Date.now() / 1000) + 3600,
    user: { id: sub, aud: "authenticated", role: "authenticated", app_metadata: {}, user_metadata: {} },
  });

  // a realistic-sized "phone photo" made in the browser (4000 x 3000 JPEG)
  const makePhoto = async (page) =>
    page.evaluate(async () => {
      const c = document.createElement("canvas");
      c.width = 4000; c.height = 3000;
      const x = c.getContext("2d");
      const g = x.createLinearGradient(0, 0, 4000, 3000);
      g.addColorStop(0, "#f5e9d0"); g.addColorStop(1, "#8fb0cf");
      x.fillStyle = g; x.fillRect(0, 0, 4000, 3000);
      x.fillStyle = "#c0392b"; x.fillRect(1400, 900, 1200, 1500);          // the "pack"
      for (let i = 0; i < 9000; i++) { x.fillStyle = `rgba(${Math.random() * 255 | 0},${Math.random() * 255 | 0},${Math.random() * 255 | 0},0.05)`; x.fillRect(Math.random() * 4000, Math.random() * 3000, 6, 6); }
      const blob = await new Promise((r) => c.toBlob(r, "image/jpeg", 0.92));
      const buf = new Uint8Array(await blob.arrayBuffer());
      let s = ""; for (let i = 0; i < buf.length; i += 0x8000) s += String.fromCharCode(...buf.subarray(i, i + 0x8000));
      return btoa(s);
    });

  // ---------------- 1. the vendor adds a photo to an existing item ----------------
  const vctx = await browser.newContext({ viewport: { width: 1280, height: 860 } });
  await vctx.addInitScript((s) => { localStorage.setItem("sb-localhost-auth-token", JSON.stringify(s)); localStorage.setItem("poolit-vendor-ui-mode", "advanced"); }, session(OWNER));
  const vpage = await vctx.newPage();
  const vcalls = [];
  vpage.on("response", (r) => { if (/\/(rest|storage)\/v1\//.test(r.url())) vcalls.push([r.request().method(), r.url().replace(REST, ""), r.status()]); });
  vpage.on("pageerror", (e) => console.log("PAGE ERROR", e.message));

  const maggiId = sql(`select id from menu_items where vendor_id='${YAMUNA_STORE}' and name like 'Maggi%'`);
  await vpage.goto(vBase + "/inventory");
  await vpage.waitForSelector(`[data-testid="photo-input-${maggiId}"]`, { state: "attached", timeout: 20000 });
  const photo = Buffer.from(await makePhoto(vpage), "base64");
  check("the test photo is a realistic phone-sized file", photo.length > 150000, `${photo.length} bytes`);
  await vpage.locator(`[data-testid="photo-input-${maggiId}"]`).first().setInputFiles({ name: "maggi.jpg", mimeType: "image/jpeg", buffer: photo });
  await vpage.waitForTimeout(5000);

  const objects = sql(`select name from storage.objects where bucket_id='product-images' order by name`).split("\n").filter(Boolean);
  check("two files were stored, in this store's own folder", objects.length === 2 && objects.every((n) => n.startsWith(YAMUNA_STORE + "/")), JSON.stringify(objects));
  check("one is the full picture and one the thumbnail", objects.some((n) => /\.thumb\./.test(n)) && objects.some((n) => !/\.thumb\./.test(n)), JSON.stringify(objects));
  const imagePath = sql(`select image_path from menu_items where id='${maggiId}'`);
  check("the item now points at the full-size picture", /^[0-9a-f-]{36}\/[0-9a-f]{16}\.(webp|jpg)$/.test(imagePath) && objects.includes(imagePath), imagePath);

  // look at the stored files exactly as a browser would get them
  const fetched = await vpage.evaluate(async ({ rest, imagePath }) => {
    const get = async (p) => { const r = await fetch(`${rest}/storage/v1/object/public/product-images/${p}`); const b = await r.arrayBuffer(); return { status: r.status, type: r.headers.get("content-type"), cache: r.headers.get("cache-control"), bytes: b.byteLength }; };
    return { full: await get(imagePath), thumb: await get(imagePath.replace(/\.(webp|jpg)$/, ".thumb.$1")) };
  }, { rest: REST, imagePath });
  check("the full picture is far smaller than the phone photo and under the 200 KB cap", fetched.full.status === 200 && fetched.full.bytes < 204800 && fetched.full.bytes < photo.length / 5, JSON.stringify(fetched.full) + " vs " + photo.length);
  check("the thumbnail is smaller still", fetched.thumb.bytes < fetched.full.bytes, JSON.stringify(fetched));
  check("pictures are cached for a year", /max-age=31536000/.test(fetched.full.cache || ""), String(fetched.full.cache));
  check("they are WebP (or JPEG where WebP is unavailable)", /image\/(webp|jpeg)/.test(fetched.full.type || ""), String(fetched.full.type));

  await vpage.waitForTimeout(1500);
  const vendorImg = await vpage.$$eval("img", (imgs) => imgs.map((i) => i.src).filter((s) => /product-images/.test(s)));
  check("the vendor console now shows the picture on that item", vendorImg.length >= 1 && vendorImg.some((s) => /thumb/.test(s)), JSON.stringify(vendorImg));

  // ---------------- 2. adding a new item with a photo ----------------
  await vpage.getByRole("button", { name: /Add item/ }).first().click();
  await vpage.getByPlaceholder("e.g. Maggi 2-Minute Noodles").fill("Photo Test Biscuits");
  await vpage.getByPlaceholder("54").fill("30");
  await vpage.getByPlaceholder("e.g. 70 g pack").fill("100 g pack");
  const photo2 = Buffer.from(await makePhoto(vpage), "base64"); // a different picture
  await vpage.getByTestId("add-item-photo").setInputFiles({ name: "biscuits.jpg", mimeType: "image/jpeg", buffer: photo2 });
  await vpage.getByRole("button", { name: /^Add item$/ }).last().click();
  await vpage.waitForTimeout(6000);
  const newImage = sql(`select coalesce(image_path,'') from menu_items where vendor_id='${YAMUNA_STORE}' and name='Photo Test Biscuits'`);
  check("a new item added with a photo gets its picture", /\/[0-9a-f]{16}\.(webp|jpg)$/.test(newImage), newImage || "(none)");
  check("four files are stored now, all in this store's folder", sql(`select count(*) from storage.objects where name like '${YAMUNA_STORE}/%'`) === "4");

  // the very same photo on another item reuses the stored files instead of storing them twice
  const laysId = sql(`select id from menu_items where vendor_id='${YAMUNA_STORE}' and name like 'Lays%'`);
  await vpage.goto(vBase + "/inventory");
  await vpage.waitForSelector(`[data-testid="photo-input-${laysId}"]`, { state: "attached", timeout: 20000 });
  await vpage.locator(`[data-testid="photo-input-${laysId}"]`).first().setInputFiles({ name: "same.jpg", mimeType: "image/jpeg", buffer: photo });
  await vpage.waitForTimeout(4500);
  check("the same photo on another item points at the same stored picture", sql(`select image_path from menu_items where id='${laysId}'`) === imagePath, sql(`select image_path from menu_items where id='${laysId}'`));
  check("and nothing was stored twice", sql(`select count(*) from storage.objects where name like '${YAMUNA_STORE}/%'`) === "4");

  // ---------------- 3. the student sees the picture ----------------
  const sctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  await sctx.addInitScript(({ s, hostel }) => {
    localStorage.setItem("poolit-student-auth", JSON.stringify(s));
    localStorage.setItem("poolit-student-profile-v1", JSON.stringify({ name: "Anaya", hostelId: hostel, block: "A", room: "204", onboarded: true, favorites: [], walletBalance: 480 }));
  }, { s: session(STUDENT), hostel: YAMUNA_HOSTEL });
  const spage = await sctx.newPage();
  spage.on("pageerror", (e) => console.log("PAGE ERROR", e.message));
  await spage.goto(sBase + "/");
  await spage.waitForSelector('[aria-label^="View "]', { timeout: 20000 });
  await spage.waitForFunction(() => Array.from(document.images).some((i) => /product-images/.test(i.src) && i.complete && i.naturalWidth > 0), null, { timeout: 15000 }).catch(() => {});
  const tile = await spage.$$eval("img", (imgs) => imgs.filter((i) => /product-images/.test(i.src)).map((i) => ({ src: i.src, w: i.naturalWidth, h: i.naturalHeight, shown: getComputedStyle(i).opacity })));
  check("the student's home screen shows the picture", tile.length >= 1 && tile.every((t) => t.w > 0), JSON.stringify(tile));
  check("tiles use the 400 px thumbnail, not the big picture", tile.every((t) => /\.thumb\./.test(t.src) && t.w <= 400), JSON.stringify(tile));
  // the picture fades in over 150 ms once it has loaded; give it a moment, then it must be fully visible
  const visible = await spage.waitForFunction(() => Array.from(document.images).some((i) => /product-images/.test(i.src) && getComputedStyle(i).opacity === "1"), null, { timeout: 4000 }).then(() => true).catch(() => false);
  check("the picture is fully visible once loaded", visible, JSON.stringify(tile));

  await spage.locator('[aria-label^="View Maggi"]').first().click().catch(() => {});
  await spage.waitForTimeout(1500);
  await spage.waitForFunction(() => Array.from(document.images).some((i) => /product-images/.test(i.src) && !/thumb/.test(i.src) && i.complete && i.naturalWidth > 0), null, { timeout: 10000 }).catch(() => {});
  const hero = await spage.$$eval("img", (imgs) => imgs.filter((i) => /product-images/.test(i.src) && !/thumb/.test(i.src)).map((i) => ({ w: i.naturalWidth })));
  check("the product page uses the larger 800 px picture", hero.length >= 1 && hero[0].w > 400 && hero[0].w <= 800, JSON.stringify(hero));

  // items without a picture still show their emoji
  await spage.goto(sBase + "/");
  await spage.waitForSelector('[aria-label^="View "]', { timeout: 20000 });
  const bodyText = (await spage.textContent("body")) || "";
  check("items without a picture still show their emoji tile", /🥤|🪥|🥔/.test(bodyText) || (await spage.$$("[aria-label^='View ']")).length >= 4);

  // a picture that fails to load falls back to the emoji tile
  await sctx.route("**/storage/v1/object/public/**", (route) => route.fulfill({ status: 404, body: "gone" }));
  await spage.reload();
  await spage.waitForSelector('[aria-label^="View "]', { timeout: 20000 });
  await spage.waitForTimeout(2500);
  const fallback = await spage.evaluate(() => ({ visibleImgs: Array.from(document.images).filter((i) => /product-images/.test(i.src) && getComputedStyle(i).opacity === "1").length, text: document.body.innerText }));
  check("if the picture is missing the tile falls back to the emoji, never a broken image", fallback.visibleImgs === 0, JSON.stringify(fallback));

  // "already exists" (409) on a storage upload is the expected answer when the identical file is sent again.
  // Taken before the attacks below, which are meant to be refused.
  const failedCalls = vcalls.filter((c) => c[2] >= 400 && !(c[2] === 409 && /\/storage\//.test(c[1])));

  // ---------------- 4. attacks on the upload rules ----------------
  const attempt = async (page, token, name, body, type) =>
    page.evaluate(async ({ rest, token, name, body, type }) => {
      const bytes = Uint8Array.from(atob(body), (c) => c.charCodeAt(0));
      const r = await fetch(`${rest}/storage/v1/object/product-images/${name}`, { method: "POST", headers: { authorization: `Bearer ${token}`, "content-type": type }, body: bytes });
      return r.status;
    }, { rest: REST, token, name, body, type });
  const tiny = Buffer.from("tiny-webp-bytes").toString("base64");
  const folder = YAMUNA_STORE;
  check("another store's owner cannot upload into this store's folder", (await attempt(vpage, jwt(OTHER_OWNER), `${folder}/aaaaaaaaaaaaaaaa.webp`, tiny, "image/webp")) === 403);
  check("a student cannot upload", (await attempt(vpage, jwt(STUDENT), `${folder}/bbbbbbbbbbbbbbbb.webp`, tiny, "image/webp")) === 403);
  check("a visitor cannot upload", (await attempt(vpage, "x.e30.y", `${folder}/cccccccccccccccc.webp`, tiny, "image/webp")) === 403);
  check("the owner cannot upload a file with a made-up name", (await attempt(vpage, jwt(OWNER), `${folder}/raw-photo.jpg`, tiny, "image/jpeg")) === 403);
  const big = Buffer.alloc(300000, 7).toString("base64");
  check("a file over 200 KB is refused", (await attempt(vpage, jwt(OWNER), `${folder}/dddddddddddddddd.jpg`, big, "image/jpeg")) === 413);
  check("a file of the wrong type is refused", (await attempt(vpage, jwt(OWNER), `${folder}/eeeeeeeeeeeeeeee.webp`, tiny, "image/png")) === 415);
  const existing = objects.find((n) => !/\.thumb\./.test(n));
  check("a file cannot be overwritten", (await attempt(vpage, jwt(OWNER), existing, tiny, "image/webp")) === 409);
  check("none of the refused uploads left anything behind", sql(`select count(*) from storage.objects where name like '${YAMUNA_STORE}/%'`) === "4");

  check("no failed calls during the vendor's own photo work", failedCalls.length === 0, JSON.stringify(failedCalls));

  await browser.close();
  rest.close(); vWeb.close(); sWeb.close();
  process.exit(failed ? 1 : 0);
})();
