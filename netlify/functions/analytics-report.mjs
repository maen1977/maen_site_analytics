import {
  aggregateDate,
  aggregateDateRange,
  jsonResponse,
  localDateKey,
  previousLocalDateKey,
  reportHtml,
  reportText,
  safeText,
  shiftDateKey
} from "./_analytics-utils.mjs";

function authorized(req) {
  const token = process.env.ANALYTICS_ADMIN_TOKEN || "";
  if (!token) return false;
  const url = new URL(req.url);
  const given = url.searchParams.get("token") || req.headers.get("x-analytics-token") || "";
  return given === token;
}

function resolveDate(req) {
  const url = new URL(req.url);
  const explicit = safeText(url.searchParams.get("date"), 10);
  if (/^\d{4}-\d{2}-\d{2}$/.test(explicit)) return explicit;
  const day = url.searchParams.get("day") || "today";
  if (day === "yesterday") return previousLocalDateKey();
  if (day === "tomorrow") return shiftDateKey(localDateKey(), 1);
  return localDateKey();
}

export default async function handler(req) {
  if (!authorized(req)) {
    return jsonResponse({ ok: false, error: "Unauthorized. Set ANALYTICS_ADMIN_TOKEN in Netlify and open with ?token=YOUR_TOKEN" }, 401);
  }

  const url = new URL(req.url);
  const date = resolveDate(req);
  const period = url.searchParams.get("period") || "day";
  const summary = period === "week"
    ? await aggregateDateRange(shiftDateKey(date, -6), date)
    : await aggregateDate(date);
  const format = url.searchParams.get("format") || "html";

  if (format === "json") return jsonResponse(summary);
  if (format === "text") {
    return new Response(reportText(summary), {
      headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store" }
    });
  }
  return new Response(reportHtml(summary), {
    headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" }
  });
}
