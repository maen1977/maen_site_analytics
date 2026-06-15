جاهز للرفع — تشغيل تلقائي لقسم كأس العالم "كل المباريات"

ارفع الملفات في نفس المسارات الموجودة داخل ZIP:

1) public/assets/worldcup-current-focus.js
2) scripts/install-worldcup-current-focus.mjs
3) .github/workflows/install-worldcup-current-focus.yml

بعد الرفع:
- ادخل GitHub > Actions
- افتح: Install World Cup current focus
- اضغط: Run workflow

الـ Workflow سيعدل public/index.html تلقائياً ويضيف:
<script src="/assets/worldcup-current-focus.js?v=20260615-auto"></script>

بعدها افتح الموقع وجرب قسم كأس العالم.
في "كل المباريات" سيذهب تلقائياً إلى:
مباراة مباشرة > أول مباراة قادمة اليوم > آخر مباراة اليوم > أقرب مباراة قادمة.
