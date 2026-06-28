import fs from 'node:fs/promises';
import path from 'node:path';

const file = path.join(process.cwd(), 'public', '_headers');
const block = `
# MaenSat World Cup JSON live repair - do not cache tournament data
/worldcup-2026/*.json
  Cache-Control: no-store, no-cache, must-revalidate, max-age=0
  CDN-Cache-Control: no-store
  Cloudflare-CDN-Cache-Control: no-store

/worldcup-2026-live-fallback.js
  Cache-Control: no-cache, must-revalidate, max-age=0
`;

let current = '';
try { current = await fs.readFile(file, 'utf8'); } catch {}
if (!current.includes('/worldcup-2026/*.json')) {
  await fs.mkdir(path.dirname(file), { recursive: true });
  const out = (current.trimEnd() + '\n' + block.trim() + '\n').trimStart();
  await fs.writeFile(file, out, 'utf8');
  console.log('Updated public/_headers for World Cup JSON no-cache.');
} else {
  console.log('public/_headers already contains World Cup JSON cache rules.');
}
