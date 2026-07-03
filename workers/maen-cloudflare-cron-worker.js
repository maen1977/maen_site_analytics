import {
  reportHtml,
  reportText,
  localDateKey,
  shiftDateKey,
  safePage,
  safeText
} from '../functions/_lib/analytics.js';

import {
  runFrequencyUpdate,
  setRuntimeContext as setFrequencyRuntimeContext
} from '../functions/_lib/frequency-utils.js';

const DEFAULT_TIMEZONE = 'Asia/Amman';
const DEFAULT_BASE_URL = 'https://maensat.pages.dev';

function envValue(env, key, fallback = '') {
  const value = env && env[key];
  return value === undefined || value === null || value === '' ? fallback : String(value);
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store'
    }
  });
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function fromAddress(env) {
  return envValue(env, 'REPORT_FROM', 'Maen Analytics <onboarding@resend.dev>');
}

function isUsingResendDevSender(env) {
  return /@resend\.dev>?$/i.test(fromAddress(env));
}

async function sendResendMessage(env, { subject, text, html }) {
  const apiKey = envValue(env, 'RESEND_API_KEY');
  const to = envValue(env, 'REPORT_EMAIL');
  const from = fromAddress(env);

  if (!apiKey || !to) {
    throw new Error('Missing mail secrets: RESEND_API_KEY and/or REPORT_EMAIL');
  }

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      authorization: `Bearer ${apiKey}`,
      'content-type': 'application/json'
    },
    body: JSON.stringify({ from, to, subject, text, html })
  });

  const body = await response.text().catch(() => '');
  if (!response.ok) {
    throw new Error(`Resend failed (${response.status}): ${body.slice(0, 1500)}`);
  }

  return { sent: true, status: response.status, body: body.slice(0, 500) };
}

async function sendFailureEmail(env, stage, error) {
  if (!envValue(env, 'RESEND_API_KEY') || !envValue(env, 'REPORT_EMAIL')) {
    console.error('[cloudflare-cron] Cannot send failure alert: missing RESEND_API_KEY or REPORT_EMAIL.');
    return { sent: false, reason: 'missing-mail-secrets' };
  }

  const message = String(error && (error.stack || error.message) || error);
  const senderWarning = isUsingResendDevSender(env)
    ? '\n\nملاحظة: REPORT_FROM يستخدم onboarding@resend.dev. إذا كان REPORT_EMAIL ليس بريد حساب Resend نفسه، استخدم دومين موثق في Resend.'
    : '';

  return sendResendMessage(env, {
    subject: `تنبيه Cloudflare: فشل تقرير موقع معن - ${stage}`,
    text: `فشل تشغيل تقرير موقع معن حنونة من Cloudflare.\n\nالمرحلة: ${stage}\nالوقت: ${new Date().toISOString()}\n\nالخطأ:\n${message.slice(0, 4000)}${senderWarning}`,
    html: `<h2>تنبيه Cloudflare: فشل تقرير موقع معن</h2>
<p><b>المرحلة:</b> ${escapeHtml(stage)}</p>
<p><b>الوقت:</b> ${escapeHtml(new Date().toISOString())}</p>
<pre style="white-space:pre-wrap;direction:ltr;text-align:left;background:#f6f8fa;padding:12px;border-radius:8px">${escapeHtml(message.slice(0, 4000))}</pre>
${isUsingResendDevSender(env) ? '<p><b>ملاحظة:</b> REPORT_FROM يستخدم onboarding@resend.dev. استخدم دومين موثق في Resend للإرسال لأي بريد.</p>' : ''}`
  });
}

async function ensureD1Tables(env) {
  if (!env.MAEN_DB || typeof env.MAEN_DB.prepare !== 'function') return;

  await env.MAEN_DB.prepare(`
    CREATE TABLE IF NOT EXISTS frequency_cache (
      key TEXT PRIMARY KEY,
      json TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )
  `).run();

  await env.MAEN_DB.prepare(`
    CREATE TABLE IF NOT EXISTS cloudflare_cron_status (
      key TEXT PRIMARY KEY,
      json TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )
  `).run();
}

