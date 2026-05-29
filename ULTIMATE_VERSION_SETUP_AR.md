# نسخة Maen Ultimate Platform Ready

هذه النسخة تجمع كل المراحل المطلوبة:

1. قسم جديد باسم **آخر التحديثات** على الكمبيوتر والموبايل.
2. تحديث ترددات يومي عبر GitHub Actions.
3. توليد ملف `public/updates/latest-updates.json` يوميًا ليعرض الموقع الأخبار والتغييرات.
4. نموذج بلاغات الزوار داخل قسم آخر التحديثات.
5. Cloudflare Pages يبقى للاستضافة + Function خفيفة فقط لتسجيل الزيارات والبلاغات.
6. Netlify يبقى استضافة Static، مع تحويل البلاغات والتتبع إلى Cloudflare.
7. SEO أساسي: `sitemap.xml`, `robots.txt`, صفحات هبوط خفيفة، وبيانات LocalBusiness.
8. الصور المحسّنة تبقى مفعّلة كما في النسخة السابقة.

## ماذا ترفع على GitHub؟

ارفع محتويات هذا المجلد إلى الريبو، وليس المجلد نفسه.

## أسرار GitHub المطلوبة

في GitHub > Settings > Secrets and variables > Actions:

### Secrets

- `RESEND_API_KEY`
- `REPORT_EMAIL`
- `FREQUENCY_REPORT_EMAIL` إذا تريد تقرير الترددات على بريد مختلف
- `REPORT_FROM`
- `CLOUDFLARE_ACCOUNT_ID`
- `CLOUDFLARE_D1_DATABASE_ID`
- `CLOUDFLARE_API_TOKEN`

### Variables اختيارية

- `PUBLIC_BASE_URL` مثال: `https://maensat.pages.dev`
- `ANALYTICS_TIMEZONE` مثال: `Asia/Amman`
- `FREQUENCY_SOURCE_CONCURRENCY` القيمة المقترحة: `16`
- `FREQUENCY_REMOVE_MISSING` القيمة: `1`

## إعدادات Cloudflare المطلوبة

اربط D1 باسم Binding:

- `MAEN_DB`

وأضف Environment Variables / Secrets:

- `ANALYTICS_SALT`
- `ALLOWED_ORIGIN` اختياري

شغّل schema الموجود في:

```text
cloudflare/schema.sql
```

هذا ينشئ جداول الزيارات وبلاغات الزوار.

## ماذا يحدث يوميًا؟

- 20:30 UTC: GitHub Actions يحدث الترددات ويولد آخر التحديثات وملفات SEO ويعمل commit.
- 21:05 UTC: GitHub Actions يجلب زيارات وبلاغات اليوم السابق من Cloudflare D1 ويرسل تقرير Resend.

## ملاحظات مهمة

- Netlify لا يشغّل Functions في هذه النسخة؛ هو يستضيف الملفات فقط.
- Cloudflare يشغّل فقط وظائف خفيفة: `/api/track-visit` و `/api/submit-report`.
- لا يتم نشر بلاغات الزوار مباشرة؛ يتم إرسالها لك في التقرير اليومي للمراجعة.
- قسم الرياضة مخصص للمصادر الرسمية/القابلة للمراجعة لمنطقة الشرق الأوسط.
