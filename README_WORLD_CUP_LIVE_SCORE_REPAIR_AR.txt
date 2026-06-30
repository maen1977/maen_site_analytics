إصلاح نتيجة المباراة المباشرة في قسم كأس العالم 2026

طريقة الرفع من GitHub Desktop:
1) فك ضغط الملف.
2) انسخ المجلدات والملفات فوق نفس المسارات داخل مشروعك.
3) افتح GitHub Desktop، ستظهر الملفات المعدلة/المضافة.
4) اعمل Commit بالرسالة المقترحة أدناه.
5) اعمل Push.
6) من GitHub > Actions شغل Workflow باسم:
   Update World Cup 2026 every 15 minutes
7) بعد نجاحه افتح الموقع مع كسر الكاش:
   https://maensat.pages.dev/#worldcup2026?v=live-score-repair

الملفات داخل الحزمة:
- scripts/worldcup-live-score-repair.mjs
- .github/workflows/update-worldcup-2026.yml
- README_WORLD_CUP_LIVE_SCORE_REPAIR_AR.txt

ما الذي يصلحه هذا الملف؟
- إذا ظهرت المباراة "مباشر" بدون نتيجة، يجلب السكربت النتيجة من ESPN مباشرة.
- يطابق المباراة حسب أسماء المنتخبين أو رقم حدث ESPN إن وجد.
- يحدث matches.json و bracket.json و knockout-live.json حتى تظهر النتيجة على الكرت.
- لا يضع نتيجة وهمية 0-0 للمباراة المجدولة؛ فقط يكتب النتيجة عندما تكون المباراة Live أو Finished من ESPN.
- يحفظ تقريراً في:
  public/worldcup-2026/live-score-repair-status.json

مهم:
- لم يتم تغيير جدولة الربع ساعة.
- بقي cron كما هو:
  4,19,34,49 * * * *
- السكربت الجديد يعمل قبل وبعد مزامنة كروت خروج المغلوب حتى لا تضيع النتيجة من knockout-live.json.

رسالة Commit المقترحة:
Fix World Cup live score repair from ESPN
