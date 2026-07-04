إصلاح أولوية حالة مباريات كأس العالم

المشكلة:
- النتيجة النهائية موجودة، لكن الكرت يكتب مباشر.
- السبب أن الواجهة كانت تعتبر كلمات مثل ركلات الترجيح أو وقت إضافي إشارة إلى مباشر حتى لو حالة المباراة صريحة بأنها انتهت.

هذا الإصلاح يجعل النهاية الصريحة أقوى من مباشر:
- انتهت بركلات الترجيح تظهر انتهت بركلات الترجيح.
- انتهت بعد التمديد تظهر انتهت بعد التمديد.
- المباراة المباشرة فعلاً تبقى مباشر.

الملفات المعدلة:
public/index.html
public/index_phone.html
public/worldcup-live-status-dom-guard.js
functions/_middleware.js
scripts/worldcup-r32-r16-official-finalizer.mjs
public/worldcup-2026/final-status-priority-status.json

رسالة الكومت:
Fix World Cup final status priority over live labels
