@echo off
setlocal
rem format.bat - Run formatting (local gulp if available, else npx)

rem Change to the batch file directory (formatting folder)
pushd "%~dp0"

rem Check node installed
where node >nul 2>&1
if errorlevel 1 (
  echo Node.js not found in PATH. Please install Node.js or add it to PATH.
  popd
  endlocal
  exit /b 1
)

rem If no args provided, default to formatting all JS under src (recursive)
if "%*"=="" (
  rem Use forward-slash glob and expose as an env var FILE so the gulpfile picks it up
  rem (gulpfile checks process.env.FILE when no CLI arg is present)
  set "FILE=src/**/*.js"
  set "ARGS="
) else (
  set "ARGS=%*"
)

rem If the local gulp binary exists, use it. Otherwise fall back to npx gulp.
if exist "node_modules\gulp\bin\gulp.js" (
  node "node_modules\gulp\bin\gulp.js" build %ARGS%
  set "LAST=%ERRORLEVEL%"
) else (
  npx gulp build %ARGS%
  set "LAST=%ERRORLEVEL%"
)

if %LAST% neq 0 (
  echo Formatting failed with exit code %LAST%.
) else (
  echo Formatting completed.
)

popd
endlocal
exit /b %LAST%
