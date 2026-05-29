import {
  aggregateDate,
  jsonResponse,
  previousLocalDateKey,
  saveReport,
  sendEmailReport
} from "./_analytics-utils.mjs";

export default async function handler(req) {
  // Manual fallback: the scheduled email report now uses weekly-report.mjs. This still generates yesterday's one-day report if opened manually.
  const date = previousLocalDateKey(new Date());
  const summary = await aggregateDate(date);
  await saveReport(summary);
  const email = await sendEmailReport(summary);

  return jsonResponse({ ok: true, date, summary, email });
}
