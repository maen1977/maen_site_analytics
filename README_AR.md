# إصلاح الأدوار المباشر لكأس العالم 2026 - MaenSat

هذا الإصلاح يعمل فقط على قسم كأس العالم ولا يغيّر تصميم الموقع العام.

## ماذا يفعل؟

1. يجعل تبويب **الأدوار** هو التبويب الافتراضي عند دخول المستخدم إلى قسم كأس العالم.
2. يعرض الأدوار بنفس نظام كروت المباريات: فريق × فريق، النتيجة، الحالة، التاريخ، الساعة، والملعب.
3. يحوّل رموز مثل `1A` و `2B` و `3B/E/F/I/J` إلى أسماء منتخبات عندما تكون بيانات المجموعات متوفرة.
4. يحدّث باقي الأدوار تلقائياً: الفائز من مباراة 73 ينتقل إلى المباراة التالية بعد ظهور النتيجة في ملفات JSON.
5. ينشئ ملف فحص مباشر:
   `/worldcup-2026/knockout-live-health.json`

## طريقة التركيب

1. فك ضغط الملف.
2. ارفع كل الملفات إلى جذر الريبو:
   `maen1977/maen_site_analytics`
3. اعمل Commit بهذه الرسالة:

```text
Add World Cup knockout live cards and auto update
```

4. ادخل GitHub Actions.
5. شغّل Action باسم:
   **World Cup knockout live cards**
6. بعد نجاحه انتظر Deploy الموقع.
7. افتح:

```text
https://maensat.pages.dev/worldcup-2026/knockout-live-health.json?v=test
```

إذا ظهر وقت جديد، فالبيانات صارت تتحدث.

## ملاحظات مهمة

- هذا الإصلاح لا يحذف التحديث القديم ولا يوقفه.
- لا يحتاج Deploy Hook طالما أنت أكدت أن الموقع يحدث.
- لو لم يظهر تبويب الأدوار مباشرة، افتح الموقع بكسر الكاش:
  `https://maensat.pages.dev/?v=knockout-live`

## الملفات المضافة

- `.github/workflows/worldcup-knockout-live-cards.yml`
- `scripts/worldcup-knockout-live-sync.mjs`
- `scripts/install-worldcup-knockout-cards-ui.mjs`
- `public/worldcup-knockout-cards-ui.js`

