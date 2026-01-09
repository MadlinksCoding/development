@echo off
setlocal

set "JEST_DIR=%~dp0"

echo.
echo Cleanup Jest temp files
echo -----------------------
echo This will remove: node_modules, package-lock.json
set /p CONFIRM="Type YES to continue: "

if /I not "%CONFIRM%"=="YES" goto done

if exist "%JEST_DIR%node_modules" (
  rmdir /s /q "%JEST_DIR%node_modules"
)
if exist "%JEST_DIR%package-lock.json" (
  del /f /q "%JEST_DIR%package-lock.json"
)

echo Cleanup complete.

:done
endlocal
