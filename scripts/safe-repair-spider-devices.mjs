import fs from 'node:fs/promises';
import path from 'node:path';

const ROOT = process.cwd();

const PAGES = [
  path.join(ROOT, 'public', 'index.html'),
  path.join(ROOT, 'public', 'index_phone.html')
];

const SAFE_TAG =
  '<scr' + 'ipt src="/assets/spider-devices-safe-view-fix.js?v=20260615-safe2"></scr' + 'ipt>';

const BAD_SCRIPT_NAMES = [
  'spider-new-devices.js',
  'spider-devices-final-guard.js'
];

function removeBadScripts(html) {
  for (const name of BAD_SCRIPT_NAMES) {
    const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const re = new RegExp(`<script\\b[^>]*src=["'][^"']*${escaped}(?:\\?[^"']*)?["'][^>]*><\\/script>\\s*`, 'gi');
    html = html.replace(re, '');
  }

  html = html.replace(
    /<script\b[^>]*src=["'][^"']*spider-devices-safe-view-fix\.js(?:\?[^"']*)?["'][^>]*><\/script>\s*/gi,
    ''
  );

  return html;
}

function injectSafeScript(html) {
  if (/<\/body>/i.test(html)) {
    return html.replace(/<\/body>/i, `  ${SAFE_TAG}\n</body>`);
  }

  if (/<\/html>/i.test(html)) {
    return html.replace(/<\/html>/i, `${SAFE_TAG}\n</html>`);
  }

  return `${html.trimEnd()}\n${SAFE_TAG}\n`;
}

function fixDevicePrice(html, title, price) {
  const titleRe = title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

  html = html.replace(
    new RegExp(`(###\\s*${titleRe}[\\s\\S]{0,1200}?السعر\\s*)\\d+\\s*د\\.?\\s*[اأ]`, 'g'),
    `$1${price} د.أ`
  );

  html = html.replace(
    new RegExp(`(${titleRe}[^"'<>\n]*?بسعر\\s*)\\d+(\\s*دينار)`, 'g'),
    `$1${price}$2`
  );

  return html;
}

function fixEncodedWhatsapp(html) {
  html = html.replace(
    /(Spider%20T777%20Elite%20Master%20Plus[^"']*?%D8%A8%D8%B3%D8%B9%D8%B1%20)\d+/g,
    '$120'
  );

  html = html.replace(
    /(Spider%20T666%20Gold%2B%205G[^"']*?%D8%A8%D8%B3%D8%B9%D8%B1%20)\d+/g,
    '$130'
  );

  return html;
}

function fixImagePathByAlt(html, alt, src) {
  const altRe = alt.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

  return html.replace(
    new RegExp(`<img\\b([^>]*alt=["']${altRe}["'][^>]*)>`, 'gi'),
    (match, attrs) => {
      if (/src=/i.test(attrs)) {
        attrs = attrs.replace(/src=["'][^"']*["']/i, `src="${src}"`);
      } else {
        attrs = ` src="${src}"${attrs}`;
      }

      return `<img${attrs}>`;
    }
  );
}

function repair(html) {
  let next = html;

  next = removeBadScripts(next);
  next = fixDevicePrice(next, 'Spider T777 Elite Master Plus', 20);
  next = fixDevicePrice(next, 'Spider T666 Gold+ 5G', 30);
  next = fixEncodedWhatsapp(next);

  next = fixImagePathByAlt(next, 'Spider T777 Elite Master Plus', '/assets/devices/spider-t777-elite-master-plus.jpg');
  next = fixImagePathByAlt(next, 'Spider T666 Gold+ 5G', '/assets/devices/spider-t666-gold-plus-5g.jpg');

  next = injectSafeScript(next);

  return next;
}

let changed = 0;

for (const page of PAGES) {
  try {
    const before = await fs.readFile(page, 'utf8');
    const after = repair(before);

    if (after !== before) {
      await fs.writeFile(page, after, 'utf8');
      console.log(`[safe-repair] Updated ${path.relative(ROOT, page)}`);
      changed += 1;
    } else {
      console.log(`[safe-repair] No change needed for ${path.relative(ROOT, page)}`);
    }
  } catch (error) {
    console.warn(`[safe-repair] Skipped ${path.relative(ROOT, page)}: ${error.message}`);
  }
}

console.log(`[safe-repair] Done. Pages changed: ${changed}`);
console.log(SAFE_TAG);
