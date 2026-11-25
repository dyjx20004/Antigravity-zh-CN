@echo off
setlocal EnableDelayedExpansion

set "TOOLS_DIR=%~dp0"
if "%TOOLS_DIR:~-1%"=="\" set "TOOLS_DIR=%TOOLS_DIR:~0,-1%"
set "CFG=%TOOLS_DIR%\config.json"

set "ELECTRON_RUN_AS_NODE="

set "CFG_PROXY=http://127.0.0.1:7897"
set "CFG_NOPROXY=localhost,127.0.0.1,::1"
set "CFG_TIMEOUT=800"

if exist "%CFG%" (
    for /f "usebackq tokens=1,2 delims==" %%A in (`powershell -NoProfile -Command "try { $c = Get-Content -LiteralPath '%CFG%' -Raw -Encoding UTF8 | ConvertFrom-Json; if ($c.proxy) { 'PROXY=' + $c.proxy }; if ($c.noProxy) { 'NOPROXY=' + $c.noProxy }; if ($c.probeTimeoutMs) { 'TIMEOUT=' + $c.probeTimeoutMs } } catch {}"`) do (
        if "%%A"=="PROXY" set "CFG_PROXY=%%B"
        if "%%A"=="NOPROXY" set "CFG_NOPROXY=%%B"
        if "%%A"=="TIMEOUT" set "CFG_TIMEOUT=%%B"
    )
)

if not defined ANTIGRAVITY_PROXY set "ANTIGRAVITY_PROXY=%CFG_PROXY%"

set "NO_PROXY=%CFG_NOPROXY%"
set "no_proxy=%CFG_NOPROXY%"
set "HTTPS_PROXY=%ANTIGRAVITY_PROXY%"
set "HTTP_PROXY=%ANTIGRAVITY_PROXY%"
set "https_proxy=%ANTIGRAVITY_PROXY%"
set "http_proxy=%ANTIGRAVITY_PROXY%"

set "APP=%LOCALAPPDATA%\Programs\antigravity\Antigravity.exe"
if not exist "%APP%" (
    echo [ERROR] Antigravity.exe not found:
    echo   %APP%
    echo.
    pause
    exit /b 1
)

powershell -NoProfile -Command "$u=$env:HTTPS_PROXY; try { $uri=[Uri]$u; $hostName=if($uri.Host){$uri.Host}else{'127.0.0.1'}; $port=if($uri.Port -gt 0){$uri.Port}else{7897}; $t=[int]$env:CFG_TIMEOUT; if($t -le 0){$t=800}; $c=New-Object Net.Sockets.TcpClient; $r=$c.BeginConnect($hostName,$port,$null,$null); $ok=$r.AsyncWaitHandle.WaitOne($t); if($ok){$c.EndConnect($r)}; $c.Close(); if(-not $ok){ Write-Host ('[WARN] Proxy ' + $hostName + ':' + $port + ' not responding. Please check your proxy client.') -ForegroundColor Yellow; Start-Sleep -Seconds 1 } } catch {}"

start "" "%APP%"
if errorlevel 1 (
    echo [ERROR] Failed to launch Antigravity.exe
    pause
    exit /b 1
)

endlocal
