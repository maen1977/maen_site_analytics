# تحديث الترددات الأسبوعي - معن حنونة للستلايت

تم ضبط نظام تحديث الترددات ليعمل أسبوعيًا من Netlify Functions وNetlify Blobs بدل التشغيل اليومي.

## ماذا يفعل النظام؟

- يفحص المصادر الرسمية والموثوقة مرة كل أسبوع.
- يعتمد المصادر الرسمية مثل Nilesat وArabsat تلقائيًا.
- يعتمد مصادر baseline-refresh الموثوقة للأقمار التي لا توفر API رسميًا واضحًا، حتى لا تبقى الأقمار الكبيرة مثل Hot Bird وTürksat وAstra مجرد نسخة ثابتة.
- يستخدم مصادر compare-only للمقارنة والتنبيه فقط.
- يحفظ أحدث قاعدة ترددات في Netlify Blobs.
- يجعل صفحة الترددات في الموقع تقرأ أحدث نسخة تلقائيًا.
- إذا فشل التحميل، يرجع الموقع فورًا إلى النسخة الاحتياطية داخل HTML.
- يرسل تقرير تحديث الترددات على نفس إيميل التقارير، لكن أسبوعيًا.

## الروابط الإدارية

شغل تحديث الترددات يدويًا:

https://maensat.netlify.app/.netlify/functions/run-frequency-update?token=maen_admin_f30RWicjBJKpZOH3NDiHSx4RrU9kSQT

اعرض تقرير آخر تحديث:

https://maensat.netlify.app/.netlify/functions/frequency-update-report?token=maen_admin_f30RWicjBJKpZOH3NDiHSx4RrU9kSQT

اعرض بيانات الترددات الحالية بصيغة JSON:

https://maensat.netlify.app/.netlify/functions/frequency-data

## الجدولة

في `netlify.toml` وداخل ملف `netlify/functions/update-frequencies.mjs` تم ضبط الجدولة التالية:

```toml
[functions."update-frequencies"]
  schedule = "30 20 * * 0"
```

يعني يعمل مرة كل أسبوع، يوم الأحد الساعة 20:30 UTC، تقريبًا 11:30 مساءً بتوقيت الأردن عندما يكون التوقيت UTC+3.

تقرير الزيارات الأسبوعي مضبوط بعده بـ 35 دقيقة:

```toml
[functions."weekly-report"]
  schedule = "5 21 * * 0"
```

## ملاحظات مهمة

- إذا كانت بعض المواقع تمنع القراءة الآلية أو تغيّر شكل الصفحة، سيظهر ذلك في تقرير المراجعة ولن يتوقف الموقع.
- المواقع غير الرسمية تستخدم للمقارنة ورفع الثقة، وليس للاستبدال الأعمى.
- إذا أردت إرسال التقارير إلى Gmail بدل Proton، يجب توثيق دومين في Resend أولًا.
- تشغيل `run-frequency-update` يدويًا يبقى متاحًا بأي وقت، حتى لو الجدولة أسبوعية.
