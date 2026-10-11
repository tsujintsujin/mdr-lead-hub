@echo off
REM MDR Lead Hub: starts everything this demo needs. Double-click it.
REM   WordPress sites (Docker)  http://localhost:8081  and  http://localhost:8082
REM   CRM                       http://localhost:3090
REM   n8n                       http://localhost:5678  (the shared n8n in D:\AIO Freelance\n8n)
REM   Tunnel                    mdr-hooks.thejobstash.com -> only the Slack and Asana webhooks
REM Ollama (qwen2.5:7b) must be running too; it normally starts with Windows.
cd /d "%~dp0"

echo Starting the WordPress sites...
docker compose up -d
if errorlevel 1 (
  echo Docker isn't answering. Open Docker Desktop, wait for it to say "Engine running", then run this again.
  pause
  exit /b 1
)

powershell -NoProfile -Command "if (-not (Get-NetTCPConnection -LocalPort 5678 -State Listen -ErrorAction SilentlyContinue)) { Start-Process cmd -ArgumentList '/k','\"D:\AIO Freelance\n8n\start_n8n.cmd\"' }"
powershell -NoProfile -Command "if (-not (Get-NetTCPConnection -LocalPort 3090 -State Listen -ErrorAction SilentlyContinue)) { Start-Process cmd -ArgumentList '/k','\"%~dp0start-crm.cmd\"' -WindowStyle Minimized }"
powershell -NoProfile -Command "if (-not (Get-Process cloudflared -ErrorAction SilentlyContinue | Where-Object { $_.CommandLine -like '*tunnel\cloudflared.yml*' })) { Start-Process cmd -ArgumentList '/k','\"%~dp0start-tunnel.cmd\"' -WindowStyle Minimized }"

echo.
echo All started. Open:
echo   Practice Growth Check  http://localhost:8081
echo   Grant Ready            http://localhost:8082
echo   CRM                    http://localhost:3090
echo   n8n                    http://localhost:5678
