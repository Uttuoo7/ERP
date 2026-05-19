@echo off
echo Starting P2P ERP Backend...
start "P2P ERP Backend" cmd /k "cd /d %~dp0 && py -m uvicorn backend.main:app --reload --port 8000"

echo Starting P2P ERP Frontend...
start "P2P ERP Frontend" cmd /k "cd /d %~dp0frontend && npm run dev"

echo Both servers are starting in new windows!
