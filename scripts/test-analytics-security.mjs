import assert from 'node:assert/strict';
import { corsHeaders, safePage, safeText } from '../functions/_lib/analytics.js';

function request(origin, url = 'https://maensat.pages.dev/api/track-event') {
  const headers = origin ? { origin } : {};
  return new Request(url, { headers });
}

assert.deepEqual(corsHeaders(request('https://maensat.pages.dev')), {
  'access-control-allow-origin': 'https://maensat.pages.dev',
  vary: 'origin'
});
assert.deepEqual(corsHeaders(request('https://evil.example')), {});
assert.deepEqual(corsHeaders(request('https://partner.example'), { ALLOWED_ORIGIN: 'https://partner.example' }), {
  'access-control-allow-origin': 'https://partner.example',
  vary: 'origin'
});
assert.deepEqual(corsHeaders(request('https://evil.example'), { ALLOWED_ORIGIN: 'https://partner.example' }), {});
assert.deepEqual(corsHeaders(request('')), {});
assert.equal(safeText('<script>alert(1)</script>\u0000', 240), '<script>alert(1)</script>');
assert.equal(safePage('https://evil.example/a?b=1#c'), '/a?b=1#c');
assert.equal(safePage('javascript:alert(1)'), '/javascript:alert(1)');

console.log('✓ analytics CORS fails closed for cross-origin requests and input helpers stay bounded');
