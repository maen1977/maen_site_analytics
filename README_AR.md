# موقع معن حنونة — نسخة جاهزة مع تقرير زيارات يومي

هذه النسخة مرتبة للنشر على Netlify كمشروع كامل.

## ماذا أضفت؟

- `public/index.html` — الصفحة الرئيسية الجاهزة، وهي نسخة من ملف الموبايل المعدّل.
- `public/index_phone.html` — نسخة الموبايل بنفس الاسم القديم.
- `netlify/functions/track-visit.mjs` — يستقبل الزيارات المجهولة.
- `netlify/functions/analytics-report.mjs` — يعرض التقرير عبر رابط محمي.
- `netlify/functions/daily-report.mjs` — يشغّل تقريرًا يوميًا مجدولًا.
- `netlify.toml` — إعدادات النشر والتشغيل اليومي والتوكن الجاهز.
- `ADMIN_REPORT_LINKS_AR.txt` — رابط التقرير وكلمة السر.
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

تقرير أمس:

```txt
https://YOUR-SITE.netlify.app/.netlify/functions/analytics-report?day=yesterday&token=maen_admin_f30RWicjBJKpZOH3NDiHSx4RrU9kSQT
```

## هل يحتاج إعدادات إضافية؟

لرؤية التقرير من الرابط: لا، وضعت لك `ANALYTICS_ADMIN_TOKEN` و `ANALYTICS_SALT` جاهزين داخل `netlify.toml`.

لإرسال التقرير إلى الإيميل تلقائيًا: أضفت الكود كاملًا، وضبطت `REPORT_EMAIL` على:

```txt
maenish@gmail.com
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

## نسخة الكمبيوتر

أنت أرسلت ملف الموبايل فقط. عندك ملف اسمه:

```txt
maen-analytics-snippet.html
```

انسخ محتواه وضعه قبل `</body>` في نسخة الكمبيوتر حتى تُحسب زيارات الكمبيوتر أيضًا.

## الخصوصية

النظام لا يسجل الاسم أو رقم الهاتف أو البريد. يحسب الزيارات بشكل مجهول عن طريق معرف محلي في المتصفح، ثم يحوله السيرفر إلى Hash.
