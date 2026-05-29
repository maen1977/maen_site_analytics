import { FREQUENCY_DATA_KEY, FREQUENCY_DATA_VERSION, getFrequencyStore, jsonResponse, readBaselineData, readSources, JORDAN_MENA_SATELLITES } from "./_frequency-utils.mjs";

export default async function handler(req) {
  try {
    const url = new URL(req.url);
    if (url.searchParams.get("baseline") === "1") {
      const baseline = await readBaselineData();
      return jsonResponse({ ...baseline, satellites: JORDAN_MENA_SATELLITES, sources: await readSources(), servedFrom: "baseline" });
    }
    const store = getFrequencyStore();
    const live = await store.get(FREQUENCY_DATA_KEY, { type: "json", consistency: "strong" });
    if (live && Array.isArray(live.items) && live.items.length && live.version === FREQUENCY_DATA_VERSION) {
      return jsonResponse({ ...live, satellites: JORDAN_MENA_SATELLITES, servedFrom: "netlify-blobs" });
    }
    const baseline = await readBaselineData();
    return jsonResponse({ ...baseline, satellites: JORDAN_MENA_SATELLITES, sources: await readSources(), servedFrom: "baseline" });
  } catch (error) {
    return jsonResponse({ ok: false, error: String(error && error.message || error) }, 500);
  }
}
