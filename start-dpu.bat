@echo off
setlocal
cd /d "%~dp0"

where node >nul 2>&1
if errorlevel 1 (
  echo Node.js was not found on PATH.
  exit /b 1
)

powershell -NoProfile -Command "try { $client = New-Object System.Net.Sockets.TcpClient('127.0.0.1',27017); $client.Close(); exit 0 } catch { exit 1 }"
if errorlevel 1 (
  echo MongoDB is not listening on 127.0.0.1:27017. Start MongoDB, then run this again.
  exit /b 1
)

start "DPU API" /D "%~dp0backend" cmd /k "npx tsc && node dist/index.js"
start "DPU Web" /D "%~dp0frontend" cmd /k "npx vite --host 127.0.0.1 --port 3124 --strictPort"

echo API  http://127.0.0.1:4213
echo Page http://127.0.0.1:3124
echo The API window shows who started it, each request, and each upload.
endlocal
