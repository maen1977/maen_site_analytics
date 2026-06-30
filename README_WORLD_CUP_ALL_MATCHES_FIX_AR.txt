إصلاح عام لكل مباريات كأس العالم الإقصائية

هذا الإصلاح لا يغيّر جدولة التحديث كل ربع ساعة.
لا يوجد أي تعديل على cron ولا على WORLD_CUP_2026_INTERVAL_MINUTES.

الهدف:
- تطبيق قراءة ركلات الترجيح والتمديد على كل المباريات، وليس مباراة ألمانيا وباراغواي فقط.
- عدم الاعتماد على نتيجة يدوية لمباراة واحدة.
- قراءة نتيجة الترجيح من الحقول المنظمة في ESPN إذا وُجدت.
- قراءة نتيجة الترجيح من نص ESPN مثل: "Paraguay advances 4-3 on penalties" إذا لم تكن الحقول المنظمة موجودة.
- تحديد الفائز تلقائياً من الترجيح ونقله للدور التالي.
- منع bracket.json من حذف نتيجة موجودة في matches.json عند توليد knockout-live.json.

الملفات:
- scripts/worldcup-quarter-hour-force.mjs
- scripts/worldcup-knockout-live-sync.mjs

طريقة الرفع:
1. انسخ الملفين فوق نفس المسارات في مشروعك.
2. Commit.
3. Push origin.
4. انتظر GitHub Actions حتى تصبح خضراء.
5. افتح الموقع واضغط Ctrl + F5.

رسالة Commit مقترحة:
Apply universal World Cup penalty and knockout result handling
