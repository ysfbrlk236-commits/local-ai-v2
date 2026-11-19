# Local AI Studio - masaustu baslaticisinin ikinci adimi.
# Ilk acilista motorlari indirir, sonra start.ps1'e devreder.
# Motor indirmesi basarisiz olursa uygulama yine acilir; eksik motor
# Modeller / Ses sekmesinde uyari olarak gorunur.
$ErrorActionPreference = "Continue"
$root = $PSScriptRoot

# Konsolun "Hizli Duzenleme" (secim) modunu kapat. Pencerenin icine
# tiklaninca Windows "Sec" moduna geciyor ve ekrana yazan programi
# durduruyor; indirme ya da sunucu takilmis gibi kaliyordu. Ayar yalnizca
# bu konsol penceresi icin gecerli, sistem ayarina dokunulmaz.
try {
  Add-Type -Namespace StudioConsole -Name Native -MemberDefinition @'
[DllImport("kernel32.dll", SetLastError = true)] public static extern System.IntPtr GetStdHandle(int handle);
[DllImport("kernel32.dll", SetLastError = true)] public static extern bool GetConsoleMode(System.IntPtr handle, out uint mode);
[DllImport("kernel32.dll", SetLastError = true)] public static extern bool SetConsoleMode(System.IntPtr handle, uint mode);
'@
  $stdin = [StudioConsole.Native]::GetStdHandle(-10)
  $mode = 0
  if ([StudioConsole.Native]::GetConsoleMode($stdin, [ref]$mode)) {
    # ENABLE_QUICK_EDIT_MODE (0x40) kapat, ENABLE_EXTENDED_FLAGS (0x80) ac.
    [void][StudioConsole.Native]::SetConsoleMode($stdin, (($mode -band (-bnot 0x40)) -bor 0x80))
  }
} catch {}
Set-Location $root
$engines = Join-Path $root "runtime\engines"
$fetch = Join-Path $root "scripts\setup\fetch.ps1"

# Kisayol simgesini guncel tut. Windows simgeyi dosya yoluna gore onbellege
# aldigi icin yeni simge yeni bir adla gelir ve kisayol ona yonlendirilir.
# Hata olursa sessizce gecilir; uygulamanin acilmasini engellememeli.
try {
  $homeDir = $env:HOME_DIR
  if (-not $homeDir) { $homeDir = Split-Path $root -Parent }
  $ico = Join-Path $homeDir "simge-yildiz.ico"
  if (Test-Path $ico) {
    $shell = New-Object -ComObject WScript.Shell
    $desk = Split-Path $homeDir -Parent
    $links = @(
      (Join-Path ([Environment]::GetFolderPath("Desktop")) "Local AI Studio.lnk"),
      (Join-Path $desk "Local AI Studio.lnk"),
      (Join-Path ([Environment]::GetFolderPath("Programs")) "Local AI Studio.lnk")
    )
    $changed = $false
    foreach ($link in $links) {
      if (Test-Path $link) {
        $shortcut = $shell.CreateShortcut($link)
        if ($shortcut.IconLocation -ne "$ico,0") {
          $shortcut.IconLocation = "$ico,0"
          $shortcut.Save()
          $changed = $true
        }
      }
    }
    if ($changed) { Start-Process ie4uinit.exe -ArgumentList "-show" -WindowStyle Hidden }
  }
} catch {}

# Klasore degil motor dosyasina bakilir: yarim kalan indirme bos klasor
# birakabiliyordu ve motor kurulu sanilip her acilista atlaniyordu.
if (-not (Test-Path (Join-Path $engines "llama\llama-server.exe"))) {
  Write-Host ""
  Write-Host "  Ilk acilis: sohbet motoru (llama.cpp) indiriliyor..." -ForegroundColor Cyan
  powershell -NoProfile -ExecutionPolicy Bypass -File $fetch llama
  if ($LASTEXITCODE -ne 0) { Write-Host "  Sohbet motoru indirilemedi; uygulama icinden tekrar denenebilir." -ForegroundColor Yellow }
}

if (-not (Test-Path (Join-Path $engines "whisper\whisper-cli.exe"))) {
  Write-Host "  Ilk acilis: ses tanima motoru (whisper.cpp) indiriliyor..." -ForegroundColor Cyan
  powershell -NoProfile -ExecutionPolicy Bypass -File $fetch whisper
  if ($LASTEXITCODE -ne 0) { Write-Host "  Ses motoru indirilemedi; sesle yazma bu durumda kapali kalir." -ForegroundColor Yellow }
}

& (Join-Path $root "start.ps1")
exit $LASTEXITCODE
