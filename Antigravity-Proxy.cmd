@echo off
REM ============================================================
REM  Antigravity Launcher WITH Proxy (process-scoped only)
REM  Does not modify any Windows global environment variables.
REM ============================================================

setlocal
call "%~dp0config.cmd"

set "NO_PROXY=%NO_PROXY_LIST%"
set "no_proxy=%NO_PROXY_LIST%"
set "HTTPS_PROXY=%ANTIGRAVITY_PROXY%"
set "HTTP_PROXY=%ANTIGRAVITY_PROXY%"
set "https_proxy=%ANTIGRAVITY_PROXY%"
set "http_proxy=%ANTIGRAVITY_PROXY%"

set "APP=%LOCALAPPDATA%\Programs\antigravity\Antigravity.exe"

if not exist "%APP%" (
    echo [ERROR] Antigravity.exe not found
    echo   expected: %APP%
    echo.
    pause
    exit /b 1
)

REM Probe the proxy port; warn only, never block startup
powershell -NoProfile -Command "$h=$env:HTTPS_PROXY -replace '^https?://',''; $p=[int]($h -split ':')[-1]; $ok=$false; try{ $c=New-Object Net.Sockets.TcpClient; $r=$c.BeginConnect('127.0.0.1',$p,$null,$null); $ok=$r.AsyncWaitHandle.WaitOne(800); if($ok){$c.EndConnect($r)}; $c.Close() }catch{}; if(-not $ok){ Write-Host ('[WARN] Proxy port ' + $p + ' is not responding; Clash/proxy may be off.') -ForegroundColor Yellow; Start-Sleep -Seconds 2 }"

start "" "%APP%"

endlocal
