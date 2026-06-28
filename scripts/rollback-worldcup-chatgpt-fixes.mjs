import fs from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();
const rel = (...p) => path.join(root, ...p);

const filesToRemove = [
  '.github/workflows/repair-worldcup-groups-live.yml',
  '.github/workflows/maensat-worldcup-final-ui-fix.yml',
  '.github/workflows/rollback-worldcup-chatgpt-fixes.yml',
  'scripts/repair-worldcup-groups-live.mjs',
  'scripts/install-worldcup-cache-headers.mjs',
  'scripts/install-worldcup-browser-fix.mjs',
  'scripts/install-worldcup-final-ui-fix.mjs',
  'scripts/rollback-worldcup-chatgpt-fixes.mjs',
  'public/worldcup-2026-live-fallback.js',
  'public/worldcup-final-ui-fix.js',
  'public/worldcup-2026/final-ui-fix-marker.json'
];

async function exists(file) {
  try { await fs.access(file); return true; } catch { return false; }
}

async function removeFile(relativePath) {
  const file = rel(...relativePath.split('/'));
  if (!(await exists(file))) {
    console.log(`skip missing: ${relativePath}`);
    return false;
  }
  await fs.rm(file, { force: true });
  console.log(`removed: ${relativePath}`);
  return true;
}

function cleanupHtml(html) {
  return html
    // Remove injected ChatGPT World Cup fallback/final UI script tags only.
    .replace(/[ \t]*<script\b[^>]*worldcup-2026-live-fallback\.js[^>]*><\/script>[ \t]*\r?\n?/gi, '')
    .replace(/[ \t]*<script\b[^>]*worldcup-final-ui-fix\.js[^>]*><\/script>[ \t]*\r?\n?/gi, '')
    // Remove accidental double blank runs caused by deletion.
    .replace(/\n{4,}/g, '\n\n\n');
}

function cleanupHeaders(text) {
  let out = text;
  // Block from maensat_worldcup_groups_fix.zip
  out = out.replace(/\n?# MaenSat World Cup JSON live repair - do not cache tournament data\r?\n\/worldcup-2026\/\*\.json\r?\n(?:[ \t].*\r?\n)+\r?\n?\/worldcup-2026-live-fallback\.js\r?\n(?:[ \t].*\r?\n)+/gi, '\n');
  // Block from maensat_worldcup_final_ui_fix.zip
  out = out.replace(/\n?# MaenSat World Cup 2026 live JSON\/cache fix\r?\n\/worldcup-2026\/\*\.json\r?\n(?:[ \t].*\r?\n)+\r?\n?\/worldcup-final-ui-fix\.js\r?\n(?:[ \t].*\r?\n)+\r?\n?\/index\.html\r?\n(?:[ \t].*\r?\n)+\r?\n?\/index_phone\.html\r?\n(?:[ \t].*\r?\n)+/gi, '\n');
  // Extra conservative line-by-line cleanup for only the injected routes if regex misses.
  const lines = out.split(/\r?\n/);
  const cleaned = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (/MaenSat World Cup JSON live repair|MaenSat World Cup 2026 live JSON\/cache fix/.test(line)) continue;
    if (/^\/(worldcup-2026-live-fallback\.js|worldcup-final-ui-fix\.js)\s*$/.test(line)) {
      // skip this route and its indented cache-control lines
      while (i + 1 < lines.length && /^\s+/.test(lines[i + 1])) i++;
      continue;
    }
    cleaned.push(line);
  }
  out = cleaned.join('\n').replace(/\n{4,}/g, '\n\n\n').trimEnd() + '\n';
  return out;
}

let changed = false;

for (const f of filesToRemove) {
  const removed = await removeFile(f);
  if (removed) changed = true;
}

for (const htmlRel of ['public/index.html', 'public/index_phone.html']) {
  const file = rel(...htmlRel.split('/'));
  if (!(await exists(file))) {
    console.log(`skip missing html: ${htmlRel}`);
    continue;
  }
  const before = await fs.readFile(file, 'utf8');
  const after = cleanupHtml(before);
  if (after !== before) {
    await fs.writeFile(file, after, 'utf8');
    console.log(`cleaned injected script tags: ${htmlRel}`);
    changed = true;
  } else {
    console.log(`no injected script tags found: ${htmlRel}`);
  }
}

const headersPath = rel('public', '_headers');
if (await exists(headersPath)) {
  const before = await fs.readFile(headersPath, 'utf8');
  const after = cleanupHeaders(before);
  if (after !== before) {
    await fs.writeFile(headersPath, after, 'utf8');
    console.log('cleaned injected World Cup cache rules: public/_headers');
    changed = true;
  } else {
    console.log('no injected World Cup cache rules found in public/_headers');
  }
}

console.log(changed ? 'Rollback cleanup completed.' : 'Nothing from the ChatGPT World Cup fixes was found to remove.');
