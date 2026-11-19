@echo off
REM ============================================================
REM  Antigravity Launcher WITH Proxy (process-scoped only)
REM  Does not modify any Windows global environment variables.
REM ============================================================

setlocal
chcp 65001 >nul
call "%~dp0config.cmd"

set "NO_PROXY=%NO_PROXY_LIST%"
set "no_proxy=%NO_PROXY_LIST%"
set "HTTPS_PROXY=%ANTIGRAVITY_PROXY%"
set "HTTP_PROXY=%ANTIGRAVITY_PROXY%"
set "https_proxy=%ANTIGRAVITY_PROXY%"
set "http_proxy=%ANTIGRAVITY_PROXY%"

set "APP=%ANTIGRAVITY_DIR%\Antigravity.exe"

if not exist "%APP%" (
    echo [错误] 未找到 Antigravity.exe
    echo        预期路径: %APP%
    echo        若安装在其他目录，请在 config.cmd 中设置 ANTIGRAVITY_DIR。
    echo.
    pause
    exit /b 1
)

REM Probe the proxy host:port; warn in Chinese only, never block startup
powershell -NoProfile -Command "$raw=$env:HTTPS_PROXY; try{ $u=[Uri]$raw; $hostName=$u.Host; $port=$u.Port }catch{ $hostName='127.0.0.1'; $port=7897 }; $ok=$false; try{ $c=New-Object Net.Sockets.TcpClient; $r=$c.BeginConnect($hostName,$port,$null,$null); $ok=$r.AsyncWaitHandle.WaitOne(800); if($ok){$c.EndConnect($r)}; $c.Close() }catch{}; if(-not $ok){ Write-Host ('[提示] 代理 ' + $raw + ' 未响应；若使用其他端口请修改 config.cmd 中的 ANTIGRAVITY_PROXY。') -ForegroundColor Yellow; Start-Sleep -Seconds 2 }"

start "" "%APP%"

endlocal
