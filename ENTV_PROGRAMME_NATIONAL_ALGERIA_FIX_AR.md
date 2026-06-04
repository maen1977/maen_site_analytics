# إصلاح ENTV / Programme National الجزائرية

تم تنفيذ باتش مخصص لقسم الترددات حتى تظهر قناة **ENTV / Programme National** ضمن نتائج البحث الجزائرية المشفرة.

## ماذا تم إصلاحه؟

- تغيير الاسم المعروض من `ENTV` إلى `ENTV / Programme National` لزيادة الوضوح.
- إضافة البلد `algeria` للقناة نفسها، وليس فقط للتردد أو لقنوات أخرى على نفس التردد.
- تغيير حالة القناة من `free` إلى `encrypted` لأن Programme National تُعامل كقناة مشفرة / BISS.
- إضافة أسماء بحث عربية وإنجليزية، مثل:
  - National Program
  - Programme National
  - ENTV
  - EPTV Terrestre
  - القناة الأرضية الجزائرية
  - الأرضية الجزائرية
  - التلفزيون الجزائري الأرضي
  - الوطنية الجزائرية
- تحديث بيانات البحث والفهرسة والنسخة المدمجة داخل HTML.

## النتيجة المتوقعة

عند اختيار:

```text
Nilesat + قنوات الجزائر + مشفرة
```

أو البحث عن:

```text
National Program
القناة الأرضية الجزائرية
Programme National
ENTV
```

يجب أن تظهر القناة على:

```text
11680 H 27500
ENTV / Programme National
Encrypted
```

## الملفات التي تم تعديلها

- `public/frequencies/frequency-data.json`
- `public/frequencies/frequency-data.v20260530.json`
- `public/frequencies/search-index.json`
- `public/frequencies/channel-classification.json`
- `public/index.html`
- `public/index_phone.html`
- `scripts/search-smoke-tests.mjs`

## الفحص

تمت إضافة اختبارات للتأكد من أن:

- `National Program` يرجع ENTV / Programme National.
- `القناة الأرضية الجزائرية` ترجع ENTV / Programme National.
- فلتر Nilesat + الجزائر + مشفرة يحتوي القناة.
