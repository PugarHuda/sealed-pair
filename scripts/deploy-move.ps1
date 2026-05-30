# scripts/deploy-move.ps1 — build + publish the Sealed Pair Move package
# Usage: .\scripts\deploy-move.ps1 [-Network testnet|mainnet] [-GasBudget 200000000]

[CmdletBinding()]
param(
    [ValidateSet("testnet", "mainnet")]
    [string]$Network = "testnet",

    [int]$GasBudget = 200000000
)

$ErrorActionPreference = "Stop"
$repoRoot = Split-Path -Parent $PSScriptRoot
$movePath = Join-Path $repoRoot "move"
$envFile = Join-Path $repoRoot ".env.local"

function Require-Cmd($name) {
    if (-not (Get-Command $name -ErrorAction SilentlyContinue)) {
        throw "Required command '$name' not found in PATH. See move/README.md for install steps."
    }
}

Require-Cmd "sui"

Write-Host "→ switching sui client env to $Network" -ForegroundColor Cyan
& sui client switch --env $Network | Out-Null

Write-Host "→ active address:" -ForegroundColor Cyan
$activeAddr = (& sui client active-address).Trim()
Write-Host "   $activeAddr"

Write-Host "→ building Move package at $movePath" -ForegroundColor Cyan
& sui move build --path $movePath
if ($LASTEXITCODE -ne 0) { throw "sui move build failed" }

Write-Host "→ publishing with gas-budget $GasBudget" -ForegroundColor Cyan
$publishOutput = & sui client publish --gas-budget $GasBudget --json $movePath 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Host $publishOutput
    throw "sui client publish failed"
}

# Parse JSON for the published package object ID
try {
    $json = $publishOutput | ConvertFrom-Json
} catch {
    Write-Host "Raw output:`n$publishOutput"
    throw "Could not parse publish output as JSON"
}

$packageId = $null
foreach ($change in $json.objectChanges) {
    if ($change.type -eq "published") {
        $packageId = $change.packageId
        break
    }
}
if (-not $packageId) { throw "Couldn't find packageId in publish output" }

Write-Host "✓ Package published" -ForegroundColor Green
Write-Host "   PackageID: $packageId"

# Update .env.local (preserve existing keys)
$envKey = "NEXT_PUBLIC_SEALED_PAIR_PACKAGE_ID"
$envLine = "$envKey=$packageId"
if (Test-Path $envFile) {
    $lines = Get-Content $envFile
    if ($lines -match "^$envKey=") {
        $updated = $lines | ForEach-Object {
            if ($_ -match "^$envKey=") { $envLine } else { $_ }
        }
        Set-Content -Path $envFile -Value $updated -Encoding UTF8
        Write-Host "→ updated $envFile" -ForegroundColor Cyan
    } else {
        Add-Content -Path $envFile -Value "`n$envLine"
        Write-Host "→ appended to $envFile" -ForegroundColor Cyan
    }
} else {
    Set-Content -Path $envFile -Value $envLine -Encoding UTF8
    Write-Host "→ created $envFile with $envKey" -ForegroundColor Cyan
}

Write-Host "`nDone. Restart the Next dev server so it picks up the new env var." -ForegroundColor Green
