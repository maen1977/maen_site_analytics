# إصلاح آمن لقنوات كأس العالم في موقع MaenSat

هذه الحزمة لا تغيّر تصميم الموقع ولا تعمل فلتر صارم يخرب القنوات الصحيحة.
الفكرة: تنظيف قنوات كأس العالم فقط، ومنع ظهور "غير مؤكد / بانتظار" على بطاقات المباريات.

## الملفات داخل الحزمة

1. `scripts/fix-worldcup-broadcasts-safe.mjs`
   - سكربت تنظيف آمن بعد تحديث بيانات كأس العالم.
   - يفهم أن `beIN Sport` أو `beIN Sports` أو `beIN Sport FTA` تعني `beIN SPORTS المفتوحة` المجانية، بشرط أن تكون ضمن قنوات المباراة نفسها.
   - يحذف `default_channels` من العرض حتى لا تظهر قنوات عامة أو غير مؤكدة كمحطات لمباراة.
   - يترك القنوات المحددة مثل `MAX 1` و`MAX 2` و`4K`.
   - يخفي `MAX 3-6` و`NEWS` و`CONNECT` حسب سياسة الموقع الحالية.

2. `public/worldcup-2026/broadcast-source.json`
   - ملف القنوات اليدوي الموثق.
   - يحافظ على M002 وM003.
   - يضيف M004 أمريكا × باراغواي، M005 قطر × سويسرا، M006 البرازيل × المغرب بالقنوات الأساسية المختصرة فقط.

## طريقة الرفع على GitHub

ارفع الملفات بنفس المسارات:

```text
scripts/fix-worldcup-broadcasts-safe.mjs
public/worldcup-2026/broadcast-source.json
```

## طريقة التشغيل اليدوي

من جذر المشروع:

```bash
node scripts/update-worldcup-2026.mjs
node scripts/fix-worldcup-broadcasts-safe.mjs
```

ثم ارفع الملفات الناتجة:

```bash
git add public/worldcup-2026/broadcasts.json public/worldcup-2026/broadcast-source.json scripts/fix-worldcup-broadcasts-safe.mjs
git commit -m "Fix World Cup broadcast display safely"
git push
```

## مهم

لا تستبدل `index.html` أو `index_phone.html` الآن. هذا الإصلاح مقصود يكون آمن ويشتغل من ملفات البيانات بدون ما نكسر الواجهة.

إذا شفت قناة مكتوبة فقط `beIN SPORTS MAX` بدون رقم، السكربت لا يعرضها لأنها عامة وليست محطة محددة للمباراة.

إذا شفت `beIN Sport` أو `beIN Sport FTA` داخل مباراة محددة، السكربت يعرضها كـ:

```text
beIN SPORTS المفتوحة
```
