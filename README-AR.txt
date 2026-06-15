إصلاح v2 لمشكلة أن قسم "كل المباريات" لا يفتح على مباراة اليوم

السبب السابق:
- public/assets/worldcup-current-focus.js انرفع.
- لكن public/index.html لم يحتوي على سطر تشغيل السكربت.
- وملف scripts/install-worldcup-current-focus.mjs كان فيه SCRIPT_TAG فارغ، لذلك لم يحقن السطر.

ارفع هذه الملفات واستبدل الموجودة:

1) public/assets/worldcup-current-focus.js
2) scripts/install-worldcup-current-focus.mjs
3) .github/workflows/install-worldcup-current-focus.yml

بعد الرفع:
1. ادخل GitHub > Actions
2. افتح Install World Cup current focus
3. اضغط Run workflow
4. بعد نجاحه تأكد أن public/index.html يحتوي على:
   /assets/worldcup-current-focus.js?v=20260615-v2

ثم افتح:
https://maensat.pages.dev/#worldcup2026

واضغط "كل المباريات".
