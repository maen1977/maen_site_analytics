import fs from 'fs';
import path from 'path';

const ROOT = process.cwd();
const files = [
  path.join(ROOT, 'public', 'index.html'),
  path.join(ROOT, 'public', 'index_phone.html'),
];

const marker = 'MAENSAT_R32_SORT_BY_TIME_FIX';

function patchFile(file) {
  if (!fs.existsSync(file)) {
    console.log(`تخطي: الملف غير موجود ${path.relative(ROOT, file)}`);
    return false;
  }
  let s = fs.readFileSync(file, 'utf8');
  if (s.includes(marker)) {
    console.log(`موجود مسبقاً: ${path.relative(ROOT, file)}`);
    return false;
  }

  const oldLine = "      var roundMatches=wcSortMatches(g.matches,'num');";
  const newLine = "      var roundMatches=wcSortMatches(g.matches, Number(k)===10 ? 'time' : 'num'); /* MAENSAT_R32_SORT_BY_TIME_FIX */";

  if (s.includes(oldLine)) {
    s = s.replaceAll(oldLine, newLine);
  } else {
    // Fallback for slightly formatted/minified variants of the same renderBracket line.
    const re = /var\s+roundMatches\s*=\s*wcSortMatches\(g\.matches\s*,\s*['\"]num['\"]\s*\)\s*;/g;
    if (!re.test(s)) {
      throw new Error(`لم أجد سطر ترتيب الأدوار داخل ${path.relative(ROOT, file)}. تأكد أن الملف يحتوي دالة renderBracket.`);
    }
    s = s.replace(re, "var roundMatches=wcSortMatches(g.matches, Number(k)===10 ? 'time' : 'num'); /* MAENSAT_R32_SORT_BY_TIME_FIX */");
  }

  fs.writeFileSync(file, s, 'utf8');
  console.log(`تم التعديل: ${path.relative(ROOT, file)}`);
  return true;
}

let changed = false;
for (const file of files) changed = patchFile(file) || changed;

console.log('\nالنتيجة:');
console.log('- دور الـ32 فقط سيُعرض حسب التاريخ والوقت.');
console.log('- باقي الأدوار تبقى بترتيب رقم المباراة كما هي.');
console.log('- لم يتم لمس التحديث كل 15 دقيقة أو GitHub Actions أو ملفات JSON.');
if (!changed) console.log('- لا توجد تغييرات جديدة لأن التعديل كان مطبقاً مسبقاً أو الملفات غير موجودة.');
