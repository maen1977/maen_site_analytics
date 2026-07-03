إصلاح نهائي لمشكلة بقاء المباراة "مباشر" بعد نهاية الترجيح

سبب المشكلة:
إذا وصل score.p أو نتيجة الترجيح وبقي status.key = live بسبب تأخر ESPN أو بسبب بقاء بيانات live قديمة، كانت الواجهة تعتبر المباراة مباشرة، حتى لو المباراة انتهت فعلاً.

ماذا يفعل هذا الإصلاح:
1. يعدل public/index.html و public/index_phone.html حتى تكون حالة "انتهت بركلات الترجيح" أعلى من live إذا ظهرت نتيجة الترجيح ومر وقت كافٍ من بداية المباراة.
2. يعدل public/worldcup-live-status-dom-guard.js حتى يصحح النص الظاهر في الكرت من "مباشر" إلى "انتهت بركلات الترجيح" عند الحاجة.
3. يضيف scripts/worldcup-stale-live-finalizer.mjs كخطوة أخيرة في GitHub Actions لتصحيح ملفات JSON نفسها.
4. يعدل .github/workflows/update-worldcup-2026.yml لتشغيل الحماية بعد كل تحديث كأس العالم.

الملفات المعدلة:
- public/index.html
- public/index_phone.html
- public/worldcup-live-status-dom-guard.js
- functions/_middleware.js
- scripts/worldcup-stale-live-finalizer.mjs
- .github/workflows/update-worldcup-2026.yml
- public/worldcup-2026/stale-live-finalizer-status.json

رسالة الكومت المقترحة:
Fix stale live status after penalty shootout

بعد الرفع:
1. Commit + Push
2. شغل workflow: Update World Cup 2026 every 15 minutes
3. افتح الموقع مع كسر الكاش:
   https://maensat.pages.dev/#worldcup2026?v=stale-live-finalizer
