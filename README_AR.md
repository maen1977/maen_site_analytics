# تنظيف عرض كأس العالم من الرئيسية على نسخة الحاسوب فقط

هذا الملف يعمل تنظيف صغير وآمن حسب المطلوب:

- يزيل حقن سكربت عرض الأدوار UI-only من نسخة الحاسوب `public/index.html` فقط.
- يزيل ذكر "ترتيب المجموعات" و"الأدوار الإقصائية" من بطاقة كأس العالم في الرئيسية على نسخة الحاسوب فقط إذا وجد النص نفسه.
- لا يلمس قسم كأس العالم نفسه ولا ملفات البيانات.
- لا يلمس `public/index_phone.html`.
- لا يغير GitHub Actions.
- لا يغير التحديث الأصلي كل 15 دقيقة.

## الملفات التي يعدلها السكربت

```text
public/index.html
```

## الملفات التي لا يلمسها

```text
.github/workflows/update-worldcup-2026.yml
scripts/worldcup-quarter-hour-force.mjs
public/index_phone.html
public/worldcup-2026/*.json
```

## طريقة التركيب

1. فك الضغط داخل جذر مشروع GitHub.
2. شغل الملف:

```text
APPLY_DESKTOP_HOME_WORLDCUP_CLEANUP.bat
```

أو من Terminal:

```bash
node scripts/cleanup-desktop-home-worldcup-only.mjs
```

3. اعمل Commit بهذه الرسالة:

```text
Clean desktop homepage World Cup 2026 display only
```

4. ارفع التغييرات.

## مهم

لا تشغل أي Action جديد. التحديث الأصلي كل ربع ساعة يبقى كما هو.
