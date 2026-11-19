@echo off
setlocal
chcp 65001 >nul
if exist "%~dp0dist\Restore.exe" (
    "%~dp0dist\Restore.exe" --no-launch --no-pause %*
) else (
    python "%~dp0Antigravity-zh-CN\Restore.py" --no-launch --no-pause %*
)
set "RC=%ERRORLEVEL%"
echo.
if "%RC%"=="0" (
    echo Starting Antigravity with proxy...
    call "%~dp0Antigravity-Proxy.cmd"
)
pause
exit /b %RC%
