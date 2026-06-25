/*
  Applies MaenSat World Cup safe fix to local project files.
  Run from repository root with: node tools/apply-worldcup-fix.cjs
*/
const fs = require('fs');
const path = require('path');

const ROOT = process.cwd();
const SCRIPT_TAG = '<script src="/worldcup-2026-today-fix.js"></script>';
const FILES = [
  path.join(ROOT, 'public', 'index.html'),
  path.join(ROOT, 'public', 'index_phone.html')
];

function exists(file) {
  try { return fs.existsSync(file); } catch (_) { return false; }
}

function insertScript(html) {
  if (html.includes('/worldcup-2026-today-fix.js')) {
    return { html, changed: false, reason: 'already_exists' };
  }

  const marker = '\n  ' + SCRIPT_TAG + '\n';

  if (/<\/body\s*>/i.test(html)) {
    return {
      html: html.replace(/<\/body\s*>/i, marker + '</body>'),
      changed: true,
      reason: 'before_body'
    };
  }

  if (/<\/html\s*>/i.test(html)) {
    return {
      html: html.replace(/<\/html\s*>/i, marker + '</html>'),
      changed: true,
      reason: 'before_html'
    };
  }

  return {
    html: html + marker,
    changed: true,
    reason: 'end_of_file'
  };
}

function main() {
  console.log('MaenSat World Cup safe fix');
  console.log('Repository:', ROOT);

  const missing = FILES.filter(f => !exists(f));
  if (missing.length) {
    console.error('\nERROR: لم أجد الملفات التالية:');
    missing.forEach(f => console.error(' - ' + f));
    console.error('\nشغّل الملف من داخل مجلد المشروع الرئيسي maen_site_analytics.');
    process.exit(1);
  }

  let changedCount = 0;
  for (const file of FILES) {
    const before = fs.readFileSync(file, 'utf8');
    const result = insertScript(before);
    if (result.changed) {
      fs.writeFileSync(file, result.html, 'utf8');
      changedCount += 1;
      console.log('UPDATED:', path.relative(ROOT, file), '(' + result.reason + ')');
    } else {
      console.log('SKIPPED:', path.relative(ROOT, file), '(script already exists)');
    }
  }

  const scriptFile = path.join(ROOT, 'public', 'worldcup-2026-today-fix.js');
  if (!exists(scriptFile)) {
    console.error('\nERROR: ملف الإصلاح غير موجود: public/worldcup-2026-today-fix.js');
    console.error('تأكد أنك نسخت مجلد public من الحزمة إلى نفس مكان public داخل المشروع.');
    process.exit(1);
  }

  console.log('\nDONE. التعديل آمن ولا يستخدم _worker.js.');
  console.log('الآن افتح GitHub Desktop ثم Commit و Push.');
  if (changedCount === 0) console.log('ملاحظة: يبدو أن التعديل كان مضافاً سابقاً.');
}

main();
