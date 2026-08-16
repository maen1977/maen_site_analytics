import {
  corsHeaders,
  jsonResponse,
  localDateKey,
  localHour,
  safePage,
  safeText,
  saveAnalyticsRecord,
  hashId,
  uaDevice
} from "../_lib/analytics.js";

export async function onRequestOptions({ request, env }) {
  return new Response(null, {
    status: 204,
    headers: {
      ...corsHeaders(request, env),
      "access-control-allow-methods": "POST, OPTIONS",
      "access-control-allow-headers": "content-type",
      "access-control-max-age": "86400"
    }
  });
}

export async function onRequestPost({ request, env }) {
  const cors = corsHeaders(request, env);
  let payload = {};
  try {
    const raw = await request.text();
    if (raw.length > 5000) return jsonResponse({ ok: false, error: "Payload too large" }, 413, cors);
    payload = raw ? JSON.parse(raw) : {};
  } catch {
    return jsonResponse({ ok: false, error: "Invalid JSON" }, 400, cors);
  }

  const eventType = safeText(payload.eventType, 80).replace(/[^a-zA-Z0-9_-]/g, "_");
  if (!eventType) return jsonResponse({ ok: false, error: "Missing eventType" }, 400, cors);

  const now = new Date();
  const userAgent = request.headers.get("user-agent") || "";
  const ip = request.headers.get("cf-connecting-ip") || request.headers.get("x-forwarded-for") || "anonymous";
  const cf = request.cf || {};
  const record = {
    id: crypto.randomUUID(),
    ts: now.toISOString(),
    localDate: localDateKey(now, env),
    localHour: localHour(now, env),
    page: safePage(payload.page || "/"),
    title: safeText(payload.title, 180),
    device: ["mobile", "desktop", "tablet"].includes(payload.device) ? payload.device : uaDevice(userAgent),
    uaDevice: uaDevice(userAgent),
    lang: safeText(payload.lang, 40),
    timezone: safeText(payload.timezone, 80),
    screen: safeText(payload.screen, 40),
    referrerHost: "event",
    visitorHash: await hashId(payload.visitorId || ip, "visitor", env),
    sessionHash: await hashId(payload.sessionId || payload.visitorId || "anonymous", "session", env),
    ipHash: await hashId(ip, "ip", env),
    country: safeText(cf.country || request.headers.get("cf-ipcountry") || "unknown", 40),
    region: safeText(cf.region || "", 80),
    city: safeText(cf.city || "", 80),
    continent: safeText(cf.continent || "", 20),
    colo: safeText(cf.colo || "", 20),
    cfTimezone: safeText(cf.timezone || "", 80),
    eventType,
    eventData: JSON.stringify(payload.data || {}).slice(0, 1200)
  };

  const storage = await saveAnalyticsRecord(env, record);
  return jsonResponse({ ok: true, ...storage }, 200, cors);
}

export async function onRequest() {
  return jsonResponse({ ok: false, error: "Method not allowed" }, 405);
}
