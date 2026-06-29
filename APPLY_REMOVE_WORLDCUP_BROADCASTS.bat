@echo off
setlocal
cd /d "%~dp0"
if exist public\index.html (
  node scripts\remove-worldcup-broadcast-info.mjs
) else (
  echo انسخ هذا المجلد إلى جذر المشروع maen_site_analytics ثم شغل الملف مرة ثانية.
  pause
  exit /b 1
)
pause
