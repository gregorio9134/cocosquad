#!/bin/bash

# Coco Squad MVP — Start All Services Locally
# Uso: bash start_all_local.sh
# Levanta Backend (FastAPI :8080) + Frontend (Vite :1420) en paralelo

set -e

echo ""
echo "╭─ COCO SQUAD MVP — LOCAL STACK ───────────────────────────╮"
echo "│ Backend:  http://127.0.0.1:8080                          │"
echo "│ Frontend: http://127.0.0.1:1420                          │"
echo "│ Docs:     http://127.0.0.1:8080/docs                    │"
echo "╰─────────────────────────────────────────────────────────╯"
echo ""

cleanup() {
    echo ""
    echo "🛑 Deteniendo servicios..."
    pkill -f "fastapi_server.py" 2>/dev/null || true
    pkill -f "vite" 2>/dev/null || true
    echo "✅ Servicios detenidos."
}
trap cleanup EXIT INT TERM

# 1. Start Backend
echo "📋 [1/3] Iniciando Backend (FastAPI)..."
cd "/Users/Gregorio/Desktop/coco squad/server-staging"
export COCO_LOCAL_DEV=1
export PYTHONUNBUFFERED=1
python3 fastapi_server.py > /tmp/coco_backend.log 2>&1 &
BACKEND_PID=$!

echo "🏥 Esperando disponibilidad del backend..."
for i in {1..15}; do
    if curl -s http://127.0.0.1:8080/health > /dev/null 2>&1; then
        echo "✅ Backend OK en http://127.0.0.1:8080 (PID: $BACKEND_PID)"
        break
    fi
    if [ $i -eq 15 ]; then
        echo "❌ Falló el inicio del backend:"
        cat /tmp/coco_backend.log | tail -25
        exit 1
    fi
    sleep 1
done

# 2. Start Frontend
echo ""
echo "📋 [2/3] Iniciando Frontend (Vite)..."
cd "/Users/Gregorio/Desktop/coco squad/windows"
npx vite --host 127.0.0.1 --port 1420 > /tmp/coco_frontend.log 2>&1 &
FRONTEND_PID=$!

echo "🏥 Esperando disponibilidad del frontend..."
for i in {1..15}; do
    if curl -s http://127.0.0.1:1420 > /dev/null 2>&1; then
        echo "✅ Frontend OK en http://127.0.0.1:1420 (PID: $FRONTEND_PID)"
        break
    fi
    if [ $i -eq 15 ]; then
        echo "❌ Falló el inicio del frontend:"
        cat /tmp/coco_frontend.log | tail -25
        exit 1
    fi
    sleep 1
done

# 3. Test de Conexión
echo ""
echo "📋 [3/3] Probando Healthcheck de la API..."
HEALTH_RESP=$(curl -s http://127.0.0.1:8080/health)
echo "✅ Respuesta: $HEALTH_RESP"

echo ""
echo "════════════════════════════════════════════════════════════"
echo "🚀 STACK LOCAL COMPLETO LISTO PARA PROBAR"
echo "════════════════════════════════════════════════════════════"
echo ""
echo "📍 Abrí en tu navegador: http://127.0.0.1:1420"
echo "📚 Documentación Swagger: http://127.0.0.1:8080/docs"
echo ""
echo "Presioná Ctrl+C para finalizar la ejecución."
echo ""

wait
