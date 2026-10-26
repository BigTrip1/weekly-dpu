@echo off
setlocal
rem Opens ports 3124 and 4213 to this PC's local network only. Run once per PC.

net session >nul 2>&1
if errorlevel 1 (
  echo Asking for administrator rights so Windows Firewall can be changed...
  powershell -NoProfile -Command "Start-Process -FilePath '%~f0' -Verb RunAs"
  exit /b
)

netsh advfirewall firewall delete rule name="DPU web 3124" >nul 2>&1
netsh advfirewall firewall delete rule name="DPU API 4213" >nul 2>&1
netsh advfirewall firewall add rule name="DPU web 3124" dir=in action=allow protocol=TCP localport=3124 profile=any remoteip=localsubnet
netsh advfirewall firewall add rule name="DPU API 4213" dir=in action=allow protocol=TCP localport=4213 profile=any remoteip=localsubnet

echo.
echo Done. Ports 3124 and 4213 now accept connections from the local network only.
pause
endlocal
