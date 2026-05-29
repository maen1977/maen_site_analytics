import { getStore } from "@netlify/blobs";
import { createHash } from "node:crypto";

export const STORE_NAME = "maen-anonymous-analytics";
export const DEFAULT_TIMEZONE = "Asia/Amman";

export function analyticsTimezone() {
  return process.env.ANALYTICS_TIMEZONE || DEFAULT_TIMEZONE;
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

export function corsHeaders(req) {
  const origin = req.headers.get("origin") || "";
  const allowedOrigin = process.env.ALLOWED_ORIGIN || "";
  if (allowedOrigin && origin === allowedOrigin) {
    return { "access-control-allow-origin": origin, "vary": "origin" };
  }
  if (!allowedOrigin) {
    return { "access-control-allow-origin": "*" };
  }
  return {};
}

export function getStoreSafe() {
  return getStore({ name: STORE_NAME, consistency: "strong" });
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

export function hashId(value, namespace = "visitor") {
  const salt = process.env.ANALYTICS_SALT || "CHANGE_ME_IN_NETLIFY_ENV";
  return createHash("sha256")
    .update(namespace + "|" + salt + "|" + String(value || "anonymous"))
    .digest("hex")
    .slice(0, 32);
}

export function localParts(date = new Date(), timeZone = analyticsTimezone()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    hourCycle: "h23"
  }).formatToParts(date);
  const out = {};
  for (const part of parts) {
    if (part.type !== "literal") out[part.type] = part.value;
  }
  return out;
}

export function localDateKey(date = new Date(), timeZone = analyticsTimezone()) {
  const p = localParts(date, timeZone);
  return `${p.year}-${p.month}-${p.day}`;
}

export function localHour(date = new Date(), timeZone = analyticsTimezone()) {
  return localParts(date, timeZone).hour || "00";
}

export function shiftDateKey(dateKey, days) {
  const [y, m, d] = dateKey.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + days, 12, 0, 0));
  return dt.toISOString().slice(0, 10);
}

export function previousLocalDateKey(now = new Date(), timeZone = analyticsTimezone()) {
  return shiftDateKey(localDateKey(now, timeZone), -1);
}

export async function listRecordsForDate(dateKey) {
  const store = getStoreSafe();
  const prefix = `events/${dateKey}/`;
  const list = await store.list({ prefix });
  const records = [];
  for (const blob of list.blobs || []) {
    try {
      const record = await store.get(blob.key, { type: "json", consistency: "strong" });
      if (record) records.push(record);
    } catch (error) {
      console.error("Failed reading analytics blob", blob.key, error);
    }
  }
  return records;
}

function topEntries(map, limit = 10) {
  return Object.entries(map)
    .sort((a, b) => b[1] - a[1] || String(a[0]).localeCompare(String(b[0])))
    .slice(0, limit)
    .map(([name, count]) => ({ name, count }));
}

export async function aggregateDate(dateKey) {
  const records = await listRecordsForDate(dateKey);
  const visitors = new Set();
  const sessions = new Set();
  const device = {};
  const pages = {};
  const referrers = {};
  const hours = {};
  const languages = {};

  for (const r of records) {
    if (r.visitorHash) visitors.add(r.visitorHash);
    if (r.sessionHash) sessions.add(r.sessionHash);
    const d = safeText(r.device || r.uaDevice || "unknown", 40) || "unknown";
    const p = safePage(r.page || "/");
    const ref = safeText(r.referrerHost || "direct", 120) || "direct";
    const h = String(r.localHour || "00").padStart(2, "0").slice(0, 2);
    const lang = safeText(r.lang || "unknown", 30) || "unknown";
    device[d] = (device[d] || 0) + 1;
    pages[p] = (pages[p] || 0) + 1;
    referrers[ref] = (referrers[ref] || 0) + 1;
    hours[h] = (hours[h] || 0) + 1;
    languages[lang] = (languages[lang] || 0) + 1;
  }

  return {
    date: dateKey,
    generatedAt: new Date().toISOString(),
    timezone: analyticsTimezone(),
    totalPageviews: records.length,
    uniqueVisitors: visitors.size,
    sessions: sessions.size,
    devices: topEntries(device),
    topPages: topEntries(pages),
    referrers: topEntries(referrers),
    hours: topEntries(hours, 24),
    languages: topEntries(languages),
    note: "الأرقام مجهولة وتعتمد على معرف محلي مجهول داخل المتصفح. قد تختلف قليلًا إذا حذف الزائر بيانات المتصفح أو استخدم أكثر من جهاز."
  };
}

