import { authorized, jsonResponse, runFrequencyUpdate } from "./_frequency-utils.mjs";

export default async function handler(req) {
  if (!authorized(req)) return jsonResponse({ ok: false, error: "Unauthorized. Open with ?token=YOUR_TOKEN" }, 401);
  const url = new URL(req.url);
  const sendEmail = url.searchParams.get("email") !== "0";
  const { payload, report, email } = await runFrequencyUpdate({ sendEmail });
  return jsonResponse({ ok: true, updatedAt: payload.updatedAt, count: payload.count, changes: payload.changes, sourceResults: payload.sourceResults, reviewedOnly: payload.reviewedOnly.slice(0, 20), report, email });
}
