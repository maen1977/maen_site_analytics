#!/usr/bin/env node
import { reportHtml, reportText, localDateKey, shiftDateKey, safePage, safeText } from '../functions/_lib/analytics.js';

const D1_REQUIRED = ['CLOUDFLARE_ACCOUNT_ID', 'CLOUDFLARE_D1_DATABASE_ID', 'CLOUDFLARE_API_TOKEN'];
const MAIL_REQUIRED = ['RESEND_API_KEY', 'REPORT_EMAIL'];

function env(name, fallback = '') {
  return process.env[name] || fallback;
}

function missing(names) {
  return names.filter((name) => !env(name));
}

function fromAddress() {
  return env('REPORT_FROM', 'Maen Analytics <onboarding@resend.dev>');
}

function isUsingResendDevSender() {
  return /@resend\.dev>?$/i.test(fromAddress());
}

async function retrieveResendDelivery(apiKey, emailId) {
  if (!apiKey || !emailId) return { deliveryStatus: 'unknown' };
  try {
    const response = await fetch(`https://api.resend.com/emails/${encodeURIComponent(emailId)}`, {
      headers: { authorization: `Bearer ${apiKey}` }
    });
    const body = await response.json().catch(() => ({}));
    return response.ok
      ? { deliveryStatus: body.last_event || 'unknown' }
      : { deliveryStatus: 'status-unavailable', deliveryStatusCode: response.status };
  } catch (error) {
    return { deliveryStatus: 'status-unavailable', deliveryStatusError: String(error?.message || error).slice(0, 180) };
  }
}

async function sendResendMessage({ subject, text, html }) {
  const apiKey = env('RESEND_API_KEY');
  const to = env('REPORT_EMAIL');
  const from = fromAddress();

  const missingMail = missing(MAIL_REQUIRED);
  if (missingMail.length) {
    throw new Error(`Missing mail secrets: ${missingMail.join(', ')}`);
  }

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { authorization: `Bearer ${apiKey}`, 'content-type': 'application/json' },
    body: JSON.stringify({ from, to, subject, text, html })
  });

  const body = await response.text().catch(() => '');
  if (!response.ok) {
    throw new Error(`Resend failed (${response.status}): ${body.slice(0, 1500)}`);
  }

  let parsed = {};
  try { parsed = JSON.parse(body); } catch {}
  const delivery = await retrieveResendDelivery(apiKey, parsed.id);
  return { sent: true, status: response.status, body: body.slice(0, 500), ...delivery };
}

