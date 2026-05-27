import { jsonResponse, runFrequencyUpdate } from "./_frequency-utils.mjs";

export default async function handler() {
  const { payload, report, email } = await runFrequencyUpdate({ sendEmail: true });
  return jsonResponse({ ok: true, updatedAt: payload.updatedAt, count: payload.count, changes: payload.changes, report, email });
}
