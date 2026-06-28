@echo off
setlocal
cd /d "%~dp0"
if not exist public\index.html (
  echo ERROR: public\index.html not found inside this patch folder.
  pause
  exit /b 1
)
if not exist ..\public (
  echo ERROR: Put this patch folder inside your repository root, then run again.
  pause
  exit /b 1
)
copy /Y public\index.html ..\public\index.html >nul
copy /Y public\index_phone.html ..\public\index_phone.html >nul
if errorlevel 1 (
  echo ERROR: Failed to restore homepage files.
  pause
  exit /b 1
)
echo Done. Homepage section restored to the version before the last homepage text change.
pause
