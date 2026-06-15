# إصلاح صورة Spider T700 فقط

هذا الإصلاح يعمل فقط على صورة كرت:

Spider T700 Elite 5G

ولا يضيف سكربت عرض جديد للموقع.

ماذا يفعل؟
1. يبحث في تاريخ GitHub عن صورة T700 الأصلية قبل ما تتبدل بالغلط.
2. يرجع هذه الصورة لكرت T700 في:
   - public/index.html
   - public/index_phone.html
3. يحذف فقط استدعاءات سكربتات Spider القديمة التي ممكن تغيّر الصور وقت فتح الموقع:
   - spider-new-devices.js
   - spider-devices-final-guard.js
   - spider-devices-safe-view-fix.js

لا يحذف أي جهاز.
لا يخفي أي صورة.
لا يغير أسعار الأجهزة.

## الملفات المطلوب رفعها

scripts/repair-spider-t700-image-only.mjs
.github/workflows/repair-spider-t700-image-only.yml

## بعد الرفع

GitHub > Actions > Repair Spider T700 image only > Run workflow

بعد النجاح:
- افتح الموقع بنافذة خفية.
- أو اعمل Ctrl + F5.
