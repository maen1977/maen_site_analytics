# إصلاح تحديث مجموعات كأس العالم 2026 لموقع MaenSat

هذا الملف مخصص لمشروع GitHub:

`maen1977/maen_site_analytics`

ويعالج مشكلة توقف تحديث **المجموعات داخل قسم كأس العالم** عبر 3 أشياء:

1. تحديث `matches.json` من ESPN حسب تواريخ البطولة.
2. إعادة بناء `standings.json` و`groups.json` تلقائياً، بما في ذلك أفضل الثوالث.
3. منع كاش Cloudflare/المتصفح من عرض ملفات JSON قديمة، وإضافة واجهة احتياطية تظهر المجموعات إذا بقيت عبارة "جاري تحميل بيانات كأس العالم".

## طريقة التركيب السهلة

1. افتح الريبو على GitHub.
2. ارفع محتويات هذا المجلد كما هي إلى جذر المشروع، وليس داخل مجلد فرعي.
3. تأكد أن هذه الملفات أصبحت موجودة:
   - `scripts/repair-worldcup-groups-live.mjs`
   - `scripts/install-worldcup-cache-headers.mjs`
   - `scripts/install-worldcup-browser-fix.mjs`
   - `public/worldcup-2026-live-fallback.js`
   - `.github/workflows/repair-worldcup-groups-live.yml`
4. من تبويب **Actions** شغّل workflow باسم:
   `Repair World Cup 2026 groups live data`
5. اضغط **Run workflow** أول مرة. التشغيل اليدوي يعمل فحص كامل من 2026-06-11 إلى 2026-07-19.
6. بعد نجاحه، افتح الموقع ثم اعمل تحديث قوي للصفحة:
   - كمبيوتر: `Ctrl + F5`
   - موبايل: امسح كاش المتصفح أو افتح نافذة خاصة.

## ملاحظات مهمة

- لا يحذف السكربت التحديث القديم الموجود عندك؛ يضيف طبقة إصلاح آمنة.
- التشغيل المجدول كل 15 دقيقة تقريباً، لكن على دقائق مختلفة عن التحديث القديم لتقليل تعارضات Git.
- إذا أردت تشغيل فحص كامل مرة أخرى، شغّل الـ workflow يدوياً من Actions.
- إذا كان عندك ملف `public/_headers` سابق، السكربت يضيف قواعد كأس العالم فقط ولا يمسح الموجود.

## الملفات التي يحدثها الإصلاح تلقائياً

- `public/worldcup-2026/matches.json`
- `public/worldcup-2026/standings.json`
- `public/worldcup-2026/groups.json`
- `public/worldcup-2026/heartbeat.json`
- `public/worldcup-2026/update-check.json`
- `public/worldcup-2026/version.json`
