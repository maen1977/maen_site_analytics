@echo off
chcp 65001 >nul
setlocal

echo Applying MaenSat World Cup next-card follow You Are Here fix...

if not exist public (
  echo ERROR: Please run this file from the root of maen_site_analytics.
  pause
  exit /b 1
)

xcopy /E /Y "%~dp0public" "public" >nul

echo Done. Commit message:
echo Sync World Cup next card with you are here match
pause
