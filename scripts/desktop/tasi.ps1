# Local AI Studio - eski masaustu kurulumunu yeni yere tasir.
# Kurulum.bat cagirir. Eski duzen: Masaustu\Local AI Studio (gizli klasor).
# Indirilen motorlar (runtime) ve veriler (data) tasinir, sonra eski klasor
# kullanici onaylarsa silinir. Onay yoksa hicbir seye dokunulmaz.
param([Parameter(Mandatory = $true)][string]$Dest)
$ErrorActionPreference = "Stop"

$old = Join-Path ([Environment]::GetFolderPath("Desktop")) "Local AI Studio"
if (-not (Test-Path (Join-Path $old "app.zip"))) { exit 0 }
if ((Resolve-Path $old).Path.TrimEnd("\") -ieq $Dest.TrimEnd("\")) { exit 0 }

Write-Host ""
Write-Host "  Eski kurulum bulundu: $old" -ForegroundColor Yellow

$running = Get-CimInstance Win32_Process | Where-Object {
  $_.ExecutablePath -and $_.ExecutablePath.StartsWith($old, "OrdinalIgnoreCase")
}
if ($running) {
  Write-Host "  Eski kurulum su an acik. Lutfen kapatip kurulumu tekrar calistirin." -ForegroundColor Red
  exit 2
}

$answer = Read-Host "  Motorlar, modeller ve sohbetler yeni kuruluma tasinsin, eski klasor silinsin mi? [E/H]"
if ($answer -notmatch '^[EeYy]') {
  Write-Host "  Eski kurulum oldugu gibi birakildi."
  exit 0
}

foreach ($sub in "data", "runtime") {
  $src = Join-Path $old "uygulama\$sub"
  if (-not (Test-Path $src)) { continue }
  $dst = Join-Path $Dest "uygulama\$sub"
  Write-Host "  Tasiniyor: $sub"
  robocopy $src $dst /E /MOVE /R:1 /W:1 /NFL /NDL /NJH /NJS /NP | Out-Null
  if ($LASTEXITCODE -ge 8) {
    Write-Host "  $sub tasinamadi; eski klasor silinmedi." -ForegroundColor Red
    exit 1
  }
}

# Eski motorlarin kayitli sureclerini gosteren dosya yeni yerde anlamsiz.
Remove-Item (Join-Path $Dest "uygulama\data\studio-url.txt") -ErrorAction SilentlyContinue
Remove-Item -LiteralPath $old -Recurse -Force
Write-Host "  Eski kurulum kaldirildi." -ForegroundColor Green
exit 0
