@echo off
setlocal
title Local AI Studio - Kurulum
REM Local AI Studio kurulumu. Yonetici izni gerekmez.
REM Uygulamayi %LOCALAPPDATA%\Programs\Local AI Studio klasorune kurar,
REM masaustune ve Baslat menusune kisayol koyar, "Yuklu uygulamalar"
REM listesine ekler. Zaten kuruluysa gunceller; modeller ve sohbetler kalir.

set "SRC=%~dp0dosyalar"
set "DEST=%LOCALAPPDATA%\Programs\Local AI Studio"

if not exist "%SRC%\app.zip" (
  echo   "dosyalar" klasoru bulunamadi. Paketi once bir klasore cikartin
  echo   ^(zip'e sag tik ^> Tumunu ayikla^), sonra Kurulum.bat'i oradan calistirin.
  pause
  exit /b 1
)

echo.
echo   Local AI Studio kuruluyor:
echo   %DEST%
echo.

REM Uygulama aciksa once kapatilmasi gerekir; aksi halde dosyalar kilitli kalir.
powershell -NoProfile -ExecutionPolicy Bypass -Command "$d = $env:DEST; $p = Get-CimInstance Win32_Process | Where-Object { $_.Name -eq 'node.exe' -and $_.ExecutablePath -and $_.ExecutablePath.StartsWith($d, 'OrdinalIgnoreCase') }; if ($p) { exit 3 }"
if errorlevel 3 (
  echo   Local AI Studio su an acik. Lutfen once kapatin ^(gorev cubugundaki
  echo   siyah pencere^), sonra kurulumu tekrar calistirin.
  pause
  exit /b 1
)

if not exist "%DEST%" mkdir "%DEST%"
for %%F in (app.zip SURUM.txt baslat.bat kaldir.bat simge-yildiz.ico "BENI OKU.txt") do (
  copy /y "%SRC%\%%~F" "%DEST%\" >nul
  if errorlevel 1 (
    echo   Kopyalanamadi: %%~F
    pause
    exit /b 1
  )
)

REM Masaustundeki eski kurulumu (gizli "Local AI Studio" klasoru) tasimayi teklif et.
powershell -NoProfile -ExecutionPolicy Bypass -File "%SRC%\tasi.ps1" -Dest "%DEST%"
if errorlevel 2 (
  pause
  exit /b 1
)

echo   Kisayollar olusturuluyor...
powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "$dest = $env:DEST; $shell = New-Object -ComObject WScript.Shell;" ^
  "$links = @((Join-Path ([Environment]::GetFolderPath('Desktop')) 'Local AI Studio.lnk'), (Join-Path ([Environment]::GetFolderPath('Programs')) 'Local AI Studio.lnk'));" ^
  "foreach ($path in $links) {" ^
  "  $s = $shell.CreateShortcut($path);" ^
  "  $s.TargetPath = Join-Path $dest 'baslat.bat';" ^
  "  $s.WorkingDirectory = $dest;" ^
  "  $s.IconLocation = (Join-Path $dest 'simge-yildiz.ico') + ',0';" ^
  "  $s.WindowStyle = 7;" ^
  "  $s.Description = 'Local AI Studio';" ^
  "  $s.Save()" ^
  "};" ^
  "$key = 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall\LocalAIStudio';" ^
  "New-Item -Path $key -Force | Out-Null;" ^
  "$version = (Get-Content (Join-Path $dest 'SURUM.txt') -Raw).Trim();" ^
  "$values = @{ DisplayName = 'Local AI Studio'; DisplayVersion = $version; Publisher = 'Local AI Studio';" ^
  "  DisplayIcon = (Join-Path $dest 'simge-yildiz.ico'); InstallLocation = $dest;" ^
  "  UninstallString = ([char]34 + (Join-Path $dest 'kaldir.bat') + [char]34) };" ^
  "foreach ($k in $values.Keys) { Set-ItemProperty -Path $key -Name $k -Value $values[$k] };" ^
  "Set-ItemProperty -Path $key -Name NoModify -Value 1 -Type DWord;" ^
  "Set-ItemProperty -Path $key -Name NoRepair -Value 1 -Type DWord"
if errorlevel 1 (
  echo   Kisayol olusturulamadi.
  pause
  exit /b 1
)

echo.
echo   Kurulum tamam. Masaustundeki "Local AI Studio" simgesiyle acabilirsiniz.
echo   Ilk acilis birkac dakika surer ^(Node.js ve motorlar indirilir^).
echo   Bu kurulum klasorunu artik silebilirsiniz.
echo.
start "" /min "%DEST%\baslat.bat"
timeout /t 6 >nul
