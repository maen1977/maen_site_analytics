import fs from 'node:fs';
import path from 'node:path';

const files = [
  path.join('public', 'index.html'),
  path.join('public', 'index_phone.html'),
];

function findFunctionEnd(src, start) {
  const open = src.indexOf('{', start);
  if (open < 0) return -1;
  let depth = 0;
  let quote = null;
  let esc = false;
  let lineComment = false;
  let blockComment = false;
  for (let i = open; i < src.length; i++) {
    const ch = src[i];
    const next = src[i + 1];

    if (lineComment) {
      if (ch === '\n') lineComment = false;
      continue;
    }
    if (blockComment) {
      if (ch === '*' && next === '/') { blockComment = false; i++; }
      continue;
    }
    if (quote) {
      if (esc) { esc = false; continue; }
      if (ch === '\\') { esc = true; continue; }
      if (ch === quote) quote = null;
      continue;
    }
    if (ch === '/' && next === '/') { lineComment = true; i++; continue; }
    if (ch === '/' && next === '*') { blockComment = true; i++; continue; }
    if (ch === '"' || ch === "'" || ch === '`') { quote = ch; continue; }
    if (ch === '{') depth++;
    if (ch === '}') {
      depth--;
      if (depth === 0) return i + 1;
    }
  }
  return -1;
}

function replaceFunction(src, name, replacement) {
  const marker = `function ${name}`;
  const start = src.indexOf(marker);
  if (start < 0) return { src, changed: false, reason: `${name} not found` };
  const end = findFunctionEnd(src, start);
  if (end < 0) return { src, changed: false, reason: `${name} end not found` };
  return { src: src.slice(0, start) + replacement + src.slice(end), changed: true };
}

function addFailSafeCss(src) {
  const marker = '/* MAENSAT_HIDE_WORLDCUP_BROADCASTS */';
  if (src.includes(marker)) return src;
  const css = `\n${marker}\n#worldcup2026 .wc-broadcast{display:none!important;}\n#worldcup2026 .wc-broadcast-title,#worldcup2026 .wc-broadcast-list,#worldcup2026 .wc-channel{display:none!important;}\n`;
  const idx = src.lastIndexOf('</style>');
  if (idx >= 0) return src.slice(0, idx) + css + src.slice(idx);
  return src + `<style>${css}</style>`;
}

let touched = 0;
for (const file of files) {
  if (!fs.existsSync(file)) {
    console.log(`SKIP: ${file} not found`);
    continue;
  }
  const original = fs.readFileSync(file, 'utf8');
  let next = original;

  // Stop rendering broadcaster/channel blocks inside all World Cup match cards.
  const result = replaceFunction(next, 'broadcastHtml', "function broadcastHtml(m){return '';} ");
  next = result.src;
  next = addFailSafeCss(next);

  if (next !== original) {
    fs.writeFileSync(file, next, 'utf8');
    touched++;
    console.log(`UPDATED: ${file}`);
  } else {
    console.log(`UNCHANGED: ${file}`);
  }
}

if (!touched) {
  console.error('لم يتم تعديل أي ملف. تأكد أنك تشغل السكربت من جذر المشروع وفيه مجلد public.');
  process.exit(1);
}

console.log('تم حذف معلومات القنوات الناقلة من عرض قسم كأس العالم بدون لمس التحديث كل 15 دقيقة.');
