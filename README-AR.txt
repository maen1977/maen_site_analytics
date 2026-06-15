# Cloudflare Deploy Hook لقسم كأس العالم

هذه النسخة تجعل GitHub Action يعمل كل ربع ساعة، ويعمل:
1. تحديث بيانات كأس العالم.
2. Heartbeat commit حتى لو لا توجد مباراة.
3. Push إلى GitHub.
4. تشغيل Cloudflare Pages Deploy Hook مباشرة.

## الملفات المطلوب رفعها واستبدال القديمة

scripts/touch-worldcup-last-checked.mjs
.github/workflows/update-worldcup-2026.yml

## مهم جدًا قبل التشغيل

لازم تضيف Deploy Hook في Cloudflare:

Cloudflare > Workers & Pages > مشروع الموقع > Settings > Builds & deployments > Deploy hooks > Create hook

سمّه مثلًا:
worldcup-quarter-hour

ثم انسخ الرابط واحفظه في GitHub Secret باسم:

CLOUDFLARE_PAGES_DEPLOY_HOOK

المسار:
GitHub repo > Settings > Secrets and variables > Actions > New repository secret

Name:
CLOUDFLARE_PAGES_DEPLOY_HOOK

Value:
رابط الـ Deploy Hook من Cloudflare

## بعد الرفع وإضافة Secret

GitHub > Actions > Update World Cup 2026 data > Run workflow

## كيف تتأكد؟

بعد التشغيل، افحص:
public/worldcup-2026/heartbeat.json

وتأكد من Cloudflare:
Workers & Pages > مشروع الموقع > Deployments

لازم تشوف deploy جديد بعد كل تشغيل.
