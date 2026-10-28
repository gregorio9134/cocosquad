#!/bin/bash
# =============================================================================
# COCO SQUAD — Inicio de Túnel HTTPS Seguro para Pruebas en Celular (PWA & WebRTC)
# =============================================================================

pkill -f "cloudflared tunnel" 2>/dev/null || true
sleep 1
rm -f /home/ubuntu/agente-staging/tunnel.log

nohup cloudflared tunnel --url http://127.0.0.1:8080 > /home/ubuntu/agente-staging/tunnel.log 2>&1 &

URL=""
for i in {1..20}; do
    sleep 1
    URL=$(grep -o 'https://[-a-zA-Z0-9.]*\.trycloudflare\.com' /home/ubuntu/agente-staging/tunnel.log | head -n 1)
    if [ -n "$URL" ]; then
        break
    fi
done

if [ -n "$URL" ]; then
    echo "=========================================================="
    echo "✅ TÚNEL HTTPS SEGURO ACTIVO PARA CELULAR (PWA & WEBRTC)"
    echo "URL Pública: $URL"
    echo "=========================================================="
    echo "$URL" > /home/ubuntu/agente-staging/tunnel_url.txt
else
    echo "⚠️ No se pudo obtener la URL tras 20s. Últimas líneas del log:"
    tail -n 15 /home/ubuntu/agente-staging/tunnel.log
fi
