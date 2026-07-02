إصلاح عرض نتيجة مباريات كأس العالم 2026 وقت البث المباشر

المطلوب من هذا الإصلاح:
- قبل بداية المباراة لا تظهر 0 - 0.
- عند بداية المباراة يظهر مربع النتيجة 0 - 0 بدل كلمة مباشر إذا لم تصل نتيجة من المصدر بعد.
- إذا وصلت نتيجة حقيقية من ESPN أو من سكربتات التحديث، تبقى النتيجة الحقيقية ولا يرجعها السكربت إلى 0 - 0.
- كلمة مباشر تبقى حالة للكرت فقط، وليست نصاً داخل مكان النتيجة.

طريقة الرفع:
1. فك ضغط الملف.
2. انسخ المجلدات والملفات فوق مشروعك بنفس المسارات.
3. افتح GitHub Desktop.
4. اعمل Commit بهذه الرسالة:
   Fix live World Cup score display as 0-0 at kickoff
5. اعمل Push.
6. من GitHub افتح:
   Actions → Update World Cup 2026 every 15 minutes → Run workflow
7. بعد نجاح الأكشن افتح الموقع مع كسر الكاش:
   https://maensat.pages.dev/#worldcup2026?v=zero-score-fix

الملفات التي تم تعديلها/إضافتها:
- scripts/worldcup-live-zero-score-guard.mjs
- public/worldcup-knockout-cards-ui.js
- .github/workflows/update-worldcup-2026.yml
- public/worldcup-2026/live-zero-score-guard-status.json
- COMMIT_MESSAGE.txt

ملاحظة مهمة:
هذا الإصلاح لا يخترع نتيجة نهائية. هو فقط يضع 0 - 0 أثناء حالة live إذا لم توجد نتيجة بعد. عند وصول نتيجة حقيقية مثل 1 - 0 أو 1 - 1، يحافظ عليها ويعرضها.
