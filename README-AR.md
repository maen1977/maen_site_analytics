# تحديث كأس العالم 2026 من أكثر من مصدر - MaenSat

هذه الحزمة تطوّر تحديث قسم كأس العالم بحيث لا يعتمد على مصدر واحد فقط للنتائج أو القنوات الناقلة.

## ماذا تضيف الحزمة؟

1. **نتائج من أكثر من مصدر**
   - صفحة beIN الرسمية لكأس العالم 2026.
   - ESPN Scoreboard كمصدر احتياطي.
   - WorldCup26 open API كمصدر احتياطي ثالث.
   - ملف التصحيحات اليدوية يبقى أعلى أولوية بعد كل شيء.

2. **قنوات beIN Sports / MENA**
   - تضيف سياسة بث واضحة لمنطقة الأردن / MENA.
   - تؤكد وجود تغطية beIN الرسمية عبر قنوات MAX و4K HDR كمظلة عامة.
   - لا تعتبر beIN SPORTS المفتوحة مؤكدة لكل مباراة إلا عند ظهور إعلان رسمي أو تأكيد مشاهدة يدوي.
   - لا تضيف ترددات ولا روابط بث.

3. **ترتيب المجموعات**
   - بعد تحديث النتائج، يعاد بناء `standings.json` من نتائج `matches.json`.

## الملفات داخل الحزمة

- `public/worldcup-2026/data-sources.json`
  - إعدادات مصادر النتائج والبث. يمكنك لاحقًا إضافة مصادر جديدة هنا بدون تعديل السكربت.

- `public/worldcup-2026/manual-results-overrides.json`
  - تصحيحات يدوية ثابتة، وفيها حاليًا USA 4-1 Paraguay.

- `scripts/merge-worldcup-multisource.mjs`
  - يجلب النتائج والقنوات من عدة مصادر ويدمجها في ملفات الموقع.

- `scripts/apply-worldcup-overrides.mjs`
  - يطبق التصحيحات اليدوية ويعيد حساب ترتيب المجموعات.

- `.github/workflows/update-worldcup-2026.yml`
  - يشغّل التحديث الأصلي، ثم التحديث متعدد المصادر، ثم التصحيحات اليدوية، ثم يعمل commit تلقائيًا.

## طريقة الرفع

1. فك ضغط الملف.
2. افتح GitHub repo: `maen1977/maen_site_analytics`.
3. اضغط `Add file` ثم `Upload files`.
4. ارفع المجلدات كما هي من داخل الحزمة:
   - `.github`
   - `public`
   - `scripts`
5. اعمل Commit.
6. ادخل إلى `Actions` ثم `Update World Cup 2026 data` ثم `Run workflow`.

## إذا لم يعمل الـcommit التلقائي

ادخل:

`Settings > Actions > General > Workflow permissions`

واختر:

`Read and write permissions`

ثم شغّل الـAction مرة ثانية.

## ملاحظة مهمة

إذا اختلفت المصادر في نتيجة مباراة، السكربت يختار المصدر الأعلى ثقة. وإذا بقيت مباراة لم تتحدث لأي سبب، ضعها في:

`public/worldcup-2026/manual-results-overrides.json`

وهكذا لن تضيع بعد التحديثات القادمة.
