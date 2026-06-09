# نسخة جاهزة للرفع مرة واحدة

## أهم التعديلات

### 1) تحديث الترددات بأمان
- لا يتم حذف أي تردد لمجرد اختفائه من فحص واحد.
- الحذف يحتاج 3 فحوصات ناجحة متتالية.
- إذا رجعت المصادر بيانات ناقصة `system/mod` بكثرة، يتم إيقاف الحذف في ذلك اليوم.
- إذا كان التردد موجوداً سابقاً والمصدر الجديد ناقص، يتم الحفاظ على معلومات النسخة القديمة.
- نظام البحث الذكي لم يتم تغييره.

### 2) فاحص beIN SPORTS الرسمي لقسم كأس العالم
- يراقب صفحات beIN SPORTS الرسمية الموجودة في:
  `public/worldcup-2026/bein-news-sources.json`
- يستخدم صفحات الفهرس لاكتشاف الأخبار فقط.
- لا ينشر قناة لمباراة إلا إذا الخبر/الجدول الرسمي ذكر المباراة والقناة بوضوح.
- إذا ذكر الخبر `beIN SPORTS المفتوحة` أو `Free-to-air` مع المباراة بوضوح، يضيفها كقناة مجانية مؤكدة مع رابط المصدر.
- إذا ذكر `beIN SPORTS MAX` بدون رقم القناة، تبقى الحالة `to_be_confirmed` ولا يتم اختراع رقم.
- أي نتيجة غير واضحة تذهب إلى:
  `public/worldcup-2026/broadcast-review.json`

### 3) متغيرات GitHub اختيارية
يمكن تركها كما هي، لأن النظام يعمل افتراضياً. لكن يمكن التحكم بها من:
`Settings -> Secrets and variables -> Actions -> Variables`

```text
WORLD_CUP_2026_BEIN_AUTO_CHECK=1
WORLD_CUP_2026_BEIN_NEWS_URLS=رابط1;رابط2
WORLD_CUP_2026_BEIN_MAX_DISCOVERED_ARTICLES=12
WORLD_CUP_2026_BEIN_CONFIRMATION_SCORE=80
```

لإيقاف فاحص beIN مؤقتاً:

```text
WORLD_CUP_2026_BEIN_AUTO_CHECK=0
```

## بعد الرفع

شغّل:

```text
Actions -> Update World Cup 2026 data -> Run workflow
```

ثم راقب ملفات:

```text
public/worldcup-2026/broadcasts.json
public/worldcup-2026/broadcast-review.json
```

إذا كان الخبر الرسمي واضحاً، سيظهر في `broadcasts.json`. إذا لم يكن واضحاً، سيظهر في `broadcast-review.json` للمراجعة فقط.
