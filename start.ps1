# Local AI Studio - Windows baslatici. start.bat bunu cagirir.
$ErrorActionPreference = "Stop"

$root = $PSScriptRoot
Set-Location $root

$node = Join-Path $root "runtime\node\node.exe"
$serverJs = Join-Path $root "packages\server\dist\server.cjs"
$webIndex = Join-Path $root "packages\web\dist\index.html"

# 1) Tasinabilir Node -- yoksa indir. Sistem Node'una dokunmayiz.
if (-not (Test-Path $node)) {
  Write-Host "  Ilk calistirma: tasinabilir Node.js kuruluyor..."
  & (Join-Path $root "scripts\setup\fetch-node.ps1")
}

# 2) Derlenmis cikti yoksa (kaynak kopyasi) burada uret. Bagimliliklar da
#    eksikse tasinabilir npm ile kurulur; kullanicidan sisteme Node kurmasini
#    istemek "sifir kurulum" vaadini bozardi.
if (-not (Test-Path $serverJs) -or -not (Test-Path $webIndex)) {
  $env:PATH = (Join-Path $root "runtime\node") + [IO.Path]::PathSeparator + $env:PATH
  $npm = Join-Path $root "runtime\node\npm.cmd"
  if (-not (Test-Path (Join-Path $root "node_modules"))) {
    Write-Host "  Ilk calistirma: bagimliliklar kuruluyor (birkac dakika surebilir)..."
    if (Test-Path (Join-Path $root "package-lock.json")) {
      & $npm ci --no-audit --no-fund --loglevel=error
    } else {
      & $npm install --no-audit --no-fund --loglevel=error
    }
    if ($LASTEXITCODE -ne 0) { throw "bagimlilik kurulumu basarisiz" }
  }
  Write-Host "  Derlenmis cikti eksik, build calistiriliyor..."
  & $npm run build
  if ($LASTEXITCODE -ne 0) { throw "build basarisiz" }
}

$env:STUDIO_ROOT = $root

# Arayuzu acar. STUDIO_APP_WINDOW=1 ise (masaustu kisayolu) Edge ya da
# Chrome'un uygulama penceresinde, adres cubugu ve sekmeler olmadan acar;
# ikisi de yoksa varsayilan tarayicida.
function Open-Studio([string]$url) {
  if ($env:STUDIO_APP_WINDOW -eq "1") {
    $candidates = @(
      (Join-Path ${env:ProgramFiles(x86)} "Microsoft\Edge\Application\msedge.exe"),
      (Join-Path $env:ProgramFiles "Microsoft\Edge\Application\msedge.exe"),
      (Join-Path $env:ProgramFiles "Google\Chrome\Application\chrome.exe"),
      (Join-Path ${env:ProgramFiles(x86)} "Google\Chrome\Application\chrome.exe"),
      (Join-Path $env:LOCALAPPDATA "Google\Chrome\Application\chrome.exe")
    )
    foreach ($exe in $candidates) {
      if ($exe -and (Test-Path $exe)) {
        Start-Process $exe -ArgumentList "--app=`"$url`"" | Out-Null
        return
      }
    }
  }
  Start-Process $url | Out-Null
}

# Zaten calisiyorsa ikinci sunucu acma: yeni surec acilista eski motorlari
# "sahipsiz" sayip kapatirdi. Onceki adres dinleniyorsa sadece pencereyi ac.
$urlFile = Join-Path $root "data\studio-url.txt"
if (Test-Path $urlFile) {
  $previous = (Get-Content $urlFile -Raw).Trim()
  if ($previous -match '^http://([^:/]+):(\d+)/') {
    $client = New-Object System.Net.Sockets.TcpClient
    try {
      if ($client.ConnectAsync($Matches[1], [int]$Matches[2]).Wait(800)) {
        Write-Host "  Local AI Studio zaten calisiyor, pencere aciliyor."
        Open-Studio $previous
        exit 0
      }
    } catch {
    } finally {
      $client.Dispose()
    }
  }
}

# 3) Sunucuyu baslat, STUDIO_URL satirini yakalayip tarayiciyi ac.
#    Surec bu konsolun cocugu: Ctrl+C ikisini birden kapatir, baska surec
#    oldurmeyiz.
$opened = $false
& $node $serverJs 2>&1 | ForEach-Object {
  $line = [string]$_
  if (-not $opened -and $line -match '^STUDIO_URL=(.+)$') {
    $opened = $true
    $url = $Matches[1]
    try { Set-Content -Path $urlFile -Value $url -Encoding ASCII } catch {}
    Open-Studio $url
  } else {
    Write-Host $line
  }
}

Remove-Item $urlFile -ErrorAction SilentlyContinue
exit $LASTEXITCODE
