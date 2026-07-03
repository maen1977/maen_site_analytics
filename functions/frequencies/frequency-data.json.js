import {
  FREQUENCY_DATA_KEY,
  getFrequencyStore,
  jsonResponse,
  setRuntimeContext
} from '../_lib/frequency-utils.js';

export async function onRequestGet({ request, env }) {
  setRuntimeContext({ request, env });
  try {
    const store = getFrequencyStore();
    const live = await store.get(FREQUENCY_DATA_KEY, { type: 'json' });
    if (live && Array.isArray(live.items)) {
      return jsonResponse({ ...live, servedFrom: 'cloudflare-live-frequency-cache' });
    }
  } catch (error) {
    console.warn('[frequency-static-override] live cache read failed:', error && error.message || error);
  }

  if (env.ASSETS && typeof env.ASSETS.fetch === 'function') {
    return env.ASSETS.fetch(request);
  }
  return jsonResponse({ ok: false, error: 'No live frequency cache yet and static fallback is unavailable.' }, 503);
}
