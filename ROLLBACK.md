# Punto de resguardo — cómo deshacer los cambios

Resguardo creado el **2026-10-22 12:32** (UTC 12:37), antes de tocar los cierres de seguridad
y antes de integrar el motor OpenCode.

Si algo sale mal, estos son los pasos exactos para volver al estado de ese momento.

---

## 1. Servidor (staging `150.136.59.173`)

El resguardo completo vive **en el servidor**, en:

```
/home/ubuntu/resguardos/resguardo-20261022-123230/
├── code/app.tar.gz      652 MB  → árbol completo de /home/ubuntu/agente-staging
├── env/env.bak                    → .env con todos los secretos (chmod 600)
├── db/*.sqlite3                   → base de inquilinos (copia consistente vía API de sqlite)
└── meta/manifest.txt              → md5 de los 8 archivos clave + PID del backend
```

### Restaurar todo (pérdida total de los cambios posteriores)

```bash
ssh -i ~/.ssh/oracle_key ubuntu@150.136.59.173
cd /home/ubuntu/agente-staging
sudo systemctl stop coco-backend 2>/dev/null || pkill -f 'python3 fastapi_server.py'
mv agente-staging agente-staging.fracaso-$(date +%s)
tar -xzf /home/ubuntu/resguardos/resguardo-20261022-123230/code/app.tar.gz -C /home/ubuntu
cp /home/ubuntu/resguardos/resguardo-20261022-123230/env/env.bak /home/ubuntu/agente-staging/.env
chmod 600 /home/ubuntu/agente-staging/.env
cd /home/ubuntu/agente-staging && nohup python3 fastapi_server.py >> server.log 2>&1 &
```

### Restaurar solo las bases de datos

```bash
cd /home/ubuntu/agente-staging
cp /home/ubuntu/resguardos/resguardo-20261022-123230/db/database__master.db.sqlite3 database/master.db
cp /home/ubuntu/resguardos/resguardo-20261022-123230/db/database__tenants_data__tenant_*.sqlite3 database/tenants_data/
```

### Verificar que el resguardo sirve (sin tocar nada)

```bash
gzip -t /home/ubuntu/resguardos/resguardo-20261022-123230/code/app.tar.gz && echo "TAR OK"
cat /home/ubuntu/resguardos/resguardo-20261022-123230/meta/manifest.txt
```

---

## 2. Local — repo principal (`~/Desktop/coco squad`)

Estado: rama `feat/mochi-real-responses`, commit base `c2723c6`, con trabajo sin commitear del usuario.

En `.resguardo/20261022-123230/`:

| Archivo | Qué guarda |
|---|---|
| `main_repo.patch` | `git diff HEAD` completo (2.193 líneas: todos los archivos modificados) |
| `untracked/` | copia de los 18 archivos sin trackear |
| `main_repo_status.txt` | `git status` del momento |
| `main_repo_head.txt` | commit base |

### Restaurar

```bash
cd "/Users/Gregorio/Desktop/coco squad"
git checkout -- .                                   # descarta cambios de archivos rastreados
git apply .resguardo/20261022-123230/main_repo.patch  # re-aplica el trabajo del usuario
cp -p .resguardo/20261022-123230/untracked/. -r .    # recupera los archivos sin trackear
```

> **Importante:** si el trabajo del usuario ya está commiteado, usar `git reset --hard <commit de main_repo_head.txt>` en vez de `git checkout -- .`.

---

## 3. Local — repo `server-staging/` (repo git propio)

Estado: rama `backend/staging-baseline`, commit base `795c18c`, con 3 archivos modificados sin commitear.

| Archivo | Qué guarda |
|---|---|
| `server-staging.patch` | `git diff HEAD` (101 líneas: `api/dependencies.py`, `api/routers/chat.py`, `fastapi_server.py`) |
| `server-staging_status.txt` | `git status` del momento |

### Restaurar

```bash
cd "/Users/Gregorio/Desktop/coco squad/server-staging"
git checkout -- .                                           # descarta cambios
git apply ../.resguardo/20261022-123230/server-staging.patch # re-aplica el trabajo
```

---

## 4. Copia de seguridad por archivo (lo que se usó al desplegar)

Además del resguardo completo, cada archivo que se modifica en el servidor se copia antes con
sufijo `.bak-YYYYmmdd-HHMMSS` (ejemplo: `fastapi_server.py.bak-20261021-231222`).

```bash
# en el servidor
ls -la /home/ubuntu/agente-staging/*.bak-* /home/ubuntu/agente-staging/api/routers/*.bak-* 2>/dev/null
```

Para volver atrás un archivo puntual:

```bash
cp fastapi_server.py.bak-20261022-HHMMSS fastapi_server.py
python3 -m py_compile fastapi_server.py && echo "sintaxis OK"
```

---

## 5. Checklist de verificación tras cualquier restauración

```bash
# 1) sintaxis de los archivos tocados
cd /home/ubuntu/agente-staging && python3 -m py_compile fastapi_server.py billing.py \
  api/routers/chat.py api/dependencies.py circuit_breaker.py functional_core.py && echo "OK"

# 2) el backend responde
curl -s -o /dev/null -w "version.json: %{http_code}\n" http://127.0.0.1:8080/version.json
curl -s -o /dev/null -w "chat sin token: %{http_code}\n" -X POST http://127.0.0.1:8080/api/chat \
  -H 'Content-Type: application/json' -d '{"message":"ping","tenant_id":1}'

# 3) el md5 del servidor coincide con el local
md5sum fastapi_server.py
```

Esperado: `version.json` → 200, `chat sin token` → **401** (session required).
