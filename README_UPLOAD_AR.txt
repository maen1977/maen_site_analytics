تصحيح مشكلة تكدس تشغيلات GitHub Actions لقسم كأس العالم 2026

الملف المعدل:
.github/workflows/update-worldcup-2026.yml

ماذا تغير؟
1) تم تغيير إعداد concurrency من:
   cancel-in-progress: false
   إلى:
   cancel-in-progress: true

هذا يمنع تكدس تشغيلات التحديث كل 15 دقيقة في حالة Queued. إذا جاء تشغيل جديد، يتم إلغاء التشغيل القديم بدل أن تبقى التشغيلات مصطفة بالدور.

2) تم إضافة حد انتظار لطلب Cloudflare Deploy Hook:
   --max-time 20 --retry 1 --retry-delay 3

هذا يمنع خطوة Deploy Hook من التعليق لفترة طويلة إذا تأخر رد Cloudflare.

طريقة الرفع:
1) افتح مستودع GitHub.
2) ادخل إلى الملف:
   .github/workflows/update-worldcup-2026.yml
3) اضغط Edit.
4) استبدل محتواه بالكامل بمحتوى الملف الموجود داخل هذه الحزمة بنفس المسار.
5) اعمل Commit مباشرة على main.
6) بعد الحفظ، ادخل Actions وألغِ أي تشغيلات صفراء Queued قديمة.
7) شغّل Workflow مرة واحدة فقط أو انتظر التشغيل التلقائي القادم.

رسالة الكومت المقترحة موجودة في COMMIT_MESSAGE.txt
