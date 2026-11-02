<#
.SYNOPSIS
  Global HL7 FHIR Learning Lab — Zero-Docker Local Dev Runner (Host Bun)
  Menyalakan Frontend Web App Vite SPA (port 5173).

.PARAMETER Arguments
  Argumen tambahan yang diteruskan ke scripts/local.ts (misal: --force-kill, --dry-run, --port 5173).

.EXAMPLE
  .\scripts\local.ps1
  .\scripts\local.ps1 --force-kill
  .\scripts\local.ps1 --dry-run
#>

[CmdletBinding()]
param(
    [Parameter(ValueFromRemainingArguments = $true)]
    [string[]]$Arguments
)

$ErrorActionPreference = "Stop"

$ScriptDir = if ($PSScriptRoot) { $PSScriptRoot } else { Split-Path -Parent $MyInvocation.MyCommand.Path }
$RootDir = (Resolve-Path (Join-Path $ScriptDir "..")).Path
$LocalTs = Join-Path $RootDir "scripts\local.ts"

if (-not (Get-Command bun -ErrorAction SilentlyContinue)) {
    [Console]::Error.WriteLine("❌ Bun runtime tidak ditemukan di PATH.")
    [Console]::Error.WriteLine("Silakan instal Bun: https://bun.sh")
    exit 1
}

if (-not (Test-Path -LiteralPath $LocalTs)) {
    [Console]::Error.WriteLine("❌ File target tidak ditemukan di checkout: $LocalTs")
    exit 1
}

Push-Location -LiteralPath $RootDir
try {
    if ($Arguments -and $Arguments.Count -gt 0) {
        & bun "$LocalTs" @Arguments
    } else {
        & bun "$LocalTs"
    }
    $exitCode = if ($null -ne $LASTEXITCODE) { $LASTEXITCODE } else { 0 }
    exit $exitCode
} catch {
    [Console]::Error.WriteLine("❌ Gagal menjalankan local runner: $_")
    exit 1
} finally {
    Pop-Location
}
