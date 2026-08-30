[CmdletBinding()]
param()

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
$work = Join-Path $root "work"
$statePath = Join-Path $work "autobot\state.json"

function Read-JsonFile([string]$Path) {
    if (-not (Test-Path -LiteralPath $Path -PathType Leaf)) {
        return $null
    }
    return Get-Content -LiteralPath $Path -Raw | ConvertFrom-Json
}

function Get-ValidatedPid([string]$PidPath, [string]$Pattern) {
    if (-not (Test-Path -LiteralPath $PidPath -PathType Leaf)) {
        return $null
    }
    $processId = Get-Content -LiteralPath $PidPath -ErrorAction SilentlyContinue | Select-Object -First 1
    if ($processId -notmatch '^\d+$') {
        return $null
    }
    $process = Get-CimInstance Win32_Process -Filter "ProcessId=$processId" -ErrorAction SilentlyContinue
    if ($process -and $process.CommandLine -match $Pattern) {
        return [int]$processId
    }
    return $null
}

function Stop-ProcessTree([int]$ProcessId, [string]$Name) {
    Write-Host "Stopping $Name (PID $ProcessId)..."
    & taskkill.exe /PID $ProcessId /T /F | Out-Null
    if ($LASTEXITCODE -ne 0 -and (Get-Process -Id $ProcessId -ErrorAction SilentlyContinue)) {
        throw "FAILED_TO_STOP_${Name}_PID_$ProcessId"
    }
}

$state = Read-JsonFile $statePath
$autobotPidPath = Join-Path $work "autobot.pid"
$autobotPid = Get-ValidatedPid $autobotPidPath 'deribit-autobot-supervisor[.]mjs'

if ($state) {
    $positions = if ($null -eq $state.positionCount) { 0 } else { [int]$state.positionCount }
    $orders = if ($null -eq $state.openOrderCount) { 0 } else { [int]$state.openOrderCount }
    $pendingOrders = @($state.pendingOrders).Count
    if ($positions -ne 0 -or $orders -ne 0 -or $pendingOrders -ne 0) {
        throw "UNSAFE_TO_CLOSE: CryptoV2 reports $positions managed position(s), $orders open order(s), and $pendingOrders pending order(s). Use the guarded hot-restart workflow instead."
    }

    if ($autobotPid) {
        $heartbeat = [datetime]$state.lastHeartbeat
        $heartbeatFresh = ((Get-Date).ToUniversalTime() - $heartbeat.ToUniversalTime()).TotalSeconds -le 90
        if (-not $heartbeatFresh -or $state.exitManagementActive -ne $true -or $state.degraded -eq $true -or $state.reconciliationRequired -eq $true -or $state.error -or $state.evaluationInFlight -eq $true) {
            throw "UNSAFE_TO_CLOSE: autonomous-worker safety state is not healthy and drained."
        }
    }
} elseif ($autobotPid) {
    throw "UNSAFE_TO_CLOSE: autonomous worker is running but its state file is unavailable."
}

$targets = New-Object 'System.Collections.Generic.HashSet[int]'
if ($autobotPid) { [void]$targets.Add($autobotPid) }

$pidRules = @(
    @{ Path = (Join-Path $work "option-snapshot.pid"); Pattern = 'option-snapshot-supervisor[.]mjs'; Name = 'option snapshot recorder' },
    @{ Path = (Join-Path $work "mt5-bridge.pid"); Pattern = 'mt5_bridge[\\/]server[.]py'; Name = 'MT5 bridge' }
)

$namedTargets = @{}
if ($autobotPid) { $namedTargets[$autobotPid] = 'autonomous worker' }
foreach ($rule in $pidRules) {
    $processId = Get-ValidatedPid $rule.Path $rule.Pattern
    if ($processId) {
        [void]$targets.Add($processId)
        $namedTargets[$processId] = $rule.Name
    }
}

$listener = Get-NetTCPConnection -LocalPort 3000 -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1
if ($listener) {
    $process = Get-CimInstance Win32_Process -Filter "ProcessId=$($listener.OwningProcess)" -ErrorAction SilentlyContinue
    if ($process.CommandLine -match 'CryptoV2.+next') {
        [void]$targets.Add([int]$process.ProcessId)
        $namedTargets[[int]$process.ProcessId] = 'web application'
    } else {
        Write-Warning "Port 3000 belongs to another application; it was not stopped."
    }
}

if ($targets.Count -eq 0) {
    Write-Host "CryptoV2 is not running."
    exit 0
}

foreach ($processId in $targets) {
    $processName = if ($namedTargets.ContainsKey($processId)) { $namedTargets[$processId] } else { 'CryptoV2 process' }
    Stop-ProcessTree $processId $processName
}

foreach ($pidPath in @($autobotPidPath, $pidRules.Path)) {
    if (Test-Path -LiteralPath $pidPath -PathType Leaf) {
        $recordedPid = Get-Content -LiteralPath $pidPath -ErrorAction SilentlyContinue | Select-Object -First 1
        if (-not (Get-Process -Id $recordedPid -ErrorAction SilentlyContinue)) {
            Remove-Item -LiteralPath $pidPath -Force -ErrorAction SilentlyContinue
        }
    }
}

Write-Host "CryptoV2 stopped with zero managed positions and zero open orders."
