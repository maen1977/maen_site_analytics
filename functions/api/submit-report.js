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

async function ensureReportSchema(env = {}) {
  if (!hasD1(env)) return false;
  await env.MAEN_DB.prepare(`CREATE TABLE IF NOT EXISTS visitor_reports (
    id TEXT PRIMARY KEY,
    ts TEXT NOT NULL,
    local_date TEXT NOT NULL,
    local_hour TEXT,
    type TEXT,
    title TEXT,
    details TEXT,
    contact_hash TEXT,
    page TEXT,
    referrer_host TEXT,
    country TEXT,
    region TEXT,
    city TEXT,
    status TEXT DEFAULT 'new'
  )`).run();
  await env.MAEN_DB.prepare("CREATE INDEX IF NOT EXISTS idx_visitor_reports_local_date ON visitor_reports(local_date)").run();
  await env.MAEN_DB.prepare("CREATE INDEX IF NOT EXISTS idx_visitor_reports_status ON visitor_reports(status)").run();
  return true;
}

function cfValue(cf, key, max = 120) {
  return safeText(cf && cf[key] !== undefined && cf[key] !== null ? cf[key] : "", max);
}

export async function onRequestPost({ request, env }) {
  const cors = corsHeaders(request, env);
  const contentLength = Number(request.headers.get("content-length") || 0);
  if (contentLength > 8000) return jsonResponse({ ok: false, error: "Payload too large" }, 413, cors);

  let payload = {};
  try {
    const raw = await request.text();
    if (raw.length > 8000) return jsonResponse({ ok: false, error: "Payload too large" }, 413, cors);
    payload = raw ? JSON.parse(raw) : {};
  } catch {
    return jsonResponse({ ok: false, error: "Invalid JSON" }, 400, cors);
  }

  const type = safeText(payload.type, 40);
  const allowed = new Set(["bad-frequency", "new-frequency", "channel-moved", "sports-info", "service-note", "other"]);
  const title = safeText(payload.title, 180);
  const details = safeText(payload.details, 1800);
  if (!allowed.has(type)) return jsonResponse({ ok: false, error: "Invalid report type" }, 400, cors);
  if (!title || details.length < 8) return jsonResponse({ ok: false, error: "Title and details are required" }, 400, cors);

  const now = new Date();
  const cf = request.cf || {};
  const ip = request.headers.get("cf-connecting-ip") || request.headers.get("x-forwarded-for") || "anonymous";
  const record = {
    id: crypto.randomUUID(),
    ts: now.toISOString(),
    localDate: localDateKey(now, env),
    localHour: localHour(now, env),
    type,
    title,
    details,
    contactHash: await hashId(payload.contact || ip, "visitor-report-contact", env),
    page: safePage(payload.page || "/#updates"),
    referrerHost: referrerHost(payload.referrer || ""),
    country: safeText(cf.country || request.headers.get("cf-ipcountry") || "unknown", 40),
    region: cfValue(cf, "region", 80),
    city: cfValue(cf, "city", 80),
    status: "new"
  };

  if (!hasD1(env)) return jsonResponse({ ok: false, error: "Missing MAEN_DB D1 binding" }, 503, cors);
  await ensureReportSchema(env);
  await env.MAEN_DB.prepare(`INSERT INTO visitor_reports
    (id, ts, local_date, local_hour, type, title, details, contact_hash, page, referrer_host, country, region, city, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
    .bind(record.id, record.ts, record.localDate, record.localHour, record.type, record.title, record.details, record.contactHash, record.page, record.referrerHost, record.country, record.region, record.city, record.status)
    .run();
  return jsonResponse({ ok: true, stored: true, id: record.id }, 200, cors);
}

export async function onRequest() {
  return jsonResponse({ ok: false, error: "Method not allowed" }, 405);
}
