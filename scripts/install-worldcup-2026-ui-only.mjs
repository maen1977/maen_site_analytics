#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const SCRIPT_SRC = '/worldcup-2026/worldcup-knockout-ui-only.js?v=20260628-ui-only';
const START = '<!-- MaenSat World Cup 2026 UI-only knockout start -->';
const END = '<!-- MaenSat World Cup 2026 UI-only knockout end -->';
const BLOCK = `${START}\n<script src="${SCRIPT_SRC}" defer></script>\n${END}`;

const OLD_MARKER_BLOCKS = [
  ['<!-- MaenSat World Cup knockout live cards start -->', '<!-- MaenSat World Cup knockout live cards end -->'],
  ['<!-- MaenSat World Cup final UI fix start -->', '<!-- MaenSat World Cup final UI fix end -->'],
  ['<!-- MaenSat World Cup 2026 live fallback start -->', '<!-- MaenSat World Cup 2026 live fallback end -->']
];
const OLD_SCRIPT_PARTS = [
  'worldcup-knockout-cards-ui.js',
  'worldcup-final-ui-fix.js',
  'worldcup-2026-live-fallback.js'
];

function removeOld(html) {
  for (const [start, end] of OLD_MARKER_BLOCKS) {
    const re = new RegExp(`${escapeRegExp(start)}[\\s\\S]*?${escapeRegExp(end)}\\s*`, 'g');
    html = html.replace(re, '');
  }
  for (const part of OLD_SCRIPT_PARTS) {
    const re = new RegExp(`<script[^>]+${escapeRegExp(part)}[^>]*><\\/script>\\s*`, 'g');
    html = html.replace(re, '');
  }
  return html;
}

function escapeRegExp(s) {
  return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function inject(file) {
  const p = path.join(ROOT, file);
  if (!fs.existsSync(p)) return { file, status: 'missing' };
  let html = fs.readFileSync(p, 'utf8');
  const before = html;
  html = removeOld(html);
  const currentBlockRe = new RegExp(`${escapeRegExp(START)}[\\s\\S]*?${escapeRegExp(END)}`, 'm');
  if (currentBlockRe.test(html)) html = html.replace(currentBlockRe, BLOCK);
  else if (html.includes('</body>')) html = html.replace('</body>', `${BLOCK}\n</body>`);
  else html = `${html.trimEnd()}\n${BLOCK}\n`;
  fs.writeFileSync(p, html, 'utf8');
  return { file, status: before === html ? 'unchanged' : 'updated' };
}

function ensureHeaders() {
  const p = path.join(ROOT, 'public', '_headers');
  let body = fs.existsSync(p) ? fs.readFileSync(p, 'utf8') : '';
  const start = '# MaenSat World Cup 2026 UI-only no-cache start';
  const end = '# MaenSat World Cup 2026 UI-only no-cache end';
  const block = `${start}\n/worldcup-2026/*.json\n  Cache-Control: no-cache, no-store, must-revalidate\n/worldcup-2026/worldcup-knockout-ui-only.js\n  Cache-Control: no-cache, no-store, must-revalidate\n${end}`;
  const re = new RegExp(`${escapeRegExp(start)}[\\s\\S]*?${escapeRegExp(end)}`, 'm');
  if (re.test(body)) body = body.replace(re, block);
  else body = `${body.trimEnd()}\n\n${block}\n`;
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, body, 'utf8');
  return { file: 'public/_headers', status: 'updated' };
}

const results = [inject('public/index.html'), inject('public/index_phone.html'), ensureHeaders()];
console.log('MaenSat World Cup 2026 UI-only install results:');
for (const r of results) console.log(`- ${r.file}: ${r.status}`);
console.log('No GitHub workflow was created or changed. The 15-minute updater stays as it is.');
