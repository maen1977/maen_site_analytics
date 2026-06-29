@echo off
chcp 65001 >nul
setlocal
cd /d "%~dp0"
node scripts\apply-r32-sort-by-time.mjs
if errorlevel 1 (
  echo.
  echo حصل خطأ أثناء تطبيق تعديل ترتيب دور 32.
  pause
  exit /b 1
)
echo.
echo تم تطبيق تعديل ترتيب مباريات دور 32 حسب التاريخ والوقت بنجاح.
pause
