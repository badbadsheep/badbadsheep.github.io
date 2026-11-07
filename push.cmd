@echo off
REM One-click publish: check, commit, push to GitHub.
REM Arguments pass through:
REM   push.cmd -SkipVerify     skip the verify step
REM   push.cmd -Force          overwrite a remote whose history is unrelated
REM   push.cmd "message"       custom commit message
REM
REM Deliberately ASCII-only: cmd.exe decodes .cmd files with the console code
REM page, so Chinese text in a batch file breaks on another code page.
REM All Chinese output lives in scripts\push.ps1.
REM
REM No "cd /d %~dp0" on purpose: scripts\push.ps1 sets its own working
REM directory, and moving the console elsewhere mid-run is what makes cmd.exe
REM lose the rest of this file ("The batch file cannot be found.") when git
REM rewrites the working tree underneath a running batch.
setlocal
set "HERE=%~dp0"

where powershell >nul 2>nul
if errorlevel 1 (
  echo   PowerShell not found in PATH.
  echo   Nothing was pushed.
  if "%~1"=="" pause
  exit /b 1
)

powershell -NoProfile -ExecutionPolicy Bypass -File "%HERE%scripts\push.ps1" %*
set "RC=%ERRORLEVEL%"

echo.
if "%RC%"=="0" echo   Done. Pushed to GitHub.
if not "%RC%"=="0" echo   Failed above. Nothing was pushed.

if "%~1"=="" pause
exit /b %RC%
