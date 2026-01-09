@echo off
setlocal

set "JEST_DIR=%~dp0"
set "CONFIG_JSON=%JEST_DIR%test-runner.config.js"
rem Convert backslashes to forward slashes for node require
set "CONFIG_JSON_NODE=%CONFIG_JSON:\=/%"
set "ROOT_DIR="
set "TEST_PATH="
set "JEST_CMD=%JEST_DIR%node_modules\.bin\jest.cmd"
set "RUN_TARGET="
set "NODE_ENV=test"
rem Force unbuffered output
set "FORCE_COLOR=1"
set "NODE_NO_WARNINGS=1"

rem Get ROOT_DIR first (needed for dependency installation)
for /f "delims=" %%A in ('node -e "const cfg=require('%CONFIG_JSON_NODE%'); console.log(cfg.rootDir||'');"') do set "ROOT_DIR=%%A"
if "%ROOT_DIR%"=="" goto bad_config

rem Install dependencies BEFORE showing menu
echo Installing/checking dependencies...
echo.

rem Ensure Jest is installed locally
if not exist "%JEST_CMD%" (
  echo Installing Jest dependencies...
  pushd "%JEST_DIR%"
  call npm install --no-fund --no-audit --silent
  popd
)
if not exist "%JEST_CMD%" (
  echo ERROR: Missing local Jest. Run npm install manually.
  pause
  goto end
)

rem Ensure joi, lru-cache, and luxon are installed in ROOT_DIR
pushd "%ROOT_DIR%"
node -e "try { require('joi'); } catch(e) { process.exit(1); }" >nul 2>&1
if errorlevel 1 (
  echo Installing joi in %ROOT_DIR%...
  call npm install joi --no-fund --no-audit --silent
)
node -e "try { require('lru-cache'); } catch(e) { process.exit(1); }" >nul 2>&1
if errorlevel 1 (
  echo Installing lru-cache in %ROOT_DIR%...
  call npm install lru-cache --no-fund --no-audit --silent
)
node -e "try { require('luxon'); } catch(e) { process.exit(1); }" >nul 2>&1
if errorlevel 1 (
  echo Installing luxon in %ROOT_DIR%...
  call npm install luxon --no-fund --no-audit --silent
)
popd

echo Dependencies ready.
echo.

:start_loop
echo Run Jest tests
echo ---------------
echo.
node -e "const cfg=require('%CONFIG_JSON_NODE%'); const classes=cfg.classes||[]; console.log('Available test classes:'); classes.forEach((c)=>console.log('  ' + c.name)); console.log('  all'); console.log('  exit');"
echo.
set /p TEST_FILTER="Enter class name, 'all', or 'exit': "
if /I "%TEST_FILTER%"=="exit" goto end
if /I "%TEST_FILTER%"=="0" goto end
if "%TEST_FILTER%"=="" goto end

rem Check if input is "all"
if /I "%TEST_FILTER%"=="all" goto set_all

rem Try to find by class name
set "TEST_FILE="

for /f "delims=" %%A in ('node -e "const cfg=require('%CONFIG_JSON_NODE%'); const cls=(cfg.classes||[]).find(c=>String(c.name||'').toLowerCase()==='%TEST_FILTER%'.toLowerCase()); if(!cls){process.exit(2);} const testPath=cls.test||''; const parts=testPath.split(/[\\/]/); console.log(parts[parts.length-1]);"') do set "TEST_FILE=%%A"
if "%TEST_FILE%"=="" goto not_found
goto run_test

:set_all
set "TEST_PATH=%JEST_DIR%tests"
goto run_all

:run_test
pushd "%JEST_DIR%"
echo Running Jest test: %TEST_FILE%
echo.
rem Run node directly - custom reporter will handle real-time output
node node_modules/jest/bin/jest.js tests/%TEST_FILE% --config=jest.config.js --runInBand --no-cache --forceExit
popd
goto done

:run_all
pushd "%JEST_DIR%"
echo Running all Jest tests (excluding example.test.js)...
echo.
rem Build test file list from config, excluding example.test.js
for /f "delims=" %%A in ('node -e "const cfg=require('%CONFIG_JSON_NODE%'); const files=(cfg.classes||[]).map(c=>{const parts=(c.test||'').split(/[\\/]/); return 'tests/'+parts[parts.length-1];}).filter(f=>f&&!f.includes('example')); console.log(files.join(' '));"') do set "TEST_FILES=%%A"
rem Run all test files from config (excluding example)
node node_modules/jest/bin/jest.js %TEST_FILES% --config=jest.config.js --runInBand --no-cache --forceExit
popd
goto done

:bad_config
echo Failed to read config: %CONFIG_JSON%
goto done

:not_found
echo Test class "%TEST_FILTER%" not found in %CONFIG_JSON%
echo Available classes:
node -e "const cfg=require('%CONFIG_JSON_NODE%'); (cfg.classes||[]).forEach(c=>console.log(c.name));"

:done
echo.
echo.
echo Test run complete.
echo.
goto start_loop

:end
endlocal
