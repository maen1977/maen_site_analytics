@echo off
setlocal
xcopy /E /Y /I public\* .\public\
echo Done. Commit with: Fix World Cup next match card data loading error
pause
