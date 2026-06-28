@echo off
chcp 65001 >nul
echo Cleaning World Cup 2026 desktop homepage only...
node scripts\cleanup-desktop-home-worldcup-only.mjs
if errorlevel 1 (
  echo.
  echo ERROR: Node.js is required or the cleanup failed.
  pause
  exit /b 1
)
echo.
echo Done. Commit and push the changed files.
pause
