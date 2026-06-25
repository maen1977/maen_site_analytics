// Cloudflare Pages Advanced Mode Worker
// هدفه الوحيد: تمرير ملفات الموقع كما هي، وحقن سكربت إصلاح قسم كأس العالم داخل صفحات HTML.
// ضع هذا الملف داخل: public/_worker.js

const HOTFIX_SCRIPT = '<script defer src="/worldcup-2026-today-fix.js?v=20260625-1"></script>';

export default {
  async fetch(request, env) {
    const response = await env.ASSETS.fetch(request);

    const url = new URL(request.url);
    const contentType = response.headers.get('content-type') || '';
    const isHtml = contentType.includes('text/html');
    const isMainPage =
      url.pathname === '/' ||
      url.pathname === '/index.html' ||
      url.pathname === '/index_phone.html' ||
      url.pathname.endsWith('.html');

    if (!isHtml || !isMainPage) {
      return response;
    }

    let html = await response.text();

    // لا نكرر الحقن إذا كان السكربت موجوداً مسبقاً.
    if (!html.includes('/worldcup-2026-today-fix.js')) {
      if (html.includes('</body>')) {
        html = html.replace('</body>', `${HOTFIX_SCRIPT}\n</body>`);
      } else {
        html += HOTFIX_SCRIPT;
      }
    }

    const headers = new Headers(response.headers);
    headers.set('content-type', 'text/html; charset=UTF-8');
    headers.delete('content-length');

    return new Response(html, {
      status: response.status,
      statusText: response.statusText,
      headers,
    });
  },
};
