import fs from 'node:fs/promises';
import path from 'node:path';

const ROOT = process.cwd();
const FILES = [
  path.join(ROOT, 'public', 'index.html'),
  path.join(ROOT, 'public', 'index_phone.html')
];

const FINAL_TAG = '<scr' + 'ipt src="/assets/spider-devices-final-guard.js?v=20260615-final"></scr' + 'ipt>';

function removeOldScripts(html) {
  return html
    .replace(/<script\b[^>]*src=["'][^"']*spider-new-devices\.js(?:\?[^"']*)?["'][^>]*><\/script>\s*/gi, '')
    .replace(/<script\b[^>]*src=["'][^"']*spider-devices-final-guard\.js(?:\?[^"']*)?["'][^>]*><\/script>\s*/gi, '');
}

function injectFinalTag(html) {
  if (/<\/body>/i.test(html)) {
    return html.replace(/<\/body>/i, `  ${FINAL_TAG}\n</body>`);
  }

  if (/<\/html>/i.test(html)) {
    return html.replace(/<\/html>/i, `${FINAL_TAG}\n</html>`);
  }

  return `${html.trimEnd()}\n${FINAL_TAG}\n`;
}

function fixPricesInText(html) {
  // T777 nearest text price.
  html = html.replace(
    /(Spider T777 Elite Master Plus[\s\S]{0,2500}?السعر\s*)\d+\s*د\.?\s*[اأ]/g,
    '$120 د.أ'
  );

  // T666 nearest text price.
  html = html.replace(
    /(Spider T666 Gold\+ 5G[\s\S]{0,2500}?السعر\s*)\d+\s*د\.?\s*[اأ]/g,
    '$130 د.أ'
  );

  // WhatsApp messages, plain and URL encoded.
  html = html
    .replace(/(Spider T777 Elite Master Plus[^"'<>\n]*?بسعر\s*)\d+(\s*دينار)/g, '$120$2')
    .replace(/(Spider T666 Gold\+ 5G[^"'<>\n]*?بسعر\s*)\d+(\s*دينار)/g, '$130$2')
    .replace(/(Spider%20T777%20Elite%20Master%20Plus[^"']*?%D8%A8%D8%B3%D8%B9%D8%B1%20)\d+/g, '$120')
    .replace(/(Spider%20T666%20Gold%2B%205G[^"']*?%D8%A8%D8%B3%D8%B9%D8%B1%20)\d+/g, '$130');

  return html;
}

function fixImagePaths(html) {
  // If an img has alt/title for the new devices, force its src to the cleaned brochure.
  html = html.replace(
    /<img\b([^>]*alt=["']Spider T777 Elite Master Plus["'][^>]*)>/gi,
    (match, attrs) => {
      if (/src=/i.test(attrs)) {
        attrs = attrs.replace(/src=["'][^"']*["']/i, 'src="/assets/devices/spider-t777-elite-master-plus.jpg"');
      } else {
        attrs = ` src="/assets/devices/spider-t777-elite-master-plus.jpg"${attrs}`;
      }
      return `<img${attrs}>`;
    }
  );

  html = html.replace(
    /<img\b([^>]*alt=["']Spider T666 Gold\+ 5G["'][^>]*)>/gi,
    (match, attrs) => {
      if (/src=/i.test(attrs)) {
        attrs = attrs.replace(/src=["'][^"']*["']/i, 'src="/assets/devices/spider-t666-gold-plus-5g.jpg"');
      } else {
        attrs = ` src="/assets/devices/spider-t666-gold-plus-5g.jpg"${attrs}`;
      }
      return `<img${attrs}>`;
    }
  );

  return html;
}

function normalize(html) {
  let next = html;
  next = removeOldScripts(next);
  next = fixPricesInText(next);
  next = fixImagePaths(next);
  next = injectFinalTag(next);
  return next;
}

let changed = 0;

for (const file of FILES) {
  try {
    const before = await fs.readFile(file, 'utf8');
    const after = normalize(before);

    if (after !== before) {
      await fs.writeFile(file, after, 'utf8');
      console.log(`[spider-final-cleanup] Updated ${path.relative(ROOT, file)}`);
      changed += 1;
    } else {
      console.log(`[spider-final-cleanup] No change needed for ${path.relative(ROOT, file)}`);
    }
  } catch (error) {
    console.warn(`[spider-final-cleanup] Skipped ${path.relative(ROOT, file)}: ${error.message}`);
  }
}

console.log(`[spider-final-cleanup] Done. Files changed: ${changed}`);
console.log(FINAL_TAG);
