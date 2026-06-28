# إصلاح عرض الأدوار داخل World Cup 2026 فقط

هذا الملف مخصص لعمل تعديل واجهة فقط داخل قسم كأس العالم 2026.

## ماذا يفعل؟

- لا يغير GitHub Actions.
- لا يغير جدول التحديث كل ربع ساعة.
- لا يغير سكربت التحديث الأصلي.
- لا يلمس باقي أقسام الموقع.
- يضيف ملف واجهة داخل:

```text
public/worldcup-2026/worldcup-knockout-ui-only.js
```

- يجعل تبويب الأدوار داخل قسم كأس العالم يعرض مباريات الأدوار على شكل كروت مثل نظام المجموعات.
- يقرأ البيانات من ملفات كأس العالم الحالية:

```text
public/worldcup-2026/matches.json
public/worldcup-2026/bracket.json
public/worldcup-2026/standings.json
public/worldcup-2026/groups.json
```

لذلك عندما يحدث التحديث الأصلي كل 15 دقيقة، الأدوار ستقرأ نفس الملفات الجديدة بدون تغيير نظام التحديث.

## طريقة التركيب الآمنة

1. فك الضغط داخل نسخة المشروع عندك.
2. تأكد أن الملفات صارت في نفس أماكنها.
3. شغل الملف:

```text
APPLY_WORLD_CUP_2026_UI_ONLY.bat
```

أو من Terminal:

```bash
node scripts/install-worldcup-2026-ui-only.mjs
```

4. ارفع التغييرات إلى GitHub.
5. رسالة الـ commit المقترحة:

```text
Add World Cup 2026 knockout UI-only card display
```

## مهم جداً

لا تشغل أي Action جديد. هذا الإصلاح لا يحتاج Action جديد.

اترك Action التحديث الأصلي كما هو:

```text
Update World Cup 2026 every 15 minutes
```

التعديل فقط يركب سكربت واجهة داخل قسم كأس العالم 2026، ولا يغير التحديث كل 15 دقيقة.

## إذا أردت تركيبه يدوياً من GitHub بدون تشغيل bat

ارفع الملف:

```text
public/worldcup-2026/worldcup-knockout-ui-only.js
```

ثم افتح `public/index.html` وأضف قبل `</body>` هذا السطر:

```html
<!-- MaenSat World Cup 2026 UI-only knockout start -->
<script src="/worldcup-2026/worldcup-knockout-ui-only.js?v=20260628-ui-only" defer></script>
<!-- MaenSat World Cup 2026 UI-only knockout end -->
```

وإذا عندك `public/index_phone.html` أضف نفس السطر فيه أيضاً.
