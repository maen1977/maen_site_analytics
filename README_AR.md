# رجوع آمن لإضافات كأس العالم السابقة

هذا الملف مخصص فقط لإزالة الإضافات التي أرسلتها سابقاً في ملفي الإصلاح:

- `maensat_worldcup_groups_fix.zip`
- `maensat_worldcup_final_ui_fix.zip`

## ماذا يحذف؟

يحذف فقط الملفات التالية إذا كانت موجودة:

- `.github/workflows/repair-worldcup-groups-live.yml`
- `.github/workflows/maensat-worldcup-final-ui-fix.yml`
- `.github/workflows/rollback-worldcup-chatgpt-fixes.yml`
- `scripts/repair-worldcup-groups-live.mjs`
- `scripts/install-worldcup-cache-headers.mjs`
- `scripts/install-worldcup-browser-fix.mjs`
- `scripts/install-worldcup-final-ui-fix.mjs`
- `scripts/rollback-worldcup-chatgpt-fixes.mjs`
- `public/worldcup-2026-live-fallback.js`
- `public/worldcup-final-ui-fix.js`
- `public/worldcup-2026/final-ui-fix-marker.json`

ويزيل من `public/index.html` و `public/index_phone.html` فقط وسوم السكربت التي تشير إلى:

- `worldcup-2026-live-fallback.js`
- `worldcup-final-ui-fix.js`

ويزيل من `public/_headers` فقط بلوكات الكاش التي تحمل عنوان MaenSat World Cup الخاصة بهذه الإضافات.

## طريقة الاستخدام عبر GitHub Actions

1. فك الضغط.
2. ارفع محتويات المجلد إلى جذر الريبو `maen1977/maen_site_analytics`.
3. اعمل Commit.
4. افتح GitHub Actions.
5. شغّل Action باسم:
   `Rollback ChatGPT World Cup fixes`
6. بعد نجاح التشغيل، انتظر Deploy جديد من Cloudflare Pages.

## الرجوع الأصلي 100%

إذا أردت الرجوع حرفياً إلى ما كان قبل أي رفع، فالطريقة الأدق هي من GitHub:

1. افتح الريبو.
2. ادخل إلى `Commits` أو `History`.
3. ابحث عن الـ commits التي رفعت فيها ملفات الإصلاح أو التي شغّلت Action الإصلاح.
4. اضغط `Revert` على هذه commits بالترتيب من الأحدث إلى الأقدم.
5. انتظر Deploy جديد من Cloudflare Pages.

هذه الطريقة هي الوحيدة التي ترجع كل ملف بيانات JSON إلى نسخته السابقة تماماً، لأن ملفات البيانات قد تكون تغيّرت بعد تشغيل Actions.
