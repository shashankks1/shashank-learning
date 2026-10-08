@echo off
rem Double-click to open Level 1. Builds the app and opens it at http://localhost:5180
cd /d "%~dp0"
if not exist node_modules (
  echo Installing dependencies, first run only...
  call npm install || goto :error
)
call npm start
goto :eof

:error
echo.
echo Something went wrong. Make sure Node.js 20+ is installed: https://nodejs.org
pause
