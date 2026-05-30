# scripts/setup-vercel-env.ps1 — push every variable from .env.local to Vercel
#
# Pre-requisites:
#   1. `vercel login` (one-time, interactive — opens your browser)
#   2. `vercel link --yes` from this directory (links cwd to a Vercel project)
#
# Usage:
#   .\scripts\setup-vercel-env.ps1                # pushes to all three environments
#   .\scripts\setup-vercel-env.ps1 -Environments production
#
# Notes:
#   - Reads .env.local from repo root, skips blank lines and comments.
#   - Removes the variable first (if exists) so re-running is idempotent.
#   - Will NOT push values that look unset (placeholders like t-XXXX).

[CmdletBinding()]
param(
    [string[]]$Environments = @("production", "preview", "development")
)

$ErrorActionPreference = "Stop"
$repoRoot = Split-Path -Parent $PSScriptRoot
$envFile = Join-Path $repoRoot ".env.local"

if (-not (Test-Path $envFile)) {
    throw ".env.local not found at $envFile"
}
if (-not (Get-Command vercel -ErrorAction SilentlyContinue)) {
    throw "vercel CLI not in PATH. Run: npm install -g vercel"
}

$lines = Get-Content $envFile | Where-Object { $_ -match "^\s*[A-Z]" -and $_ -match "=" }
if (-not $lines) {
    Write-Host "No variables found in .env.local — nothing to push." -ForegroundColor Yellow
    exit 0
}

foreach ($line in $lines) {
    $idx = $line.IndexOf('=')
    $name = $line.Substring(0, $idx).Trim()
    $value = $line.Substring($idx + 1).Trim()

    # skip obvious placeholders
    if ($value -match "^t-X+|^XXXX|YOUR_") {
        Write-Host "skip $name (placeholder)" -ForegroundColor DarkGray
        continue
    }
    if ([string]::IsNullOrWhiteSpace($value)) {
        Write-Host "skip $name (empty)" -ForegroundColor DarkGray
        continue
    }

    foreach ($env in $Environments) {
        # Idempotency: remove first (silently), then add
        & vercel env rm $name $env --yes 2>$null | Out-Null
        $value | & vercel env add $name $env | Out-Null
        if ($LASTEXITCODE -eq 0) {
            Write-Host "✓ $name → $env" -ForegroundColor Green
        } else {
            Write-Host "✗ $name → $env  (vercel exit $LASTEXITCODE)" -ForegroundColor Red
        }
    }
}

Write-Host "`nDone. Trigger a deploy: vercel deploy  (preview)  or  vercel --prod  (production)" -ForegroundColor Cyan
