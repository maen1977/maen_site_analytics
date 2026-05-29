# نسخة تعمل على Netlify و Cloudflare Pages — تحديث Cloudflare يومي

هذه النسخة تجعل الموقع يعمل على الطرفين:

- **Netlify**: بقي كما هو من ناحية Functions والجدولة القديمة.
- **Cloudflare Pages**: أضيف له نظام يومي لتحديث الترددات وإرسال تقرير الزيارات عبر Resend.

## ماذا تغير؟

- بقيت ملفات Netlify القديمة كما هي داخل `netlify/functions`.
- بقيت جدولة Netlify كما هي في `netlify.toml`.
- أُضيفت Cloudflare Pages Functions داخل `functions/api`.
- تم تعديل واجهة الموقع لتستخدم مسار API موحد:

```text
/api/track-visit
/api/frequency-data
/api/analytics-report
/api/daily-report
/api/run-frequency-update
```

- أُضيف redirect في `netlify.toml` حتى `/api/...` يعمل على Netlify أيضًا.
- أُضيف ملف `public/_redirects` حتى الروابط القديمة `/.netlify/functions/...` لا تنكسر على Cloudflare.
- أُضيفت قاعدة D1 في `cloudflare/schema.sql`.
- أُضيف Worker يومي في `cloudflare/cron-worker.js`.

## إعدادات Netlify

لا تغيّر شيئًا في Netlify. ارفع النسخة على GitHub فقط، وNetlify سيستعمل نفس إعداداته:

```text
Publish directory: public
Functions directory: netlify/functions
```

## إعدادات Cloudflare Pages

في Cloudflare Pages استخدم:

```text
Framework preset: None
Build command: exit 0
Build output directory: public
```

## إنشاء قاعدة D1 في Cloudflare

1. افتح Cloudflare Dashboard.
2. ادخل على D1 وأنشئ قاعدة باسم:

```text
maen_analytics
```

3. نفّذ SQL الموجود في:

```text
cloudflare/schema.sql
```

إذا كنت نفذت نسخة قديمة من schema قبل هذه النسخة، نفّذ أيضًا:

```text
cloudflare/migration_add_daily_geo_columns.sql
```

لو ظهر خطأ `duplicate column` فهذا طبيعي ويعني أن العمود موجود.

4. افتح مشروع Cloudflare Pages:

```text
Settings → Functions → D1 database bindings
```

أضف Binding باسم:

```text
MAEN_DB
```

واختر قاعدة `maen_analytics`.

## Environment Variables / Secrets في Cloudflare Pages

أضف نفس قيم Resend الموجودة عندك في Netlify، لكن داخل Cloudflare:

```text
RESEND_API_KEY=مفتاح Resend
REPORT_EMAIL=الإيميل الذي تصله تقارير الزيارات
REPORT_FROM=Maen Analytics <الإيميل الموثق في Resend>
FREQUENCY_REPORT_EMAIL=الإيميل الذي تصله تقارير الترددات، أو اتركه غير موجود ليستخدم REPORT_EMAIL
ANALYTICS_SALT=قيمة سرية طويلة
ANALYTICS_ADMIN_TOKEN=توكن إداري طويل
ANALYTICS_TIMEZONE=Asia/Amman
PUBLIC_BASE_URL=https://maensat.pages.dev
```

اختياريًا للتحديث اليومي للترددات:

```text
FREQUENCY_REMOVE_MISSING=1
FREQUENCY_MIN_CANDIDATES_FOR_REMOVAL=50
FREQUENCY_MIN_SUCCESSFUL_SOURCES_FOR_REMOVAL=5
FREQUENCY_SOURCE_CONCURRENCY=16
FREQUENCY_FETCH_TIMEOUT_MS=4500
```

مهم: `FREQUENCY_REMOVE_MISSING=1` يعني أن Cloudflare يحذف الترددات التي لا تظهر في الفحص اليومي عندما تكون تغطية المصادر كافية. إذا أردت إيقاف الحذف التلقائي مؤقتًا، اجعلها:

```text
FREQUENCY_REMOVE_MISSING=0
```

## تجربة Cloudflare يدويًا

بعد نشر Cloudflare Pages، جرّب:

```text
https://maensat.pages.dev/api/frequency-data
```

لتشغيل تحديث الترددات يدويًا وإرسال تقرير Resend:

```text
https://maensat.pages.dev/api/run-frequency-update?email=1&token=YOUR_TOKEN
```

لتقرير زيارات يومي يدوي:

```text
https://maensat.pages.dev/api/daily-report?token=YOUR_TOKEN
```

لعرض تقرير زيارات HTML:

```text
https://maensat.pages.dev/api/analytics-report?period=day&format=html&token=YOUR_TOKEN
```

## تشغيل التحديث اليومي والتقرير اليومي على Cloudflare

Cloudflare Pages Functions لا تشغّل Cron مباشرة من داخل Pages، لذلك يوجد Worker منفصل:

```text
cloudflare/cron-worker.js
```

أنشئ Worker جديد في Cloudflare، والصق هذا الملف، ثم أضف Variables/Secrets للـ Worker:

```text
PAGES_BASE_URL=https://maensat.pages.dev
ANALYTICS_ADMIN_TOKEN=نفس التوكن الموجود في Pages
```

ثم أضف Cron Triggers:

```text
30 20 * * *
5 21 * * *
```

الأول يشغّل تحديث الترددات يوميًا.  
الثاني يرسل تقرير الزيارات اليومي يوميًا.

مع `ANALYTICS_TIMEZONE=Asia/Amman`، توقيت 21:05 UTC يكون بعد منتصف الليل في الأردن غالبًا، فيرسل تقرير اليوم السابق المكتمل.

## ما الذي يحتويه تقرير الزيارات اليومي؟

- عدد فتح الصفحات.
- عدد الزوار التقريبي.
- عدد الجلسات.
- مصدر الزيارة `referrer`.
- البلد من Cloudflare إذا كان متاحًا.
- المدينة/المنطقة إذا كانت متاحة من Cloudflare.
- الجهاز واللغة والصفحة.
- آخر الزيارات كرموز Hash مجهولة بدل IP كامل.

ملاحظة خصوصية مهمة: لا يمكن معرفة اسم الشخص الحقيقي إلا إذا قام هو بالتواصل أو التسجيل. التقرير يعطي بلد/مصدر/جهاز/زائر مجهول، وليس هوية شخصية.
