import fs from 'node:fs/promises';
import path from 'node:path';

const ROOT = process.cwd();
const INDEX_FILE = path.join(ROOT, 'public', 'index.html');

// Build the script tag by concatenation so no editor/sanitizer strips it.
const SCRIPT_TAG =
  '<scr' + 'ipt src="/assets/worldcup-current-focus.js?v=20260615-v2"></scr' + 'ipt>';

function hasFocusScript(html) {
  return /\/assets\/worldcup-current-focus\.js(?:\?[^"']*)?/.test(html);
}

function replaceOldFocusScript(html) {
  return html.replace(
    /<script\b[^>]*src=["']\/assets\/worldcup-current-focus\.js(?:\?[^"']*)?["'][^>]*><\/script>/gi,
    SCRIPT_TAG
  );
}

function inject(html) {
  if (hasFocusScript(html)) {
    return replaceOldFocusScript(html);
  }

  if (/<\/body>/i.test(html)) {
    return html.replace(/<\/body>/i, `  ${SCRIPT_TAG}\n</body>`);
  }

  if (/<\/html>/i.test(html)) {
    return html.replace(/<\/html>/i, `${SCRIPT_TAG}\n</html>`);
  }

  return `${html.trimEnd()}\n${SCRIPT_TAG}\n`;
}

const original = await fs.readFile(INDEX_FILE, 'utf8');
const next = inject(original);

if (next === original) {
  console.log('[worldcup-focus-install] No index.html changes needed.');
} else {
  await fs.writeFile(INDEX_FILE, next, 'utf8');
  console.log('[worldcup-focus-install] Installed script tag in public/index.html');
  console.log(SCRIPT_TAG);
}
