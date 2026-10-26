@echo off
setlocal
powershell -NoProfile -Command "Get-NetTCPConnection -LocalPort 4000,5173 -State Listen -ErrorAction SilentlyContinue | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue }"
echo Stopped the API on port 4000 and the page on port 5173.
echo MongoDB was left running.
endlocal
