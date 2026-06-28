# إصلاح كأس العالم داخل التحديث الأصلي كل 15 دقيقة

هذا الملف معمول حسب طلبك: لا يضيف Action جديد، ولا يغيّر تصميم الموقع، ولا يلمس `index.html`.

## ماذا يغيّر؟

يستبدل ملفين فقط:

1. `.github/workflows/update-worldcup-2026.yml`
2. `scripts/worldcup-quarter-hour-force.mjs`

## ماذا يعمل الإصلاح؟

- يحافظ على نفس Action الأصلي: `Update World Cup 2026 every 15 minutes`.
- يحافظ على نفس الجدولة: كل 15 دقيقة تقريباً.
- يحدّث النتائج من ESPN داخل نفس سكربت التحديث الأصلي.
- يعيد بناء `standings.json` و `groups.json`.
- يحدّث `bracket.json` داخل نفس التحديث الأصلي.
- يربط أسماء المنتخبات في دور الـ32 بدل الرموز مثل `1A` و `2B` و `3B/E/F/I/J` قدر الإمكان.
- ينقل الفائزين تلقائياً للأدوار التالية عندما تصبح نتيجة المباراة موثقة.
- يكتب ملفات فحص كل تشغيل: `heartbeat.json`, `update-check.json`, `version.json`, `deploy-marker.txt`.

## طريقة التركيب

1. فك الضغط.
2. ارفع محتويات المجلد إلى جذر الريبو:
   `maen1977/maen_site_analytics`
3. وافق على استبدال الملفين الموجودين.
4. اعمل Commit بهذه الرسالة:

```text
Restore original 15-minute World Cup updater with integrated knockout patch
```

5. ادخل GitHub Actions.
6. شغّل Action الأصلي فقط:

```text
Update World Cup 2026 every 15 minutes
```

7. بعد نجاحه، افحص:

```text
https://maensat.pages.dev/worldcup-2026/heartbeat.json?v=15min
```

لا تشغّل أي Action قديم من ملفات الإصلاح السابقة.

## ملاحظات مهمة

- هذا الإصلاح لا يحتوي على `worldcup-final-ui-fix.js` ولا `knockout-live-cards` ولا أي سكربت واجهة.
- إذا كانت ملفات إصلاح قديمة موجودة في الريبو، لا تشغّلها. الأفضل حذفها لاحقاً بهدوء، لكن هذا الملف لا يعتمد عليها.
- إذا بقي الموقع لا يعرض التحديث رغم أن `heartbeat.json` تغير، تكون المشكلة نشر/كاش، وليس سكربت التحديث.
