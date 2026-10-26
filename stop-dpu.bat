@echo off
setlocal
powershell -NoProfile -Command "Get-NetTCPConnection -LocalPort 4213,3124 -State Listen -ErrorAction SilentlyContinue | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue }"
echo Stopped the API on port 4213 and the page on port 3124.
echo MongoDB was left running.
endlocal
