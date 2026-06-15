# Ultimate fix Spider prices

هذا الإصلاح أوسع من السابق لأنه يتعامل مع أكثر من صيغة:

- السعر 25 د.أ كنص عربي.
- السعر مفصول داخل HTML.
- price: 25 داخل JavaScript.
- "price": 25 داخل JSON/JS.
- data-price="25".
- رسائل واتساب.

المطلوب:
- Spider T777 Elite Master Plus = 20
- Spider T666 Gold+ 5G = 30

## ارفع الملفين:

scripts/ultimate-fix-spider-prices.mjs
.github/workflows/ultimate-fix-spider-prices.yml

## بعد الرفع:

قد يعمل تلقائياً بسبب push.
أو شغله يدويًا:

GitHub > Actions > Ultimate fix Spider prices > Run workflow

بعد النجاح افتح الموقع Ctrl + F5 أو نافذة خفية.
