@echo off
echo ==================================================
echo MaenSat World Cup 2026 FINAL UI Fix
echo ==================================================
echo.
echo انسخ محتويات هذا المجلد فوق جذر مشروع GitHub:
echo maen1977/maen_site_analytics
echo.
echo ثم ارفع الملفات إلى GitHub وشغل Action:
echo MaenSat World Cup final UI fix
echo.
echo إذا كنت تعمل من جهازك داخل مجلد المشروع، شغل:
echo node scripts\install-worldcup-final-ui-fix.mjs
echo git add public/index.html public/index_phone.html public/_headers public/worldcup-final-ui-fix.js public/worldcup-2026/final-ui-fix-marker.json scripts/install-worldcup-final-ui-fix.mjs .github/workflows/maensat-worldcup-final-ui-fix.yml
echo git commit -m "Install final World Cup 2026 UI fix"
echo git push
echo.
pause
