# Ultimate fix Spider prices v2

سبب فشل النسخة السابقة:
كان فيها خطأ كتابي في أول سطر: import صار imp||t.

هذه نسخة مصححة وتعمل بطريقة أبسط:
- تبحث عن اسم الجهاز.
- تبحث عن كلمة "السعر" بعد الاسم داخل نفس كرت الجهاز.
- تغير أول رقم بعد كلمة السعر.

المطلوب:
- Spider T777 Elite Master Plus = 20
- Spider T666 Gold+ 5G = 30

## ارفع الملفين:

scripts/ultimate-fix-spider-prices-v2.mjs
.github/workflows/ultimate-fix-spider-prices-v2.yml

## بعد الرفع:

GitHub > Actions > Ultimate fix Spider prices v2 > Run workflow

بعد النجاح افتح الموقع بنافذة خفية أو Ctrl + F5.
