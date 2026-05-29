@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo تشغيل موقع معن حنونة محلياً...
echo.
where python >nul 2>nul
if %errorlevel%==0 (
  echo افتح الرابط التالي إذا لم يفتح المتصفح تلقائياً:
  echo http://localhost:8080
  start http://localhost:8080
  python -m http.server 8080 -d public
  pause
  exit /b
)
where py >nul 2>nul
if %errorlevel%==0 (
  echo افتح الرابط التالي إذا لم يفتح المتصفح تلقائياً:
  echo http://localhost:8080
  start http://localhost:8080
  py -m http.server 8080 -d public
  pause
  exit /b
)
echo لم أجد Python على الجهاز.
echo افتح الملف public\index.html مباشرة، أو ثبّت Python ثم شغّل هذا الملف مرة أخرى.
pause