async function d1Query(env, sql, params = []) {
  if (!env.MAEN_DB || typeof env.MAEN_DB.prepare !== 'function') {
    throw new Error('Missing Cloudflare D1 binding: MAEN_DB');
  }
  const stmt = env.MAEN_DB.prepare(sql);
  const result = params.length ? await stmt.bind(...params).all() : await stmt.all();
  return result && Array.isArray(result.results) ? result.results : [];
}

async function putStatus(env, key, value) {
  const payload = {
    ...value,
    updatedAt: new Date().toISOString(),
    generatedBy: 'cloudflare-worker-cron'
  };

  if (env.MAEN_DB && typeof env.MAEN_DB.prepare === 'function') {
    await ensureD1Tables(env);
    await env.MAEN_DB.prepare(`
      INSERT INTO cloudflare_cron_status (key, json, updated_at)
      VALUES (?, ?, ?)
      ON CONFLICT(key) DO UPDATE SET json = excluded.json, updated_at = excluded.updated_at
    `).bind(key, JSON.stringify(payload), payload.updatedAt).run();
  }

  if (env.MAEN_FREQUENCY_KV && typeof env.MAEN_FREQUENCY_KV.put === 'function') {
    await env.MAEN_FREQUENCY_KV.put(`cloudflare-cron-status/${key}.json`, JSON.stringify(payload));
  }

  return payload;
}

async function getStatus(env, key) {
  if (env.MAEN_DB && typeof env.MAEN_DB.prepare === 'function') {
    try {
      await ensureD1Tables(env);
      const row = await env.MAEN_DB.prepare('SELECT json FROM cloudflare_cron_status WHERE key = ?').bind(key).first();
      if (row && row.json) return JSON.parse(row.json);
    } catch (error) {
      console.warn('[cloudflare-cron] Failed reading D1 status:', error && error.message || error);
    }
  }

  if (env.MAEN_FREQUENCY_KV && typeof env.MAEN_FREQUENCY_KV.get === 'function') {
    try {
      const value = await env.MAEN_FREQUENCY_KV.get(`cloudflare-cron-status/${key}.json`, { type: 'json' });
      if (value) return value;
    } catch (error) {
      console.warn('[cloudflare-cron] Failed reading KV status:', error && error.message || error);
    }
  }

  return null;
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

  for (const row of rows) {
    const visitorHash = row.visitor_hash || row.visitorHash;
    const sessionHash = row.session_hash || row.sessionHash;
    const ipHash = row.ip_hash || row.ipHash;
    if (visitorHash) visitors.add(visitorHash);
    if (sessionHash) sessions.add(sessionHash);
    if (ipHash) networks.add(ipHash);
    addCount(device, row.device || row.ua_device || row.uaDevice || 'unknown');
    addCount(pages, safePage(row.page || '/'), '/');
    addCount(referrers, row.referrer_host || row.referrerHost || 'direct', 'direct');
    addCount(hours, String(row.local_hour || row.localHour || '00').padStart(2, '0').slice(0, 2), '00');
    addCount(languages, row.lang || 'unknown');
    addCount(countries, row.country || 'unknown');
    addCount(regions, row.region || 'unknown');
    addCount(cities, [row.city, row.country].filter(Boolean).join('، ') || 'unknown');
    addCount(continents, row.continent || 'unknown');
    addCount(colos, row.colo || 'unknown');
  }

  const noteLines = [
    'تقرير يومي من Cloudflare Worker اعتمادًا على سجلات Cloudflare D1.',
    'البيانات مجهولة: لا يتم تخزين IP الكامل ولا اسم الشخص الحقيقي؛ يتم عرض البلد/المدينة التقريبية والمصدر والصفحة والجهاز عندما تكون متاحة.'
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
    generatedBy: 'cloudflare-worker-d1',
    note: noteLines.join('\n')
  };
}

