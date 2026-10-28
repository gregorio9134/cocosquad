#!/bin/bash

# Coco Squad — Backend Local Startup
# Uso: cd "path/to/coco squad" && bash start_backend.sh

set -e

echo ""
echo "╭─ COCO SQUAD BACKEND LOCAL ─────────────────────────────────╮"
echo "│ Starting FastAPI server on http://127.0.0.1:8080           │"
echo "╰────────────────────────────────────────────────────────────╯"
echo ""

# Verifica health check
echo "📋 Running health check..."
python3 health_check.py
if [ $? -ne 0 ]; then
    echo ""
    echo "❌ Health check failed. Fix the issues above before starting."
    exit 1
fi

echo ""
echo "🚀 Starting backend with COCO_LOCAL_DEV=1..."
echo ""

cd server-staging
export COCO_LOCAL_DEV=1
export PYTHONUNBUFFERED=1
export FOUNDER_PASSWORD="FounderTest123!"

python3 fastapi_server.py
