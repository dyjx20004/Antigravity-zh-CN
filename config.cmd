@echo off
REM ============================================================
REM  Antigravity Toolset Unified Configuration
REM  External env var ANTIGRAVITY_PROXY takes precedence if set.
REM ============================================================

if not defined ANTIGRAVITY_PROXY set "ANTIGRAVITY_PROXY=http://127.0.0.1:7897"
set "NO_PROXY_LIST=localhost,127.0.0.1,::1"