export async function aggregateDateRange(startDateKey, endDateKey) {
  const visitors = new Set();
  const sessions = new Set();
  const device = {};
  const pages = {};
  const referrers = {};
  const hours = {};
  const languages = {};
  const dates = [];
  let totalPageviews = 0;

  for (let dateKey = startDateKey; dateKey <= endDateKey; dateKey = shiftDateKey(dateKey, 1)) {
    dates.push(dateKey);
    const records = await listRecordsForDate(dateKey);
    totalPageviews += records.length;
    for (const r of records) {
      if (r.visitorHash) visitors.add(r.visitorHash);
      if (r.sessionHash) sessions.add(r.sessionHash);
      const d = safeText(r.device || r.uaDevice || "unknown", 40) || "unknown";
      const p = safePage(r.page || "/");
      const ref = safeText(r.referrerHost || "direct", 120) || "direct";
      const h = String(r.localHour || "00").padStart(2, "0").slice(0, 2);
      const lang = safeText(r.lang || "unknown", 30) || "unknown";
      device[d] = (device[d] || 0) + 1;
      pages[p] = (pages[p] || 0) + 1;
      referrers[ref] = (referrers[ref] || 0) + 1;
      hours[h] = (hours[h] || 0) + 1;
      languages[lang] = (languages[lang] || 0) + 1;
    }
  }

  const periodLabel = `${startDateKey} إلى ${endDateKey}`;
  return {
    date: periodLabel,
    period: "week",
    periodKey: `week-${startDateKey}_${endDateKey}`,
    periodLabel,
    startDate: startDateKey,
    endDate: endDateKey,
    dates,
    generatedAt: new Date().toISOString(),
    timezone: analyticsTimezone(),
    totalPageviews,
    uniqueVisitors: visitors.size,
    sessions: sessions.size,
    devices: topEntries(device),
    topPages: topEntries(pages),
    referrers: topEntries(referrers),
    hours: topEntries(hours, 24),
    languages: topEntries(languages),
    note: "تقرير أسبوعي يجمع آخر 7 أيام حسب توقيت الموقع. الأرقام مجهولة وتعتمد على معرف محلي مجهول داخل المتصفح. قد تختلف قليلًا إذا حذف الزائر بيانات المتصفح أو استخدم أكثر من جهاز."
  };
}

