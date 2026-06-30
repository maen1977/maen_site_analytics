تصحيح v16 - حل مشكلة ظهور "الوضع غير مفعل" بعد اختيار التطبيق كتطبيق SMS افتراضي

ارفع الملفات التالية فوق القديمة بنفس أماكنها:

app/build.gradle.kts
app/src/main/kotlin/com/laithdev/smssender/MainActivity.kt
app/src/main/kotlin/com/laithdev/smssender/SmsRoleHelper.kt
.github/workflows/build-debug-apk.yml
keystore.properties
app/maensat-sms-sender.jks

رسالة commit المقترحة:
Fix default SMS mode detection on Xiaomi

بعد الرفع:
Actions > Build Maensat Safe APK > Run workflow

بعد التثبيت:
1) افتح التطبيق.
2) اضغط زر جعل التطبيق SMS الافتراضي.
3) اختر maensat sms sender.
4) ارجع للتطبيق، وسيعمل تحديث تلقائي للحالة.

سبب التصحيح:
بعض أجهزة Xiaomi/MIUI ترجع من شاشة اختيار تطبيق SMS بدون تحديث الشاشة داخل التطبيق.
تمت إضافة تحديث عند العودة للشاشة، وتم تحسين فحص RoleManager لتأكيد أن التطبيق هو تطبيق SMS الافتراضي.
