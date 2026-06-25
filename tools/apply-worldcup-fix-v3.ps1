$ErrorActionPreference = "Stop"
$root = Get-Location
$tag = '<script src="/worldcup-2026-today-fix.js?v=20260625v3"></script>'
$files = @("public\index.html", "public\index_phone.html")

Write-Host "Repository:" $root
foreach ($file in $files) {
    if (!(Test-Path $file)) {
        throw "لم أجد الملف: $file"
    }

    $html = Get-Content -Raw -Encoding UTF8 $file
    $old = $html

    # Remove any previous versions of the fix script, then insert the cache-busted v3 tag.
    $html = [Regex]::Replace($html, '<script\s+src=["'']/worldcup-2026-today-fix\.js[^"'']*["'']\s*>\s*</script>\s*', '', 'IgnoreCase')

    if ($html.Contains($tag)) {
        Write-Host "ALREADY OK:" $file
    } elseif ($html -match '</body\s*>') {
        $html = [Regex]::Replace($html, '</body\s*>', "`n  $tag`n</body>", 'IgnoreCase')
        Set-Content -Encoding UTF8 -NoNewline -Path $file -Value $html
        Write-Host "UPDATED:" $file "before </body>"
    } elseif ($html -match '</html\s*>') {
        $html = [Regex]::Replace($html, '</html\s*>', "`n  $tag`n</html>", 'IgnoreCase')
        Set-Content -Encoding UTF8 -NoNewline -Path $file -Value $html
        Write-Host "UPDATED:" $file "before </html>"
    } else {
        $html = $html + "`n  $tag`n"
        Set-Content -Encoding UTF8 -NoNewline -Path $file -Value $html
        Write-Host "UPDATED:" $file "at end of file"
    }

    $check = Get-Content -Raw -Encoding UTF8 $file
    if ($check -notlike "*worldcup-2026-today-fix.js?v=20260625v3*") {
        throw "فشل التحقق: السطر لم يدخل داخل $file"
    }
}

Write-Host "DONE: تم إدخال سكربت V3 داخل index.html و index_phone.html"
Write-Host "ملاحظة مهمة: لازم تظهر الملفات public/index.html و public/index_phone.html ضمن Changed files في GitHub Desktop."
