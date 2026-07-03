استرجاع تقارير الترددات والزيارات اليومية عبر GitHub Actions
==============================================================

ما الذي تضيفه هذه الحزمة؟
-------------------------
تضيف Workflow جديد مستقل:

.github/workflows/daily-frequency-and-analytics-report.yml

هذا الـ Workflow يرجع النظام القديم:
- GitHub Actions هو المشغّل اليومي.
- Cloudflare D1 هو مصدر بيانات الزيارات.
- Cloudflare Pages يبقى للاستضافة وتسجيل الزيارات.
- Resend يبقى لإرسال الإيميل.

متى يعمل؟
---------
يعمل يومياً على cron:

15 5 * * *

يعني 05:15 UTC، وتقريباً 08:15 صباحاً بتوقيت الأردن عندما يكون الأردن UTC+3.

ماذا يشغل؟
----------
1. npm run github:update-frequencies
   وهذا يشغّل:
   scripts/github-daily-frequency-update.mjs

2. إذا تغيرت ملفات الترددات، يعمل commit و push حتى Cloudflare Pages يعيد النشر.

3. npm run github:analytics-report
   وهذا يشغّل:
   scripts/github-daily-analytics-report.mjs

4. يقرأ زيارات أمس من Cloudflare D1 ويرسل تقرير الإيميل.

الأسرار المطلوبة في GitHub
--------------------------
اذهب إلى:
GitHub repo → Settings → Secrets and variables → Actions → New repository secret

وتأكد من وجود هذه الأسرار:

CLOUDFLARE_ACCOUNT_ID
CLOUDFLARE_D1_DATABASE_ID
CLOUDFLARE_API_TOKEN
RESEND_API_KEY
REPORT_EMAIL
REPORT_FROM
ANALYTICS_TIMEZONE
PUBLIC_BASE_URL

القيم المقترحة:

ANALYTICS_TIMEZONE = Asia/Amman
PUBLIC_BASE_URL = https://maensat.pages.dev
REPORT_EMAIL = البريد الذي يستقبل التقارير
REPORT_FROM = بريد موثق في Resend، مثل: Maen Reports <reports@your-domain.com>

مهم جداً
--------
CLOUDFLARE_D1_DATABASE_ID لازم يكون لنفس قاعدة D1 التي يستخدمها الموقع في /api/track-visit.
لا تعمل قاعدة D1 جديدة، لأن التقرير سيقرأ من القاعدة الحالية التي تخزن الزيارات.

كيف تشغله يدوياً؟
-----------------
بعد رفع الملفات وعمل push:

GitHub → Actions → Daily frequency and analytics reports → Run workflow

يمكن اختيار:
- all
- frequency_only
- analytics_only

ويمكن وضع REPORT_DATE مثل 2026-07-02 إذا أردت تقرير يوم معين.

رسالة الكومت المقترحة
---------------------
Restore GitHub Actions daily reports and frequency updates
