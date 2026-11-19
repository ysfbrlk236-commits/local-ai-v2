# Local AI Studio - masaustu baslaticisinin ikinci adimi.
# Ilk acilista motorlari indirir, sonra start.ps1'e devreder.
# Motor indirmesi basarisiz olursa uygulama yine acilir; eksik motor
# Modeller / Ses sekmesinde uyari olarak gorunur.
$ErrorActionPreference = "Continue"
$root = $PSScriptRoot
Set-Location $root
$engines = Join-Path $root "runtime\engines"
$fetch = Join-Path $root "scripts\setup\fetch.ps1"

if (-not (Test-Path (Join-Path $engines "llama"))) {
  Write-Host ""
  Write-Host "  Ilk acilis: sohbet motoru (llama.cpp) indiriliyor..." -ForegroundColor Cyan
  powershell -NoProfile -ExecutionPolicy Bypass -File $fetch llama
  if ($LASTEXITCODE -ne 0) { Write-Host "  Sohbet motoru indirilemedi; uygulama icinden tekrar denenebilir." -ForegroundColor Yellow }
}

if (-not (Test-Path (Join-Path $engines "whisper"))) {
  Write-Host "  Ilk acilis: ses tanima motoru (whisper.cpp) indiriliyor..." -ForegroundColor Cyan
  powershell -NoProfile -ExecutionPolicy Bypass -File $fetch whisper
  if ($LASTEXITCODE -ne 0) { Write-Host "  Ses motoru indirilemedi; sesle yazma bu durumda kapali kalir." -ForegroundColor Yellow }
}

& (Join-Path $root "start.ps1")
exit $LASTEXITCODE
