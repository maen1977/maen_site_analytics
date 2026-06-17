# تحديث كأس العالم كل ربع ساعة — ملفات جاهزة للرفع

هذه الحزمة تعمل 3 أشياء معًا:

1. تشغل GitHub Actions كل 15 دقيقة على الفرع `main`.
2. تفحص ملفات مباريات كأس العالم والقنوات الناقلة، وتغيّر `heartbeat.json` و `update-check.json` وملفات البيانات حتى لو لم تتغير النتيجة.
3. تجبر Cloudflare Pages على نشر نسخة حديثة: إمّا عبر Deploy Hook، أو عبر Git integration، أو اختيارياً عبر Wrangler Direct Deploy إذا أضفت توكن Cloudflare.

## ارفع الملفات كما هي

ارفع هذه الملفات بنفس المسارات داخل مستودع GitHub:

```text
.github/workflows/update-worldcup-2026.yml
scripts/worldcup-quarter-hour-force.mjs
public/_headers
```

إذا سألك GitHub هل تستبدل الملفات القديمة، اختر Replace / Commit changes.

## إعداد Cloudflare المهم جدًا

من Cloudflare:

1. افتح Workers & Pages.
2. اختر مشروع Pages الخاص بالموقع، غالبًا اسمه `maensat`.
3. ادخل Settings ثم Builds.
4. اعمل Add deploy hook.
5. اختر الفرع `main`.
6. انسخ رابط الـ Deploy Hook.

من GitHub:

1. افتح المستودع `maen1977/maen_site_analytics`.
2. Settings → Secrets and variables → Actions.
3. New repository secret.
4. الاسم:

```text
CLOUDFLARE_PAGES_DEPLOY_HOOK
```

5. القيمة: رابط الـ Deploy Hook من Cloudflare.

## اختياري لكن أقوى: النشر المباشر عبر Wrangler

إذا أردت أن يرفع GitHub الملفات مباشرة إلى Cloudflare حتى لو Git integration فيه مشكلة، أضف هذه الأسرار:

```text
CLOUDFLARE_API_TOKEN
CLOUDFLARE_ACCOUNT_ID
```

وحط هذا كـ Repository variable إذا اسم مشروع Pages ليس `maensat`:

```text
CLOUDFLARE_PAGES_PROJECT
```

القيمة المتوقعة غالبًا:

```text
maensat
```

## كيف تتأكد أنه اشتغل؟

بعد الرفع:

1. GitHub → Actions → Update World Cup 2026 every 15 minutes.
2. اضغط Run workflow للتجربة الآن.
3. بعد نجاح التشغيل، افتح هذه الملفات في المستودع وتأكد أن الوقت تغيّر:

```text
public/worldcup-2026/heartbeat.json
public/worldcup-2026/update-check.json
public/worldcup-2026/deploy-marker.txt
```

## ملاحظات مهمة

- GitHub Actions قد يتأخر أحيانًا، خصوصًا عند بداية الساعة، لذلك الجدولة هنا على الدقائق `4,19,34,49` بدل `0,15,30,45`.
- إذا لم تضف `CLOUDFLARE_PAGES_DEPLOY_HOOK`، سيظل GitHub يحدّث الملفات، لكن Cloudflare قد لا ينشر فورًا إذا الربط مع GitHub غير مضبوط.
- ملف `public/_headers` يمنع كاش ملفات كأس العالم حتى تظهر آخر نسخة للزائر.
