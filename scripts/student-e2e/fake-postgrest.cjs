// A stand-in for Supabase's REST layer (PostgREST) and Storage, for end-to-end tests only.
//
// POST /rest/v1/rpc/<function> runs the real database function on a local Postgres, as
// the role and user named in the request's JWT, and maps errors to HTTP statuses the way
// PostgREST does (SQLSTATE PT<nnn> -> status nnn).
//
// POST /storage/v1/object/<bucket>/<path> runs the real row-level-security upload rule on
// storage.objects as the caller (and enforces the bucket's size and type limits);
// GET /storage/v1/object/public/<bucket>/<path> serves stored files back.
//
// It does not check JWT signatures. Never point it at anything real.
const http = require("http");
const { execFileSync, spawnSync } = require("child_process");

function start({ port, db, psqlArgs = [] }) {
  const psql = (sql) =>
    spawnSync("psql", [...psqlArgs, "-d", db, "-X", "-q", "-At", "-v", "VERBOSITY=verbose", "-v", "ON_ERROR_STOP=1"], {
      input: sql,
      encoding: "utf8",
    });

  // argument names and types of each function, read from the database once
  const sigCache = new Map();
  const signature = (fn) => {
    if (!sigCache.has(fn)) {
      const safe = fn.replace(/[^\w]/g, "");
      const out = execFileSync(
        "psql",
        [...psqlArgs, "-d", db, "-X", "-At", "-c",
          `select coalesce(json_agg(json_build_object('name', a.name, 'type', format_type(a.typ, null)) order by a.ord), '[]')
             from pg_proc p join pg_namespace s on s.oid = p.pronamespace,
                  lateral unnest(p.proargnames, p.proargtypes::oid[]) with ordinality as a(name, typ, ord)
            where s.nspname = 'public' and p.proname = '${safe}'`],
        { encoding: "utf8" },
      );
      sigCache.set(fn, JSON.parse(out.trim() || "[]"));
    }
    return sigCache.get(fn);
  };

  const lit = (v, type) =>
    v === null || v === undefined ? `NULL::${type}` : `$q$${typeof v === "object" ? JSON.stringify(v) : String(v)}$q$::${type}`;

  const claims = (auth) => {
    try {
      return JSON.parse(Buffer.from(auth.replace(/^Bearer /, "").split(".")[1], "base64url").toString());
    } catch {
      return { role: "anon" };
    }
  };

  const q1 = (v) => `$q$${String(v)}$q$`;
  const files = new Map(); // "bucket/path" -> { bytes, type, cache }

  const storage = (req, res, cors, chunks) => {
    const json = (status, body) => {
      res.writeHead(status, { ...cors, "content-type": "application/json" });
      res.end(JSON.stringify(body));
    };
    const url = req.url.split("?")[0];

    const pub = /^\/storage\/v1\/object\/public\/([^/]+)\/(.+)$/.exec(url);
    if (req.method === "GET" && pub) {
      const f = files.get(`${pub[1]}/${decodeURIComponent(pub[2])}`);
      const isPublic = psql(`select public from storage.buckets where id = ${q1(pub[1])};`).stdout.trim() === "t";
      if (!f || !isPublic) return json(404, { statusCode: "404", error: "not_found", message: "Object not found" });
      res.writeHead(200, { ...cors, "content-type": f.type, "cache-control": f.cache });
      return res.end(f.bytes);
    }

    const up = /^\/storage\/v1\/object\/([^/]+)\/(.+)$/.exec(url);
    if (up && (req.method === "POST" || req.method === "PUT")) {
      const bucket = up[1];
      const name = decodeURIComponent(up[2]);
      const bytes = Buffer.concat(chunks);
      const type = (req.headers["content-type"] || "").split(";")[0];
      const row = psql(
        `select coalesce(file_size_limit::text,'') || '|' || coalesce(array_to_string(allowed_mime_types, ','),'') from storage.buckets where id = ${q1(bucket)};`,
      ).stdout.trim();
      if (!row) return json(404, { statusCode: "404", error: "Bucket not found", message: "Bucket not found" });
      const [limit, mimes] = row.split("|");
      if (limit && bytes.length > Number(limit)) return json(413, { statusCode: "413", error: "Payload too large", message: "The object exceeded the maximum allowed size" });
      if (mimes && !mimes.split(",").includes(type)) return json(415, { statusCode: "415", error: "invalid_mime_type", message: `mime type ${type} is not supported` });

      const jwt = claims(req.headers.authorization || "");
      const role = jwt.role === "authenticated" ? "authenticated" : "anon";
      const r = psql(
        [
          "begin;",
          `select set_config('request.jwt.claims', $q$${JSON.stringify(jwt)}$q$, true);`,
          `set local role ${role};`,
          `insert into storage.objects (bucket_id, name) values (${q1(bucket)}, ${q1(name)});`,
          "commit;",
        ].join("\n"),
      );
      if (r.status !== 0) {
        const e = /ERROR:\s+(\w{5})/.exec(r.stderr || "") || [];
        if (e[1] === "23505") return json(409, { statusCode: "409", error: "Duplicate", message: "The resource already exists" });
        return json(403, { statusCode: "403", error: "Unauthorized", message: "new row violates row-level security policy" });
      }
      files.set(`${bucket}/${name}`, { bytes, type, cache: req.headers["cache-control"] || "" });
      return json(200, { Key: `${bucket}/${name}` });
    }
    return json(404, { message: "not found" });
  };

  const server = http.createServer((req, res) => {
    const cors = {
      "Access-Control-Allow-Origin": req.headers.origin || "*",
      "Access-Control-Allow-Headers": "*",
      "Access-Control-Allow-Methods": "GET,POST,PUT,OPTIONS",
      "Access-Control-Expose-Headers": "*",
    };
    if (req.method === "OPTIONS") {
      res.writeHead(204, cors);
      return res.end();
    }
    const chunks = [];
    req.on("data", (c) => chunks.push(c));
    // `server.delayMs` simulates a slow network: each call is answered that much later.
    req.on("end", () => (server.delayMs ? setTimeout(handle, server.delayMs) : handle()));
    const handle = () => {
      if (req.url.startsWith("/storage/v1/")) return storage(req, res, cors, chunks);

      const m = /^\/rest\/v1\/rpc\/(\w+)/.exec(req.url);
      if (!m) {
        res.writeHead(404, { ...cors, "content-type": "application/json" });
        return res.end(JSON.stringify({ message: "not found" }));
      }
      const body = Buffer.concat(chunks).toString();
      const fn = m[1];
      const args = body ? JSON.parse(body) : {};
      const jwt = claims(req.headers.authorization || "");
      const role = jwt.role === "authenticated" ? "authenticated" : "anon";
      const params = signature(fn)
        .filter((p) => p.name in args)
        .map((p) => `${p.name} => ${lit(args[p.name], p.type)}`);
      const sql = [
        "begin;",
        `select set_config('request.jwt.claims', $q$${JSON.stringify(jwt)}$q$, true);`,
        `set local role ${role};`,
        `select 'RESULT:' || coalesce(to_jsonb(public.${fn}(${params.join(", ")}))::text, 'null');`,
        "commit;",
      ].join("\n");
      const r = psql(sql);
      const hit = (r.stdout || "").split("\n").find((l) => l.startsWith("RESULT:"));
      if (r.status === 0 && hit) {
        res.writeHead(200, { ...cors, "content-type": "application/json" });
        return res.end(hit.slice(7));
      }
      const e = /ERROR:\s+(\w{5}):\s+(.*)/.exec(r.stderr || "") || [];
      const code = e[1] || "XX000";
      const message = (e[2] || r.stderr || "error").trim();
      const status = /^PT(\d{3})$/.test(code) ? Number(code.slice(2)) : code === "42501" ? (role === "anon" ? 401 : 403) : 400;
      res.writeHead(status, { ...cors, "content-type": "application/json" });
      res.end(JSON.stringify({ code, message, details: null, hint: null }));
    };
  });
  return new Promise((resolve) => server.listen(port, () => resolve(server)));
}

module.exports = { start };
