# إصلاح نهائي لواجهة كأس العالم 2026 في موقع MaenSat

هذا الإصلاح مخصص للمشكلة التي بقيت كما هي بعد تحديث البيانات: تبويبات كأس العالم داخل الصفحة، خصوصًا:

- المجموعات
- أفضل الثوالث
- الأدوار
- كل المباريات
- الأردن
- اليوم

## سبب المشكلة

البيانات داخل `public/worldcup-2026` أصبحت موجودة ومحدثة، لكن واجهة الصفحة نفسها تبقى أحيانًا على:

`جاري تحميل بيانات كأس العالم 2026...`

أو لا تعرض تبويب `المجموعات` و`الأدوار` بشكل صحيح. لذلك هذا التصليح لا يعتمد فقط على تحديث JSON، بل يضيف ملف JavaScript جديد يقرأ ملفات JSON مباشرة ويعرض التبويبات في المتصفح.

## الملفات الموجودة في هذا التصليح

- `public/worldcup-final-ui-fix.js`
- `scripts/install-worldcup-final-ui-fix.mjs`
- `.github/workflows/maensat-worldcup-final-ui-fix.yml`
- `APPLY_WORLD_CUP_FINAL_UI_FIX.bat`
- `README_AR.md`

## طريقة التركيب من GitHub

1. فك الضغط.
2. افتح المجلد `maensat_worldcup_final_ui_fix`.
3. ارفع محتوياته كما هي إلى جذر الريبو:

   `maen1977/maen_site_analytics`

4. بعد رفع الملفات، ادخل GitHub ثم Actions.
5. شغل Action باسم:

   `MaenSat World Cup final UI fix`

6. انتظر إلى أن ينجح التشغيل ويعمل Commit تلقائي.
7. انتظر Cloudflare Pages حتى يعمل Deploy جديد.
8. افتح الموقع واعمل Hard Refresh:

   - على ويندوز: `Ctrl + F5`
   - أو افتح الرابط مع كسر كاش مثل: `https://maensat.pages.dev/?v=final-worldcup-ui`

## ماذا يفعل الإصلاح؟

- يحقن ملف `worldcup-final-ui-fix.js` داخل `public/index.html` و `public/index_phone.html`.
- يكسر كاش ملفات كأس العالم JSON.
- يعرض جدول المجموعات من `groups.json` أو `standings.json`.
- يعرض أفضل الثوالث ويحسِب أفضل 8.
- يعرض الأدوار من `bracket.json` أو `matches.json`، وإذا لم تكن المواجهات موجودة بعد يعرض المنتخبات المتأهلة من ترتيب المجموعات.
- لا يغيّر باقي أقسام الموقع.

## علامة نجاح التركيب

بعد تشغيل الـ Action سيظهر ملف جديد:

`public/worldcup-2026/final-ui-fix-marker.json`

وجود هذا الملف يعني أن الإصلاح تم تركيبه في الريبو.
