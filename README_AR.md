# موقع معن حنونة — نسخة جاهزة مع تقرير زيارات أسبوعي

هذه النسخة مرتبة للنشر على Netlify كمشروع كامل.

## ماذا أضفت؟

- `public/index.html` — الصفحة الرئيسية الجاهزة، وهي نسخة من ملف الموبايل المعدّل.
- `public/index_phone.html` — نسخة الموبايل بنفس الاسم القديم.
- `netlify/functions/track-visit.mjs` — يستقبل الزيارات المجهولة.
- `netlify/functions/analytics-report.mjs` — يعرض التقرير عبر رابط محمي، ويمكن عرض تقرير أسبوعي بإضافة `period=week`.
- `netlify/functions/weekly-report.mjs` — يشغّل تقرير زيارات أسبوعيًا ويجمع آخر 7 أيام كاملة.
- `netlify/functions/update-frequencies.mjs` — يشغّل تحديث الترددات أسبوعيًا.
- `netlify.toml` — إعدادات النشر والتشغيل الأسبوعي والتوكن الجاهز.
- `ADMIN_REPORT_LINKS_AR.txt` — روابط التقارير وكلمة السر.
- `backup/index_phone_original_backup.html` — نسخة احتياطية من الملف الأصلي.

## طريقة الرفع الصحيحة

الأفضل أن ترفع هذه الحزمة كمشروع Netlify من GitHub أو عبر Netlify CLI، وليس رفع ملف HTML وحده.

الملف `netlify.toml` يحدد أن مجلد النشر هو:

```txt
public
```

والوظائف الخلفية موجودة في:

```txt
netlify/functions
```

## رابط التقرير

بعد النشر استبدل `YOUR-SITE` باسم موقعك وافتح:

```txt
https://YOUR-SITE.netlify.app/.netlify/functions/analytics-report?token=maen_admin_f30RWicjBJKpZOH3NDiHSx4RrU9kSQT
```

تقرير أسبوعي لآخر 7 أيام حتى التاريخ المحدد:

```txt
https://YOUR-SITE.netlify.app/.netlify/functions/analytics-report?period=week&token=maen_admin_f30RWicjBJKpZOH3NDiHSx4RrU9kSQT
```

تقرير أمس فقط، إذا احتجته يدويًا:

```txt
https://YOUR-SITE.netlify.app/.netlify/functions/analytics-report?day=yesterday&token=maen_admin_f30RWicjBJKpZOH3NDiHSx4RrU9kSQT
```

## هل يحتاج إعدادات إضافية؟

لرؤية التقرير من الرابط: لا، وضعت لك `ANALYTICS_ADMIN_TOKEN` و `ANALYTICS_SALT` جاهزين داخل `netlify.toml`.

لإرسال التقرير إلى الإيميل تلقائيًا: أضفت الكود كاملًا، وضبطت `REPORT_EMAIL` على:

```txt
maenish_ai@proton.me
```

المتبقي فقط أن تضيف مفتاح Resend السري من لوحة Netlify:

```txt
RESEND_API_KEY=ضع_مفتاح_Resend
```

ثم جرّب الإرسال من:

```txt
https://YOUR-SITE.netlify.app/.netlify/functions/send-test-email?token=maen_admin_f30RWicjBJKpZOH3NDiHSx4RrU9kSQT
```

بدون `RESEND_API_KEY` سيُحفظ التقرير ويظهر بالرابط، لكنه لن يُرسل بالبريد.

## الجدولة الأسبوعية

- تحديث الترددات: كل يوم أحد الساعة 20:30 UTC، تقريبًا 11:30 مساءً بتوقيت الأردن عند UTC+3.
- تقرير الزيارات الأسبوعي: كل يوم أحد الساعة 21:05 UTC، تقريبًا 12:05 بعد منتصف الليل بتوقيت الأردن عند UTC+3.
- تقرير الزيارات الأسبوعي يجمع آخر 7 أيام كاملة حسب توقيت `Asia/Amman`.

## نسخة الكمبيوتر

أنت أرسلت ملف الموبايل فقط. عندك ملف اسمه:

```txt
maen-analytics-snippet.html
```

انسخ محتواه وضعه قبل `</body>` في نسخة الكمبيوتر حتى تُحسب زيارات الكمبيوتر أيضًا.

## الخصوصية

النظام لا يسجل الاسم أو رقم الهاتف أو البريد. يحسب الزيارات بشكل مجهول عن طريق معرف محلي في المتصفح، ثم يحوله السيرفر إلى Hash.

## تحديث الترددات الأسبوعي

تمت إضافة نظام تحديث ومقارنة للترددات يعمل أسبوعيًا. راجع ملف `FREQUENCY_UPDATE_SETUP_AR.md` للروابط وطريقة التشغيل.
