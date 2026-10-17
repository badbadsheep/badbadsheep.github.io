@echo off
REM One-click publish: check, commit, push to GitHub.
REM Arguments are passed through, e.g.  push.cmd -SkipVerify
REM
REM This file is deliberately ASCII-only. cmd.exe decodes .cmd files with the
REM console code page, so Chinese text in a batch file breaks on a machine
REM whose code page differs. All Chinese output lives in scripts\push.ps1.
cd /d "%~dp0"

where powershell >nul 2>nul
if errorlevel 1 (
  echo   PowerShell not found in PATH.
  echo   Nothing was pushed.
  if "%~1"=="" pause
  exit /b 1
)

powershell -NoProfile -ExecutionPolicy Bypass -File "scripts\push.ps1" %*
set "RC=%ERRORLEVEL%"

echo.
if "%RC%"=="0" echo   Done. Pushed to GitHub.
if not "%RC%"=="0" echo   Failed above. Nothing was pushed.

if "%~1"=="" pause
exit /b %RC%
