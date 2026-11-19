@echo off
setlocal
title Local AI Studio - Kaldir
REM Local AI Studio'yu kaldirir: kisayollar, "Yuklu uygulamalar" kaydi ve
REM uygulama klasoru. Modeller ve sohbetler icin ayrica sorar.

set "DEST=%~dp0"
if "%DEST:~-1%"=="\" set "DEST=%DEST:~0,-1%"

REM Kendi klasorunu silebilmek icin gecici klasordeki bir kopyadan calis.
if /i not "%~1"=="--gecici" (
  copy /y "%~f0" "%TEMP%\local-ai-studio-kaldir.bat" >nul
  start "" "%TEMP%\local-ai-studio-kaldir.bat" --gecici "%DEST%"
  exit /b 0
)
set "DEST=%~2"

echo.
echo   Local AI Studio kaldirilacak:
echo   %DEST%
echo.
choice /c EH /n /m "  Devam edilsin mi? [E/H] "
if errorlevel 2 exit /b 0

choice /c EH /n /m "  Indirilen modeller ve sohbetler de silinsin mi? [E/H] "
set "VERILER=%errorlevel%"

echo   Calisan uygulama kapatiliyor...
powershell -NoProfile -ExecutionPolicy Bypass -Command "$d = $env:DEST; Get-CimInstance Win32_Process | Where-Object { ($_.ExecutablePath -and $_.ExecutablePath.StartsWith($d, 'OrdinalIgnoreCase')) -or ($_.CommandLine -and ($_.CommandLine -like ('*' + $d + '\baslat.bat*') -or $_.CommandLine -like ('*' + $d + '\uygulama\masaustu-baslat.ps1*'))) } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }"
timeout /t 2 >nul

echo   Kisayollar ve kayit siliniyor...
powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "Remove-Item (Join-Path ([Environment]::GetFolderPath('Desktop')) 'Local AI Studio.lnk') -ErrorAction SilentlyContinue;" ^
  "Remove-Item (Join-Path ([Environment]::GetFolderPath('Programs')) 'Local AI Studio.lnk') -ErrorAction SilentlyContinue;" ^
  "Remove-Item 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall\LocalAIStudio' -Recurse -ErrorAction SilentlyContinue"

echo   Dosyalar siliniyor...
if "%VERILER%"=="1" (
  rmdir /s /q "%DEST%"
) else (
  REM Veriler kalsin: uygulama\data disindaki her sey silinir.
  powershell -NoProfile -ExecutionPolicy Bypass -Command "$d = $env:DEST; Get-ChildItem -LiteralPath $d -Force | Where-Object { $_.Name -ne 'uygulama' } | Remove-Item -Recurse -Force -ErrorAction SilentlyContinue; $app = Join-Path $d 'uygulama'; if (Test-Path $app) { Get-ChildItem -LiteralPath $app -Force | Where-Object { $_.Name -ne 'data' } | Remove-Item -Recurse -Force -ErrorAction SilentlyContinue }"
  echo   Modeller ve sohbetler burada duruyor: %DEST%\uygulama\data
)

echo.
echo   Local AI Studio kaldirildi.
pause
(goto) 2>nul & del "%~f0"