export function reportText(summary) {
  const lines = [];
  lines.push(summary.period === "week" ? "تقرير زيارات أسبوعي لموقع معن حنونة للستلايت" : "تقرير زيارات موقع معن حنونة للستلايت");
  lines.push(`${summary.period === "week" ? "الفترة" : "التاريخ"}: ${summary.periodLabel || summary.date}`);
  lines.push(`المنطقة الزمنية: ${summary.timezone}`);
  lines.push("");
  lines.push(`إجمالي فتح الصفحات: ${summary.totalPageviews}`);
  lines.push(`عدد الزوار التقريبي: ${summary.uniqueVisitors}`);
  lines.push(`عدد الجلسات: ${summary.sessions}`);
  lines.push("");
  lines.push("حسب الجهاز:");
  for (const item of summary.devices) lines.push(`- ${item.name}: ${item.count}`);
  lines.push("");
  lines.push("أكثر الصفحات زيارة:");
  for (const item of summary.topPages.slice(0, 8)) lines.push(`- ${item.name}: ${item.count}`);
  lines.push("");
  lines.push("مصادر الزيارة:");
  for (const item of summary.referrers.slice(0, 8)) lines.push(`- ${item.name}: ${item.count}`);
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
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function table(title, rows) {
  const body = rows.length
    ? rows.map((r) => `<tr><td>${escapeHtml(r.name)}</td><td>${escapeHtml(r.count)}</td></tr>`).join("")
    : `<tr><td colspan="2">لا توجد بيانات</td></tr>`;
  return `<section><h2>${escapeHtml(title)}</h2><table><thead><tr><th>البند</th><th>العدد</th></tr></thead><tbody>${body}</tbody></table></section>`;
}

export function reportHtml(summary) {
  return `<!doctype html>
<html lang="ar" dir="rtl">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>تقرير زيارات ${escapeHtml(summary.periodLabel || summary.date)}</title>
<style>
body{margin:0;background:#f8f5ed;color:#111;font-family:Tahoma,Arial,sans-serif;line-height:1.7}.wrap{max-width:980px;margin:auto;padding:28px}.card,section{background:#fff;border-radius:22px;box-shadow:0 14px 38px rgba(0,0,0,.08);padding:22px;margin:0 0 18px}h1{margin:0 0 8px;font-size:28px}.kpis{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px}.kpi{background:#111;color:#fff;border-radius:18px;padding:18px}.kpi b{font-size:28px;display:block;color:#ffd23f}table{width:100%;border-collapse:collapse}th,td{border-bottom:1px solid #eee;padding:10px;text-align:right}th{background:#fafafa}@media(max-width:720px){.kpis{grid-template-columns:1fr}.wrap{padding:14px}}
</style>
</head>
<body><main class="wrap">
<div class="card"><h1>${summary.period === "week" ? "تقرير زيارات أسبوعي لموقع معن حنونة للستلايت" : "تقرير زيارات موقع معن حنونة للستلايت"}</h1><p>${summary.period === "week" ? "الفترة" : "التاريخ"}: <b>${escapeHtml(summary.periodLabel || summary.date)}</b> — المنطقة الزمنية: <b>${escapeHtml(summary.timezone)}</b></p><p>${escapeHtml(summary.note)}</p></div>
<div class="kpis"><div class="kpi">فتح الصفحات<b>${summary.totalPageviews}</b></div><div class="kpi">الزوار التقريبيون<b>${summary.uniqueVisitors}</b></div><div class="kpi">الجلسات<b>${summary.sessions}</b></div></div>
${table("حسب الجهاز", summary.devices)}
${table("أكثر الصفحات زيارة", summary.topPages)}
${table("مصادر الزيارة", summary.referrers)}
${table("الساعات الأكثر نشاطًا", summary.hours)}
${table("اللغات", summary.languages)}
</main></body></html>`;
}

export async function saveReport(summary) {
  const store = getStoreSafe();
  await store.setJSON(`reports/${summary.periodKey || summary.date}.json`, summary);
}

export async function sendEmailReport(summary) {
  const apiKey = process.env.RESEND_API_KEY || "";
  const to = process.env.REPORT_EMAIL || "";
  const from = process.env.REPORT_FROM || "Maen Analytics <onboarding@resend.dev>";
  if (!apiKey || !to) {
    return { sent: false, reason: "RESEND_API_KEY or REPORT_EMAIL is not configured" };
  }

  const subject = `${summary.period === "week" ? "تقرير زيارات أسبوعي" : "تقرير زيارات موقع معن حنونة"} - ${summary.periodLabel || summary.date}`;
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "authorization": `Bearer ${apiKey}`,
      "content-type": "application/json"
    },
    body: JSON.stringify({
      from,
      to,
      subject,
      text: reportText(summary),
      html: reportHtml(summary)
    })
  });

  const body = await response.text().catch(() => "");
  return { sent: response.ok, status: response.status, body: body.slice(0, 500) };
}
