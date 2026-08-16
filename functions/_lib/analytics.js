export const DEFAULT_TIMEZONE = "Asia/Amman";

let schemaReady = false;

export function envValue(env, key, fallback = "") {
  return env && env[key] !== undefined && env[key] !== null && env[key] !== "" ? String(env[key]) : fallback;
}

export function analyticsTimezone(env = {}) {
  return envValue(env, "ANALYTICS_TIMEZONE", DEFAULT_TIMEZONE);
}

export function jsonResponse(data, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      ...extraHeaders
    }
  });
}

export function corsHeaders(request, env = {}) {
  const origin = request.headers.get("origin") || "";
  const allowedOrigin = envValue(env, "ALLOWED_ORIGIN");
  if (allowedOrigin && origin === allowedOrigin) return { "access-control-allow-origin": origin, "vary": "origin" };
  if (!allowedOrigin) return { "access-control-allow-origin": "*" };
  return {};
}

export function safeText(value, max = 240) {
  return String(value ?? "")
    .replace(/[\u0000-\u001F\u007F]/g, "")
    .trim()
    .slice(0, max);
}

export function safePage(value) {
  const page = safeText(value, 400) || "/";
  if (/^https?:\/\//i.test(page)) {
    try {
      const url = new URL(page);
      return (url.pathname || "/") + (url.search || "") + (url.hash || "");
    } catch {
      return "/";
    }
  }
  return page.startsWith("/") ? page : "/" + page;
}

export function referrerHost(value) {
  const ref = safeText(value, 400);
  if (!ref) return "direct";
  try {
    const host = new URL(ref).hostname.replace(/^www\./, "");
    return host || "direct";
  } catch {
    return "other";
  }
}

export async function hashId(value, namespace = "visitor", env = {}) {
  const salt = envValue(env, "ANALYTICS_SALT", "CHANGE_ME_IN_CLOUDFLARE_ENV");
  const data = new TextEncoder().encode(namespace + "|" + salt + "|" + String(value || "anonymous"));
  const digest = await crypto.subtle.digest("SHA-256", data);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("").slice(0, 32);
}

export function localParts(date = new Date(), timeZone = DEFAULT_TIMEZONE) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    hourCycle: "h23"
  }).formatToParts(date);
  const out = {};
  for (const part of parts) if (part.type !== "literal") out[part.type] = part.value;
  return out;
}

export function localDateKey(date = new Date(), envOrTimeZone = {}) {
  const timeZone = typeof envOrTimeZone === "string" ? envOrTimeZone : analyticsTimezone(envOrTimeZone);
  const p = localParts(date, timeZone);
  return `${p.year}-${p.month}-${p.day}`;
}

export function localHour(date = new Date(), envOrTimeZone = {}) {
  const timeZone = typeof envOrTimeZone === "string" ? envOrTimeZone : analyticsTimezone(envOrTimeZone);
  return localParts(date, timeZone).hour || "00";
}

export function shiftDateKey(dateKey, days) {
  const [y, m, d] = dateKey.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + days, 12, 0, 0));
  return dt.toISOString().slice(0, 10);
}

export function previousLocalDateKey(now = new Date(), env = {}) {
  return shiftDateKey(localDateKey(now, env), -1);
}

export function uaDevice(userAgent) {
  const ua = String(userAgent || "").toLowerCase();
  if (/tablet|ipad/.test(ua)) return "tablet";
  if (/mobi|android|iphone|phone/.test(ua)) return "mobile";
  if (!ua) return "unknown";
  return "desktop";
}

function hasD1(env = {}) {
  return env.MAEN_DB && typeof env.MAEN_DB.prepare === "function";
}

function hasKV(env = {}) {
  return env.MAEN_ANALYTICS_KV && typeof env.MAEN_ANALYTICS_KV.put === "function";
}

