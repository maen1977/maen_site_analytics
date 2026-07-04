// MaenSat Cloudflare Pages middleware
// Injects the World Cup live status DOM guard into HTML pages so the visible cards
// cannot remain "لم تبدأ" when a match is already live or has a live score.

const GUARD_SRC = '/worldcup-live-status-dom-guard.js?v=20260703-extra-time-penalty-priority-v2';

export async function onRequest(context) {
  const response = await context.next();
  const contentType = response.headers.get('content-type') || '';

  if (!contentType.toLowerCase().includes('text/html')) {
    return response;
  }

  let html = await response.text();

  if (!html.includes('worldcup-live-status-dom-guard.js')) {
    const script = `<script defer src="${GUARD_SRC}"></script>`;
    if (html.includes('</body>')) {
      html = html.replace('</body>', `${script}\n</body>`);
    } else {
      html += `\n${script}\n`;
    }
  }

  const headers = new Headers(response.headers);
  headers.set('cache-control', 'no-store, no-cache, must-revalidate, max-age=0');
  headers.delete('content-length');

  return new Response(html, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}
