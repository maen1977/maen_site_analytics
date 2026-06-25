تعديل كأس العالم 2026 - نسخة آمنة بدون Worker
===============================================

المهم:
- لا يوجد ملف public/_worker.js داخل هذه الحزمة.
- هذا التعديل لا يغير Cloudflare ولا نظام تشغيل الموقع.
- التعديل يضيف سكربت صغير داخل index.html و index_phone.html فقط.

ماذا يعمل التعديل؟
1) أول ما المستخدم يفتح قسم كأس العالم، يفتح على تبويب "اليوم".
2) تبويب اليوم يعرض المباريات من بداية اليوم بتوقيت الأردن إلى وقت فتح الموقع + 24 ساعة.
3) خانة العدّاد تصبح مثل: "انطلقت البطولة — اليوم 15 من البطولة".
4) لا يتم لمس ملفات matches.json أو groups.json أو GitHub Actions.

طريقة التركيب عبر GitHub Desktop:
1) فك ضغط الملف.
2) افتح مشروع maen_site_analytics من GitHub Desktop.
3) اضغط Repository ثم Open in Explorer.
4) انسخ الملفات والمجلدات من هذه الحزمة فوق مجلد المشروع.
   يعني انسخ:
   - public/worldcup-2026-today-fix.js
   - tools/apply-worldcup-fix.cjs
   - APPLY_WORLD_CUP_FIX.bat
5) من داخل مجلد المشروع نفسه، اضغط مرتين على:
   APPLY_WORLD_CUP_FIX.bat
6) ارجع إلى GitHub Desktop.
7) تأكد أن الملفات المعدلة هي تقريباً:
   - public/index.html
   - public/index_phone.html
   - public/worldcup-2026-today-fix.js
   - tools/apply-worldcup-fix.cjs
   - APPLY_WORLD_CUP_FIX.bat
8) اكتب في Summary:
   Fix World Cup today tab safely
9) اضغط Commit to main ثم Push origin.

إذا صار أي خطأ:
- من GitHub Desktop افتح History.
- اضغط يمين على آخر Commit.
- اختر Revert changes in commit.
- اضغط Push origin.

ملاحظة:
إذا جهازك لا يوجد عليه Node.js، ملف APPLY_WORLD_CUP_FIX.bat لن يعمل.
في هذه الحالة أخبرني، وأعطيك طريقة لصق سطر السكربت يدوياً داخل index.html و index_phone.html.
