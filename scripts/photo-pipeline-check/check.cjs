// Real-browser check of the photo pipeline (Chromium). Bundles the app code, serves it on localhost
// (a secure context, so crypto.subtle works), runs synthetic phone photos through it.
const { chromium } = require('playwright');
const http = require('http'); const fs = require('fs'); const path = require('path');
const bundle = process.argv[2];
const srv = http.createServer((req, res) => {
  if (req.url === '/bundle.js') { res.setHeader('content-type', 'text/javascript'); res.end(fs.readFileSync(bundle)); }
  else { res.setHeader('content-type', 'text/html'); res.end('<!doctype html><title>t</title><body></body>'); }
}).listen(0);
(async () => {
  const port = srv.address().port;
  const b = await chromium.launch(); const p = await b.newPage();
  p.on('pageerror', e => console.log('PAGEERROR', e.message));
  await p.goto(`http://localhost:${port}/`); await p.addScriptTag({ url: '/bundle.js' });
  const out = await p.evaluate(async () => {
    const { resizeInBrowser, uploadProductPhoto, PHOTO_LIMIT_BYTES } = window.photo;
    // A "photo": gradient + shapes + fine grain, like a product on a table.
    const make = async (w, h, type = 'image/jpeg', transparent = false) => {
      const c = document.createElement('canvas'); c.width = w; c.height = h; const x = c.getContext('2d');
      if (!transparent) { const g = x.createLinearGradient(0, 0, w, h); g.addColorStop(0, '#d8cdb8'); g.addColorStop(1, '#7f9bb5'); x.fillStyle = g; x.fillRect(0, 0, w, h); }
      for (let i = 0; i < 40; i++) { x.fillStyle = `hsl(${i * 9},55%,${35 + (i % 30)}%)`; x.beginPath(); x.arc(Math.random() * w, Math.random() * h, Math.random() * w / 9, 0, 7); x.fill(); }
      for (let i = 0; i < 12000; i++) { x.fillStyle = `rgba(${Math.random() * 255 | 0},${Math.random() * 255 | 0},${Math.random() * 255 | 0},0.06)`; x.fillRect(Math.random() * w, Math.random() * h, 5, 5); }
      return await new Promise(r => c.toBlob(r, type, 0.92));
    };
    const dims = async (bytes, type) => { const bm = await createImageBitmap(new Blob([bytes], { type })); const d = [bm.width, bm.height]; bm.close(); return d; };
    const res = {};
    for (const [name, w, h] of [['landscape12MP', 4000, 3000], ['portrait12MP', 3000, 4000], ['mp50', 8160, 6120], ['small', 300, 200]]) {
      const file = await make(w, h);
      const t0 = performance.now();
      const full = await resizeInBrowser(file, 800); const thumb = await resizeInBrowser(file, 400);
      const ms = Math.round(performance.now() - t0);
      res[name] = { srcKB: Math.round(file.size / 1024), full: await dims(full.bytes, full.type), fullKB: +(full.bytes.length / 1024).toFixed(1), thumb: await dims(thumb.bytes, thumb.type), thumbKB: +(thumb.bytes.length / 1024).toFixed(1), type: full.type, ms };
    }
    // transparent PNG must not turn black
    const pc = document.createElement('canvas'); pc.width = 600; pc.height = 600; const px = pc.getContext('2d');
    px.fillStyle = '#c0392b'; px.beginPath(); px.arc(300, 300, 120, 0, 7); px.fill();   // a product on a transparent background
    const png = await new Promise(r => pc.toBlob(r, 'image/png'));
    const r = await resizeInBrowser(png, 400);
    const bm = await createImageBitmap(new Blob([r.bytes], { type: r.type }));
    const c = document.createElement('canvas'); c.width = bm.width; c.height = bm.height; const x = c.getContext('2d'); x.drawImage(bm, 0, 0);
    const corner = Array.from(x.getImageData(2, 2, 1, 1).data).slice(0, 3);
    res.transparentCorner = corner;
    // A browser that cannot encode WebP answers with PNG instead (Safari has done this): must fall back to JPEG.
    const realConvert = OffscreenCanvas.prototype.convertToBlob;
    OffscreenCanvas.prototype.convertToBlob = function (o) { return realConvert.call(this, o && o.type === 'image/webp' ? { type: 'image/png' } : o); };
    const fb = await resizeInBrowser(await make(4000, 3000), 800);
    OffscreenCanvas.prototype.convertToBlob = realConvert;
    res.noWebp = { type: fb.type, kb: +(fb.bytes.length / 1024).toFixed(1), dims: await dims(fb.bytes, fb.type) };
    // whole flow with a fake store, in the browser
    const log = [];
    const deps = { resize: resizeInBrowser, upload: async (p, i) => { log.push(['upload', p, i.type, i.bytes.length]); return 'uploaded'; }, setItemImage: async (id, p) => { log.push(['set', id, p]); } };
    const flow = await uploadProductPhoto({ vendorId: '3d098ff9-2192-4c11-8a0b-1f2e3d4c5b6a', itemId: 'i', file: await make(4000, 3000), deps });
    res.flow = { path: flow.path, log, limit: PHOTO_LIMIT_BYTES };
    return res;
  });
  const expect = (name, ok, detail) => { console.log((ok ? 'PASS ' : 'FAIL ') + name + (ok ? '' : '  -> ' + detail)); if (!ok) process.exitCode = 1; };
  const L = out.landscape12MP, P = out.portrait12MP, M = out.mp50, S = out.small;
  expect('landscape full 800x600', L.full[0] === 800 && L.full[1] === 600, L.full);
  expect('landscape thumb 400x300', L.thumb[0] === 400 && L.thumb[1] === 300, L.thumb);
  expect('portrait full 600x800', P.full[0] === 600 && P.full[1] === 800, P.full);
  expect('portrait thumb 300x400', P.thumb[0] === 300 && P.thumb[1] === 400, P.thumb);
  expect('50MP full 800x600', M.full[0] === 800 && M.full[1] === 600, M.full);
  expect('small photo is not enlarged', S.full[0] === 300 && S.full[1] === 200 && S.thumb[0] === 300, [S.full, S.thumb]);
  expect('all files under the 200 KB bucket limit', [L, P, M, S].every(r => r.fullKB * 1024 <= out.flow.limit && r.thumbKB * 1024 <= out.flow.limit), 'too big');
  expect('webp used where supported', [L, P, M, S].every(r => r.type === 'image/webp'), 'not webp');
  expect('transparent background becomes white', out.transparentCorner.every(v => v > 240), out.transparentCorner);
  expect('no WebP encoder: falls back to JPEG, still fits', out.noWebp.type === 'image/jpeg' && out.noWebp.kb * 1024 <= out.flow.limit && out.noWebp.dims[0] === 800, JSON.stringify(out.noWebp));
  expect('flow: thumb, full, then attach', out.flow.log.map(e => e[0]).join() === 'upload,upload,set', JSON.stringify(out.flow.log.map(e => e[0])));
  console.log('timings (ms, both sizes, this machine):', Object.fromEntries(['landscape12MP','portrait12MP','mp50','small'].map(k => [k, out[k].ms])));

  await b.close(); srv.close();
})();
