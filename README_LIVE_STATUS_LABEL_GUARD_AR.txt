إصلاح شارة حالة مباريات كأس العالم 2026

المشكلة:
الكرت كان يعرض نص الحالة مباشرة من status.label_ar داخل knockout-live.json.
إذا بقيت القيمة القديمة "لم تبدأ" بينما المباراة بدأت أو وصلت لها نتيجة، يظهر الكرت بشكل خاطئ: النتيجة موجودة لكن الحالة "لم تبدأ".

الحل:
تم تعديل public/worldcup-knockout-cards-ui.js حتى يحسب نص الحالة بذكاء:
- إذا المباراة انتهت: يعرض حالة الانتهاء الموجودة أو "انتهت".
- إذا المباراة مباشرة من ESPN أو داخل نافذة وقت المباراة أو فيها نتيجة وغير منتهية: يعرض "مباشر".
- إذا المباراة بدأت ولا توجد نتيجة بعد: يعرض 0-0 في مكان النتيجة.
- إذا المباراة قبل وقتها: يعرض شحطة في مكان النتيجة ويترك الحالة "لم تبدأ".

الملفات:
public/worldcup-knockout-cards-ui.js
public/worldcup-2026/live-status-label-guard-status.json

رسالة الكومت المقترحة:
Fix World Cup card status for live upcoming matches

بعد الرفع:
1. اعمل Commit + Push.
2. شغّل GitHub Actions > Update World Cup 2026 every 15 minutes > Run workflow.
3. افتح الموقع مع كسر الكاش:
https://maensat.pages.dev/#worldcup2026?v=live-status-label-guard
