# تصحيح قنوات كأس العالم - MaenSat

## الملفات الموجودة داخل الحزمة

ارفع هذين الملفين إلى نفس المسارات داخل GitHub:

1. `scripts/fix-worldcup-broadcasts-safe.mjs`
2. `public/worldcup-2026/broadcast-source.json`

> لا ترفع ملف ZIP نفسه داخل الريبو. فك الضغط أولاً، ثم ارفع الملفات الموجودة بداخله.

## طريقة الرفع من GitHub

### الملف الأول

المسار:

```text
scripts/fix-worldcup-broadcasts-safe.mjs
```

إذا الملف موجود، استبدله بالملف الموجود داخل هذه الحزمة.
إذا غير موجود، أنشئ ملف جديد بنفس الاسم داخل مجلد `scripts`.

رسالة الحفظ المقترحة:

```text
Fix safe World Cup broadcast cleanup script
```

### الملف الثاني

المسار:

```text
public/worldcup-2026/broadcast-source.json
```

استبدل الملف القديم كاملًا بالملف الموجود داخل هذه الحزمة.

رسالة الحفظ المقترحة:

```text
Update confirmed World Cup broadcast source
```

## بعد الرفع

إذا عندك كمبيوتر أو Codespaces، شغل من جذر المشروع:

```bash
node scripts/update-worldcup-2026.mjs
node scripts/fix-worldcup-broadcasts-safe.mjs
```

بعدها ارفع الملف الناتج إذا تغيّر:

```text
public/worldcup-2026/broadcasts.json
```

## ماذا يصلح هذا التعديل؟

- يمنع ظهور كلمات مثل: بانتظار، غير مؤكد، pending، to be confirmed.
- لا يستخدم `default_channels` كقنوات ظاهرة للمباريات.
- يعتبر `beIN Sport` و `beIN Sports` و `beIN Sport FTA` قناة مجانية عندما تكون مكتوبة كقناة للمباراة نفسها.
- يحافظ على القنوات الأساسية فقط: المفتوحة، MAX 1، MAX 2، 4K.
- لا يخلط قنوات المباريات المتزامنة؛ كل مباراة حسب `match_id`.
