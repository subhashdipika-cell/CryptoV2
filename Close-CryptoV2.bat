@echo off
setlocal EnableExtensions
title Close CryptoV2
cd /d "%~dp0"

powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\close-cryptov2.ps1"
set "CLOSE_EXIT=%ERRORLEVEL%"

if not "%CLOSE_EXIT%"=="0" echo [BLOCKED] CryptoV2 was left running to preserve trading safety.
if /i not "%TRADING_LAB_HIDDEN%"=="1" timeout /t 3 /nobreak >nul
endlocal & exit /b %CLOSE_EXIT%
