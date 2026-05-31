# إصلاح بحث قسم الترددات

## سبب المشكلة
كان ربط أحداث البحث في قسم الترددات يتم بعد اكتمال تحميل ملف قاعدة الترددات. إذا تأخر تحميل `frequency-manifest.json` أو ملف البيانات بسبب الكاش/الشبكة، كانت خانة البحث تظهر للمستخدم لكن الكتابة فيها لا تعيد فلترة النتائج مباشرة.

## ما تم إصلاحه
- ربط خانة البحث فور فتح قسم الترددات، قبل انتظار تحميل قاعدة البيانات.
- إضافة ربط احتياطي مباشر على `input/change` حتى لا يتوقف البحث إذا تأخر التهيئة.
- جعل `loadFrequencyFeature()` ينتظر تهيئة قسم الترددات فعليًا، مع fallback آمن لو حدث خطأ.
- إضافة fallback لمسارات ملفات الترددات:
  - `/frequencies/frequency-manifest.json`
  - `frequencies/frequency-manifest.json`
  - `/frequencies/frequency-data.json`
  - `frequencies/frequency-data.json`
- تطبيق نفس الإصلاح على:
  - `public/index.html`
  - `public/index_phone.html`

## فحوصات تمت
تم تشغيل:

```bash
npm run build:static
npm run check
node scripts/search-smoke-tests.mjs
```

وتأكدت الاختبارات من أن البحث عن:
- `11766`
- `جزيرة`
- `beinsport`
- `اون تايم سبورت`
- `ON Sport`

يعطي نتائج صحيحة.

## ملاحظة رفع
بعد رفع النسخة، يفضل عمل Deploy جديد كامل. إذا بقيت المشكلة عندك على نفس الجهاز فقط، افتح الموقع بنافذة خاصة أو امسح كاش المتصفح لأن ملفات HTML/JS القديمة ممكن تكون معلقة عند المتصفح.
