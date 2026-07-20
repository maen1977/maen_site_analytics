// World Cup 2026 automatic dispatcher disabled after the tournament ended.
// This worker intentionally does not call GitHub Actions anymore.

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store'
    }
  });
}

export default {
  async scheduled() {
    // Intentionally disabled: no quarter-hour GitHub dispatch.
  },

  async fetch(request) {
    const url = new URL(request.url);

    if (url.pathname === '/health') {
      return jsonResponse({
        ok: true,
        disabled: true,
        service: 'maensat-worldcup-cloudflare-cron',
        message: 'World Cup 2026 automatic updates are disabled because the tournament ended.',
        now: new Date().toISOString()
      });
    }

    if (url.pathname === '/run') {
      return jsonResponse({
        ok: false,
        disabled: true,
        error: 'World Cup 2026 updates are permanently disabled.'
      }, 410);
    }

    return jsonResponse({
      ok: false,
      disabled: true,
      error: 'World Cup 2026 updater is disabled. Use /health.'
    }, 404);
  }
};
