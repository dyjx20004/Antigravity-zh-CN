@echo off
setlocal

set "TOOLS_DIR=%~dp0"
if "%TOOLS_DIR:~-1%"=="\" set "TOOLS_DIR=%TOOLS_DIR:~0,-1%"

echo ==============================================================
echo   Antigravity One-Click Chinese Localization and Proxy Fix
echo ==============================================================
echo.

echo [1/3] Checking shortcuts and startup self-heal...
powershell -NoProfile -ExecutionPolicy Bypass -File "%TOOLS_DIR%\repoint-shortcuts.ps1"
if errorlevel 1 (
    echo [ERROR] Shortcut verification failed.
    pause
    exit /b 1
)

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

echo.
echo [2/3] Checking version and applying Chinese patch...
"%PY_EXE%" "%TOOLS_DIR%\patcher.py" --no-launch
if errorlevel 1 (
    echo.
    echo [ERROR] Localization patch failed.
    pause
    exit /b 1
)

if exist "%USERPROFILE%\.agy-shim" (
    rmdir /s /q "%USERPROFILE%\.agy-shim" >nul 2>&1
)

echo.
echo [3/3] Launching Antigravity with proxy...
call "%TOOLS_DIR%\launch-proxy.cmd"
if errorlevel 1 (
    echo [ERROR] Launch failed.
    pause
    exit /b 1
)

endlocal
