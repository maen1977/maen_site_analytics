import fs from 'node:fs/promises';
import path from 'node:path';

const ROOT = process.cwd();
const INDEX_FILE = path.join(ROOT, 'public', 'index.html');
const SCRIPT_TAG = '<script src="/assets/worldcup-current-focus.js?v=20260615-auto"></script>';

function hasFocusScript(html) {
  return /\/assets\/worldcup-current-focus\.js(?:\?[^"']*)?/.test(html);
}

function injectBeforeBody(html) {
  if (hasFocusScript(html)) {
    return html.replace(
      /<script\s+src=["']\/assets\/worldcup-current-focus\.js(?:\?[^"']*)?["']\s*><\/script>/,
      SCRIPT_TAG
    );
  }

  if (/<\/body>/i.test(html)) {
    return html.replace(/<\/body>/i, `  ${SCRIPT_TAG}\n</body>`);
  }

  if (/<\/html>/i.test(html)) {
    return html.replace(/<\/html>/i, `${SCRIPT_TAG}\n</html>`);
  }

  return `${html.trimEnd()}\n${SCRIPT_TAG}\n`;
}

const html = await fs.readFile(INDEX_FILE, 'utf8');
const next = injectBeforeBody(html);

if (next === html) {
  console.log('[worldcup-focus-install] index.html already includes the current focus script.');
} else {
  await fs.writeFile(INDEX_FILE, next, 'utf8');
  console.log('[worldcup-focus-install] Added/updated worldcup-current-focus script tag in public/index.html');
}
