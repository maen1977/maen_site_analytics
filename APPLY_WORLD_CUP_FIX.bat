@echo off
chcp 65001 >nul
echo MaenSat World Cup safe fix
echo.
where node >nul 2>nul
if errorlevel 1 (
  echo ERROR: Node.js غير مثبت على الجهاز.
  echo ثبّت Node.js أو شغّل الأمر من Git Bash إذا كان متوفر.
  echo.
  pause
  exit /b 1
)
node tools\apply-worldcup-fix.cjs
echo.
pause
