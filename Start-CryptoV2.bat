@echo off
setlocal EnableExtensions

title CryptoV2 Autonomous AI
cd /d "%~dp0"

set "APP_HOST=127.0.0.1"
set "APP_PORT=3000"
set "APP_URL=http://%APP_HOST%:%APP_PORT%"

echo.
echo  ==========================================
echo          CryptoV2 Autonomous AI Bot
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

call :ensure_autobot
call :ensure_option_snapshot_recorder
call :ensure_mt5_bridge

powershell.exe -NoLogo -NoProfile -Command "try { $response = Invoke-WebRequest -UseBasicParsing -Uri '%APP_URL%' -TimeoutSec 2; if ($response.StatusCode -eq 200) { exit 0 } } catch {}; exit 1" >nul 2>&1
if not errorlevel 1 (
    echo [READY] CryptoV2 is already running at %APP_URL%
    if /I not "%CRYPTOV2_NO_BROWSER%"=="1" start "" "%APP_URL%"
    exit /b 0
)

echo [MODE] DERIBIT TESTNET AI / REAL ACCOUNT ROUTING NOT PRESENT
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

:ensure_autobot
if not exist "work" mkdir "work"
powershell.exe -NoLogo -NoProfile -Command "$pidFile='%~dp0work\autobot.pid'; if (Test-Path $pidFile) { $botPid=Get-Content $pidFile -ErrorAction SilentlyContinue; if ($botPid -and (Get-Process -Id $botPid -ErrorAction SilentlyContinue)) { exit 0 } }; exit 1" >nul 2>&1
if not errorlevel 1 (
    echo [AI BOT] Autonomous worker is already running.
    exit /b 0
)
echo [AI BOT] Starting Deribit Testnet worker in fail-closed monitoring mode...
powershell.exe -NoLogo -NoProfile -Command "$process = Start-Process -FilePath 'node.exe' -ArgumentList @('%~dp0bot\deribit-autobot-supervisor.mjs') -WorkingDirectory '%~dp0' -WindowStyle Hidden -RedirectStandardOutput '%~dp0work\autobot.log' -RedirectStandardError '%~dp0work\autobot-error.log' -PassThru; $process.Id | Set-Content '%~dp0work\autobot.pid'" >nul 2>&1
timeout /t 2 /nobreak >nul
if exist "work\autobot.pid" (
    echo [AI BOT] Worker started. Autonomous order routing remains locked until separately armed.
) else (
    echo [WARNING] AI worker did not start. Check work\autobot-error.log.
)
exit /b 0

:ensure_option_snapshot_recorder
if not exist "work" mkdir "work"
powershell.exe -NoLogo -NoProfile -Command "$pidFile='%~dp0work\option-snapshot.pid'; if (Test-Path $pidFile) { $recorderPid=Get-Content $pidFile -ErrorAction SilentlyContinue; if ($recorderPid -and (Get-Process -Id $recorderPid -ErrorAction SilentlyContinue)) { exit 0 } }; exit 1" >nul 2>&1
if not errorlevel 1 (
    echo [OPTION DATA] Read-only Testnet snapshot recorder is already running.
    exit /b 0
)
echo [OPTION DATA] Starting public Deribit Testnet snapshot recorder...
powershell.exe -NoLogo -NoProfile -Command "$process = Start-Process -FilePath 'node.exe' -ArgumentList @('%~dp0bot\option-snapshot-supervisor.mjs') -WorkingDirectory '%~dp0' -WindowStyle Hidden -RedirectStandardOutput '%~dp0work\option-snapshot.log' -RedirectStandardError '%~dp0work\option-snapshot-error.log' -PassThru; $process.Id | Set-Content '%~dp0work\option-snapshot.pid'" >nul 2>&1
timeout /t 2 /nobreak >nul
if exist "work\option-snapshot.pid" (
    echo [OPTION DATA] Recorder started: public data only, no credentials, no order routing.
) else (
    echo [WARNING] Option snapshot recorder did not start. Check work\option-snapshot-error.log.
)
exit /b 0

