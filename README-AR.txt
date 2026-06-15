# إصلاح آمن لقسم الأجهزة

هذا الإصلاح لا يحذف أي كرت جهاز.

ماذا يعمل؟
1. يلغي سكربتات الإضافة القديمة التي قد تسبب إخفاء أو تكرار الأجهزة:
   - spider-new-devices.js
   - spider-devices-final-guard.js

2. يصحح الأسعار داخل index.html و index_phone.html:
   - Spider T777 Elite Master Plus = 20 د.أ
   - Spider T666 Gold+ 5G = 30 د.أ

3. يضيف سكربت آمن فقط:
   - يمسح فلتر البحث داخل قسم الأجهزة.
   - يرجع كل كروت الأجهزة ظاهرة.
   - لا يحذف أي جهاز.
   - يثبت صورة وسعر T777 و T666 إذا كانت موجودة.

## ارفع الملفات بنفس المسارات

public/assets/spider-devices-safe-view-fix.js
scripts/safe-repair-spider-devices.mjs
.github/workflows/safe-repair-spider-devices.yml

## بعد الرفع

GitHub > Actions > Safe repair Spider devices > Run workflow

بعد النجاح:
- افتح الموقع بنافذة خفية أو اعمل Ctrl + F5.
- ادخل قسم الأجهزة.
- إذا بقي فقط جهاز واحد، امسح خانة البحث واضغط "كل الشركات".
- للتجربة من Console:
  fixSpiderDevicesSafe()
