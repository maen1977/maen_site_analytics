@echo off
chcp 65001 >nul
setlocal
cd /d "%~dp0"

echo ================================================
echo  Remove "الأدوار" from homepage only
echo  This does NOT touch the 15-minute updater.
echo ================================================
echo.

if not exist "public\index.html" (
  echo ERROR: لم أجد public\index.html
  echo انسخ محتويات هذا المجلد إلى جذر مشروع GitHub ثم شغل الملف من هناك.
  pause
  exit /b 1
)

node "scripts\remove-adwar-from-home-only.mjs"
if errorlevel 1 (
  echo.
  echo حصل خطأ أثناء التطبيق.
  pause
  exit /b 1
)

echo.
echo تم. الآن اعمل Commit و Push.
pause
