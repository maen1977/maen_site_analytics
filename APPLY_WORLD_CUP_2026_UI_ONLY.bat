@echo off
chcp 65001 >nul
echo Installing MaenSat World Cup 2026 UI-only knockout fix...
node scripts\install-worldcup-2026-ui-only.mjs
if errorlevel 1 (
  echo.
  echo ERROR: Node.js is required or the installer failed.
  pause
  exit /b 1
)
echo.
echo Done. Commit and push the changed files.
pause
