تعديل قسم كأس العالم 2026 - معن حنونة للستلايت

الملفات الموجودة داخل هذا ZIP:

1) public/_worker.js
2) public/worldcup-2026-today-fix.js

طريقة الرفع عن طريق GitHub Desktop:

1. افتح مشروع maen_site_analytics على جهازك من GitHub Desktop.
2. افتح فولدر المشروع من خيار "Open in Explorer".
3. انسخ مجلد public الموجود داخل هذا ZIP فوق مجلد public الموجود في مشروعك.
4. وافق على إضافة/استبدال الملفات عند الطلب.
5. ارجع إلى GitHub Desktop.
6. اكتب في خانة Summary:
   Fix World Cup today tab
7. اضغط Commit to main.
8. اضغط Push origin.

ماذا يفعل التعديل؟

- لا يغير ملفات index.html أو index_phone.html الكبيرة.
- يضيف Cloudflare Pages Worker آمن يمرر كل ملفات الموقع كما هي.
- يحقن سكربت صغير داخل صفحات الموقع فقط.
- عند فتح قسم كأس العالم، يتم فتح تبويب "اليوم" تلقائياً.
- تبويب اليوم يعرض المباريات من بداية اليوم بتوقيت الأردن حتى وقت فتح الموقع + 24 ساعة.
- يتم تحديث خانة "انطلقت البطولة" لتظهر: اليوم رقم X من البطولة.

ملاحظة مهمة:
هذا الحل مناسب لأن الموقع منشور على Cloudflare Pages عبر maensat.pages.dev.
لا تستخدم Direct Upload من لوحة Cloudflare؛ ارفعه من GitHub Desktop ثم Push.
