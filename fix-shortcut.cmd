@echo off
setlocal
chcp 65001 >nul
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\repoint-shortcut.ps1" %*
set "RC=%ERRORLEVEL%"
echo.
pause
exit /b %RC%
