# إصلاح إضافة أجهزة SPIDER بدون تكرار

هذا الإصلاح يضيف الجهازين مباشرة داخل `public/index.html` و `public/index_phone.html` بدل سكربت تشغيل في المتصفح.

## لماذا هذا الإصلاح؟
الملفات الموجودة حالياً على GitHub فيها مشكلتان:
- `public/index.html` لا يستدعي `spider-new-devices.js`، لذلك الصور الجديدة لا تظهر.
- `scripts/install-spider-devices.mjs` الحالي فيه `SCRIPT_TAG = ''`، لذلك لم يضف سطر التشغيل.

## ماذا يعمل هذا الإصلاح؟
- يحذف أي استدعاء قديم لـ `spider-new-devices.js` إذا وجد، حتى لا يصير تكرار.
- يضيف الجهازين ككروت ثابتة داخل قسم الأجهزة، قبل أجهزة Majestic.
- يستخدم نفس تصميم كرت SPIDER الموجود بالموقع عن طريق نسخ كرت موجود وتبديل الصورة والاسم والسعر.
- يضع علامات بداية/نهاية حتى إذا شغلته مرة ثانية يستبدل الإضافة بدل تكرارها.

## ارفع الملفات بالمسارات التالية

public/assets/devices/spider-t777-elite-master-plus.jpg
public/assets/devices/spider-t666-gold-plus-5g.jpg
scripts/install-spider-devices-static.mjs
.github/workflows/install-spider-devices-static.yml

## بعد الرفع
1. افتح GitHub > Actions
2. افتح: Install Spider devices static
3. اضغط: Run workflow

بعد النجاح، افحص `public/index.html` وابحث عن:
`SPIDER_NEW_DEVICES_STATIC_START`

ستجد الجهازين:
- Spider T777 Elite Master Plus — السعر 20 د.أ
- Spider T666 Gold+ 5G — السعر 30 د.أ
