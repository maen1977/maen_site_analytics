تحديث sitemap لموقع معن حنونة للستلايت

ما تم تعديله:
- تغيير namespace إلى الصيغة القياسية http://www.sitemaps.org/schemas/sitemap/0.9
- إضافة lastmod لكل صفحة
- إضافة changefreq
- الإبقاء على robots.txt وفيه رابط sitemap

طريقة الرفع:
1. فك الضغط.
2. انسخ مجلد public فوق مجلد public الموجود في مشروعك.
3. وافق على الاستبدال.
4. من GitHub Desktop اعمل Commit ثم Push.

رسالة Commit المقترحة:
Fix sitemap fetch issue

بعد النشر:
1. افتح:
https://maensat.pages.dev/sitemap.xml

2. ادخل Google Search Console > Sitemaps
3. احذف sitemap القديم إن أمكن أو أعد إرسال:
sitemap.xml

إذا ظهر Couldn't fetch مباشرة، انتظر من ساعة إلى 24 ساعة لأن Google أحيانًا يحتاج وقت حتى يقرأ الملف بعد النشر.
