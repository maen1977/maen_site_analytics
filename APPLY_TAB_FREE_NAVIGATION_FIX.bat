@echo off
setlocal
if not exist "public\assets" mkdir "public\assets"
copy /Y "maensat_worldcup_tab_free_navigation_fix\public\assets\worldcup-current-focus.js" "public\assets\worldcup-current-focus.js"
echo Done. Commit message: Fix World Cup tab navigation after default knockout open
pause
