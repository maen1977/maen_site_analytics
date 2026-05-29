import { randomUUID } from "node:crypto";
import {
  corsHeaders,
  getStoreSafe,
  hashId,
  jsonResponse,
  localDateKey,
  localHour,
  referrerHost,
  safePage,
  safeText
} from "./_analytics-utils.mjs";

function uaDevice(userAgent) {
  const ua = String(userAgent || "").toLowerCase();
  if (/tablet|ipad/.test(ua)) return "tablet";
  if (/mobi|android|iphone|phone/.test(ua)) return "mobile";
  if (!ua) return "unknown";
  return "desktop";
}

export default async function handler(req) {
  const cors = corsHeaders(req);

  if (req.method === "OPTIONS") {
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

  if (req.method !== "POST") {
    return jsonResponse({ ok: false, error: "Method not allowed" }, 405, cors);
  }

  const contentLength = Number(req.headers.get("content-length") || 0);
  if (contentLength > 6000) {
    return jsonResponse({ ok: false, error: "Payload too large" }, 413, cors);
  }

  let payload = {};
  try {
    const raw = await req.text();
    if (raw.length > 6000) return jsonResponse({ ok: false, error: "Payload too large" }, 413, cors);
    payload = raw ? JSON.parse(raw) : {};
  } catch {
    return jsonResponse({ ok: false, error: "Invalid JSON" }, 400, cors);
  }

  const now = new Date();
  const localDate = localDateKey(now);
  const record = {
    id: randomUUID(),
    ts: now.toISOString(),
    localDate,
    localHour: localHour(now),
    page: safePage(payload.page),
    title: safeText(payload.title, 180),
    device: ["mobile", "desktop", "tablet"].includes(payload.device) ? payload.device : uaDevice(req.headers.get("user-agent")),
    uaDevice: uaDevice(req.headers.get("user-agent")),
    lang: safeText(payload.lang, 40),
    timezone: safeText(payload.timezone, 80),
    screen: safeText(payload.screen, 40),
    referrerHost: referrerHost(payload.referrer),
    visitorHash: hashId(payload.visitorId || req.headers.get("x-nf-client-connection-ip") || "anonymous", "visitor"),
    sessionHash: hashId(payload.sessionId || payload.visitorId || "anonymous", "session")
  };

  const store = getStoreSafe();
  const key = `events/${localDate}/${Date.now()}-${record.id}.json`;
  await store.setJSON(key, record);

  return jsonResponse({ ok: true }, 200, cors);
}
