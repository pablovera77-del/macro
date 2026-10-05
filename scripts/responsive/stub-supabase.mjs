#!/usr/bin/env node
/**
 * Servidor "stub" que imita lo mínimo de Supabase (Auth + PostgREST) con datos de
 * prueba en memoria. Sirve para revisar la app en un navegador cuando no hay
 * acceso a la base real. NO valida nada, NO persiste cambios y NUNCA debe
 * apuntar a la base real: escucha solo en localhost.
 *
 *   node scripts/responsive/stub-supabase.mjs            (puerto 54321)
 *   STUB_PORT=54399 node scripts/responsive/stub-supabase.mjs
 *
 * Qué entiende de PostgREST:
 *  - select con columnas, alias (alias:col) y embebidos (tabla(...), alias:fk(...), tabla!inner(...))
 *  - filtros eq, neq, gt, gte, lt, lte, like, ilike, is, in, not.<op>, or=(...)
 *  - filtros sobre embebidos con !inner (patients.estado=eq.activo)
 *  - order, limit, offset, HEAD y Prefer: count=exact (Content-Range)
 *  - Accept: application/vnd.pgrst.object+json (single())
 *  - rpc/<función> (devuelve lo que diga fixtures.rpc)
 * Auth: GET /auth/v1/user acepta cualquier JWT con "sub"; /token devuelve una sesión.
 */
import http from "node:http";
import { buildFixtures, DEMO_USERS, FK_MAP, makeJwt } from "./fixtures.mjs";

const PORT = Number(process.env.STUB_PORT || 54321);
const VERBOSE = process.env.STUB_VERBOSE === "1";
const F = buildFixtures();
const warned = new Set();

// ---------- utilidades ----------
const singular = (t) => (t.endsWith("es") && !t.endsWith("ses") && t !== "obras_sociales" ? t.slice(0, -2) : t.endsWith("s") ? t.slice(0, -1) : t);
function splitTop(str, sep = ",") {
  const out = []; let depth = 0, cur = "";
  for (const ch of str) {
    if (ch === "(") depth++;
    if (ch === ")") depth--;
    if (ch === sep && depth === 0) { out.push(cur); cur = ""; } else cur += ch;
  }
  if (cur.trim()) out.push(cur);
  return out.map((s) => s.trim()).filter(Boolean);
}
function parseSelect(sel) {
  return splitTop(sel || "*").map((item) => {
    const m = item.match(/^(?:(\w+):)?([\w*]+)(?:!(\w+))?(?:!(\w+))?(?:\(([\s\S]*)\))?$/);
    if (!m) return { kind: "col", name: item };
    const [, alias, name, h1, h2, inner] = m;
    if (inner === undefined) {
      const col = item.replace(/::\w+$/, "");
      const a = col.match(/^(\w+):(\w+)$/);
      return a ? { kind: "col", alias: a[1], name: a[2] } : { kind: "col", name: col };
    }
    const hints = [h1, h2].filter(Boolean);
    const inner_ = hints.includes("inner");
    let table = name, fkHint = hints.find((h) => h !== "inner") || null;
    // alias:columna(...) -> el alias es la tabla y la columna es la clave foránea (profiles:egreso_informado_por(...))
    if (alias && alias !== name && !F.tables[name]) { table = alias; fkHint = name; }
    return { kind: "embed", alias: alias || name, table, fkHint, inner: inner_, sub: parseSelect(inner) };
  });
}
function cmp(a, b) {
  if (a == null && b == null) return 0;
  if (a == null) return 1; // nulls last (asc)
  if (b == null) return -1;
  if (typeof a === "number" && typeof b === "number") return a - b;
  return String(a) < String(b) ? -1 : String(a) > String(b) ? 1 : 0;
}
function matchOp(val, op, arg) {
  const s = val == null ? null : String(val);
  switch (op) {
    case "eq": return s === arg || (typeof val === "boolean" && String(val) === arg);
    case "neq": return s !== arg;
    case "gt": return cmp(val, isNaN(arg) ? arg : Number(arg)) > 0 && val != null;
    case "gte": return val != null && (typeof val === "number" ? val >= Number(arg) : String(val) >= arg);
    case "lt": return val != null && (typeof val === "number" ? val < Number(arg) : String(val) < arg);
    case "lte": return val != null && (typeof val === "number" ? val <= Number(arg) : String(val) <= arg);
    case "like": return s != null && new RegExp("^" + arg.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/%/g, ".*") + "$").test(s);
    case "ilike": return s != null && new RegExp("^" + arg.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/%/g, ".*") + "$", "i").test(s);
    case "is": return arg === "null" ? val == null : arg === "true" ? val === true : arg === "false" ? val === false : false;
    case "in": return s != null && splitTop(arg.replace(/^\(|\)$/g, "")).map((x) => x.replace(/^"|"$/g, "")).includes(s);
    default: return true;
  }
}
function evalFilter(row, spec) {
  // spec = "op.arg" o "not.op.arg"
  let neg = false, rest = spec;
  if (rest.startsWith("not.")) { neg = true; rest = rest.slice(4); }
  const i = rest.indexOf(".");
  const op = rest.slice(0, i), arg = rest.slice(i + 1);
  return { op, arg, neg };
}
function rowMatches(row, col, spec) {
  const { op, arg, neg } = evalFilter(row, spec);
  const r = matchOp(row[col], op, arg);
  return neg ? !r : r;
}
function evalOr(row, expr) {
  const inner = expr.replace(/^\(|\)$/g, "");
  return splitTop(inner).some((c) => {
    const m = c.match(/^(\w+)\.(.+)$/);
    return m ? rowMatches(row, m[1], m[2]) : false;
  });
}