:ensure_mt5_bridge
set "MT5_BRIDGE_URL=http://127.0.0.1:8765"
if not defined MT5_TERMINAL_PATH set "MT5_TERMINAL_PATH=D:\MT5IntelliTrade\terminal64.exe"
if not defined MT5_DEMO_ORDER_ROUTING set "MT5_DEMO_ORDER_ROUTING=true"

powershell.exe -NoLogo -NoProfile -Command "try { $response = Invoke-WebRequest -UseBasicParsing -Uri '%MT5_BRIDGE_URL%/health' -TimeoutSec 2; if ($response.StatusCode -eq 200) { exit 0 } } catch {}; exit 1" >nul 2>&1
if not errorlevel 1 (
    echo [MT5] Bridge is already connected.
    exit /b 0
)

set "MT5_BOOTSTRAP_PYTHON="
set "MT5_PYTHON="
if exist ".venv\Scripts\python.exe" set "MT5_PYTHON=%~dp0.venv\Scripts\python.exe"
if not defined MT5_PYTHON if defined MT5_PYTHON_PATH if exist "%MT5_PYTHON_PATH%" set "MT5_PYTHON=%MT5_PYTHON_PATH%"
if not defined MT5_PYTHON if exist "D:\Projects\CryptoAgent\.venv\Scripts\python.exe" set "MT5_BOOTSTRAP_PYTHON=D:\Projects\CryptoAgent\.venv\Scripts\python.exe"
if not defined MT5_PYTHON if not defined MT5_BOOTSTRAP_PYTHON for /f "delims=" %%P in ('where python.exe 2^>nul') do if not defined MT5_BOOTSTRAP_PYTHON set "MT5_BOOTSTRAP_PYTHON=%%P"

if not defined MT5_PYTHON if defined MT5_BOOTSTRAP_PYTHON (
    echo [SETUP] Creating the isolated MT5 bridge environment...
    "%MT5_BOOTSTRAP_PYTHON%" -m venv ".venv"
    if not errorlevel 1 if exist ".venv\Scripts\python.exe" set "MT5_PYTHON=%~dp0.venv\Scripts\python.exe"
    if not defined MT5_PYTHON set "MT5_PYTHON=%MT5_BOOTSTRAP_PYTHON%"
)

if not defined MT5_PYTHON (
    echo [WARNING] Python was not found. CryptoV2 will start with simulated fallback data.
    exit /b 0
)

"%MT5_PYTHON%" -c "import MetaTrader5" >nul 2>&1
if errorlevel 1 (
    echo [SETUP] Installing the official MetaTrader5 Python package...
    "%MT5_PYTHON%" -m pip install --disable-pip-version-check -r "mt5_bridge\requirements.txt"
    if errorlevel 1 (
        echo [WARNING] MT5 bridge setup failed. CryptoV2 will use simulated fallback data.
        exit /b 0
    )
)

if not exist "work" mkdir "work"
echo [MT5] Starting loopback bridge for %MT5_TERMINAL_PATH%...
powershell.exe -NoLogo -NoProfile -Command "$process = Start-Process -FilePath '%MT5_PYTHON%' -ArgumentList @('%~dp0mt5_bridge\server.py') -WorkingDirectory '%~dp0' -WindowStyle Hidden -RedirectStandardOutput '%~dp0work\mt5-bridge.log' -RedirectStandardError '%~dp0work\mt5-bridge-error.log' -PassThru; $process.Id | Set-Content '%~dp0work\mt5-bridge.pid'" >nul 2>&1

for /L %%I in (1,1,15) do (
    powershell.exe -NoLogo -NoProfile -Command "try { $response = Invoke-WebRequest -UseBasicParsing -Uri '%MT5_BRIDGE_URL%/health' -TimeoutSec 2; if ($response.StatusCode -eq 200) { exit 0 } } catch {}; exit 1" >nul 2>&1
    if not errorlevel 1 (
        echo [MT5] Verified DEMO bridge connected. Demo order routing: %MT5_DEMO_ORDER_ROUTING%.
        exit /b 0
    )
    timeout /t 1 /nobreak >nul
)

echo [WARNING] MT5 did not connect. Check work\mt5-bridge-error.log.
echo [WARNING] CryptoV2 will continue with clearly labelled fallback data.
exit /b 0
