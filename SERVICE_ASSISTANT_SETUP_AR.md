# قسم خدمة وصيانة الذكي — ملاحظات النسخة

تمت إضافة قسم جديد بدون صفحة Admin:

- الصفحة: `public/service.html`
- الواجهة: `public/assets/service.css` و `public/assets/service.js`
- قاعدة المعرفة: `public/service/knowledge/`
- فهرس البحث الداخلي: `public/service/index/service-search-index.json`
- التقرير اليومي: `public/service/reports/daily-service-report.md`
- سكربت التحديث اليومي: `scripts/github-daily-service-update.mjs`
- Workflow: `.github/workflows/maen-daily-automation.yml`
- API اختياري للـ AI والتسجيل: `functions/api/service-chat.js`

## طريقة العمل

1. الموقع يبحث أولًا داخل الداتا الداخلية.
2. إذا وجد جوابًا قويًا، لا يستخدم AI.
3. إذا لم يجد جوابًا، يحاول استخدام Cloudflare Workers AI فقط إذا كان Binding موجودًا ومفعّلًا.
4. أي جواب AI لا يدخل للداتا الرسمية مباشرة، بل يبقى للمراجعة.
5. GitHub Actions يبني فهرس الخدمة والتقرير كل 24 ساعة.
6. لا توجد صفحة Admin.

## الداتا الموجودة مبدئيًا

الفهرس الحالي يحتوي على 228 مقال/حل داخلي، منها:

- ريسيفرات: Spider, Tiger, Starsat, Geant, Senator, Echolink, Icone, Forever, Qmax, Majestic, Ghazal, Infinity, Star-X, National وغيرها.
- شاشات: Samsung, LG, TCL, Hisense, Sony, G-Guard, Magic, General View, General Deluxe, General Gold وغيرها.
- أنظمة: Samsung Tizen, LG webOS, Google TV, Android TV, VIDAA, Roku TV, Fire TV, Smart OS خاص.
- تطبيقات: YouTube, Netflix, Shahid, TOD, OSN+, IPTV Player, Google Play, Samsung Smart Hub, LG Content Store وغيرها.
- مشاكل: Wi-Fi, LAN, Hotspot, DNS, IPTV يقطع، No Signal، HDMI، الريموت، فشل التحديث، شاشة سوداء.

## Cloudflare AI اختياري

القسم يعمل بدون AI من خلال البحث الداخلي. إذا أردت تشغيل AI لاحقًا على Cloudflare:

- أضف Workers AI binding باسم `AI`.
- يمكن إضافة متغير `SERVICE_AI_ENABLED=1`.
- يمكن تغيير الموديل عبر `SERVICE_AI_MODEL`.

إذا لم يتم ضبط AI، الموقع سيطلب من المستخدم الموديل والتفاصيل بدل استخدام AI.

## Cloudflare D1 اختياري للتقارير التفصيلية

إذا كان Binding `MAEN_DB` موجودًا، سيتم تسجيل الأسئلة وإحصائيات الإجابات. GitHub Actions يستطيع سحب هذه البيانات للتقرير إذا كانت أسرار Cloudflare مضبوطة:

- `CLOUDFLARE_ACCOUNT_ID`
- `CLOUDFLARE_D1_DATABASE_ID`
- `CLOUDFLARE_API_TOKEN`

بدون هذه الأسرار، سيظل التقرير اليومي يبني الفهرس ويعرض عدد المقالات والكاش والمراجعات.

## أوامر الفحص

تم تشغيل:

```bash
npm run check
node scripts/service-smoke-tests.mjs
```

والفحص ناجح.
