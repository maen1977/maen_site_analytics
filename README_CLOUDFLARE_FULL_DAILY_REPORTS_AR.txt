حل Cloudflare بالكامل لتقرير الترددات وزيارات الموقع
=====================================================

ماذا تفعل هذه الحزمة؟
---------------------
1) تضيف Cloudflare Worker Cron مستقل:
   workers/maen-cloudflare-cron-worker.js

2) الـ Worker يشتغل يومياً الساعة 08:15 صباحاً بتوقيت الأردن تقريباً:
   wrangler.cloudflare-cron.toml
   cron: 15 5 * * *  (UTC)

3) التحديث اليومي يصير داخل Cloudflare:
   - تحديث الترددات من المصادر
   - تخزين آخر frequency-data في Cloudflare D1 داخل جدول frequency_cache
   - إرسال تقرير الترددات عبر Resend
   - قراءة زيارات أمس من Cloudflare D1
   - إرسال تقرير زيارات الموقع عبر Resend
   - حفظ حالة آخر تشغيل في D1 داخل جدول cloudflare_cron_status

4) تضيف API داخل Cloudflare Pages لقراءة البيانات الحية:
   /api/frequency-data
   /api/frequency-report

5) تضيف override للمسارات القديمة حتى الموقع يقرأ من Cloudflare live cache بدل الملف الثابت عندما تكون البيانات موجودة:
   /frequencies/frequency-data.json
   /frequencies/latest-frequency-update-report.json

الملفات الموجودة
----------------
workers/maen-cloudflare-cron-worker.js
functions/api/frequency-data.js
functions/api/frequency-report.js
functions/frequencies/frequency-data.json.js
functions/frequencies/latest-frequency-update-report.json.js
migrations/cloudflare-cron-d1.sql
wrangler.cloudflare-cron.toml
public/cloudflare/cloudflare-cron-status.json
COMMIT_MESSAGE.txt

مهم جداً في Cloudflare
----------------------
لازم يكون عندك نفس D1 الذي يستقبل زيارات الموقع مربوط باسم:
MAEN_DB

والـ Worker يحتاج هذه المتغيرات/الأسرار:
RESEND_API_KEY        سر Resend للإرسال
REPORT_EMAIL          البريد الذي يستقبل التقارير
REPORT_FROM           مثال: Maen Analytics <reports@your-domain.com>
ANALYTICS_TIMEZONE    Asia/Amman
PUBLIC_BASE_URL       https://maensat.pages.dev
CRON_ADMIN_TOKEN      أي كلمة سر قوية للتشغيل اليدوي

اختياري:
FREQUENCY_REPORT_EMAIL إذا بدك تقرير الترددات يروح لبريد مختلف.
MAEN_FREQUENCY_KV إذا بدك KV أيضاً، لكن D1 يكفي.

طريقة التشغيل المقترحة
----------------------
1) ارفع الملفات على GitHub Desktop واعمل Commit + Push.

2) من Cloudflare Dashboard:
   Workers & Pages -> Create Worker
   اربط نفس D1 باسم MAEN_DB
   أضف Secrets أعلاه
   أضف Cron Trigger: 15 5 * * *

أو عبر Wrangler بعد تعديل database_id في wrangler.cloudflare-cron.toml:
   npx wrangler deploy --config wrangler.cloudflare-cron.toml

اختبار يدوي بعد النشر
----------------------
افتح رابط الـ Worker الخاص بك:
https://YOUR-WORKER.YOUR-SUBDOMAIN.workers.dev/status

ثم شغل التقرير يدوياً:
POST https://YOUR-WORKER.YOUR-SUBDOMAIN.workers.dev/run/all?token=CRON_ADMIN_TOKEN

أو فقط الترددات:
POST https://YOUR-WORKER.YOUR-SUBDOMAIN.workers.dev/run/frequency?token=CRON_ADMIN_TOKEN

أو فقط زيارات الموقع:
POST https://YOUR-WORKER.YOUR-SUBDOMAIN.workers.dev/run/analytics?token=CRON_ADMIN_TOKEN

بعد أول تشغيل ناجح
------------------
الموقع سيقرأ الترددات الحية من Cloudflare عبر:
https://maensat.pages.dev/frequencies/frequency-data.json

وإذا لم توجد بيانات حية بعد، يرجع تلقائياً للملف الثابت الموجود في الموقع.

رسالة الكومت
------------
Move daily reports and frequency updates to Cloudflare cron
