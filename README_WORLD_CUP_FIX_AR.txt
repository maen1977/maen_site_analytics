إصلاح قسم كأس العالم 2026 - بدون تغيير جدولة التحديث كل ربع ساعة

طريقة الرفع:
1) افتح مشروع الموقع عندك في GitHub Desktop.
2) انسخ الملفات الموجودة داخل هذا المجلد فوق نفس المسارات في مشروعك.
3) تأكد أن الملف .github/workflows/update-worldcup-2026.yml بقي بنفس cron:
   4,19,34,49 * * * *
4) اعمل Commit ثم Push.

الملفات المعدلة:
- scripts/worldcup-quarter-hour-force.mjs
- scripts/worldcup-knockout-live-sync.mjs
- public/index.html
- public/index_phone.html
- .github/workflows/update-worldcup-2026.yml
- package.json
- public/worldcup-2026/knockout-live.json
- public/worldcup-2026/knockout-live-health.json

ما تم إصلاحه:
- قراءة حالة الشوط الإضافي الأول والثاني من ESPN.
- قراءة ركلات الترجيح إذا ظهرت باسم shootoutScore أو penalties أو penaltyScore.
- حفظ نتيجة الترجيح داخل score.p و score.penalties، بالإضافة إلى penalty_home_score و penalty_away_score.
- تحديد الفائز بعد ركلات الترجيح أو بعد التمديد، حتى ينتقل للدور التالي.
- عرض حالة: انتهت بعد التمديد / انتهت بركلات الترجيح / الشوط الإضافي الأول / الشوط الإضافي الثاني.
- ترتيب دور الـ32 والأدوار الإقصائية حسب وقت المباراة، وليس حسب رقم المباراة.
- تشغيل مزامنة knockout-live داخل نفس Workflow الأصلي كل 15 دقيقة، بدون تغيير الجدولة.
- إصلاح package.json حتى لا يشير إلى سكربت غير موجود.

فحص تم قبل التسليم:
- npm run check:github نجح.
- تم التأكد أن cron بقي: 4,19,34,49 * * * *
- تم التأكد أن WORLD_CUP_2026_INTERVAL_MINUTES بقي 15.
- تم التأكد أن دور الـ32 في knockout-live.json مرتب زمنياً.
