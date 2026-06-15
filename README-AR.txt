# تحديث كأس العالم كل ربع ساعة + تشغيل نشر Cloudflare Pages

## ماذا تفعل هذه الملفات؟

1. تجعل Workflow كأس العالم يعمل كل ربع ساعة:
   2,17,32,47 من كل ساعة.

2. تجبر سكربت كأس العالم على الفحص حتى لو لا توجد مباراة:
   WORLD_CUP_2026_FORCE_UPDATE=1

3. تعمل heartbeat كل ربع ساعة داخل:
   public/worldcup-2026/heartbeat.json
   public/worldcup-2026/deploy-marker.txt

4. لأن الملفات تتغير كل ربع ساعة، GitHub سيعمل commit/push كل ربع ساعة.
   إذا كان Cloudflare Pages مربوطاً مع GitHub، كل push على الفرع المرتبط يطلق deploy جديد.

## الملفات المطلوب رفعها واستبدال القديمة:

scripts/touch-worldcup-last-checked.mjs
.github/workflows/update-worldcup-2026.yml

## بعد الرفع:

1. GitHub > Actions
2. افتح: Update World Cup 2026 data
3. اضغط: Run workflow

بعد النجاح افحص:
public/worldcup-2026/heartbeat.json

يجب أن يتغير last_checked_at كل ربع ساعة.
