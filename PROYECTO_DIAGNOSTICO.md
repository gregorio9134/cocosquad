# Coco Squad — Diagnóstico Completo del Proyecto

**Fecha:** 2026-10-23  
**Estado:** ⚠️ CRÍTICO — Backend no operacional, Frontend funcionando localmente  

---

## 1. Estado Actual

### Frontend (Windows/PWA)
- ✅ Corre en `http://127.0.0.1:5173` sin problemas
- ✅ Modo offline implementado (mock responses)
- ✅ Chips de sugerencias listos
- ✅ Botón "Copiar" en respuestas implementado
- ⚠️ Requiere backend en `http://127.0.0.1:8080` para funcionalidad real

### Backend (FastAPI)
- ❌ **NO ARRANCA NUNCA** — Error en `api/routers/admin.py` línea 157
- ❌ Servidor en Oracle (150.136.59.173:8080) está muerto desde Oct 22
- ⚠️ `jarvis_core.py` importa dependencias pesadas (sentry-sdk, etc) que no están en .venv

### Base de Datos
- ⚠️ SQLite local (`database/master.db`, `database/tenants_data/*.db`) existe
- ⚠️ Oracle tiene backups pero servidor no corre

---

## 2. Errores Recurrentes (Del Histórico)

### Error #1: Admin Router Roto
```
NameError: name '_exigir_admin_o_fundador' is not defined
Localización: api/routers/admin.py:157
```
**Causa:** La función `_exigir_admin_o_fundador` se usa pero no está definida.  
**Impacto:** Fastapi_server.py no puede importar admin.router → backend no arranca.  
**Solución:** Definir la función o comentar la línea 157.

### Error #2: Imports Faltantes en jarvis_core.py
```
ModuleNotFoundError: No module named 'sentry_sdk'
```
**Causa:** `fastapi_server.py:18` importa `sentry_sdk` que no está en requirements.txt  
**Impacto:** Backend falla al startup  
**Solución:** Crear stub minimal o agregar a .venv

### Error #3: Tests Saltados en Silencio
```
test_core.py - SKIPPED (pytest no disponible)
test_security.py - SKIPPED (fastapi no disponible en unittest)
```
**Causa:** Tests usan pytest pero unittest loader no los ve; se ejecutan sin error reportado  
**Impacto:** Cambios rotos se meten sin detectarse  
**Señal:** `SKIPPED 2 tests` en salida de suite

### Error #4: Sintaxis en admin.py Cargada Dinámicamente
```
_admin = Depends(_exigir_admin_o_fundador)  # <— línea 157
```
**Causa:** Code executes durante import, no en time de parseo  
**Impacto:** Pasa ast.parse() pero falla en runtime  

---

## 3. Hallazgos del Análisis Actual

### Backend — Estructura
| Archivo | Estado | Notas |
|---------|--------|-------|
| `fastapi_server.py` | ✅ Sintaxis OK | Importa admin que falla |
| `api/dependencies.py` | ✅ Sintaxis OK | Tiene bypass COCO_LOCAL_DEV |
| `api/routers/chat.py` | ✅ Sintaxis OK | Router /api/chat funcional en teoría |
| `api/routers/admin.py` | ⚠️ Falla en runtime | Línea 157 ejecuta código inválido |
| `jarvis_core.py` | ❌ NO EXISTE | Requirements no instalados |

### Frontend — Estructura
| Archivo | Estado | Notas |
|---------|--------|-------|
| `windows/src/core/bridge.ts` | ✅ Mock mode OK | Fallback a respuestas locales |
| `windows/src/views/chat.ts` | ✅ Sugerencias OK | Chips y copiar implementados |
| `windows/src/style.css` | ✅ Estilos OK | Animaciones incluidas |
| `dist/` | ✅ Build OK | Vite genera assets correctamente |

---

## 4. Problemas Identificados

### P1: Admin Router Genera NameError
**Severidad:** 🔴 CRÍTICO  
**Quién:** El backend no puede iniciarse  
**Línea:** `api/routers/admin.py:157`  
**Fix:** Buscar dónde se define `_exigir_admin_o_fundador` o comentar línea 157

### P2: jarvis_core.py No Existe / Imports Pesados
**Severidad:** 🔴 CRÍTICO  
**Quién:** Importa sentry, google-genai, etc que no están en venv  
**Alternativa:** Usar stub minimal (ya existe en bridge as mock)  
**Fix:** Crear `jarvis_core.py` mínimo o instalar dependencias

### P3: Tests Saltados No Se Reportan
**Severidad:** 🟠 ALTO  
**Quién:** pytest falla silenciosamente cuando deps faltan  
**Señal:** "1 passed, 2 skipped" en verde  
**Fix:** Suite debe usar `-rs` flag y contar skipped como error

### P4: Servidor Oracle Está Muerto
**Severidad:** 🟠 ALTO  
**Quién:** 150.136.59.173:8080 no responde desde Oct 22 13:52  
**Log antiguo:** `/home/ubuntu/agente-staging/server.log` no se actualiza  
**Fix:** Decidir si mantenerlo o trabajar 100% local

---

## 5. Plan de Correcciones

### Fase 1: Desbloquear Backend Local
1. **Fix admin.py** – Buscar y definir `_exigir_admin_o_fundador` o comentar línea 157
2. **Crear jarvis_core.py minimal** – O instalar todas las dependencias en venv
3. **Test que backend arranca** – `curl http://127.0.0.1:8080/version.json` → HTTP 200

### Fase 2: Verificación Automática
1. **Crear script de health check** – Valida sintaxis, imports, arranca server
2. **Agregar a pre-commit** – Se ejecuta antes de cada commit
3. **CI/CD local** – Tests + build + verificación juntos

### Fase 3: Documentar Reglas
1. **No saltarse tests** – Si falta dependencia, error explícito
2. **Imports críticos verificados** – Al import, no en runtime
3. **Backend = verificación obligatoria** – Antes de "listo", prueba POST a /api/chat

---

## 6. Próximos Pasos

- [ ] Arreglar admin.py (P1)
- [ ] Crear jarvis_core.py minimal (P1)
- [ ] Verificar backend arranca
- [ ] Implementar health check script
- [ ] Actualizar PROJECT_MEMORY.md con lo aprendido
