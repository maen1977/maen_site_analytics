import {
  aggregateDate,
  jsonResponse,
  localDateKey,
  previousLocalDateKey,
  safeText,
  sendEmailReport
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
  return localDateKey();
}

export default async function handler(req) {
  if (!authorized(req)) {
    return jsonResponse({ ok: false, error: "Unauthorized. Open with ?token=YOUR_TOKEN" }, 401);
  }

  const date = resolveDate(req);
  const summary = await aggregateDate(date);
  const email = await sendEmailReport(summary);

  return jsonResponse({
    ok: Boolean(email.sent),
    date,
    to: process.env.REPORT_EMAIL || null,
    email,
    help: email.sent
      ? "Email sent. Check the inbox and spam folder."
      : "Email was not sent. Make sure RESEND_API_KEY is set in Netlify Environment variables."
  });
}
