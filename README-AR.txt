# إصلاح نهائي مباشر للأسعار فقط

المشكلة الحالية:
- Spider T777 Elite Master Plus ما زال 25 د.أ
- Spider T666 Gold+ 5G ما زال 25 د.أ

هذا الإصلاح يعمل استبدال مباشر داخل:
- public/index.html
- public/index_phone.html

ويتحقق قبل إنهاء التشغيل أن:
- T777 = السعر 20 د.أ
- T666 = السعر 30 د.أ

## ارفع الملفين:

scripts/hard-fix-spider-prices.mjs
.github/workflows/hard-fix-spider-prices.yml

## بعد الرفع

الـ workflow سيعمل تلقائيًا بسبب push.
ولو ما اشتغل:
GitHub > Actions > Hard fix Spider prices > Run workflow

بعدها افتح الموقع بنافذة خفية أو Ctrl + F5.