function tableRows(name) {
  if (F.tables[name]) return F.tables[name];
  if (!warned.has(name)) { warned.add(name); console.warn(`[stub] tabla/vista sin fixture: ${name} (devuelvo [])`); }
  return [];
}

// ---------- embebidos ----------
function findFk(table, embed, fkHint) {
  const key = `${table}.${embed}`;
  if (FK_MAP[key]) return { dir: "fwd", col: FK_MAP[key] };
  if (fkHint) return { dir: "fwd", col: fkHint };
  const cand = singular(embed) + "_id";
  const rows = F.tables[table] || [];
  if (rows.length && cand in rows[0]) return { dir: "fwd", col: cand };
  const other = F.tables[embed] || [];
  const back = singular(table) + "_id";
  if (other.length && back in other[0]) return { dir: "rev", col: back };
  if (cand === "obras_sociale_id") return { dir: "fwd", col: "obra_social_id" };
  return { dir: "fwd", col: cand };
}
function project(table, rows, sel) {
  return rows.map((row) => {
    const out = {};
    for (const it of sel) {
      if (it.kind === "col") {
        if (it.name === "*") Object.assign(out, row);
        else out[it.alias || it.name] = row[it.name] === undefined ? null : row[it.name];
      } else {
        const fk = findFk(table, it.table, it.fkHint);
        let val;
        if (fk.dir === "fwd") {
          const target = tableRows(it.table).find((r) => r.id === row[fk.col]);
          val = target ? project(it.table, [target], it.sub)[0] : null;
        } else {
          const list = tableRows(it.table).filter((r) => r[fk.col] === row.id);
          val = project(it.table, list, it.sub);
        }
        out[it.alias] = val;
      }
    }
    return out;
  });
}

function query(table, params, headers) {
  let rows = [...tableRows(table)];
  const sel = parseSelect(params.get("select") || "*");
  const embeds = sel.filter((s) => s.kind === "embed");
  // Filtros
  for (const [key, spec] of params.entries()) {
    if (["select", "order", "limit", "offset", "columns", "on_conflict"].includes(key)) continue;
    if (key === "or") { rows = rows.filter((r) => evalOr(r, spec)); continue; }
    if (key.includes(".")) {
      const [emb, col] = key.split(".");
      const e = embeds.find((x) => x.alias === emb || x.table === emb);
      if (!e) continue;
      rows = rows.filter((r) => {
        const fk = findFk(table, e.table, e.fkHint);
        const t = fk.dir === "fwd" ? tableRows(e.table).find((x) => x.id === r[fk.col]) : null;
        return t ? rowMatches(t, col, spec) : false;
      });
      continue;
    }
    rows = rows.filter((r) => rowMatches(r, key, spec));
  }
  // !inner sin filtro: descartar sin relación
  for (const e of embeds.filter((x) => x.inner)) {
    rows = rows.filter((r) => {
      const fk = findFk(table, e.table, e.fkHint);
      return fk.dir === "fwd" ? tableRows(e.table).some((x) => x.id === r[fk.col]) : true;
    });
  }
  // Orden
  const order = params.get("order");
  if (order) {
    const keys = order.split(",").map((o) => { const [c, ...f] = o.split("."); return { c, desc: f.includes("desc") }; });
    rows.sort((a, b) => { for (const k of keys) { const r = cmp(a[k.c], b[k.c]); if (r) return k.desc ? -r : r; } return 0; });
  }
  const total = rows.length;
  const off = Number(params.get("offset") || 0);
  if (off) rows = rows.slice(off);
  if (params.get("limit")) rows = rows.slice(0, Number(params.get("limit")));
  return { rows: project(table, rows, sel), total, offset: off };
}

