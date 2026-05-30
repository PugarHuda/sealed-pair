# scripts/setup-vercel-env.ps1 -- push every variable from .env.local to Vercel
#
# Pre-requisites:
#   1. vercel login (one-time, interactive -- opens your browser)
#   2. vercel link --yes from this directory
#
# Usage:
#   .\scripts\setup-vercel-env.ps1                # pushes to all three environments
#   .\scripts\setup-vercel-env.ps1 -Environments production
#
# Notes:
#   - Reads .env.local from repo root, skips blank lines and comments.
#   - Removes the variable first (if exists) so re-running is idempotent.
#   - Will NOT push values that look unset (placeholders like t-XXXX).
#   - All vercel calls are silenced on stderr to avoid the harmless
#     "<claude-code-hint>" emission tripping ErrorAction.

[CmdletBinding()]
param(
    [string[]]$Environments = @("production", "preview", "development")
)

# Continue so a single failed call doesn't kill the loop.
$ErrorActionPreference = "Continue"

$repoRoot = Split-Path -Parent $PSScriptRoot
$envFile = Join-Path $repoRoot ".env.local"

if (-not (Test-Path $envFile)) {
    Write-Host "ERROR: .env.local not found at $envFile" -ForegroundColor Red
    exit 1
}
if (-not (Get-Command vercel -ErrorAction SilentlyContinue)) {
    Write-Host "ERROR: vercel CLI not in PATH. Run: npm install -g vercel" -ForegroundColor Red
    exit 1
}

$lines = Get-Content $envFile | Where-Object { $_ -match "^\s*[A-Z]" -and $_ -match "=" }
if (-not $lines) {
    Write-Host "No variables found in .env.local -- nothing to push." -ForegroundColor Yellow
    exit 0
}

foreach ($line in $lines) {
    $idx = $line.IndexOf('=')
    $name = $line.Substring(0, $idx).Trim()
    $value = $line.Substring($idx + 1).Trim()

    if ($value -match "^t-X+|^XXXX|YOUR_") {
        Write-Host "skip $name (placeholder)" -ForegroundColor DarkGray
        continue
    }
    if ([string]::IsNullOrWhiteSpace($value)) {
        Write-Host "skip $name (empty)" -ForegroundColor DarkGray
        continue
    }

    foreach ($env in $Environments) {
        # Remove existing (ignore failure if it doesn't exist yet).
        & vercel env rm $name $env --yes 2>$null 1>$null
        # Use --value + --yes flags: this form works for all environments
        # including 'preview' (which otherwise asks for a git branch).
        & vercel env add $name $env --value $value --yes 2>$null 1>$null
        if ($LASTEXITCODE -eq 0) {
            Write-Host "[OK]  $name -> $env" -ForegroundColor Green
        } else {
            Write-Host "[ERR] $name -> $env  (vercel exit $LASTEXITCODE)" -ForegroundColor Red
        }
    }
}

Write-Host ""
Write-Host "Done. Trigger a deploy:" -ForegroundColor Cyan
Write-Host "  vercel deploy        (preview URL)"
Write-Host "  vercel --prod        (production URL)"
