@echo off
setlocal EnableExtensions

title CryptoV2 Terminal
cd /d "%~dp0"

set "APP_HOST=127.0.0.1"
set "APP_PORT=3000"
set "APP_URL=http://%APP_HOST%:%APP_PORT%"

echo.
echo  ==========================================
echo           CryptoV2 Trading Terminal
echo  ==========================================
echo.

where node.exe >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Node.js is not installed or is not available in PATH.
    echo Install Node.js 20.9 or newer, then run this file again.
    echo.
    pause
    exit /b 1
)

where npm.cmd >nul 2>&1
if errorlevel 1 (
    echo [ERROR] npm.cmd is not available in PATH.
    echo Repair the Node.js installation, then run this file again.
    echo.
    pause
    exit /b 1
)

for /f "tokens=1 delims=." %%V in ('node -p "process.versions.node"') do set "NODE_MAJOR=%%V"
if %NODE_MAJOR% LSS 20 (
    echo [ERROR] Node.js 20.9 or newer is required. Detected version:
    node --version
    echo.
    pause
    exit /b 1
)

if not exist "node_modules\next\package.json" (
    echo [SETUP] Installing application dependencies...
    call npm.cmd install
    if errorlevel 1 (
        echo.
        echo [ERROR] Dependency installation failed.
        pause
        exit /b 1
    )
    echo.
)

powershell.exe -NoLogo -NoProfile -Command "try { $response = Invoke-WebRequest -UseBasicParsing -Uri '%APP_URL%' -TimeoutSec 2; if ($response.StatusCode -eq 200) { exit 0 } } catch {}; exit 1" >nul 2>&1
if not errorlevel 1 (
    echo [READY] CryptoV2 is already running at %APP_URL%
    if /I not "%CRYPTOV2_NO_BROWSER%"=="1" start "" "%APP_URL%"
    exit /b 0
)

echo [MODE] PAPER / SIMULATION ONLY
echo [START] Launching CryptoV2 at %APP_URL%
echo [STOP] Press Ctrl+C in this window to stop the application.
echo.

if /I not "%CRYPTOV2_NO_BROWSER%"=="1" (
    start "" powershell.exe -NoLogo -NoProfile -WindowStyle Hidden -Command "Start-Sleep -Seconds 4; Start-Process '%APP_URL%'"
)

call npm.cmd run dev -- --hostname %APP_HOST% --port %APP_PORT%
set "APP_EXIT=%ERRORLEVEL%"

if not "%APP_EXIT%"=="0" (
    echo.
    echo [ERROR] CryptoV2 stopped with exit code %APP_EXIT%.
    pause
)

exit /b %APP_EXIT%
