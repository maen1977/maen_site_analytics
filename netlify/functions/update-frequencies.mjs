import { jsonResponse, runFrequencyUpdate } from "./_frequency-utils.mjs";

export const config = { schedule: "30 20 * * 0" };

export default async function handler() {
  const { payload, report, email } = await runFrequencyUpdate({ sendEmail: true });
  return jsonResponse({ ok: true, updatedAt: payload.updatedAt, count: payload.count, groupCounts: payload.groupCounts, changes: payload.changes, report, email });
}
