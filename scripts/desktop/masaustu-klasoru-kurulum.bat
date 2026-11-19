@echo off
setlocal
title Local AI Studio - kisayol kurulumu
REM Bir kerelik kurulum: masaustune simgeli "Local AI Studio" kisayolu koyar,
REM Baslat menusune ekler, "Local AI Studio" klasorunu gizler ve uygulamayi acar.
REM Is bitince bu dosya kendini siler. Klasordeki dosyalara dokunmaz.

set "DESK=%~dp0"
if "%DESK:~-1%"=="\" set "DESK=%DESK:~0,-1%"
set "HOME_DIR=%DESK%\Local AI Studio"

if not exist "%HOME_DIR%\baslat.bat" (
  echo "Local AI Studio" klasoru veya icindeki baslat.bat bulunamadi.
  pause
  exit /b 1
)

echo.
echo   Kisayol olusturuluyor...
powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "$shell = New-Object -ComObject WScript.Shell;" ^
  "$targets = @((Join-Path $env:DESK 'Local AI Studio.lnk'), (Join-Path ([Environment]::GetFolderPath('Programs')) 'Local AI Studio.lnk'));" ^
  "foreach ($path in $targets) {" ^
  "  $s = $shell.CreateShortcut($path);" ^
  "  $s.TargetPath = Join-Path $env:HOME_DIR 'baslat.bat';" ^
  "  $s.WorkingDirectory = $env:HOME_DIR;" ^
  "  $s.IconLocation = (Join-Path $env:HOME_DIR 'simge-yildiz.ico') + ',0';" ^
  "  $s.WindowStyle = 7;" ^
  "  $s.Description = 'Local AI Studio';" ^
  "  $s.Save()" ^
  "}"
if errorlevel 1 (
  echo   Kisayol olusturulamadi.
  pause
  exit /b 1
)

attrib +h "%HOME_DIR%" >nul 2>&1

echo   Tamam. Bundan sonra masaustundeki simgeye tiklayin.
start "" "%DESK%\Local AI Studio.lnk"

REM Kendini sil: masaustunde yalnizca simge kalsin.
(goto) 2>nul & del "%~f0"