async function sendFailureEmail(stage, error) {
  if (missing(MAIL_REQUIRED).length) {
    console.error('[analytics] Cannot send failure email because RESEND_API_KEY or REPORT_EMAIL is missing.');
    return { sent: false, reason: 'missing-mail-secrets' };
  }

  const subject = `تنبيه: فشل تقرير زيارات الموقع - ${stage}`;
  const message = String(error && (error.stack || error.message) || error);
  const senderWarning = isUsingResendDevSender()
    ? '\n\nملاحظة مهمة: REPORT_FROM يستخدم onboarding@resend.dev. إذا كان REPORT_EMAIL ليس بريد حساب Resend نفسه، قد يرفض Resend الإرسال. استخدم دومين موثق في Resend وضع REPORT_FROM مثل: Maen Analytics <reports@your-domain.com>.'
    : '';

  return sendResendMessage({
    subject,
    text:
`فشل إرسال/تجهيز تقرير زيارات موقع معن حنونة.

المرحلة: ${stage}
الوقت: ${new Date().toISOString()}

الخطأ:
${message.slice(0, 4000)}
${senderWarning}`,
    html:
`<div dir="rtl" style="font-family:Tahoma,Arial,sans-serif;line-height:1.8">
<h2>تنبيه: فشل تقرير زيارات الموقع</h2>
<p><b>المرحلة:</b> ${escapeHtml(stage)}</p>
<p><b>الوقت:</b> ${escapeHtml(new Date().toISOString())}</p>
<pre style="direction:ltr;text-align:left;white-space:pre-wrap;background:#f6f6f6;padding:14px;border-radius:12px">${escapeHtml(message.slice(0, 4000))}</pre>
${isUsingResendDevSender() ? '<p style="background:#fff3cd;padding:12px;border-radius:12px"><b>ملاحظة:</b> REPORT_FROM يستخدم onboarding@resend.dev. إذا كان REPORT_EMAIL ليس بريد حساب Resend نفسه، قد يرفض Resend الإرسال. استخدم دومين موثق في Resend.</p>' : ''}
</div>`
  });
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

async function d1Query(sql, params = []) {
  const missingD1 = missing(D1_REQUIRED);
  if (missingD1.length) {
    throw new Error(`Missing Cloudflare D1 secrets: ${missingD1.join(', ')}`);
  }

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
    throw new Error(`Cloudflare D1 query failed (${response.status}): ${bodyText.slice(0, 1500)}`);
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

function aggregateRows(rows, dateKey, timezone, warnings = []) {
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

  const noteLines = [
    'تقرير يومي من GitHub Actions اعتمادًا على سجلات Cloudflare D1. البيانات مجهولة: لا يتم تخزين IP الكامل ولا اسم الشخص الحقيقي؛ يتم عرض البلد/المدينة التقريبية والمصدر والصفحة والجهاز عندما تكون متاحة.'
  ];

  if (warnings.length) {
    noteLines.push('');
    noteLines.push('تنبيهات النظام:');
    for (const warning of warnings) noteLines.push(`- ${warning}`);
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
    note: noteLines.join('\n')
  };
}

async function main() {
  const timezone = env('ANALYTICS_TIMEZONE', 'Asia/Amman');
  const dateKey = env('REPORT_DATE') || shiftDateKey(localDateKey(new Date(), timezone), -1);
  const warnings = [];

  if (isUsingResendDevSender()) {
    warnings.push('REPORT_FROM يستخدم onboarding@resend.dev. هذا مناسب للاختبار فقط غالباً. للإرسال لأي بريد آخر استخدم دومين موثق في Resend.');
  }

  console.log(`[analytics] Building report for local date ${dateKey} (${timezone})`);
  console.log(`[analytics] REPORT_EMAIL: ${env('REPORT_EMAIL') ? 'present' : 'MISSING'}`);
  console.log(`[analytics] REPORT_FROM: ${env('REPORT_FROM') ? 'custom' : 'default onboarding@resend.dev'}`);
  console.log(`[analytics] D1 secrets: ${missing(D1_REQUIRED).length ? 'MISSING ' + missing(D1_REQUIRED).join(', ') : 'present'}`);

  let rows = [];

  try {
    rows = await d1Query(
      `SELECT id, ts, local_date, local_hour, page, title, device, ua_device, lang, timezone, screen, referrer_host, visitor_hash, session_hash, ip_hash, country, region, city, continent, colo, cf_timezone
       FROM analytics_events
       WHERE local_date = ?
       ORDER BY ts ASC`,
      [dateKey]
    );
  } catch (error) {
    const message = String(error && error.message || error).toLowerCase();

    if (message.includes('no such table') || message.includes('analytics_events')) {
      console.warn('[analytics] analytics_events table is not ready yet; sending an empty report.');
      warnings.push('جدول analytics_events غير موجود أو لم يتم إنشاؤه بعد. أول زيارة ناجحة عبر track-visit تنشئ الجدول.');
      rows = [];
    } else {
      console.error('[analytics] D1 read failed. Trying to send failure alert email.');
      try {
        await sendFailureEmail('Cloudflare D1 read', error);
      } catch (mailError) {
        console.error('[analytics] Failure alert email also failed:', mailError && (mailError.stack || mailError.message) || mailError);
      }
      throw error;
    }
  }

  const summary = aggregateRows(rows, dateKey, timezone, warnings);

  const email = await sendResendMessage({
    subject: `تقرير زيارات يومي - ${summary.periodLabel || summary.date}`,
    text: reportText(summary),
    html: reportHtml(summary)
  });

  console.log(`[analytics] Rows: ${rows.length}; email: ${JSON.stringify(email)}`);
  console.log(JSON.stringify({
    ok: true,
    date: dateKey,
    totalPageviews: summary.totalPageviews,
    uniqueVisitors: summary.uniqueVisitors,
    email,
    warnings
  }, null, 2));
}

main().catch(async (error) => {
  console.error('[analytics] Report failed:', error && error.stack || error);
  process.exit(1);
});
