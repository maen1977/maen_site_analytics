# Maen Site Safe Update - Frequency & World Cup Broadcasts

## الملفات التي تم تعديلها

- `functions/_lib/frequency-utils.js`
  - إضافة حماية من حذف الترددات من أول فحص.
  - أي تردد يختفي من المصدر اليومي يبقى محفوظاً حتى يغيب 3 فحوصات ناجحة متتالية.
  - إذا كان فحص المصادر ناقصاً بشكل كبير في `system/mod` يتم منع الحذف نهائياً لذلك اليوم.
  - التردد الجديد الذي ينقصه `system/mod` لا يُنشر في الموقع، بل ينتقل إلى `reviewedOnly`.
  - عند تحديث تردد موجود، يتم الحفاظ على معلومات النسخة القديمة التقنية إذا رجع المصدر الجديد ناقصاً.
  - تحسين قراءة `system/mod` من سطر التردد نفسه في جداول المصادر.

- `scripts/github-daily-frequency-update.mjs`
  - إضافة تقرير جودة للمصادر داخل GitHub Actions logs.
  - يوضح عدد المرشحين الناقصين `system/mod` وعينات منهم.
  - تمرير تقرير الجودة إلى منطق الدمج لمنع الحذف غير الآمن.

- `.github/workflows/maen-daily-automation.yml`
  - إضافة متغيرات أمان للترددات:
    - `FREQUENCY_REMOVE_MISSING_AFTER_CHECKS`
    - `FREQUENCY_MAX_INCOMPLETE_SYSTEM_MOD_FOR_REMOVAL`
    - `FREQUENCY_MAX_INCOMPLETE_SYSTEM_MOD_RATIO_FOR_REMOVAL`

- `scripts/update-worldcup-2026.mjs`
  - دعم مصدر بث محلي `public/worldcup-2026/broadcast-source.json`.
  - ما زال يدعم `WORLD_CUP_2026_BROADCAST_SOURCE_URL` إذا أردت استخدام رابط خارجي.
  - لا يغيّر القنوات المجانية إلا عند إضافة تأكيد رسمي في ملف المصدر.

- `public/worldcup-2026/broadcast-source.json`
  - ملف جاهز لإضافة تأكيدات البث الرسمية مثل beIN المفتوحة.
  - حالياً لا يعلن أي مباراة مجانية تلقائياً، لأنه يحتاج رابط رسمي.

- `.gitignore`
  - إضافة حماية لمنع رفع `.env` و `.dev.vars` والمفاتيح المحلية إلى GitHub.

- `.env.example`
  - إضافة شرح المتغيرات الجديدة بدون أسرار حقيقية.

## ما لم يتم تغييره

- لم يتم تعديل نظام البحث الذكي.
- لم يتم تغيير منطق البحث عن مصر، MBC، أو MBC على نايل سات.
- لم يتم تغيير ملفات `frequency-data.json` أو `search-index.json` مباشرة.

## الفحص

تم تشغيل:

```bash
node --check functions/_lib/frequency-utils.js
node --check scripts/github-daily-frequency-update.mjs
node --check scripts/update-worldcup-2026.mjs
node scripts/search-smoke-tests.mjs
```

ونجحت اختبارات البحث، ومنها:
- MBC
- MBC على Nilesat/Eutelsat 7W-8W
- CBC مقابل MBC
- beIN Sports
- كل الصفوف فيها system/mod

## تحديث إضافي: فاحص أخبار beIN SPORTS الرسمي لكأس العالم

تمت إضافة طبقة تلقائية آمنة لقسم كأس العالم:

- يراقب النظام صفحات beIN SPORTS الرسمية الموجودة في `public/worldcup-2026/bein-news-sources.json`.
- صفحات الفهرس تستخدم لاكتشاف الأخبار، ولا يتم النشر منها مباشرة لتجنب خلط أخبار متعددة.
- النشر التلقائي يحدث فقط إذا ذكر مصدر beIN الرسمي المباراة والقناة بوضوح وبدرجة ثقة كافية.
- إذا ذكر الخبر القناة بشكل عام مثل `beIN SPORTS MAX` بدون رقم، تبقى الحالة `to_be_confirmed` ولا يتم اختراع رقم القناة.
- إذا ذكر الخبر `beIN SPORTS المفتوحة` أو free-to-air مع المباراة بوضوح، يتم وضعها كقناة مجانية مؤكدة مع رابط المصدر.
- أي نتائج غير واضحة توضع في `public/worldcup-2026/broadcast-review.json` للمراجعة ولا تظهر كحقيقة مؤكدة على الموقع.

متغيرات اختيارية في GitHub Variables:

```text
WORLD_CUP_2026_BEIN_AUTO_CHECK=1
WORLD_CUP_2026_BEIN_NEWS_URLS=رابط1;رابط2
WORLD_CUP_2026_BEIN_MAX_DISCOVERED_ARTICLES=12
WORLD_CUP_2026_BEIN_CONFIRMATION_SCORE=80
```

إذا أردت إيقاف الفاحص مؤقتاً:

```text
WORLD_CUP_2026_BEIN_AUTO_CHECK=0
```
