import fs from 'node:fs/promises';
import path from 'node:path';

const ROOT = process.cwd();

const FILES = [
  path.join(ROOT, 'public', 'index.html'),
  path.join(ROOT, 'public', 'index_phone.html')
];

const SCRIPT_TAG =
  '<scr' + 'ipt src="/assets/spider-new-devices.js?v=20260615-devices"></scr' + 'ipt>';

function hasScript(html) {
  return /\/assets\/spider-new-devices\.js(?:\?[^"']*)?/.test(html);
}

function replaceExisting(html) {
  return html.replace(
    /<script\b[^>]*src=["']\/assets\/spider-new-devices\.js(?:\?[^"']*)?["'][^>]*><\/script>/gi,
    SCRIPT_TAG
  );
}

function inject(html) {
  if (hasScript(html)) return replaceExisting(html);

  if (/<\/body>/i.test(html)) {
    return html.replace(/<\/body>/i, `  ${SCRIPT_TAG}\n</body>`);
  }

  if (/<\/html>/i.test(html)) {
    return html.replace(/<\/html>/i, `${SCRIPT_TAG}\n</html>`);
  }

  return `${html.trimEnd()}\n${SCRIPT_TAG}\n`;
}

let changed = 0;

for (const file of FILES) {
  try {
    const before = await fs.readFile(file, 'utf8');
    const after = inject(before);

    if (after !== before) {
      await fs.writeFile(file, after, 'utf8');
      console.log(`[spider-devices-install] Updated ${path.relative(ROOT, file)}`);
      changed += 1;
    } else {
      console.log(`[spider-devices-install] No change needed for ${path.relative(ROOT, file)}`);
    }
  } catch (error) {
    console.warn(`[spider-devices-install] Skipped ${path.relative(ROOT, file)}: ${error.message}`);
  }
}

console.log(`[spider-devices-install] Done. Files changed: ${changed}`);
console.log(SCRIPT_TAG);
