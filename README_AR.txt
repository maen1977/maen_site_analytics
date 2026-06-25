تعديل كأس العالم V3 - مهم جداً
===============================

سبب أن النسخة السابقة لم تغيّر شيئاً:
فحصت index.html على GitHub ولم أجد سطر تحميل:
/worldcup-2026-today-fix.js
يعني السكربت لم يدخل داخل index.html و index_phone.html، لذلك الموقع بقي كما هو.

هذه النسخة لا تستخدم _worker.js ولا تحتاج Node.js.
تستخدم PowerShell الموجود في ويندوز لإدخال السطر داخل الملفين تلقائياً.

الخطوات:
1) فك الضغط.
2) افتح مشروع maen_site_analytics من GitHub Desktop.
3) اضغط Repository ثم Open in Explorer.
4) انسخ محتويات هذه الحزمة فوق مجلد المشروع نفسه، وليس داخل public فقط.
   لازم تندمج هذه الملفات:
   - public/worldcup-2026-today-fix.js
   - tools/apply-worldcup-fix-v3.ps1
   - APPLY_WORLD_CUP_FIX_V3.bat
5) اضغط مرتين على APPLY_WORLD_CUP_FIX_V3.bat من داخل مجلد المشروع.
6) لازم تظهر رسالة UPDATED للملفين:
   - public/index.html
   - public/index_phone.html
7) افتح GitHub Desktop.
8) تأكد أن Changed files فيها على الأقل:
   - public/index.html
   - public/index_phone.html
   - public/worldcup-2026-today-fix.js
9) اكتب Summary:
   Fix World Cup today tab V3
10) اضغط Commit to main ثم Push origin.

بعد النشر:
افتح الموقع بمتصفح خفي أو اضغط Ctrl+F5 حتى تتجاوز الكاش.

ما الذي يتغير؟
- قسم كأس العالم يفتح على تبويب اليوم.
- اليوم يعرض من بداية اليوم بتوقيت الأردن إلى وقت فتح الموقع + 24 ساعة.
- عداد البطولة يظهر مثل: انطلقت البطولة — اليوم 15 من البطولة.

إذا لم يظهر تغيير:
افتح GitHub Desktop وتأكد أن public/index.html تغيّر. إذا لم يتغيّر، فالتعديل لم يُطبّق.
