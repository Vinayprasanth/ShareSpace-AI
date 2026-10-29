@echo off
setlocal
cd /d "%~dp0"
echo ShareSpace AI - Windows setup
if not exist backend\.env copy backend\.env.example backend\.env >nul
if not exist node_modules\concurrently (
  echo Installing root dependencies...
  call npm install || goto :error
)
if not exist backend\node_modules\sql.js (
  echo Installing backend dependencies...
  call npm --prefix backend install || goto :error
)
if not exist frontend\node_modules\vite (
  echo Installing frontend dependencies...
  call npm --prefix frontend install || goto :error
)
echo Starting ShareSpace AI. Keep this window open.
call npm run dev
goto :eof
:error
echo.
echo Setup failed. Copy the error above and share it for troubleshooting.
pause
