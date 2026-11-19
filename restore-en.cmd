@echo off
setlocal
chcp 65001 >nul
call "%~dp0config.cmd"

if exist "%~dp0dist\Restore.exe" (
    "%~dp0dist\Restore.exe" --app-dir "%ANTIGRAVITY_DIR%" --no-launch --no-pause %*
    set "RC=%ERRORLEVEL%"
    goto :after_restore
)

powershell -NoProfile -ExecutionPolicy Bypass -Command "$py=$null; foreach($c in @('python','py')){ $cmd=Get-Command $c -ErrorAction SilentlyContinue; if($cmd -and $cmd.Source -notlike '*\WindowsApps\*'){ $py=$cmd.Source; break } }; if(-not $py){ Write-Host '[错误] 未检测到可用的 Python 环境（已排除 Microsoft Store 占位符）。请安装 Python 3.8+，或从 GitHub Releases 下载已编译的 Release 压缩包。' -ForegroundColor Red; exit 1 }; if($py -like '*\py.exe'){ & $py -3 '%~dp0Antigravity-zh-CN\Restore.py' --app-dir '%ANTIGRAVITY_DIR%' --no-launch --no-pause @args } else { & $py '%~dp0Antigravity-zh-CN\Restore.py' --app-dir '%ANTIGRAVITY_DIR%' --no-launch --no-pause @args }; exit $LASTEXITCODE" %*
set "RC=%ERRORLEVEL%"

:after_restore
echo.
if "%RC%"=="0" (
    echo 正在通过代理启动原版 Antigravity...
    call "%~dp0Antigravity-Proxy.cmd"
)
pause
exit /b %RC%
