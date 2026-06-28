import fs from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();
const scriptFile = 'worldcup-final-ui-fix.js';
const tag = `<script src="/${scriptFile}?v=20260628-final-ui-v2" defer></script>`;
const htmlFiles = [
  path.join(root, 'public', 'index.html'),
  path.join(root, 'public', 'index_phone.html')
];

async function exists(file) {
  try { await fs.access(file); return true; } catch { return false; }
}

function removeOldTags(html) {
  return html
    .replace(/\s*<script\b[^>]*worldcup-final-ui-fix\.js[^>]*><\/script>\s*/gi, '\n')
    .replace(/\s*<script\b[^>]*worldcup-2026-live-fallback\.js[^>]*><\/script>\s*/gi, '\n');
}

function injectTag(html) {
  html = removeOldTags(html);
  if (html.includes(`/${scriptFile}?v=20260628-final-ui-v2`)) return html;
  if (/<\/body\s*>/i.test(html)) return html.replace(/<\/body\s*>/i, `  ${tag}\n</body>`);
  if (/<\/html\s*>/i.test(html)) return html.replace(/<\/html\s*>/i, `  ${tag}\n</html>`);
  return `${html}\n${tag}\n`;
}

for (const file of htmlFiles) {
  if (!(await exists(file))) {
    console.log(`Skipped missing file: ${path.relative(root, file)}`);
    continue;
  }
  const before = await fs.readFile(file, 'utf8');
  const after = injectTag(before);
  if (after !== before) {
    await fs.writeFile(file, after, 'utf8');
    console.log(`Installed ${scriptFile} in ${path.relative(root, file)}`);
  } else {
    console.log(`${scriptFile} already installed in ${path.relative(root, file)}`);
  }
}

const headersPath = path.join(root, 'public', '_headers');
let headers = '';
if (await exists(headersPath)) headers = await fs.readFile(headersPath, 'utf8');
const block = `

# MaenSat World Cup 2026 live JSON/cache fix
/worldcup-2026/*.json
  Cache-Control: no-store, no-cache, must-revalidate, max-age=0

/${scriptFile}
  Cache-Control: no-store, no-cache, must-revalidate, max-age=0

/index.html
  Cache-Control: no-store, no-cache, must-revalidate, max-age=0

/index_phone.html
  Cache-Control: no-store, no-cache, must-revalidate, max-age=0
`;
if (!headers.includes('MaenSat World Cup 2026 live JSON/cache fix')) {
  await fs.writeFile(headersPath, headers.trimEnd() + block, 'utf8');
  console.log('Updated public/_headers cache rules.');
} else {
  console.log('Cache rules already exist in public/_headers.');
}

const markerDir = path.join(root, 'public', 'worldcup-2026');
await fs.mkdir(markerDir, { recursive: true });
await fs.writeFile(path.join(markerDir, 'final-ui-fix-marker.json'), JSON.stringify({
  ok: true,
  fix: 'worldcup-final-ui-fix',
  version: '2026-06-28-final-ui-v2',
  installed_at: new Date().toISOString(),
  note_ar: 'هذا الملف يؤكد تثبيت إصلاح واجهة تبويبات كأس العالم: المجموعات، أفضل الثوالث، الأدوار، كل المباريات، الأردن، اليوم.'
}, null, 2) + '\n', 'utf8');
console.log('Wrote public/worldcup-2026/final-ui-fix-marker.json');
