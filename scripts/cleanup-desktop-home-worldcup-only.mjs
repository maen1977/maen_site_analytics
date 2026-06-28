#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const desktopIndex = path.join(ROOT, 'public', 'index.html');
const touched = [];

function escRe(s) {
  return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function removeMarkedBlock(html, start, end) {
  const re = new RegExp(`${escRe(start)}[\\s\\S]*?${escRe(end)}\\s*`, 'g');
  return html.replace(re, '');
}

function removeScriptByPart(html, part) {
  const re = new RegExp(`<script[^>]+${escRe(part)}[^>]*><\\/script>\\s*`, 'g');
  return html.replace(re, '');
}

if (!fs.existsSync(desktopIndex)) {
  console.error('لم أجد الملف public/index.html. شغّل السكربت من جذر المشروع.');
  process.exit(1);
}

let html = fs.readFileSync(desktopIndex, 'utf8');
const before = html;

// 1) Remove only the desktop injection that was added for World Cup 2026 UI-only cards.
// This does not touch GitHub Actions, JSON data, or index_phone.html.
html = removeMarkedBlock(html, '<!-- MaenSat World Cup 2026 UI-only knockout start -->', '<!-- MaenSat World Cup 2026 UI-only knockout end -->');
html = removeScriptByPart(html, 'worldcup-knockout-ui-only.js');

// 2) Remove mentions of groups/knockout from the desktop homepage card only when the exact text exists.
// It keeps the World Cup 2026 section itself untouched.
const oldCardText = 'تابع مباريات ونتائج كأس العالم، ترتيب المجموعات، مشوار الأردن، والأدوار الإقصائية بتوقيت الأردن.';
const newCardText = 'تابع مباريات ونتائج كأس العالم ومشوار الأردن بتوقيت الأردن.';
if (html.includes(oldCardText)) {
  html = html.replace(oldCardText, newCardText);
}

if (html !== before) {
  fs.writeFileSync(desktopIndex, html, 'utf8');
  touched.push('public/index.html');
}

// 3) Leave the 15-minute updater completely unchanged.
console.log('MaenSat desktop homepage World Cup cleanup finished.');
console.log(touched.length ? `Updated: ${touched.join(', ')}` : 'No changes were needed.');
console.log('Important: update-worldcup-2026.yml was not touched, so the 15-minute updater stays as it is.');
console.log('Important: public/index_phone.html was not touched.');
