@echo off
REM Double-click to start the local preview.
REM cd to this file's folder so it works no matter where you launched it from.
cd /d "%~dp0"
echo.
echo   Folder : %CD%
echo   Preview: http://localhost:4321
echo   Close this window to stop.
echo.
call pnpm dev
pause