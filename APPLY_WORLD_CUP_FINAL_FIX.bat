@echo off
chcp 65001 >nul
setlocal
set "ROOT=%~dp0"

if not exist "%ROOT%public" (
  echo ERROR: لازم تشغل هذا الملف من داخل مجلد المشروع نفسه maen_site_analytics
  echo افتح GitHub Desktop ^> Repository ^> Open in Explorer، ثم انسخ الملفات هناك وشغل هذا الملف.
  pause
  exit /b 1
)

powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "$ErrorActionPreference='Stop';" ^
  "$root='%ROOT%';" ^
  "$tag='<script src=""/worldcup-direct-fix-final.js?v=20260625-final"" defer></script>';" ^
  "$files=@('public/index.html','public/index_phone.html');" ^
  "foreach($rel in $files){" ^
  "  $path=Join-Path $root $rel;" ^
  "  if(!(Test-Path $path)){ Write-Host ('MISSING: '+$rel) -ForegroundColor Red; continue }" ^
  "  $html=[System.IO.File]::ReadAllText($path,[System.Text.Encoding]::UTF8);" ^
  "  $html=[regex]::Replace($html,'\s*<script\s+src=[''\"]/?worldcup-2026-today-fix\.js[^>]*></script>','',[System.Text.RegularExpressions.RegexOptions]::IgnoreCase);" ^
  "  $html=[regex]::Replace($html,'\s*<script\s+src=[''\"]/?worldcup-direct-fix-final\.js[^>]*></script>','',[System.Text.RegularExpressions.RegexOptions]::IgnoreCase);" ^
  "  if($html -match '</body>'){ $html=$html -replace '</body>',$tag+[Environment]::NewLine+'</body>' } else { $html=$html+[Environment]::NewLine+$tag+[Environment]::NewLine }" ^
  "  [System.IO.File]::WriteAllText($path,$html,(New-Object System.Text.UTF8Encoding($false)));" ^
  "  if(([System.IO.File]::ReadAllText($path,[System.Text.Encoding]::UTF8)) -match 'worldcup-direct-fix-final\.js'){ Write-Host ('UPDATED: '+$rel) -ForegroundColor Green } else { Write-Host ('FAILED: '+$rel) -ForegroundColor Red }" ^
  "}" ^
  "if(Test-Path (Join-Path $root 'public/worldcup-direct-fix-final.js')){ Write-Host 'OK: public/worldcup-direct-fix-final.js موجود' -ForegroundColor Green } else { Write-Host 'ERROR: ملف JavaScript غير موجود داخل public' -ForegroundColor Red }"

echo.
echo انتهى. افتح GitHub Desktop وتأكد أن الملفات المتغيرة هي:
echo public/index.html
echo public/index_phone.html
echo public/worldcup-direct-fix-final.js
echo.
pause
