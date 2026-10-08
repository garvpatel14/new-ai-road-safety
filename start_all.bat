@echo off
title SafeRoad AI Platform Launcher
echo ========================================================
echo   Starting SafeRoad AI Platform Services...
echo ========================================================

cd /d "%~dp0"

echo [1/3] Starting Backend API (Port 5000)...
start "SafeRoad Backend API" cmd /k "cd /d "%~dp0server" && npm run dev"

echo [2/3] Starting ML Inference Server (Port 8000)...
start "SafeRoad ML Inference" cmd /k "cd /d "%~dp0" && python server/ml_server.py"

echo [3/3] Starting Frontend Web App (Port 3000)...
start "SafeRoad Frontend" cmd /k "cd /d "%~dp0" && npm run dev"

echo.
echo All 3 services launched in separate windows!
echo - Frontend: http://localhost:3000
echo - Backend API: http://localhost:5000/api
echo - ML Inference: http://localhost:8000
echo.
pause
