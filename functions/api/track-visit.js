import { corsHeaders, hashId, jsonResponse, localDateKey, localHour, referrerHost, safePage, safeText, saveAnalyticsRecord, uaDevice } from "../_lib/analytics.js";

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

function cfValue(cf, key, max = 120) {
  return safeText(cf && cf[key] !== undefined && cf[key] !== null ? cf[key] : "", max);
}

export async function onRequestPost({ request, env }) {
  const cors = corsHeaders(request, env);
  const contentLength = Number(request.headers.get("content-length") || 0);
  if (contentLength > 6000) return jsonResponse({ ok: false, error: "Payload too large" }, 413, cors);

  let payload = {};
  try {
    const raw = await request.text();
    if (raw.length > 6000) return jsonResponse({ ok: false, error: "Payload too large" }, 413, cors);
    payload = raw ? JSON.parse(raw) : {};
  } catch {
    return jsonResponse({ ok: false, error: "Invalid JSON" }, 400, cors);
  }

  const now = new Date();
  const localDate = localDateKey(now, env);
  const userAgent = request.headers.get("user-agent") || "";
  const ip = request.headers.get("cf-connecting-ip") || request.headers.get("x-forwarded-for") || "anonymous";
  const cf = request.cf || {};
  const record = {
    id: crypto.randomUUID(),
    ts: now.toISOString(),
    localDate,
    localHour: localHour(now, env),
    page: safePage(payload.page),
    title: safeText(payload.title, 180),
    device: ["mobile", "desktop", "tablet"].includes(payload.device) ? payload.device : uaDevice(userAgent),
    uaDevice: uaDevice(userAgent),
    lang: safeText(payload.lang, 40),
    timezone: safeText(payload.timezone, 80),
    screen: safeText(payload.screen, 40),
    referrerHost: referrerHost(payload.referrer),
    visitorHash: await hashId(payload.visitorId || ip, "visitor", env),
    sessionHash: await hashId(payload.sessionId || payload.visitorId || "anonymous", "session", env),
    ipHash: await hashId(ip, "ip", env),
    country: safeText(cf.country || request.headers.get("cf-ipcountry") || "unknown", 40),
    region: cfValue(cf, "region", 80),
    city: cfValue(cf, "city", 80),
    continent: cfValue(cf, "continent", 20),
    colo: cfValue(cf, "colo", 20),
    cfTimezone: cfValue(cf, "timezone", 80)
  };

  const storage = await saveAnalyticsRecord(env, record);
  return jsonResponse({ ok: true, ...storage }, 200, cors);
}

export async function onRequest() {
  return jsonResponse({ ok: false, error: "Method not allowed" }, 405);
}
