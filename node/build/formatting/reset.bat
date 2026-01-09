@echo off
setlocal

rem Determine the script name so we do not delete ourselves.
set "script=%~nx0"

rem Clean the src and build directories for the fresh run.
call :cleanDir "%~dp0src" false
call :cleanDir "%~dp0build" false

endlocal
exit /b

:cleanDir
set "dirPath=%~1"
set "skipScript=%~2"

if not exist "%dirPath%" exit /b
pushd "%dirPath%"

for /f "delims=" %%I in ('dir /b') do (
    if /i not "%%I"=="%script%" (
        if exist "%%I\" (
            rd /s /q "%%I" >nul 2>&1
        ) else (
            del /f /q "%%I" >nul 2>&1
        )
    )
)

popd
exit /b
