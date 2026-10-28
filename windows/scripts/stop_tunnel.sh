#!/bin/bash
# =============================================================================
# COCO SQUAD — Detener Túnel HTTPS de Cloudflare
# =============================================================================

pkill -f "cloudflared tunnel" 2>/dev/null || true
rm -f /home/ubuntu/agente-staging/tunnel_url.txt
echo "🛑 Túnel HTTPS de Cloudflare detenido correctamente."
