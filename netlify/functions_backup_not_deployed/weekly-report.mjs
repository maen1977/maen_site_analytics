import {
  aggregateDateRange,
  jsonResponse,
  previousLocalDateKey,
  saveReport,
  sendEmailReport,
  shiftDateKey
} from "./_analytics-utils.mjs";

export const config = { schedule: "5 21 * * 0" };

export default async function handler() {
  // Runs weekly in UTC. At 21:05 UTC Sunday, Jordan is around 00:05 Monday when UTC+3.
  // The weekly report covers the last complete 7 local dates, Monday through Sunday.
  const endDate = previousLocalDateKey(new Date());
  const startDate = shiftDateKey(endDate, -6);
  const summary = await aggregateDateRange(startDate, endDate);
  await saveReport(summary);
  const email = await sendEmailReport(summary);

  return jsonResponse({ ok: true, period: summary.periodLabel, summary, email });
}
