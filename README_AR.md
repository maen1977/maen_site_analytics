# إصلاح آمن لتحديث كأس العالم 2026 وربط أسماء فرق الأدوار

هذا الملف لا يغيّر تصميم الموقع ولا يضيف سكربتات للواجهة. الإصلاح يلمس فقط:

- GitHub Action الخاص بالتحديث كل ربع ساعة.
- سكربت يربط رموز الأدوار مثل `1A` و`2B` و`3A/B/C` بأسماء المنتخبات من `standings.json`.
- إعدادات كاش آمنة لملفات JSON داخل `/worldcup-2026`.
- ملفات فحص واضحة: `heartbeat.json` و`deploy-health.json` و`bracket-linker-status.json`.

## الملفات الموجودة في هذا الإصلاح

- `.github/workflows/update-worldcup-2026.yml`
- `scripts/worldcup-bracket-linker.mjs`
- `scripts/worldcup-cache-headers-safe.mjs`

## طريقة التركيب

1. فك ضغط الملف.
2. ارفع محتويات المجلد إلى جذر الريبو:
   `maen1977/maen_site_analytics`
3. اعمل Commit بهذه الرسالة:

```text
Fix World Cup 2026 live update and bracket team names
```

4. ادخل إلى GitHub ثم **Actions**.
5. شغّل يدويًا workflow باسم:
   **Update World Cup 2026 every 15 minutes**
6. انتظر انتهاء التشغيل وظهور Commit جديد من `github-actions[bot]`.
7. انتظر Cloudflare Pages يعمل Deploy جديد.
8. افتح هذه الروابط للفحص:

- `https://maensat.pages.dev/worldcup-2026/heartbeat.json?v=check`
- `https://maensat.pages.dev/worldcup-2026/deploy-marker.txt?v=check`
- `https://maensat.pages.dev/worldcup-2026/bracket-linker-status.json?v=check`
- `https://maensat.pages.dev/worldcup-2026/deploy-health.json?v=check`

## كيف تعرف أين المشكلة لو بقي الموقع لا يتحدث؟

افتح:

`https://maensat.pages.dev/worldcup-2026/deploy-health.json?v=check`

إذا وجدت:

```json
"cloudflare_hook_configured": false
```

فهذا يعني أن GitHub قد يعمل ويكتب ملفات جديدة، لكن Cloudflare قد لا ينشرها إذا كان الربط التلقائي مع GitHub غير شغال. في هذه الحالة تحتاج إضافة Secret باسم:

`CLOUDFLARE_PAGES_DEPLOY_HOOK`

داخل GitHub Secrets بقيمة Deploy Hook من Cloudflare Pages.

## ملاحظة مهمة

هذا الإصلاح لا يمس `index.html` ولا `index_phone.html` ولا شكل الموقع. إذا حدث أي شيء غير مرغوب، يمكنك حذف الملفين:

- `scripts/worldcup-bracket-linker.mjs`
- `scripts/worldcup-cache-headers-safe.mjs`

ثم ترجع ملف workflow من History.
