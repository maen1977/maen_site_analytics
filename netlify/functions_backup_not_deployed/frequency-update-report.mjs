import { FREQUENCY_REPORT_KEY, authorized, getFrequencyStore, jsonResponse } from "./_frequency-utils.mjs";

export default async function handler(req) {
  if (!authorized(req)) return jsonResponse({ ok: false, error: "Unauthorized. Open with ?token=YOUR_TOKEN" }, 401);
  const store = getFrequencyStore();
  const report = await store.get(FREQUENCY_REPORT_KEY, { type: "json", consistency: "strong" });
  if (!report) return jsonResponse({ ok: false, error: "No frequency update report yet. Run run-frequency-update first or wait for the scheduled job." }, 404);
  return jsonResponse(report);
}
