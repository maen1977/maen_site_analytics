import {
  FREQUENCY_REPORT_KEY,
  getFrequencyStore,
  jsonResponse,
  setRuntimeContext
} from '../_lib/frequency-utils.js';

async function staticFallback(request) {
  const url = new URL('/frequencies/latest-frequency-update-report.json', request.url);
  const response = await fetch(url.href, { cf: { cacheTtl: 0, cacheEverything: false } });
  const payload = await response.json().catch(() => ({ ok: false, error: 'Static fallback is not valid JSON' }));
  return jsonResponse({ ...payload, servedFrom: 'static-fallback' }, response.ok ? 200 : response.status);
}

export async function onRequestGet({ request, env }) {
  setRuntimeContext({ request, env });
  try {
    const store = getFrequencyStore();
    const live = await store.get(FREQUENCY_REPORT_KEY, { type: 'json' });
    if (live) {
      return jsonResponse({ ...live, servedFrom: 'cloudflare-live-frequency-cache' });
    }
  } catch (error) {
    console.warn('[frequency-report-api] live cache read failed:', error && error.message || error);
  }
  return staticFallback(request);
}
