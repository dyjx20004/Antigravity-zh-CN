@echo off
setlocal
chcp 65001 >nul
if exist "%~dp0dist\Antigravity-Patcher.exe" (
    "%~dp0dist\Antigravity-Patcher.exe" --backup-dir "%~dp0backups" --force-reextract --no-launch --no-pause %*
) else (
    python "%~dp0Antigravity-zh-CN\Antigravity-Patcher.py" --backup-dir "%~dp0backups" --force-reextract --no-launch --no-pause %*
)
set "RC=%ERRORLEVEL%"
echo.
pause
exit /b %RC%
