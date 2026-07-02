إصلاح: المباريات المنتهية العالقة بعبارة "بانتظار التحديث"

المشكلة:
أحياناً مباراة تنتهي وقتها، لكن ملف knockout-live.json يبقى بدون score1 و score2، فتظهر في الكرت عبارة "بانتظار التحديث" بدل النتيجة النهائية.

الحل داخل هذه الحزمة:
1. إضافة سكربت:
   scripts/worldcup-finished-score-backfill.mjs

2. السكربت يعمل بثلاث مراحل:
   - يبحث أولاً داخل ملفات الموقع نفسها: matches.json و bracket.json و knockout-live.json.
     إذا وجد نفس المباراة أو نفس الفريقين وفيها نتيجة، ينسخ النتيجة للملف العالق.
   - إذا لم يجد نتيجة محلية، يجلب مباريات ESPN حسب تاريخ المباراة، وليس فقط scoreboard الحالي.
     هذا مهم لأن المباراة المنتهية قد لا تظهر ضمن الأحداث الحالية.
   - إذا وجد نتيجة موثوقة، يملأ كل حقول النتيجة المستخدمة في الموقع:
     score1, score2, home_score, away_score, team1_score, team2_score, score.ft, score.current

3. السكربت لا يخترع نتيجة.
   إذا لم يجد النتيجة في ملفات الموقع أو ESPN، يتركها كما هي ويكتبها داخل تقرير:
   public/worldcup-2026/finished-score-backfill-status.json

4. تم تعديل GitHub Action:
   .github/workflows/update-worldcup-2026.yml

   ليشغل الإصلاح قبل وبعد مزامنة كروت الأدوار، ثم مرة أخيرة بعد حماية 0-0 للمباشر.

طريقة الرفع:
- انسخ محتوى ZIP فوق مشروعك بنفس المسارات.
- افتح GitHub Desktop.
- اعمل Commit بالرسالة الموجودة في COMMIT_MESSAGE.txt.
- اعمل Push.
- من GitHub شغل:
  Actions → Update World Cup 2026 every 15 minutes → Run workflow

بعد نجاح الـ Action افتح الموقع مع كسر الكاش:
https://maensat.pages.dev/#worldcup2026?v=finished-score-backfill

كيف تعرف أنه اشتغل؟
افتح الملف:
public/worldcup-2026/finished-score-backfill-status.json

ستجد أرقام مثل:
- stale_missing_scores: عدد المباريات المنتهية بلا نتيجة
- local_updates: كم نتيجة تم نسخها من ملفات الموقع
- espn_updates: كم نتيجة تم جلبها من ESPN
- unresolved: مباريات لم يجد لها مصدر نتيجة بعد
