# إصلاح نهائي لتحديث كأس العالم كل ربع ساعة

## ارفع واستبدل هذه الملفات

1. .github/workflows/update-worldcup-2026.yml
2. scripts/touch-worldcup-last-checked.mjs
3. public/_headers

## ماذا يفعل الإصلاح؟

- يشغل GitHub Actions كل ربع ساعة: 4، 19، 34، 49 من كل ساعة.
- يجبر سكربت كأس العالم على الفحص مع مباراة أو بدون مباراة.
- يحدّث metadata داخل ملفات كأس العالم.
- يحدّث heartbeat.json و deploy-marker.txt كل تشغيل.
- يعمل commit/push كل تشغيل.
- يضرب Cloudflare Deploy Hook إذا كان Secret موجود.
- public/_headers يمنع كاش ملفات /worldcup-2026/*.

## Secret المطلوب في GitHub

CLOUDFLARE_PAGES_DEPLOY_HOOK

إذا مش موجود، الـ workflow لن يفشل، لكنه سيكتب في اللوج أنه تخطى Cloudflare hook.

## بعد الرفع

GitHub > Actions > Update World Cup 2026 data > Run workflow

بعد النجاح راقب:
public/worldcup-2026/heartbeat.json

وراقب Cloudflare:
Workers & Pages > مشروع الموقع > Deployments
