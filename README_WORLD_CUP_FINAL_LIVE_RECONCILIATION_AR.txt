إصلاح نهائي لمشكلة: المباراة مباشرة لكن الكرت يظهر "لم تبدأ"

ما الذي تم إصلاحه؟
1) إضافة سكربت جديد:
   scripts/worldcup-final-live-reconciliation.mjs

   هذا السكربت يعمل في آخر التحديث، بعد كل سكربتات كأس العالم الأخرى.
   وظيفته أن يقرأ حالة ESPN الحالية ويصلح الملفات الثلاثة:
   - public/worldcup-2026/matches.json
   - public/worldcup-2026/bracket.json
   - public/worldcup-2026/knockout-live.json

2) تعديل workflow:
   .github/workflows/update-worldcup-2026.yml

   تمت إضافة خطوة أخيرة قبل الكومت:
   Final live status reconciliation

   الهدف: لا يأتي أي سكربت لاحق ويعيد مباراة بدأت إلى "لم تبدأ".

3) تعديل حماية واجهة الكرت:
   public/worldcup-knockout-cards-ui.js

   إذا وقت المباراة بتوقيت الأردن بدأ، والملف لا يزال يقول "لم تبدأ"، الواجهة لا تعرض "لم تبدأ".
   تعرض الحالة "مباشر" وتعرض في مكان النتيجة 0-0 إذا لم تصل نتيجة بعد.

لماذا حدثت مشكلة مصر وأستراليا؟
لأن ESPN كان يعتبر المباراة Live، لكن knockout-live.json بقي أو رجع إلى Scheduled/لم تبدأ بعد خطوات المزامنة والترتيب. لذلك الكرت قرأ الملف كما هو وعرض "لم تبدأ".

طريقة الرفع:
- انسخ محتوى ZIP فوق المشروع بنفس المسارات.
- افتح GitHub Desktop.
- Commit + Push.

رسالة الكومت المقترحة:
Fix World Cup live status stuck as scheduled

بعد الرفع:
GitHub → Actions → Update World Cup 2026 every 15 minutes → Run workflow

بعد ما يصير أخضر، افتح الموقع مع كسر الكاش:
https://maensat.pages.dev/#worldcup2026?v=final-live-reconcile
