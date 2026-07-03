إصلاح إضافي ونهائي لمنطق التمديد وركلات الترجيح في كروت كأس العالم

المشكلة:
كان وجود score.et أو score.p يجعل الواجهة تعرض:
- انتهت بعد التمديد
أو
- انتهت بركلات الترجيح
حتى لو المباراة لا تزال مباشرة.

الإصلاح:
1. حالة live / in_play / extra_time / penalties صارت لها أولوية أعلى من أي label قديم.
2. score.et لا يعني أن المباراة انتهت؛ يستخدم كهدف/نتيجة حالية إذا المباراة في التمديد.
3. score.p لا يستخدم كنتيجة أصلية، بل كركلات ترجيح فقط.
4. لا تظهر "انتهت بعد التمديد" إلا إذا هناك final / finished / AET صريح.
5. لا تظهر "انتهت بركلات الترجيح" إلا إذا المباراة final ومعها بيانات ترجيح.
6. أثناء التمديد أو ضربات الجزاء، الحالة تبقى "مباشر".

الملفات المعدلة:
- public/index.html
- public/index_phone.html
- public/worldcup-live-status-dom-guard.js
- functions/_middleware.js

ملف الحالة:
- public/worldcup-2026/extra-time-penalty-priority-status.json

رسالة الكومت المقترحة:
Fix World Cup extra time and penalty status priority

بعد الرفع:
1. Commit + Push
2. انتظر Cloudflare Pages deployment
3. افتح الموقع مع كسر الكاش:
https://maensat.pages.dev/#worldcup2026?v=extra-time-penalty-priority
