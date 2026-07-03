إصلاح نهائي لمشكلة: المباراة ما زالت مباشرة لكن الموقع يعرض "انتهت بعد التمديد".

سبب المشكلة:
كان كود الكرت يعتبر وجود score.et دليلاً أن المباراة انتهت بعد التمديد.
هذا خطأ، لأن score.et يمكن أن يظهر أثناء اللعب في الأشواط الإضافية قبل نهاية المباراة.

ما تم إصلاحه:
1. public/index.html
2. public/index_phone.html
3. public/worldcup-live-status-dom-guard.js
4. functions/_middleware.js

القواعد الجديدة:
- إذا حالة ESPN أو phase تقول live / extra_time / penalties / in_play / مباشر: يظهر "مباشر".
- لا يظهر "انتهت بعد التمديد" إلا إذا الحالة النهائية فعلاً finished / final / full time / AET.
- أثناء المباشر يتم تفضيل score.current ثم score.live ثم score.et ثم score.ft، حتى لا يرجع السكور لنتيجة نهاية الوقت الأصلي أثناء التمديد.
- إذا المباراة بدأت ولا توجد نتيجة بعد يظهر 0 - 0.

بعد الرفع:
1. Commit + Push
2. انتظر Cloudflare Pages Deployment
3. افتح الرابط مع كسر الكاش:
   https://maensat.pages.dev/#worldcup2026?v=extra-time-live-status-final

رسالة الكومت المقترحة موجودة في COMMIT_MESSAGE.txt
