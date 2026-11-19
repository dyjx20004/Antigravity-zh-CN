@echo off
REM ============================================================
REM  Antigravity Toolset Unified Configuration
REM  External env vars (ANTIGRAVITY_PROXY / ANTIGRAVITY_DIR) take precedence.
REM ============================================================

if not defined ANTIGRAVITY_PROXY set "ANTIGRAVITY_PROXY=http://127.0.0.1:7897"
set "NO_PROXY_LIST=localhost,127.0.0.1,::1"

if not defined ANTIGRAVITY_DIR (
    if exist "%LOCALAPPDATA%\Programs\antigravity\Antigravity.exe" (
        set "ANTIGRAVITY_DIR=%LOCALAPPDATA%\Programs\antigravity"
    ) else if exist "%ProgramFiles%\antigravity\Antigravity.exe" (
        set "ANTIGRAVITY_DIR=%ProgramFiles%\antigravity"
    ) else (
        set "ANTIGRAVITY_DIR=%LOCALAPPDATA%\Programs\antigravity"
    )
)
