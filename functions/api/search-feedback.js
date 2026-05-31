import { corsHeaders, hashId, jsonResponse, localDateKey, localHour, referrerHost, safePage, safeText } from "../_lib/analytics.js";

export async function onRequestOptions({ request, env }) {
  const cors = corsHeaders(request, env);
  return new Response(null, {
    status: 204,
    headers: {
      ...cors,
      "access-control-allow-methods": "POST, OPTIONS",
      "access-control-allow-headers": "content-type",
      "access-control-max-age": "86400"
    }
  });
}

function hasD1(env = {}) {
  return env.MAEN_DB && typeof env.MAEN_DB.prepare === "function";
}

function normalizeQuery(value) {
  return safeText(value, 100)
    .toLowerCase()
    .replace(/[\u064B-\u065F\u0670\u0640]/g, "")
    .replace(/[أإآٱ]/g, "ا")
    .replace(/ة/g, "ه")
    .replace(/ى/g, "ي")
    .replace(/ؤ/g, "و")
    .replace(/ئ/g, "ي")
    .replace(/[^\u0600-\u06FFa-z0-9\s]/gi, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 80);
}

async function ensureSchema(env = {}) {
  if (!hasD1(env)) return false;
  await env.MAEN_DB.prepare(`CREATE TABLE IF NOT EXISTS failed_searches_daily (
    id TEXT PRIMARY KEY,
    local_date TEXT NOT NULL,
    local_hour TEXT,
    query TEXT NOT NULL,
    query_hash TEXT NOT NULL,
    mode TEXT,
    satellite TEXT,
    service_filter TEXT,
    page TEXT,
    referrer_host TEXT,
    country TEXT,
    hits INTEGER DEFAULT 1,
    first_seen TEXT NOT NULL,
    last_seen TEXT NOT NULL
  )`).run();
  await env.MAEN_DB.prepare("CREATE UNIQUE INDEX IF NOT EXISTS idx_failed_searches_daily_unique ON failed_searches_daily(local_date, query_hash, satellite, service_filter)").run();
  await env.MAEN_DB.prepare("CREATE INDEX IF NOT EXISTS idx_failed_searches_daily_date ON failed_searches_daily(local_date)").run();
  return true;
}

export async function onRequestPost({ request, env }) {
  const cors = corsHeaders(request, env);
  const contentLength = Number(request.headers.get("content-length") || 0);
  if (contentLength > 2500) return jsonResponse({ ok: false, error: "Payload too large" }, 413, cors);

  let payload = {};
  try {
    const raw = await request.text();
    if (raw.length > 2500) return jsonResponse({ ok: false, error: "Payload too large" }, 413, cors);
    payload = raw ? JSON.parse(raw) : {};
  } catch {
    return jsonResponse({ ok: false, error: "Invalid JSON" }, 400, cors);
  }

  const query = normalizeQuery(payload.query);
  if (query.length < 3) return jsonResponse({ ok: false, error: "Query too short" }, 400, cors);
  if (!hasD1(env)) return jsonResponse({ ok: false, error: "Missing MAEN_DB D1 binding" }, 503, cors);
  await ensureSchema(env);

  const now = new Date();
  const localDate = localDateKey(now, env);
  const cf = request.cf || {};
  const hash = await hashId(query, "failed-search-query", env);
  const satellite = safeText(payload.satellite || "all", 80) || "all";
  const serviceFilter = safeText(payload.serviceFilter || "all", 40) || "all";
  const id = `${localDate}|${hash}|${satellite}|${serviceFilter}`;

  await env.MAEN_DB.prepare(`INSERT INTO failed_searches_daily
    (id, local_date, local_hour, query, query_hash, mode, satellite, service_filter, page, referrer_host, country, hits, first_seen, last_seen)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)
    ON CONFLICT(local_date, query_hash, satellite, service_filter)
    DO UPDATE SET hits = hits + 1, last_seen = excluded.last_seen, page = excluded.page, referrer_host = excluded.referrer_host, country = excluded.country`)
    .bind(
      id,
      localDate,
      localHour(now, env),
      query,
      hash,
      safeText(payload.mode || "free", 40),
      satellite,
      serviceFilter,
      safePage(payload.page || "/"),
      referrerHost(payload.referrer || request.headers.get("referer") || ""),
      safeText(cf.country || request.headers.get("cf-ipcountry") || "unknown", 40),
      now.toISOString(),
      now.toISOString()
    )
    .run();

  return jsonResponse({ ok: true, stored: true }, 200, cors);
}

export async function onRequest() {
  return jsonResponse({ ok: false, error: "Method not allowed" }, 405);
}
