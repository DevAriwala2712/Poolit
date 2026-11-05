// A stand-in for Supabase's REST layer (PostgREST), for end-to-end tests only.
// It answers POST /rest/v1/rpc/<function> by running the real database function
// on a local Postgres, as the role and user named in the request's JWT, and maps
// errors to HTTP statuses the way PostgREST does (SQLSTATE PT<nnn> -> status nnn).
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

  const server = http.createServer((req, res) => {
    const cors = {
      "Access-Control-Allow-Origin": req.headers.origin || "*",
      "Access-Control-Allow-Headers": "*",
      "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
      "Access-Control-Expose-Headers": "*",
    };
    if (req.method === "OPTIONS") {
      res.writeHead(204, cors);
      return res.end();
    }
    const m = /^\/rest\/v1\/rpc\/(\w+)/.exec(req.url);
    if (!m) {
      res.writeHead(404, { ...cors, "content-type": "application/json" });
      return res.end(JSON.stringify({ message: "not found" }));
    }
    let body = "";
    req.on("data", (c) => (body += c));
    req.on("end", () => {
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
    });
  });
  return new Promise((resolve) => server.listen(port, () => resolve(server)));
}

module.exports = { start };
