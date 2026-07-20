# Maen Site Safe Update - Frequency Data

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
node scripts/search-smoke-tests.mjs
```

ونجحت اختبارات البحث، ومنها:
- MBC
- MBC على Nilesat/Eutelsat 7W-8W
- CBC مقابل MBC
- beIN Sports
- كل الصفوف فيها system/mod
