# إصلاح ثابت لقسم أجهزة Spider

هذا الإصلاح لا يضيف أي JavaScript جديد للموقع ولا يخفي أي جهاز.

ماذا يعمل؟
1. يحذف فقط استدعاءات السكربتات القديمة التي كانت تغير العرض:
   - spider-new-devices.js
   - spider-devices-final-guard.js
   - spider-devices-safe-view-fix.js

2. يصحح الأسعار داخل:
   - public/index.html
   - public/index_phone.html

   Spider T777 Elite Master Plus = 20 د.أ
   Spider T666 Gold+ 5G = 30 د.أ

3. يثبت صور الجهازين الجديدين:
   - T777 => /assets/devices/spider-t777-elite-master-plus.jpg
   - T666 => /assets/devices/spider-t666-gold-plus-5g.jpg

4. يرجع صورة Spider T700 Elite 5G من تاريخ GitHub إذا كانت تبدلت بالغلط إلى صورة T666/T777.

## الملفات المطلوب رفعها

scripts/repair-spider-static-clean.mjs
.github/workflows/repair-spider-static-clean.yml

## بعد الرفع

GitHub > Actions > Repair Spider static clean > Run workflow

بعد نجاح التشغيل:
- افتح الموقع بنافذة خفية.
- أو اعمل Ctrl + F5.
- لا تشغل Workflows Spider القديمة.
