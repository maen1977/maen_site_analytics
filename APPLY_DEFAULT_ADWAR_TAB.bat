@echo off
setlocal
cd /d "%~dp0"
echo Applying default World Cup tab = Adwar / Knockout...
if not exist "public\index.html" (
  echo ERROR: public\index.html not found in this patch folder.
  pause
  exit /b 1
)
if not exist "..\public" (
  echo ERROR: Please copy this patch folder to the root of your GitHub project, then run this BAT.
  pause
  exit /b 1
)
copy /Y "public\index.html" "..\public\index.html" >nul
copy /Y "public\index_phone.html" "..\public\index_phone.html" >nul
echo Done. Commit the changed public/index.html and public/index_phone.html.
pause
