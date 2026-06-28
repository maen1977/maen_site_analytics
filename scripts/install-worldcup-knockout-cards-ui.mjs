#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const SCRIPT_TAG = '<script src="/worldcup-knockout-cards-ui.js?v=20260628-knockout-live" defer></script>';
const START = '<!-- MaenSat World Cup knockout live cards start -->';
const END = '<!-- MaenSat World Cup knockout live cards end -->';

function inject(file) {
  const p = path.join(ROOT, file);
  if (!fs.existsSync(p)) return false;
  let html = fs.readFileSync(p, 'utf8');
  const block = `${START}\n${SCRIPT_TAG}\n${END}`;
  const re = new RegExp(`${START}[\\s\\S]*?${END}`, 'm');
  if (re.test(html)) html = html.replace(re, block);
  else if (html.includes('</body>')) html = html.replace('</body>', `${block}\n</body>`);
  else html += `\n${block}\n`;
  fs.writeFileSync(p, html, 'utf8');
  return true;
}

function ensureHeaders() {
  const p = path.join(ROOT, 'public', '_headers');
  let body = fs.existsSync(p) ? fs.readFileSync(p, 'utf8') : '';
  const blockStart = '# MaenSat World Cup live JSON no-cache start';
  const blockEnd = '# MaenSat World Cup live JSON no-cache end';
  const block = `${blockStart}\n/worldcup-2026/*.json\n  Cache-Control: no-cache, no-store, must-revalidate\n/worldcup-knockout-cards-ui.js\n  Cache-Control: no-cache, no-store, must-revalidate\n${blockEnd}`;
  const re = new RegExp(`${blockStart}[\\s\\S]*?${blockEnd}`, 'm');
  if (re.test(body)) body = body.replace(re, block);
  else body = body.trimEnd() + `\n\n${block}\n`;
  fs.writeFileSync(p, body, 'utf8');
}

const changed = [inject('public/index.html'), inject('public/index_phone.html')].filter(Boolean).length;
ensureHeaders();
console.log(`Installed World Cup knockout cards UI in ${changed} HTML file(s).`);