async function runAnalyticsReport(env, options = {}) {
  const timezone = envValue(env, 'ANALYTICS_TIMEZONE', DEFAULT_TIMEZONE);
  const dateKey = options.date || envValue(env, 'REPORT_DATE') || shiftDateKey(localDateKey(new Date(), timezone), -1);
  const warnings = [];

  if (isUsingResendDevSender(env)) {
    warnings.push('REPORT_FROM يستخدم onboarding@resend.dev. هذا مناسب للاختبار فقط غالباً. للإرسال لأي بريد آخر استخدم دومين موثق في Resend.');
  }

  let rows = [];
  try {
    rows = await d1Query(env, `
      SELECT id, ts, local_date, local_hour, page, title, device, ua_device, lang, timezone, screen,
             referrer_host, visitor_hash, session_hash, ip_hash, country, region, city, continent, colo, cf_timezone
      FROM analytics_events
      WHERE local_date = ?
      ORDER BY ts ASC
    `, [dateKey]);
  } catch (error) {
    const message = String(error && error.message || error).toLowerCase();
    if (message.includes('no such table') || message.includes('analytics_events')) {
      warnings.push('جدول analytics_events غير موجود أو لم يتم إنشاؤه بعد. أول زيارة ناجحة عبر /api/track-visit تنشئ الجدول.');
      rows = [];
    } else {
      throw error;
    }
  }

  const summary = aggregateRows(rows, dateKey, timezone, warnings);
  const email = await sendResendMessage(env, {
    subject: `تقرير زيارات يومي - ${summary.periodLabel || summary.date}`,
    text: reportText(summary),
    html: reportHtml(summary)
  });

  const status = await putStatus(env, 'analytics-daily', {
    ok: true,
    type: 'analytics-daily',
    date: dateKey,
    timezone,
    totalPageviews: summary.totalPageviews,
    uniqueVisitors: summary.uniqueVisitors,
    sessions: summary.sessions,
    email,
    warnings
  });

  return { summary, email, status };
}

async function runFrequencyReport(env) {
  await ensureD1Tables(env);
  setFrequencyRuntimeContext({
    env,
    baseUrl: envValue(env, 'PUBLIC_BASE_URL', envValue(env, 'PAGES_BASE_URL', DEFAULT_BASE_URL))
  });

  const result = await runFrequencyUpdate({ sendEmail: true });
  const status = await putStatus(env, 'frequency-daily', {
    ok: true,
    type: 'frequency-daily',
    updatedAt: result.payload?.updatedAt || new Date().toISOString(),
    totalFrequencies: result.report?.totalFrequencies || result.payload?.count || 0,
    changes: result.report?.changes || result.payload?.changes || {},
    sourcesChecked: result.report?.sourcesChecked || 0,
    sourcesFailed: result.report?.sourcesFailed || 0,
    email: result.email
  });

  return { ...result, status };
}

async function runAll(env, trigger = 'manual') {
  await ensureD1Tables(env);
  const startedAt = new Date().toISOString();
  const results = {
    ok: true,
    trigger,
    startedAt,
    finishedAt: null,
    frequency: null,
    analytics: null,
    errors: []
  };

  try {
    const frequency = await runFrequencyReport(env);
    results.frequency = {
      ok: true,
      totalFrequencies: frequency.report?.totalFrequencies || frequency.payload?.count || 0,
      changes: frequency.report?.changes || frequency.payload?.changes || {},
      email: frequency.email
    };
  } catch (error) {
    results.ok = false;
    const message = String(error && (error.stack || error.message) || error);
    results.frequency = { ok: false, error: message.slice(0, 1500) };
    results.errors.push({ stage: 'frequency', error: message.slice(0, 1500) });
    await sendFailureEmail(env, 'frequency daily update', error).catch((mailError) => {
      console.error('[cloudflare-cron] Failure email failed:', mailError && mailError.message || mailError);
    });
  }

  try {
    const analytics = await runAnalyticsReport(env);
    results.analytics = {
      ok: true,
      date: analytics.summary.date,
      totalPageviews: analytics.summary.totalPageviews,
      uniqueVisitors: analytics.summary.uniqueVisitors,
      sessions: analytics.summary.sessions,
      email: analytics.email
    };
  } catch (error) {
    results.ok = false;
    const message = String(error && (error.stack || error.message) || error);
    results.analytics = { ok: false, error: message.slice(0, 1500) };
    results.errors.push({ stage: 'analytics', error: message.slice(0, 1500) });
    await sendFailureEmail(env, 'analytics daily report', error).catch((mailError) => {
      console.error('[cloudflare-cron] Failure email failed:', mailError && mailError.message || mailError);
    });
  }

  results.finishedAt = new Date().toISOString();
  await putStatus(env, 'daily-all', results);
  return results;
}

