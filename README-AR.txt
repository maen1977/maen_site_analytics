# إضافة رسيفرين SPIDER إلى قسم الأجهزة

## الأجهزة المضافة
1. Spider T777 Elite Master Plus
   السعر على الموقع: 20 د.أ

2. Spider T666 Gold+ 5G
   السعر على الموقع: 30 د.أ

تم إزالة السعر المطبوع من الصور، والسعر سيظهر داخل كرت المنتج في الموقع.

## ارفع الملفات كما هي بنفس المسارات

public/assets/devices/spider-t777-elite-master-plus.jpg
public/assets/devices/spider-t666-gold-plus-5g.jpg
public/assets/spider-new-devices.js
scripts/install-spider-devices.mjs
.github/workflows/install-spider-devices.yml

## بعد الرفع

1. افتح GitHub > Actions
2. افتح: Install Spider devices
3. اضغط: Run workflow

الـ Workflow سيضيف سطر تشغيل السكربت تلقائياً إلى:
public/index.html
public/index_phone.html

السطر الذي سيضاف:
<script src="/assets/spider-new-devices.js?v=20260615-devices"></script>

## ملاحظة

السكربت ينسخ تصميم كرت جهاز موجود في قسم الأجهزة، حتى تبقى الإضافة بنفس شكل وتصميم الموقع.
إذا لم يجد كرتاً جاهزاً لأي سبب، يعمل كرت احتياطي بتصميم مناسب ومتجاوب.
