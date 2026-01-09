@echo off
rem wrapper to keep window open and delegate to win-run-core.bat
set "CONFIG_JSON=%~dp0test-runner.config.js"
cmd /k "%~dp0win-run-core.bat"

