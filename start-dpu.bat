@echo off
setlocal
cd /d "%~dp0"

where node >nul 2>&1
if errorlevel 1 (
  echo Node.js was not found on PATH.
  exit /b 1
)

set "MODE=%~1"
if /i "%MODE%"=="dev" goto modeChosen
if /i "%MODE%"=="prod" goto modeChosen
echo.
echo   [D] Dev         live reload, for editing the code
echo   [P] Production  builds the page first, then serves the built files
echo.
choice /c DP /n /m "Start in Dev or Production? (D/P): "
if errorlevel 2 (set "MODE=prod") else (set "MODE=dev")

:modeChosen
powershell -NoProfile -Command "try { $client = New-Object System.Net.Sockets.TcpClient('127.0.0.1',27017); $client.Close(); exit 0 } catch { exit 1 }"
if errorlevel 1 (
  echo MongoDB is not listening on 127.0.0.1:27017. Start MongoDB, then run this again.
  exit /b 1
)

if /i "%MODE%"=="prod" (
  echo Building the page with npm run build ...
  pushd "%~dp0frontend"
  call npm run build
  if errorlevel 1 (
    popd
    echo The build failed. Nothing was started.
    exit /b 1
  )
  popd
  start "DPU API (production)" /D "%~dp0backend" cmd /k "npm start"
  start "DPU Web (production)" /D "%~dp0frontend" cmd /k "npm start"
) else (
  start "DPU API (dev)" /D "%~dp0backend" cmd /k "npm run dev"
  start "DPU Web (dev)" /D "%~dp0frontend" cmd /k "npm run dev"
)

echo.
echo Mode %MODE%
echo API  http://127.0.0.1:4213
echo Page http://127.0.0.1:3124
powershell -NoProfile -Command "Get-NetIPAddress -AddressFamily IPv4 | Where-Object { $_.IPAddress -notlike '127.*' -and $_.IPAddress -notlike '169.254.*' } | ForEach-Object { Write-Host ('Network page http://' + $_.IPAddress + ':3124') }"
netsh advfirewall firewall show rule name="DPU web 3124" >nul 2>&1
if errorlevel 1 (
  echo.
  echo Other PCs may be blocked by Windows Firewall. Run allow-network.bat once on this PC to let the local network in.
)
echo The API window shows who started it, each request, and each upload.
endlocal
