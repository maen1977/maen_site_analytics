إصلاح كأس العالم v5 - مزامنة الأدوار الظاهرة في الموقع

سبب المشكلة:
ملف knockout-live.json صار يحدد الفائزين بشكل صحيح، لكن صفحة الموقع الحالية public/index.html و public/index_phone.html تعرض تبويب الأدوار من ملف matches.json.
لذلك كان الفائز صحيحاً في knockout-live.json، لكنه لا يظهر في الموقع.

ماذا يعمل هذا الإصلاح:
- يبقي التحديث كل ربع ساعة كما هو بدون تغيير cron.
- بعد حساب الفائزين من W74 / W75 / W89 / L101 ... ينسخ الأسماء الصحيحة إلى matches.json أيضاً.
- يحافظ على الحقول الأصلية مثل team1_slot و team2_slot حتى يبقى المصدر الديناميكي معروفاً.
- إذا المباراة السابقة لم تنتهِ، يترك القيمة كرمز W77 أو W89 حتى يعرضها الموقع بلغته الحالية كـ "الفائز من مباراة 77".
- إذا المباراة السابقة انتهت، يضع المنتخب الحقيقي مثل Paraguay / Morocco / Canada.

الملف الأساسي المعدل:
scripts/worldcup-knockout-live-sync.mjs

ملف Workflow مرفق كما هو لضمان أن السكربت يعمل داخل نفس تحديث الربع ساعة:
.github/workflows/update-worldcup-2026.yml

بعد الرفع:
1. Commit
2. Push origin
3. شغل Workflow: Update World Cup 2026 every 15 minutes
4. بعد اللون الأخضر افتح الموقع واضغط Ctrl + F5

رسالة Commit مقترحة:
Sync knockout advancement into displayed matches data
