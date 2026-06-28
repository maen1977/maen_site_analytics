@echo off
setlocal
cd /d "%~dp0"
if not exist "public\index.html" (
  echo ERROR: Put this folder content in the root of maen_site_analytics then run again.
  pause
  exit /b 1
)
if not exist "public\assets" mkdir "public\assets"
copy /Y "public\index.html" "..\public\index.html" >nul 2>nul
copy /Y "public\index_phone.html" "..\public\index_phone.html" >nul 2>nul
copy /Y "public\assets\worldcup-current-focus.js" "..\public\assets\worldcup-current-focus.js" >nul 2>nul
if errorlevel 1 (
  echo If you are already in the project root, copy the public folder manually over your public folder.
) else (
  echo Done. World Cup current match focus installed.
)
pause
