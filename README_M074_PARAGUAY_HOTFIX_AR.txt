تصحيح مباراة ألمانيا وباراغواي M074

النتيجة الصحيحة:
ألمانيا 1 - 1 باراغواي
باراغواي فازت 4 - 3 بركلات الترجيح وتأهلت.

هذا الإصلاح لا يغيّر جدولة التحديث كل 15 دقيقة.

الملفات:
- public/worldcup-2026/manual-results-overrides.json
  يضيف تصحيحاً موثقاً ومقفلاً لمباراة M074 حتى تظهر النتيجة فوراً.

- scripts/worldcup-quarter-hour-force.mjs
  يضيف ربط ESPN المعروف للمباراة M074 برقم الحدث 760489.

- scripts/worldcup-knockout-live-sync.mjs
  يمنع نسخة bracket المجدولة من حذف نتيجة موجودة في matches.json عند توليد knockout-live.json.

بعد رفع الملفات:
1. Commit
2. Push origin
3. انتظر GitHub Actions حتى يظهر أخضر
4. افتح الموقع مع Ctrl+F5