function isAuthorized(request, env) {
  const expected = envValue(env, 'CRON_ADMIN_TOKEN') || envValue(env, 'ANALYTICS_ADMIN_TOKEN') || envValue(env, 'FREQUENCY_ADMIN_TOKEN');
  if (!expected) return false;
  const url = new URL(request.url);
  const given = url.searchParams.get('token')
    || request.headers.get('x-cron-token')
    || request.headers.get('x-analytics-token')
    || request.headers.get('x-frequency-token');
  return given === expected;
}

async function statusPayload(env) {
  const [daily, frequency, analytics] = await Promise.all([
    getStatus(env, 'daily-all'),
    getStatus(env, 'frequency-daily'),
    getStatus(env, 'analytics-daily')
  ]);

  return {
    ok: true,
    worker: 'maen-cloudflare-daily-cron',
    timezone: envValue(env, 'ANALYTICS_TIMEZONE', DEFAULT_TIMEZONE),
    baseUrl: envValue(env, 'PUBLIC_BASE_URL', envValue(env, 'PAGES_BASE_URL', DEFAULT_BASE_URL)),
    hasD1: Boolean(env.MAEN_DB),
    hasFrequencyKV: Boolean(env.MAEN_FREQUENCY_KV),
    hasResend: Boolean(envValue(env, 'RESEND_API_KEY')),
    hasReportEmail: Boolean(envValue(env, 'REPORT_EMAIL')),
    latest: { daily, frequency, analytics }
  };
}

export default {
  async scheduled(event, env, ctx) {
    ctx.waitUntil(runAll(env, `cron:${event.cron}`));
  },

  async fetch(request, env) {
    const url = new URL(request.url);
    const method = request.method.toUpperCase();

    if (method === 'GET' && (url.pathname === '/' || url.pathname === '/status' || url.pathname === '/health')) {
      return json(await statusPayload(env));
    }

    if (method !== 'POST') {
      return json({ ok: false, error: 'Use POST for manual runs.' }, 405);
    }

    if (!isAuthorized(request, env)) {
      return json({ ok: false, error: 'Unauthorized. Set CRON_ADMIN_TOKEN and pass ?token=...' }, 401);
    }

    if (url.pathname === '/run/frequency') {
      try {
        const result = await runFrequencyReport(env);
        return json({ ok: true, totalFrequencies: result.report?.totalFrequencies || result.payload?.count || 0, changes: result.report?.changes || result.payload?.changes || {}, email: result.email, status: result.status });
      } catch (error) {
        await sendFailureEmail(env, 'manual frequency update', error).catch(() => {});
        return json({ ok: false, error: String(error && (error.stack || error.message) || error).slice(0, 3000) }, 500);
      }
    }

    if (url.pathname === '/run/analytics') {
      try {
        const date = url.searchParams.get('date') || '';
        const result = await runAnalyticsReport(env, { date });
        return json({ ok: true, date: result.summary.date, totalPageviews: result.summary.totalPageviews, uniqueVisitors: result.summary.uniqueVisitors, sessions: result.summary.sessions, email: result.email, status: result.status });
      } catch (error) {
        await sendFailureEmail(env, 'manual analytics report', error).catch(() => {});
        return json({ ok: false, error: String(error && (error.stack || error.message) || error).slice(0, 3000) }, 500);
      }
    }

    if (url.pathname === '/run/all' || url.pathname === '/run/daily') {
      return json(await runAll(env, 'manual-http'));
    }

    return json({ ok: false, error: 'Not found' }, 404);
  }
};
