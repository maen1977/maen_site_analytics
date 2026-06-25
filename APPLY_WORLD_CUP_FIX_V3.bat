@echo off
chcp 65001 >nul
setlocal
cd /d "%~dp0"
echo MaenSat World Cup Today Fix V3
echo.
if not exist "public\index.html" (
  echo ERROR: لازم تشغل هذا الملف من داخل مجلد المشروع maen_site_analytics.
  echo افتح GitHub Desktop ^> Repository ^> Open in Explorer، ثم انسخ الملفات هناك.
  pause
  exit /b 1
)
if not exist "public\index_phone.html" (
  echo ERROR: لم أجد public\index_phone.html
  pause
  exit /b 1
)
if not exist "public\worldcup-2026-today-fix.js" (
  echo ERROR: لم أجد public\worldcup-2026-today-fix.js
  echo تأكد أنك نسخت مجلد public من الحزمة فوق مجلد public في المشروع.
  pause
  exit /b 1
)
powershell -NoProfile -ExecutionPolicy Bypass -File "tools\apply-worldcup-fix-v3.ps1"
echo.
echo إذا ظهرت UPDATED أو ALREADY OK، افتح GitHub Desktop واعمل Commit ثم Push.
pause
