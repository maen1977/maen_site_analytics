# إصلاح خطأ علامات Git Conflict في أرشيف كأس العالم

استبدل الملفين في المستودع بنفس المسارات:

- `scripts/worldcup-canonical-finalizer.mjs`
- `.github/workflows/update-worldcup-2026.yml`

الإصلاح يقوم بما يلي:

1. يكتشف علامات `<<<<<<<`, `=======`, `>>>>>>>` داخل ملفات JSON وTXT في `public/worldcup-2026`.
2. يستعيد نسخة JSON صالحة قبل تشغيل المثبت النهائي.
3. يثبت جميع مباريات M073-M104 والنهائي: إسبانيا 1-0 الأرجنتين.
4. يفحص عدم بقاء علامات تعارض.
5. يوقف الجدولة كل 15 دقيقة؛ التشغيل يصبح يدوياً فقط من Actions.

بعد رفع الملفين، شغّل من GitHub Actions:

`World Cup 2026 Final Archive (manual only)` ثم `Run workflow` مرة واحدة.
