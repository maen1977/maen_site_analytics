# إزالة الأدوار من قسم الرئيسية فقط

هذا الملف يزيل عبارة **الأدوار / الأدوار الإقصائية** من وصف بطاقة كأس العالم في **قسم الرئيسية** فقط.

لا يلمس:

- `.github/workflows/update-worldcup-2026.yml`
- `scripts/worldcup-quarter-hour-force.mjs`
- `public/worldcup-2026/*.json`
- نظام التحديث كل ربع ساعة

## طريقة التركيب

1. فك الضغط.
2. انسخ محتويات المجلد إلى جذر مشروع GitHub.
3. شغّل:

```bat
APPLY_REMOVE_ADWAR_FROM_HOME_ONLY.bat
```

4. اعمل Commit بهذه الرسالة:

```text
Remove knockout wording from desktop homepage only
```

## ملاحظة مهمة

هذا لا يحذف تبويب **الأدوار** من داخل قسم كأس العالم 2026 نفسه؛ يحذفها فقط من الرئيسية.
