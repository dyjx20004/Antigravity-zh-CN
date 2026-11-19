@echo off
setlocal
chcp 65001 >nul
call "%~dp0config.cmd"
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\run-all.ps1" %*
set "RC=%ERRORLEVEL%"
echo.
if not "%RC%"=="0" (
    echo [FAILED] Exit code: %RC%
    pause
    exit /b %RC%
)
pause
endlocal
