# إصلاح أسعار Spider بطريقة تفهم HTML

سبب فشل السكربت السابق:
كان يبحث عن "السعر 25 د.أ" كنص واحد.
لكن الصفحة غالباً فيها السعر مفصول داخل عناصر HTML، مثل:
السعر ... <span>25</span> د.أ

هذا الإصلاح يبحث عن كلمة "السعر" ثم يغير أول رقم بعدها داخل نفس كرت الجهاز.

## المطلوب
- Spider T777 Elite Master Plus = 20 د.أ
- Spider T666 Gold+ 5G = 30 د.أ

## ارفع الملفين

scripts/html-aware-fix-spider-prices.mjs
.github/workflows/html-aware-fix-spider-prices.yml

## بعد الرفع
قد يشتغل تلقائياً بسبب push.
أو شغله يدويًا:

GitHub > Actions > HTML aware fix Spider prices > Run workflow

بعد النجاح:
- افتح الموقع بنافذة خفية أو Ctrl + F5.
