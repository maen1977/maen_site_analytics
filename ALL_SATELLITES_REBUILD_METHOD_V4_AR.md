# تقرير تطبيق طريقة Amos على باقي الأقمار - v4

تم في هذه النسخة نقل طريقة Amos من كونها تصحيحًا خاصًا بقمر واحد إلى آلية تحديث أوسع لكل الأقمار الموجودة في قائمة الموقع.

## ما تم فعليًا

- تم إبقاء داتا الموقع الأصلية وعدم حذف أي تردد موجود.
- تم تغيير مفتاح الدمج الداخلي من: القمر + التردد + القطبية فقط، إلى: القمر + التردد + القطبية + Symbol Rate، حتى لا يتم دمج ترددين مختلفين بالخطأ إذا تشابه MHz والقطبية.
- تم تحسين قارئ DTHSat ليقرأ نوعين من الجداول:
  - الجداول العادية: Channel Name / Frequency / Polarity / Symbol Rate / FEC.
  - الجداول المركبة: Frequency Polarity و Symbol Rate/FEC داخل نفس الخانة.
- تم إضافة مصادر DTHSat كاملة إضافية للأقمار التي لم تكن مغطاة بنفس مستوى Amos:
  - Badr 26E
  - Eutelsat 16E
  - Eutelsat 9E
  - Hellas Sat 39E
  - Hellas Sat 3
  - Eutelsat 36E
  - Intelsat 20 / 68.5E
- صار عدد مصادر التحديث في `netlify/frequency-sources.json`: 67 مصدر.

## نقطة مهمة جدًا

هذه النسخة لا تدّعي أن الملف المدمج داخل الموقع هو نسخة حية 100% لكل قنوات العالم. الداتا المدمجة هي fallback آمن، أما المصدر الأقوى بعد النشر فهو تشغيل:

```text
/.netlify/functions/run-frequency-update?token=YOUR_TOKEN
```

بعد تشغيله على Netlify سيقوم المحدث بجلب المصادر الحية ودمج النواقص داخل Netlify Blobs، والموقع سيقرأ النسخة الحية تلقائيًا من:

```text
/.netlify/functions/frequency-data
```

## الملفات المعدلة

- `netlify/functions/_frequency-utils.mjs`
- `netlify/frequency-sources.json`
- `netlify/frequency-baseline.json`
- `public/frequencies/frequency-data.json`
- `public/index.html`
- `public/index_phone.html`
- `index.html`

## الخلاصة

قمر Amos بقي فيه baseline موسّع يدويًا من النسخة السابقة، وهذه النسخة جعلت باقي الأقمار تدخل نفس طريقة الاستيراد والتدقيق عند تشغيل التحديث، بدل أن تبقى بعض الأقمار معتمدة على مصادر قليلة أو Parser أضعف.
