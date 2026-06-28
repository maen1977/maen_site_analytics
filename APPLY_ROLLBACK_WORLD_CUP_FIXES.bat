@echo off
setlocal
cd /d "%~dp0"
if not exist scripts\rollback-worldcup-chatgpt-fixes.mjs (
  echo لم أجد ملف rollback-worldcup-chatgpt-fixes.mjs
  pause
  exit /b 1
)
node scripts\rollback-worldcup-chatgpt-fixes.mjs
if errorlevel 1 (
  echo فشل تنفيذ الرجوع.
  pause
  exit /b 1
)
echo.
echo تم تنظيف إضافات إصلاح كأس العالم السابقة محلياً.
echo إذا كنت داخل نسخة Git، نفذ:
echo git add -A
echo git commit -m "Rollback ChatGPT World Cup UI fixes"
echo git push
pause
