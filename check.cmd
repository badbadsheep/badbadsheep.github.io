@echo off
REM Double-click for a full pre-publish check:
REM font subset -^> type check -^> build -^> dead link scan
cd /d "%~dp0"
echo.
echo   [1/4] font subset
call pnpm fonts
if errorlevel 1 goto fail
echo   [2/4] type check
call pnpm check
if errorlevel 1 goto fail
echo   [3/4] build
call pnpm build
if errorlevel 1 goto fail
echo   [4/4] link check
call pnpm links
if errorlevel 1 goto fail
echo.
echo   All green.
pause
exit /b 0

:fail
echo.
echo   Failed above. Do not publish yet.
pause
exit /b 1