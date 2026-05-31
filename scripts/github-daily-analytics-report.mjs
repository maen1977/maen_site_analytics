#!/usr/bin/env node
import { reportHtml, reportText, localDateKey, shiftDateKey, safePage, safeText } from '../functions/_lib/analytics.js';

const REQUIRED = ['CLOUDFLARE_ACCOUNT_ID', 'CLOUDFLARE_D1_DATABASE_ID', 'CLOUDFLARE_API_TOKEN', 'RESEND_API_KEY', 'REPORT_EMAIL'];

function env(name, fallback = '') {
  return process.env[name] || fallback;
}

function requireEnv() {
  const missing = REQUIRED.filter(name => !env(name));
  if (missing.length) {
    throw new Error(`Missing required GitHub Actions secrets/variables: ${missing.join(', ')}`);
  }
}

async function d1Query(sql, params = []) {
  const accountId = env('CLOUDFLARE_ACCOUNT_ID');
  const databaseId = env('CLOUDFLARE_D1_DATABASE_ID');
  const token = env('CLOUDFLARE_API_TOKEN');
  const url = `https://api.cloudflare.com/client/v4/accounts/${encodeURIComponent(accountId)}/d1/database/${encodeURIComponent(databaseId)}/query`;
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${token}`,
      'content-type': 'application/json'
    },
    body: JSON.stringify({ sql, params })
  });
  const bodyText = await response.text();
  let body;
  try { body = JSON.parse(bodyText); } catch { body = { raw: bodyText }; }
  if (!response.ok || body.success === false) {
    throw new Error(`Cloudflare D1 query failed (${response.status}): ${bodyText.slice(0, 1000)}`);
  }
  const resultBlock = Array.isArray(body.result) ? body.result[0] : body.result;
  return (resultBlock && resultBlock.results) || [];
}

function topEntries(map, limit = 10) {
  return Object.entries(map)
    .filter(([, count]) => count > 0)
    .sort((a, b) => b[1] - a[1] || String(a[0]).localeCompare(String(b[0])))
    .slice(0, limit)
    .map(([name, count]) => ({ name, count }));
}

function addCount(map, value, fallback = 'unknown') {
  const name = safeText(value || fallback, 120) || fallback;
  map[name] = (map[name] || 0) + 1;
}

function visitDigest(row) {
  return {
    time: safeText(row.ts, 30),
    hour: safeText(row.localHour || row.local_hour, 8),
    visitor: safeText(row.visitorHash || row.visitor_hash, 12),
    session: safeText(row.sessionHash || row.session_hash, 12),
    page: safePage(row.page || '/'),
    referrer: safeText(row.referrerHost || row.referrer_host || 'direct', 120),
    country: safeText(row.country || 'unknown', 40),
    region: safeText(row.region || '', 80),
    city: safeText(row.city || '', 80),
    device: safeText(row.device || row.uaDevice || row.ua_device || 'unknown', 40),
    lang: safeText(row.lang || 'unknown', 40),
    screen: safeText(row.screen || '', 40),
    network: safeText(row.ipHash || row.ip_hash, 12)
  };
}


function aggregateRows(rows, dateKey, timezone) {
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

  for (const r of rows) {
    const visitorHash = r.visitor_hash || r.visitorHash;
    const sessionHash = r.session_hash || r.sessionHash;
    const ipHash = r.ip_hash || r.ipHash;
    if (visitorHash) visitors.add(visitorHash);
    if (sessionHash) sessions.add(sessionHash);
    if (ipHash) networks.add(ipHash);
    addCount(device, r.device || r.ua_device || r.uaDevice || 'unknown');
    addCount(pages, safePage(r.page || '/'), '/');
    addCount(referrers, r.referrer_host || r.referrerHost || 'direct', 'direct');
    addCount(hours, String(r.local_hour || r.localHour || '00').padStart(2, '0').slice(0, 2), '00');
    addCount(languages, r.lang || 'unknown');
    addCount(countries, r.country || 'unknown');
    addCount(regions, r.region || 'unknown');
    addCount(cities, [r.city, r.country].filter(Boolean).join('، ') || 'unknown');
    addCount(continents, r.continent || 'unknown');
    addCount(colos, r.colo || 'unknown');
  }

  return {
    generatedAt: new Date().toISOString(),
    timezone,
    date: dateKey,
    period: 'day',
    periodKey: dateKey,
    periodLabel: dateKey,
    totalPageviews: rows.length,
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
    latestVisits: rows.slice(-30).reverse().map(visitDigest),
    generatedBy: 'github-actions-cloudflare-d1',
    note: 'تقرير يومي من GitHub Actions اعتمادًا على سجلات Cloudflare D1. البيانات مجهولة: لا يتم تخزين IP الكامل ولا اسم الشخص الحقيقي؛ يتم عرض البلد/المدينة التقريبية والمصدر والصفحة والجهاز عندما تكون متاحة.'
  };
}

async function sendResend(summary) {
  const apiKey = env('RESEND_API_KEY');
  const to = env('REPORT_EMAIL');
  const from = env('REPORT_FROM', 'Maen Analytics <onboarding@resend.dev>');
  const subject = `تقرير زيارات يومي - ${summary.periodLabel || summary.date}`;
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { authorization: `Bearer ${apiKey}`, 'content-type': 'application/json' },
    body: JSON.stringify({ from, to, subject, text: reportText(summary), html: reportHtml(summary) })
  });
  const text = await response.text().catch(() => '');
  if (!response.ok) throw new Error(`Resend failed (${response.status}): ${text.slice(0, 1000)}`);
  return { sent: true, status: response.status, body: text.slice(0, 500) };
}

async function main() {
  requireEnv();
  const timezone = env('ANALYTICS_TIMEZONE', 'Asia/Amman');
  const dateKey = env('REPORT_DATE') || shiftDateKey(localDateKey(new Date(), timezone), -1);
  console.log(`[analytics] Building report for local date ${dateKey} (${timezone})`);

  let rows = [];
  try {
    rows = await d1Query(`SELECT id, ts, local_date, local_hour, page, title, device, ua_device, lang, timezone, screen, referrer_host, visitor_hash, session_hash, ip_hash, country, region, city, continent, colo, cf_timezone FROM analytics_events WHERE local_date = ? ORDER BY ts ASC`, [dateKey]);
  } catch (error) {
    const message = String(error && error.message || error).toLowerCase();
    if (message.includes('no such table') || message.includes('analytics_events')) {
      console.warn('[analytics] analytics_events table is not ready yet; sending an empty report. A first tracked visit will create the table.');
      rows = [];
    } else {
      throw error;
    }
  }
  const summary = aggregateRows(rows, dateKey, timezone);
  const email = await sendResend(summary);
  console.log(`[analytics] Rows: ${rows.length}; email: ${JSON.stringify(email)}`);
  console.log(JSON.stringify({ ok: true, date: dateKey, totalPageviews: summary.totalPageviews, uniqueVisitors: summary.uniqueVisitors, email }, null, 2));
}

main().catch(error => {
  console.error('[analytics] Report failed:', error && error.stack || error);
  process.exit(1);
});
