إصلاح حالة كروت كأس العالم التي بقيت تعرض "لم تبدأ" رغم أن المباراة مباشرة.

سبب المشكلة الحقيقي:
واجهة الموقع الأصلية داخل public/index.html و public/index_phone.html كانت تقرأ m.status بهذه الطريقة:
String(m.status)

لكن ملف matches.json صار يخزن الحالة ككائن:
status: { key: "live", label_ar: "مباشر", state: "live" }

عند تحويل الكائن إلى String تصير النتيجة:
[object Object]

لذلك دالة statusText لم ترَ كلمة live، وبقيت تعرض "لم تبدأ"، رغم أن النتيجة كانت موجودة مثل 1 - 1.

ماذا تم إصلاحه:
- إضافة دالة wcStatusParts(m) في public/index.html و public/index_phone.html.
- الدالة تجمع status.key/status.state/status.label_ar + live_phase + score.phase + live_status_detail.
- تعديل statusText حتى يعرض "مباشر" إذا المباراة مباشرة أو فيها نتيجة جارية.
- تعديل دوال المساندة حتى تفهم status object بدل النص فقط.

ما لم يتغير:
- لم يتم تغيير تصميم الكرت.
- لم يتم تغيير الألوان.
- لم يتم تغيير ترتيب المباريات.
- لم يتم تغيير أسماء الفرق.
- لم يتم تغيير أرقام المباريات.
- لم يتم تغيير workflow التحديث.

بعد الرفع:
1. ارفع الملفات بنفس المسارات.
2. Commit + Push.
3. انتظر Cloudflare Pages deployment.
4. افتح الموقع مع كسر الكاش:
   https://maensat.pages.dev/#worldcup2026?v=status-object-fix

رسالة الكومت المقترحة:
Fix World Cup status object live labels
