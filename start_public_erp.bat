@echo off
echo Starting P2P ERP Public Server...
echo Make sure you have installed localtunnel globally: npm install -g localtunnel

start "P2P ERP Backend" cmd /k "cd /d %~dp0 && py -m uvicorn backend.main:app --port 8000"

echo Waiting for backend to start...
timeout /t 3 /nobreak > NUL

echo Starting LocalTunnel...
start "P2P ERP Public Link" cmd /k "npx localtunnel --port 8000"

echo LocalTunnel should now provide you a URL (e.g., https://something.loca.lt)
echo Share that URL with anyone to give them access to the ERP!
