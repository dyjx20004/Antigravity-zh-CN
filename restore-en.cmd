@echo off
setlocal

set "TOOLS_DIR=%~dp0"
if "%TOOLS_DIR:~-1%"=="\" set "TOOLS_DIR=%TOOLS_DIR:~0,-1%"

echo ==============================================================
echo   Antigravity Restore Official English Version
echo ==============================================================
echo.

set "PY_EXE="
where python >nul 2>&1
if not errorlevel 1 set "PY_EXE=python"
if not defined PY_EXE (
    if exist "%LOCALAPPDATA%\Programs\Python\Python313\python.exe" (
        set "PY_EXE=%LOCALAPPDATA%\Programs\Python\Python313\python.exe"
    )
)
if not defined PY_EXE (
    echo [ERROR] Python not found in PATH or %LOCALAPPDATA%\Programs\Python\Python313\python.exe
    pause
    exit /b 1
)

"%PY_EXE%" "%TOOLS_DIR%\patcher.py" --restore --no-launch
if errorlevel 1 (
    echo.
    echo [ERROR] Restore failed.
    pause
    exit /b 1
)

echo.
echo Launching official English Antigravity with proxy...
call "%TOOLS_DIR%\launch-proxy.cmd"
if errorlevel 1 (
    pause
    exit /b 1
)

endlocal
