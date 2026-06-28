@echo off
chcp 65001 >nul
setlocal

echo تطبيق إصلاح بطاقة المباراة القادمة داخل قسم كأس العالم 2026...

if not exist "public" (
  echo خطأ: شغّل هذا الملف من جذر مشروع GitHub حيث يوجد مجلد public.
  pause
  exit /b 1
)

copy /Y "%~dp0public\index.html" "public\index.html" >nul
if exist "%~dp0public\index_phone.html" copy /Y "%~dp0public\index_phone.html" "public\index_phone.html" >nul
if exist "%~dp0public\assets\worldcup-current-focus.js" (
  if not exist "public\assets" mkdir "public\assets"
  copy /Y "%~dp0public\assets\worldcup-current-focus.js" "public\assets\worldcup-current-focus.js" >nul
)

echo تم التطبيق بنجاح.
echo رسالة Commit المقترحة:
echo Show next World Cup match card with flags
pause