async function runOptional(env, sql) {
  try {
    await env.MAEN_DB.prepare(sql).run();
  } catch (error) {
    const message = String(error && error.message || error).toLowerCase();
    if (!message.includes("duplicate") && !message.includes("already exists")) {
      console.warn("Optional D1 schema statement failed", sql, error);
    }
  }
}

export async function ensureAnalyticsSchema(env = {}) {
  if (!hasD1(env) || schemaReady) return;
  await env.MAEN_DB.prepare(`CREATE TABLE IF NOT EXISTS analytics_events (
    id TEXT PRIMARY KEY,
    ts TEXT NOT NULL,
    local_date TEXT NOT NULL,
    local_hour TEXT,
    page TEXT,
    title TEXT,
    device TEXT,
    ua_device TEXT,
    lang TEXT,
    timezone TEXT,
    screen TEXT,
    referrer_host TEXT,
    visitor_hash TEXT,
    session_hash TEXT,
    ip_hash TEXT,
    country TEXT,
    region TEXT,
    city TEXT,
    continent TEXT,
    colo TEXT,
    cf_timezone TEXT,
    event_type TEXT,
    event_data TEXT
  )`).run();
  await runOptional(env, "ALTER TABLE analytics_events ADD COLUMN ip_hash TEXT");
  await runOptional(env, "ALTER TABLE analytics_events ADD COLUMN country TEXT");
  await runOptional(env, "ALTER TABLE analytics_events ADD COLUMN region TEXT");
  await runOptional(env, "ALTER TABLE analytics_events ADD COLUMN city TEXT");
  await runOptional(env, "ALTER TABLE analytics_events ADD COLUMN continent TEXT");
  await runOptional(env, "ALTER TABLE analytics_events ADD COLUMN colo TEXT");
  await runOptional(env, "ALTER TABLE analytics_events ADD COLUMN cf_timezone TEXT");
  await runOptional(env, "ALTER TABLE analytics_events ADD COLUMN event_type TEXT");
  await runOptional(env, "ALTER TABLE analytics_events ADD COLUMN event_data TEXT");
  await env.MAEN_DB.prepare("CREATE INDEX IF NOT EXISTS idx_analytics_events_local_date ON analytics_events(local_date)").run();
  await env.MAEN_DB.prepare("CREATE INDEX IF NOT EXISTS idx_analytics_events_visitor ON analytics_events(visitor_hash)").run();
  await env.MAEN_DB.prepare("CREATE INDEX IF NOT EXISTS idx_analytics_events_session ON analytics_events(session_hash)").run();
  await env.MAEN_DB.prepare(`CREATE TABLE IF NOT EXISTS analytics_reports (
    key TEXT PRIMARY KEY,
    json TEXT NOT NULL,
    generated_at TEXT NOT NULL
  )`).run();
  schemaReady = true;
}

