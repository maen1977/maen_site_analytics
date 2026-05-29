# إعداد النسخة الجديدة: GitHub Actions + Cloudflare + Netlify

هذه النسخة تجعل الشغل اليومي الثقيل على GitHub Actions بدل Netlify أو Cloudflare Cron.

## البنية الجديدة

```text
GitHub Actions:
- تحديث الترددات والمحطات يوميًا
- مقارنة الجديد مع القديم
- حذف الترددات القديمة عند توفر تغطية كافية من المصادر
- تحديث ملف public/frequencies/frequency-data.json
- عمل commit تلقائي
- إرسال تقرير الترددات عبر Resend
- إرسال تقرير الزيارات اليومي عبر Resend من Cloudflare D1

Cloudflare Pages:
- استضافة الموقع
- تسجيل الزيارات فقط عبر /api/track-visit

Netlify:
- استضافة static فقط
- لا توجد جدولة ولا Functions مطلوبة
```

## ماذا تغير في الموقع؟

- البحث عن الترددات صار يقرأ من الملف الثابت:

```text
/frequencies/frequency-data.json
```

بدل:

```text
/api/frequency-data
```

- تسجيل الزيارات صار يرسل مباشرة إلى Cloudflare:

```text
https://maensat.pages.dev/api/track-visit
```

حتى لو الزائر فتح نسخة Netlify، يتم إرسال الزيارة إلى Cloudflare D1.

## أسرار GitHub المطلوبة

افتح GitHub repo ثم:

```text
Settings → Secrets and variables → Actions → Secrets
```

أضف الأسرار التالية:

```text
RESEND_API_KEY
REPORT_EMAIL
REPORT_FROM
CLOUDFLARE_ACCOUNT_ID
CLOUDFLARE_D1_DATABASE_ID
CLOUDFLARE_API_TOKEN
```

اختياريًا أضف:

```text
FREQUENCY_REPORT_EMAIL
```

إذا لم تضفه، تقرير الترددات سيذهب إلى `REPORT_EMAIL`.

## متغيرات GitHub الاختيارية

من:

```text
Settings → Secrets and variables → Actions → Variables
```

يمكن إضافة:

```text
ANALYTICS_TIMEZONE=Asia/Amman
FREQUENCY_SOURCE_CONCURRENCY=16
FREQUENCY_FETCH_TIMEOUT_MS=4500
FREQUENCY_REMOVE_MISSING=1
FREQUENCY_MIN_CANDIDATES_FOR_REMOVAL=50
FREQUENCY_MIN_SUCCESSFUL_SOURCES_FOR_REMOVAL=5
```

## صلاحيات GitHub Actions

الـ workflow يستخدم:

```text
permissions:
  contents: write
```

حتى يستطيع عمل commit يومي لملف الترددات.

إذا فشل الـ commit، افتح:

```text
Settings → Actions → General → Workflow permissions
```

واختر:

```text
Read and write permissions
```

## جدولة GitHub Actions

الملف:

```text
.github/workflows/maen-daily-automation.yml
```

يشغل مهمتين:

```text
20:30 UTC يوميًا → تحديث الترددات وإرسال تقرير الترددات
21:05 UTC يوميًا → إرسال تقرير الزيارات من Cloudflare D1
```

## Cloudflare المطلوب

على Cloudflare Pages يجب أن يكون عندك D1 binding باسم:

```text
MAEN_DB
```

ويجب أن تكون جداول D1 مضافة من:

```text
cloudflare/schema.sql
```

Cloudflare Pages يحتاج فقط endpoint تسجيل الزيارات:

```text
/api/track-visit
```

ولا يحتاج Cron Worker للتحديث اليومي.

## Netlify المطلوب

Netlify أصبح static hosting فقط. ملف `netlify.toml` الآن لا يحتوي على جدول Functions.

إذا كان Netlify مربوطًا بـ GitHub، سيأخذ ملف الترددات الجديد بعد كل commit من GitHub Actions وينشره كموقع static.

## تشغيل يدوي من GitHub

من GitHub:

```text
Actions → Maen daily automation → Run workflow
```

اختر:

```text
both
```

أو:

```text
frequencies
```

أو:

```text
analytics
```

## ملاحظة مهمة عن “مين دخل”

التقرير لا يعرف اسم الشخص الحقيقي إلا إذا الزائر سجّل دخول أو عبّى نموذج باسمه.

الذي يتم تخزينه هو معلومات مجهولة مثل:

```text
البلد
المدينة إذا وصلت من Cloudflare
الصفحة
مصدر الزيارة
الجهاز
اللغة
وقت الدخول
Visitor hash بدل IP كامل
```

هذا أفضل للخصوصية وأقل مخاطرة.

## ملاحظة عن ملفات Netlify القديمة

تم نقل Functions القديمة إلى:

```text
netlify/functions_backup_not_deployed
```

حتى لا يتعامل Netlify معها كـ Functions فعّالة. هذا فقط للرجوع لها إذا احتجنا، وليس للتشغيل الحالي.
