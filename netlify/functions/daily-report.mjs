import {
  aggregateDate,
  jsonResponse,
  previousLocalDateKey,
  saveReport,
  sendEmailReport
} from "./_analytics-utils.mjs";

export default async function handler(req) {
  // Netlify scheduled functions run in UTC, while the report date is calculated in ANALYTICS_TIMEZONE.
  const date = previousLocalDateKey(new Date());
  const summary = await aggregateDate(date);
  await saveReport(summary);
  const email = await sendEmailReport(summary);

  return jsonResponse({ ok: true, date, summary, email });
}
