# Maensat emergency 15-minute watchdog patch

هذه حزمة الطوارئ التي تعمل بطبقتين:

1. GitHub workflow رئيسي يحدث ملفات كأس العالم كل 15 دقيقة.
2. GitHub watchdog يشتغل كل 5 دقائق، يقرأ `heartbeat.json`، وإذا صار آخر تحديث أقدم من 12 دقيقة يشغّل التحديث الرئيسي فورًا.
3. اختياري لكنه الأقوى: Cloudflare Worker Cron يشغّل GitHub workflow كل 15 دقيقة من خارج GitHub، حتى لا نعتمد على GitHub schedule وحده.

## ارفع هذه الملفات إلى GitHub واستبدل الموجود

```text
.github/workflows/update-worldcup-2026.yml
.github/workflows/worldcup-2026-watchdog.yml
scripts/worldcup-quarter-hour-force.mjs
public/_headers
```

ارفعهم من جذر الريبو، وليس داخل مجلد الحزمة.

## بعد الرفع مباشرة

من GitHub:

1. افتح Actions.
2. افتح `World Cup 2026 watchdog every 5 minutes`.
3. اضغط `Run workflow` مرة واحدة.
4. بعدها افتح `Update World Cup 2026 every 15 minutes` وتأكد أن تشغيل جديد ظهر.

الـ watchdog لا يكتب ملفات بنفسه. هو فقط يراقب آخر نبضة ويشغّل ملف التحديث الرئيسي إذا تأخر.

## Cloudflare Worker Cron — الضمان الأقوى

هذا اختياري لكنه أفضل حل لو بدك مش بس GitHub. داخل الحزمة يوجد:

```text
cloudflare-worker/maensat-github-dispatch-worker.js
cloudflare-worker/wrangler.toml
```

### من GitHub اعمل Token

GitHub → Settings → Developer settings → Personal access tokens → Fine-grained token

اختر الريبو:

```text
maen1977/maen_site_analytics
```

الصلاحية المطلوبة:

```text
Actions: Read and write
```

لا تعطِه صلاحيات زيادة. خليه ينتهي بعد كأس العالم.

### من Cloudflare

1. Workers & Pages.
2. Create Worker.
3. الصق محتوى `maensat-github-dispatch-worker.js`.
4. Settings → Variables and Secrets.
5. أضف Secret باسم:

```text
GITHUB_TOKEN
```

والقيمة هي GitHub token.

6. أضف Variables عادية:

```text
GITHUB_OWNER = maen1977
GITHUB_REPO = maen_site_analytics
GITHUB_WORKFLOW_ID = update-worldcup-2026.yml
GITHUB_REF = main
```

7. Settings → Triggers → Cron Triggers → Add cron:

```text
*/15 * * * *
```

## ملاحظات

- لا ترسل GitHub token لأي شخص ولا تضعه داخل الملفات.
- GitHub schedule ممكن يتأخر أو ينحذف تحت الضغط، لذلك أضفنا watchdog.
- Cloudflare Cron هو الطبقة الخارجية الأقوى لأنه يشغّل GitHub يدويًا عبر API كل 15 دقيقة.
