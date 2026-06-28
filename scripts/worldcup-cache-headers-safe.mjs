import fs from 'node:fs/promises';
import path from 'node:path';

const ROOT = process.cwd();
const HEADERS_FILE = path.join(ROOT, 'public', '_headers');
const BLOCK_START = '# MaenSat World Cup 2026 live JSON no-cache - start';
const BLOCK_END = '# MaenSat World Cup 2026 live JSON no-cache - end';
const BLOCK = `${BLOCK_START}
/worldcup-2026/*.json
  Cache-Control: no-store, no-cache, must-revalidate, max-age=0
  CDN-Cache-Control: no-store
  Cloudflare-CDN-Cache-Control: no-store
/worldcup-2026/*.txt
  Cache-Control: no-store, no-cache, must-revalidate, max-age=0
  CDN-Cache-Control: no-store
  Cloudflare-CDN-Cache-Control: no-store
${BLOCK_END}`;

async function main() {
  let existing = '';
  try {
    existing = await fs.readFile(HEADERS_FILE, 'utf8');
  } catch {
    existing = '';
  }
  const withoutOldBlock = existing
    .replace(new RegExp(`${escapeRegExp(BLOCK_START)}[\\s\\S]*?${escapeRegExp(BLOCK_END)}\\s*`, 'g'), '')
    .trimEnd();
  const next = `${withoutOldBlock}${withoutOldBlock ? '\n\n' : ''}${BLOCK}\n`;
  if (next !== existing) {
    await fs.mkdir(path.dirname(HEADERS_FILE), { recursive: true });
    await fs.writeFile(HEADERS_FILE, next);
    console.log('[worldcup-cache] public/_headers updated with no-cache rules for /worldcup-2026/*.json');
  } else {
    console.log('[worldcup-cache] public/_headers already contains World Cup no-cache rules');
  }
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

main().catch((error) => {
  console.error('[worldcup-cache] failed:', error);
  process.exitCode = 1;
});
