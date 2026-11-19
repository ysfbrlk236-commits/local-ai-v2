@echo off
setlocal
title Local AI Studio
REM Local AI Studio - baslatici. Masaustundeki "Local AI Studio" kisayolu bunu calistirir.
REM Ilk acilista uygulamayi acar, Node.js ve motorlari indirir (birkac dakika).
REM Bu pencere kucultulmus calisir; kapatirsaniz uygulama da kapanir.

set "HOME_DIR=%~dp0"
if "%HOME_DIR:~-1%"=="\" set "HOME_DIR=%HOME_DIR:~0,-1%"
set "APP=%HOME_DIR%\uygulama"
set "STUDIO_APP_WINDOW=1"

if not exist "%HOME_DIR%\app.zip" (
  echo app.zip bulunamadi: %HOME_DIR%
  pause
  exit /b 1
)

if not exist "%APP%\SURUM.txt" goto extract
fc /b "%HOME_DIR%\SURUM.txt" "%APP%\SURUM.txt" >nul 2>&1
if errorlevel 1 goto extract
goto run

:extract
echo.
echo   Uygulama dosyalari aciliyor...
powershell -NoProfile -ExecutionPolicy Bypass -Command "Expand-Archive -LiteralPath (Join-Path $env:HOME_DIR 'app.zip') -DestinationPath $env:APP -Force"
if errorlevel 1 (
  echo   Dosyalar acilamadi.
  pause
  exit /b 1
)

:run
powershell -NoProfile -ExecutionPolicy Bypass -File "%APP%\masaustu-baslat.ps1"
if errorlevel 1 pause
