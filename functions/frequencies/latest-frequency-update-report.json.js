import {
  FREQUENCY_REPORT_KEY,
  getFrequencyStore,
  jsonResponse,
  setRuntimeContext
} from '../_lib/frequency-utils.js';

export async function onRequestGet({ request, env }) {
  setRuntimeContext({ request, env });
  try {
    const store = getFrequencyStore();
    const live = await store.get(FREQUENCY_REPORT_KEY, { type: 'json' });
    if (live) {
      return jsonResponse({ ...live, servedFrom: 'cloudflare-live-frequency-cache' });
    }
  } catch (error) {
    console.warn('[frequency-report-static-override] live cache read failed:', error && error.message || error);
  }

  if (env.ASSETS && typeof env.ASSETS.fetch === 'function') {
    return env.ASSETS.fetch(request);
  }
  return jsonResponse({ ok: false, error: 'No live report cache yet and static fallback is unavailable.' }, 503);
}
