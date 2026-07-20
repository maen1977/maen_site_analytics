param(
    [Parameter(Mandatory = $true)]
    [string]$RepoPath
)

$ErrorActionPreference = 'Stop'
$patchRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$repo = (Resolve-Path $RepoPath).Path

$files = @(
    '.github/workflows/update-worldcup-2026.yml',
    'cloudflare-worker/maensat-github-dispatch-worker.js',
    'update-worldcup-2026.yml'
)

foreach ($relative in $files) {
    $source = Join-Path $patchRoot $relative
    $target = Join-Path $repo $relative
    $targetDir = Split-Path -Parent $target
    New-Item -ItemType Directory -Force -Path $targetDir | Out-Null
    Copy-Item -Force $source $target
    Write-Host "Updated: $relative"
}

Push-Location $repo
try {
    $workflow = Get-Content '.github/workflows/update-worldcup-2026.yml' -Raw
    if ($workflow -match '(?m)^\s*schedule\s*:|cron\s*:') {
        throw 'Scheduled cron still exists in the active workflow.'
    }

    $worker = Get-Content 'cloudflare-worker/maensat-github-dispatch-worker.js' -Raw
    if ($worker -match 'dispatchGitHubWorkflow|api\.github\.com/repos') {
        throw 'Cloudflare dispatcher is still active.'
    }

    git add -- '.github/workflows/update-worldcup-2026.yml' 'cloudflare-worker/maensat-github-dispatch-worker.js' 'update-worldcup-2026.yml'
    Write-Host ''
    Write-Host 'World Cup 2026 quarter-hour updates are disabled.' -ForegroundColor Green
    Write-Host 'Review with: git diff --cached'
    Write-Host 'Then commit and push.'
}
finally {
    Pop-Location
}
