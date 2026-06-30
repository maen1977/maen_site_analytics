إصلاح دمج تحديث الأدوار داخل Workflow الأصلي

المطلوب من المستخدم:
انسخ الملفات الموجودة في هذا ZIP فوق نفس المسارات داخل مشروع GitHub Desktop، ثم اعمل Commit و Push.

الملفات:
- .github/workflows/update-worldcup-2026.yml
- scripts/worldcup-quarter-hour-force.mjs
- scripts/worldcup-knockout-live-sync.mjs

ما الذي تغيّر؟
- لم يتم تغيير توقيت التحديث كل ربع ساعة.
- بقي cron كما هو: 4,19,34,49 * * * *
- بقي WORLD_CUP_2026_INTERVAL_MINUTES = 15
- تمت إضافة تشغيل worldcup-knockout-live-sync.mjs داخل نفس Workflow الأصلي بعد تحديث النتائج وتصحيح دور 32.
- تمت إضافة knockout-live-health.json لقائمة الملفات التي يرفعها GitHub Actions.
- تم الإبقاء على منطق قراءة التمديد وركلات الترجيح وترحيل الفائزين ديناميكياً لكل الأدوار.

رسالة Commit المقترحة:
Integrate knockout advancement sync into 15-minute World Cup workflow
