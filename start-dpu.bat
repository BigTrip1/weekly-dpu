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
call :ensureMongo
if errorlevel 1 exit /b 1

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
exit /b 0

:mongoUp
powershell -NoProfile -Command "try { $client = New-Object System.Net.Sockets.TcpClient('127.0.0.1',27017); $client.Close(); exit 0 } catch { exit 1 }"
exit /b %errorlevel%

:ensureMongo
call :mongoUp
if not errorlevel 1 (
  echo MongoDB is already running.
  exit /b 0
)
echo MongoDB is not running. Starting it ...
sc query MongoDB >nul 2>&1
if not errorlevel 1 goto startService
set "MONGOD="
for /d %%D in ("%ProgramFiles%\MongoDB\Server\*") do if exist "%%D\bin\mongod.exe" set "MONGOD=%%D\bin\mongod.exe"
if not defined MONGOD goto noMongo
if not exist "%~dp0data\db" mkdir "%~dp0data\db"
start "MongoDB" /min "%MONGOD%" --dbpath "%~dp0data\db" --bind_ip 127.0.0.1
goto waitMongo

:startService
net start MongoDB >nul 2>&1
if not errorlevel 1 goto waitMongo
echo Asking for administrator rights to start the MongoDB service ...
powershell -NoProfile -Command "Start-Process -FilePath 'net' -ArgumentList 'start','MongoDB' -Verb RunAs -Wait -WindowStyle Hidden"
goto waitMongo

:waitMongo
powershell -NoProfile -Command "$end = (Get-Date).AddSeconds(40); while ((Get-Date) -lt $end) { try { $client = New-Object System.Net.Sockets.TcpClient('127.0.0.1',27017); $client.Close(); exit 0 } catch { Start-Sleep -Seconds 1 } }; exit 1"
if errorlevel 1 (
  echo MongoDB did not start within 40 seconds. Start it by hand, then run this again.
  exit /b 1
)
echo MongoDB is running.
exit /b 0

:noMongo
echo MongoDB is not installed. Install MongoDB Community Server, then run this again.
exit /b 1