export async function saveAnalyticsRecord(env = {}, record = {}) {
  if (hasD1(env)) {
    await ensureAnalyticsSchema(env);
    await env.MAEN_DB.prepare(`INSERT INTO analytics_events
      (id, ts, local_date, local_hour, page, title, device, ua_device, lang, timezone, screen, referrer_host, visitor_hash, session_hash, ip_hash, country, region, city, continent, colo, cf_timezone, event_type, event_data)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .bind(
        record.id,
        record.ts,
        record.localDate,
        record.localHour,
        record.page,
        record.title,
        record.device,
        record.uaDevice,
        record.lang,
        record.timezone,
        record.screen,
        record.referrerHost,
        record.visitorHash,
        record.sessionHash,
        record.ipHash,
        record.country,
        record.region,
        record.city,
        record.continent,
        record.colo,
        record.cfTimezone,
        record.eventType || "",
        record.eventData || ""
      )
      .run();
    return { stored: true, backend: "d1" };
  }
  if (hasKV(env)) {
    const key = `events/${record.localDate}/${Date.now()}-${record.id}.json`;
    await env.MAEN_ANALYTICS_KV.put(key, JSON.stringify(record));
    return { stored: true, backend: "kv" };
  }
  return { stored: false, backend: "none", reason: "Missing MAEN_DB D1 binding or MAEN_ANALYTICS_KV binding" };
}

function rowToRecord(r) {
  return {
    id: r.id,
    ts: r.ts,
    localDate: r.local_date,
    localHour: r.local_hour,
    page: r.page,
    title: r.title,
    device: r.device,
    uaDevice: r.ua_device,
    lang: r.lang,
    timezone: r.timezone,
    screen: r.screen,
    referrerHost: r.referrer_host,
    visitorHash: r.visitor_hash,
    sessionHash: r.session_hash,
    ipHash: r.ip_hash,
    eventType: r.event_type || "",
    eventData: r.event_data || "",
    country: r.country,
    region: r.region,
    city: r.city,
    continent: r.continent,
    colo: r.colo,
    cfTimezone: r.cf_timezone
  };
}

export async function listRecordsForDate(env = {}, dateKey) {
  if (hasD1(env)) {
    await ensureAnalyticsSchema(env);
    const result = await env.MAEN_DB.prepare(`SELECT id, ts, local_date, local_hour, page, title, device, ua_device, lang, timezone, screen, referrer_host, visitor_hash, session_hash, ip_hash, country, region, city, continent, colo, cf_timezone, event_type, event_data FROM analytics_events WHERE local_date = ? AND (event_type IS NULL OR event_type = '') ORDER BY ts ASC`)
      .bind(dateKey)
      .all();
    return (result.results || []).map(rowToRecord);
  }
  if (env.MAEN_ANALYTICS_KV && typeof env.MAEN_ANALYTICS_KV.list === "function") {
    const prefix = `events/${dateKey}/`;
    const list = await env.MAEN_ANALYTICS_KV.list({ prefix });
    const records = [];
    for (const key of list.keys || []) {
      const record = await env.MAEN_ANALYTICS_KV.get(key.name, { type: "json" });
      if (record) records.push(record);
    }
    return records
      .filter((record) => !record.eventType)
      .sort((a, b) => String(a.ts || "").localeCompare(String(b.ts || "")));
  }
  return [];
}

function topEntries(map, limit = 10) {
  return Object.entries(map)
    .filter(([, count]) => count > 0)
    .sort((a, b) => b[1] - a[1] || String(a[0]).localeCompare(String(b[0])))
    .slice(0, limit)
    .map(([name, count]) => ({ name, count }));
}

function addCount(map, value, fallback = "unknown") {
  const name = safeText(value || fallback, 120) || fallback;
  map[name] = (map[name] || 0) + 1;
}

function visitDigest(record) {
  return {
    time: safeText(record.ts, 30),
    hour: safeText(record.localHour, 8),
    visitor: safeText(record.visitorHash, 12),
    session: safeText(record.sessionHash, 12),
    page: safePage(record.page || "/"),
    referrer: safeText(record.referrerHost || "direct", 120),
    country: safeText(record.country || "unknown", 40),
    region: safeText(record.region || "", 80),
    city: safeText(record.city || "", 80),
    device: safeText(record.device || record.uaDevice || "unknown", 40),
    lang: safeText(record.lang || "unknown", 40),
    screen: safeText(record.screen || "", 40),
    network: safeText(record.ipHash, 12)
  };
}

function aggregateRecords(records, env = {}, meta = {}) {
  const visitors = new Set();
  const sessions = new Set();
  const networks = new Set();
  const device = {};
  const pages = {};
  const referrers = {};
  const hours = {};
  const languages = {};
  const countries = {};
  const regions = {};
  const cities = {};
  const continents = {};
  const colos = {};

  for (const r of records) {
    if (r.visitorHash) visitors.add(r.visitorHash);
    if (r.sessionHash) sessions.add(r.sessionHash);
    if (r.ipHash) networks.add(r.ipHash);
    addCount(device, r.device || r.uaDevice || "unknown");
    addCount(pages, safePage(r.page || "/"), "/");
    addCount(referrers, r.referrerHost || "direct", "direct");
    addCount(hours, String(r.localHour || "00").padStart(2, "0").slice(0, 2), "00");
    addCount(languages, r.lang || "unknown");
    addCount(countries, r.country || "unknown");
    addCount(regions, r.region || "unknown");
    const cityLabel = [r.city, r.country].filter(Boolean).join("، ") || "unknown";
    addCount(cities, cityLabel);
    addCount(continents, r.continent || "unknown");
    addCount(colos, r.colo || "unknown");
  }

  const latestVisits = records.slice(-30).reverse().map(visitDigest);
  return {
    ...meta,
    generatedAt: new Date().toISOString(),
    timezone: analyticsTimezone(env),
    totalPageviews: records.length,
    uniqueVisitors: visitors.size,
    sessions: sessions.size,
    approximateNetworks: networks.size,
    devices: topEntries(device),
    topPages: topEntries(pages),
    referrers: topEntries(referrers),
    hours: topEntries(hours, 24),
    languages: topEntries(languages),
    countries: topEntries(countries, 30),
    regions: topEntries(regions, 30),
    cities: topEntries(cities, 30),
    continents: topEntries(continents, 10),
    cloudflareDatacenters: topEntries(colos, 20),
    latestVisits,
    note: meta.note || "تقرير يومي مجهول الخصوصية: لا يتم تخزين IP الكامل ولا اسم الشخص الحقيقي. يتم عرض زائر/شبكة كرمز Hash تقريبي مع البلد والمصدر والصفحة والجهاز عندما تكون هذه المعلومات متاحة من Cloudflare والمتصفح."
  };
}

export async function aggregateDate(env = {}, dateKey) {
  const records = await listRecordsForDate(env, dateKey);
  return aggregateRecords(records, env, {
    date: dateKey,
    period: "day",
    periodKey: dateKey,
    periodLabel: dateKey
  });
}

export async function aggregateDateRange(env = {}, startDateKey, endDateKey) {
  const records = [];
  const dates = [];
  for (let dateKey = startDateKey; dateKey <= endDateKey; dateKey = shiftDateKey(dateKey, 1)) {
    dates.push(dateKey);
    records.push(...await listRecordsForDate(env, dateKey));
  }
  const periodLabel = `${startDateKey} إلى ${endDateKey}`;
  return aggregateRecords(records.sort((a, b) => String(a.ts || "").localeCompare(String(b.ts || ""))), env, {
    date: periodLabel,
    period: "week",
    periodKey: `week-${startDateKey}_${endDateKey}`,
    periodLabel,
    startDate: startDateKey,
    endDate: endDateKey,
    dates,
    note: "تقرير أسبوعي يجمع آخر 7 أيام حسب توقيت الموقع. البيانات مجهولة ولا تتضمن IP كامل أو أسماء حقيقية."
  });
}

export function reportText(summary) {
  const lines = [];
  lines.push(summary.period === "week" ? "تقرير زيارات أسبوعي لموقع معن حنونة للستلايت" : "تقرير زيارات يومي لموقع معن حنونة للستلايت");
  lines.push(`${summary.period === "week" ? "الفترة" : "التاريخ"}: ${summary.periodLabel || summary.date}`);
  lines.push(`المنطقة الزمنية: ${summary.timezone}`);
  lines.push("");
  lines.push(`إجمالي فتح الصفحات: ${summary.totalPageviews}`);
  lines.push(`عدد الزوار التقريبي: ${summary.uniqueVisitors}`);
  lines.push(`عدد الجلسات: ${summary.sessions}`);
  lines.push(`عدد الشبكات/العناوين التقريبي: ${summary.approximateNetworks || 0}`);
  lines.push("");
  lines.push("حسب البلد:");
  for (const item of summary.countries.slice(0, 12)) lines.push(`- ${item.name}: ${item.count}`);
  lines.push("");
  lines.push("حسب المدينة/البلد:");
  for (const item of summary.cities.slice(0, 12)) lines.push(`- ${item.name}: ${item.count}`);
  lines.push("");
  lines.push("حسب الجهاز:");
  for (const item of summary.devices) lines.push(`- ${item.name}: ${item.count}`);
  lines.push("");
  lines.push("أكثر الصفحات زيارة:");
  for (const item of summary.topPages.slice(0, 10)) lines.push(`- ${item.name}: ${item.count}`);
  lines.push("");
  lines.push("مصادر الزيارة:");
  for (const item of summary.referrers.slice(0, 10)) lines.push(`- ${item.name}: ${item.count}`);
  lines.push("");
  lines.push("آخر الزيارات المسجلة:");
  for (const v of summary.latestVisits.slice(0, 12)) {
    lines.push(`- ${v.time} | زائر ${v.visitor || "-"} | ${v.country}${v.city ? " / " + v.city : ""} | ${v.device} | ${v.page} | مصدر: ${v.referrer}`);
  }
  lines.push("");
  lines.push("أكثر الساعات نشاطًا:");
  for (const item of summary.hours.slice(0, 8)) lines.push(`- الساعة ${item.name}: ${item.count}`);
  lines.push("");
  lines.push(summary.note);
  return lines.join("\n");
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function table(title, rows) {
  const body = rows.length
    ? rows.map((r) => `<tr><td>${escapeHtml(r.name)}</td><td>${escapeHtml(r.count)}</td></tr>`).join("")
    : `<tr><td colspan="2">لا توجد بيانات</td></tr>`;
  return `<section><h2>${escapeHtml(title)}</h2><table><thead><tr><th>البند</th><th>العدد</th></tr></thead><tbody>${body}</tbody></table></section>`;
}

function visitsTable(visits = []) {
  const body = visits.length
    ? visits.slice(0, 25).map((v) => `<tr><td>${escapeHtml(v.time)}</td><td>${escapeHtml(v.visitor)}</td><td>${escapeHtml([v.country, v.city].filter(Boolean).join(" / "))}</td><td>${escapeHtml(v.device)}</td><td>${escapeHtml(v.page)}</td><td>${escapeHtml(v.referrer)}</td></tr>`).join("")
    : `<tr><td colspan="6">لا توجد زيارات مسجلة</td></tr>`;
  return `<section><h2>آخر الزيارات المسجلة</h2><table><thead><tr><th>الوقت</th><th>الزائر</th><th>الموقع التقريبي</th><th>الجهاز</th><th>الصفحة</th><th>المصدر</th></tr></thead><tbody>${body}</tbody></table></section>`;
}


export function reportHtml(summary) {
  return `<!doctype html>
<html lang="ar" dir="rtl">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>تقرير زيارات ${escapeHtml(summary.periodLabel || summary.date)}</title>
<style>
body{margin:0;background:#f8f5ed;color:#111;font-family:Tahoma,Arial,sans-serif;line-height:1.7}.wrap{max-width:1100px;margin:auto;padding:28px}.card,section{background:#fff;border-radius:22px;box-shadow:0 14px 38px rgba(0,0,0,.08);padding:22px;margin:0 0 18px}h1{margin:0 0 8px;font-size:28px}.kpis{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px}.kpi{background:#111;color:#fff;border-radius:18px;padding:18px}.kpi b{font-size:28px;display:block;color:#ffd23f}table{width:100%;border-collapse:collapse;table-layout:auto}th,td{border-bottom:1px solid #eee;padding:10px;text-align:right;vertical-align:top}th{background:#fafafa}@media(max-width:720px){.kpis{grid-template-columns:1fr}.wrap{padding:14px}table{font-size:12px}}
</style>
</head>
<body><main class="wrap">
<div class="card"><h1>${summary.period === "week" ? "تقرير زيارات أسبوعي لموقع معن حنونة للستلايت" : "تقرير زيارات يومي لموقع معن حنونة للستلايت"}</h1><p>${summary.period === "week" ? "الفترة" : "التاريخ"}: <b>${escapeHtml(summary.periodLabel || summary.date)}</b> — المنطقة الزمنية: <b>${escapeHtml(summary.timezone)}</b></p><p>${escapeHtml(summary.note)}</p></div>
<div class="kpis"><div class="kpi">فتح الصفحات<b>${summary.totalPageviews}</b></div><div class="kpi">الزوار التقريبيون<b>${summary.uniqueVisitors}</b></div><div class="kpi">الجلسات<b>${summary.sessions}</b></div><div class="kpi">الشبكات التقريبية<b>${summary.approximateNetworks || 0}</b></div></div>
${table("حسب البلد", summary.countries || [])}
${table("حسب المدينة/البلد", summary.cities || [])}
${table("حسب الجهاز", summary.devices || [])}
${table("أكثر الصفحات زيارة", summary.topPages || [])}
${table("مصادر الزيارة", summary.referrers || [])}
${visitsTable(summary.latestVisits || [])}
${table("الساعات الأكثر نشاطًا", summary.hours || [])}
${table("اللغات", summary.languages || [])}
${table("مراكز Cloudflare", summary.cloudflareDatacenters || [])}
</main></body></html>`;
}

export async function saveReport(env = {}, summary) {
  const key = summary.periodKey || summary.date;
  if (hasD1(env)) {
    await ensureAnalyticsSchema(env);
    await env.MAEN_DB.prepare(`INSERT INTO analytics_reports (key, json, generated_at) VALUES (?, ?, ?) ON CONFLICT(key) DO UPDATE SET json = excluded.json, generated_at = excluded.generated_at`)
      .bind(key, JSON.stringify(summary), new Date().toISOString())
      .run();
    return { saved: true, backend: "d1" };
  }
  if (env.MAEN_ANALYTICS_KV) {
    await env.MAEN_ANALYTICS_KV.put(`reports/${key}.json`, JSON.stringify(summary));
    return { saved: true, backend: "kv" };
  }
  return { saved: false, backend: "none" };
}

export async function sendEmailReport(env = {}, summary) {
  const apiKey = envValue(env, "RESEND_API_KEY");
  const to = envValue(env, "REPORT_EMAIL");
  const from = envValue(env, "REPORT_FROM", "Maen Analytics <onboarding@resend.dev>");
  if (!apiKey || !to) return { sent: false, reason: "RESEND_API_KEY or REPORT_EMAIL is not configured" };

  const subject = `${summary.period === "week" ? "تقرير زيارات أسبوعي" : "تقرير زيارات يومي"} - ${summary.periodLabel || summary.date}`;
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { "authorization": `Bearer ${apiKey}`, "content-type": "application/json" },
    body: JSON.stringify({ from, to, subject, text: reportText(summary), html: reportHtml(summary) })
  });
  const body = await response.text().catch(() => "");
  return { sent: response.ok, status: response.status, body: body.slice(0, 500) };
}

export function authorized(request, env = {}) {
  const token = envValue(env, "ANALYTICS_ADMIN_TOKEN");
  if (!token) return false;
  const url = new URL(request.url);
  const given = url.searchParams.get("token") || request.headers.get("x-analytics-token") || "";
  return given === token;
}

export function resolveDate(request, env = {}) {
  const url = new URL(request.url);
  const explicit = safeText(url.searchParams.get("date"), 10);
  if (/^\d{4}-\d{2}-\d{2}$/.test(explicit)) return explicit;
  const day = url.searchParams.get("day") || "today";
  if (day === "yesterday") return previousLocalDateKey(new Date(), env);
  if (day === "tomorrow") return shiftDateKey(localDateKey(new Date(), env), 1);
  return localDateKey(new Date(), env);
}
