@echo off
title Coucou - Mochi Island (Windows)
set PATH=C:\Users\polac\AppData\Local\hermes\node;%PATH%
cd /d "C:\Users\polac\.gemini\antigravity\scratch\coucou\windows"
echo ========================================================
echo   Iniciando Coucou (Mochi - Island Companion)
echo ========================================================
echo Abriendo vista previa en tu navegador...
start http://127.0.0.1:1420/
npx vite --port 1420 --host 127.0.0.1
pause
