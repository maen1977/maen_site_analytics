# تحديث الترددات اليومي - معن حنونة للستلايت

تمت إضافة نظام تحديث ترددات يومي يعمل من Netlify Functions وNetlify Blobs.

## ماذا يفعل النظام؟

- يفحص المصادر الرسمية والموثوقة كل 24 ساعة.
- يعتمد المصادر الرسمية مثل Nilesat وArabsat تلقائيًا.
- يستخدم LyngSat وKingOfSat وSatBeams كمرجع مقارنة ومراقبة، ولا يعتمد تغييرًا منفردًا منها إلا إذا توافق أكثر من مصدر أو كان المصدر رسميًا.
- يحفظ أحدث قاعدة ترددات في Netlify Blobs.
- يجعل صفحة الترددات في الموقع تقرأ أحدث نسخة تلقائيًا.
- إذا فشل التحميل، يرجع الموقع فورًا إلى النسخة الاحتياطية داخل HTML.
- يرسل تقرير تحديث الترددات على نفس إيميل التقارير.

## الروابط الإدارية

شغل تحديث الترددات يدويًا:

https://maensat.netlify.app/.netlify/functions/run-frequency-update?token=maen_admin_f30RWicjBJKpZOH3NDiHSx4RrU9kSQT

اعرض تقرير آخر تحديث:

https://maensat.netlify.app/.netlify/functions/frequency-update-report?token=maen_admin_f30RWicjBJKpZOH3NDiHSx4RrU9kSQT

اعرض بيانات الترددات الحالية بصيغة JSON:

https://maensat.netlify.app/.netlify/functions/frequency-data

## الجدولة

في netlify.toml أضفنا:

[functions."update-frequencies"]
  schedule = "30 20 * * *"

يعني يعمل يوميًا حوالي 11:30 مساءً بتوقيت الأردن عندما يكون التوقيت UTC+3.

## ملاحظات مهمة

- إذا كانت بعض المواقع تمنع القراءة الآلية أو تغيّر شكل الصفحة، سيظهر ذلك في تقرير المراجعة ولن يتوقف الموقع.
- المواقع غير الرسمية تستخدم للمقارنة ورفع الثقة، وليس للاستبدال الأعمى.
- إذا أردت إرسال التقارير إلى Gmail بدل Proton، يجب توثيق دومين في Resend أولًا.
