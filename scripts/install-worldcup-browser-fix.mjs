import fs from 'node:fs/promises';
import path from 'node:path';

const file = path.join(process.cwd(), 'public', 'index.html');
const tag = '<script src="worldcup-2026-live-fallback.js?v=groups-repair-20260628" defer></script>';

let html = await fs.readFile(file, 'utf8');
if (html.includes('worldcup-2026-live-fallback.js')) {
  console.log('World Cup browser fallback already installed.');
  process.exit(0);
}

if (html.includes('</body>')) {
  html = html.replace('</body>', `  ${tag}\n</body>`);
} else {
  html += `\n${tag}\n`;
}
await fs.writeFile(file, html, 'utf8');
console.log('Installed World Cup browser fallback script tag in public/index.html.');