// ---------- HTTP ----------
function cors(req, res) {
  const origin = req.headers.origin || "*";
  res.setHeader("access-control-allow-origin", origin);
  res.setHeader("access-control-allow-credentials", "true");
  res.setHeader("access-control-allow-headers", req.headers["access-control-request-headers"] || "*");
  res.setHeader("access-control-allow-methods", "GET,POST,PUT,PATCH,DELETE,HEAD,OPTIONS");
  res.setHeader("access-control-expose-headers", "content-range, content-length");
  res.setHeader("access-control-max-age", "600");
}
const json = (res, code, body, extra = {}) => {
  res.writeHead(code, { "content-type": "application/json", ...extra });
  res.end(body === undefined ? "" : JSON.stringify(body));
};
function jwtUser(req) {
  const h = req.headers.authorization || "";
  const tok = h.replace(/^Bearer\s+/i, "");
  try {
    const p = JSON.parse(Buffer.from(tok.split(".")[1], "base64url").toString());
    if (!p.sub) return null;
    return p;
  } catch { return null; }
}
function userObject(sub) {
  const u = DEMO_USERS.find((x) => x.id === sub) || DEMO_USERS[0];
  return { id: u.id, aud: "authenticated", role: "authenticated", email: u.email, email_confirmed_at: "2026-01-01T00:00:00Z", app_metadata: { provider: "email" }, user_metadata: {}, created_at: "2026-01-01T00:00:00Z", updated_at: "2026-01-01T00:00:00Z" };
}
function sessionFor(u) {
  const access_token = makeJwt(u.id, u.email);
  return { access_token, token_type: "bearer", expires_in: 31536000, expires_at: Math.floor(Date.now() / 1000) + 31536000, refresh_token: "stub-refresh-" + u.id, user: userObject(u.id) };
}

const server = http.createServer(async (req, res) => {
  cors(req, res);
  if (req.method === "OPTIONS") { res.writeHead(204); return res.end(); }
  const url = new URL(req.url, `http://localhost:${PORT}`);
  const chunks = []; for await (const c of req) chunks.push(c);
  const bodyText = Buffer.concat(chunks).toString();
  let body = {}; try { body = bodyText ? JSON.parse(bodyText) : {}; } catch { /* ignore */ }
  if (VERBOSE) console.log(req.method, url.pathname + url.search);

  // ----- Auth -----
  if (url.pathname.startsWith("/auth/v1/")) {
    const ep = url.pathname.slice("/auth/v1/".length);
    if (ep === "user" && req.method === "GET") {
      const p = jwtUser(req);
      return p ? json(res, 200, userObject(p.sub)) : json(res, 401, { code: 401, msg: "invalid JWT", error_code: "bad_jwt" });
    }
    if (ep === "user" && req.method === "PUT") return json(res, 200, userObject(jwtUser(req)?.sub));
    if (ep === "token") {
      const email = body.email || "";
      const u = DEMO_USERS.find((x) => x.email === email) || DEMO_USERS.find((x) => "stub-refresh-" + x.id === body.refresh_token) || DEMO_USERS[0];
      return json(res, 200, sessionFor(u));
    }
    if (ep === "logout" || ep === "recover") return json(res, 200, {});
    return json(res, 200, {});
  }

  // ----- RPC -----
  if (url.pathname.startsWith("/rest/v1/rpc/")) {
    const fn = url.pathname.slice("/rest/v1/rpc/".length);
    const handler = F.rpc[fn];
    if (!handler) { console.warn(`[stub] rpc sin fixture: ${fn}`); return json(res, 200, null); }
    return json(res, 200, handler(body, url.searchParams));
  }

  // ----- PostgREST -----
  if (url.pathname.startsWith("/rest/v1/")) {
    const table = url.pathname.slice("/rest/v1/".length);
    if (req.method === "GET" || req.method === "HEAD") {
      const { rows, total, offset } = query(table, url.searchParams, req.headers);
      const wantCount = /count=/.test(req.headers.prefer || "");
      const range = rows.length ? `${offset}-${offset + rows.length - 1}/${wantCount ? total : "*"}` : `*/${wantCount ? total : "*"}`;
      const hdr = { "content-range": range };
      if (req.method === "HEAD") { res.writeHead(200, hdr); return res.end(); }
      if (/vnd\.pgrst\.object\+json/.test(req.headers.accept || "")) {
        if (rows.length !== 1) return json(res, 406, { code: "PGRST116", details: `The result contains ${rows.length} rows`, hint: null, message: "JSON object requested, multiple (or no) rows returned" });
        return json(res, 200, rows[0], hdr);
      }
      return json(res, 200, rows, hdr);
    }
    // Escrituras: no persisten. Devuelven lo enviado (con id) para que el flujo siga.
    const sent = Array.isArray(body) ? body : [body];
    const echo = sent.map((r, i) => ({ id: `stub-${Date.now()}-${i}`, ...r }));
    if (/return=representation/.test(req.headers.prefer || "")) return json(res, req.method === "POST" ? 201 : 200, /vnd\.pgrst\.object\+json/.test(req.headers.accept || "") ? echo[0] : echo);
    res.writeHead(req.method === "POST" ? 201 : 204); return res.end();
  }

  if (url.pathname === "/" || url.pathname === "/health") return json(res, 200, { ok: true, stub: true });
  json(res, 404, { message: "no existe en el stub" });
});

server.listen(PORT, "127.0.0.1", () => console.log(`[stub] Supabase de prueba escuchando en http://localhost:${PORT} (${Object.keys(F.tables).length} tablas/vistas)`));
