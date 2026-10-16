from fastapi import APIRouter, Request, HTTPException, Depends, WebSocket, WebSocketDisconnect
from slowapi import Limiter
from slowapi.util import get_remote_address
from utils.logger import get_logger
from api.dependencies import get_tenant_engine, verify_admin_token, get_core_engine
import json
import asyncio

logger = get_logger('router_chat')
router = APIRouter(prefix="/api/chat", tags=["chat"])
limiter = Limiter(key_func=get_remote_address)

@router.post("")
@router.post("/coco")
@router.post("/coco/chat")
@limiter.limit("20/minute")
async def api_chat(
    request: Request,
):
    from fastapi.concurrency import run_in_threadpool
    data = await request.json()
    chat_id = data.get('chat_id', 9999)
    user_msg = data.get('message', '')
    file_data = data.get('file', None)
    mode_req = data.get('mode', 'recepcion')
    tenant_id = int(data.get('tenant_id', 1))
    web_search = data.get('web_search', False)

    if mode_req == 'recepcion' or str(data.get('chat_id', '')).startswith('rec_'):
        tenant_id = 1

    modo_tutor = (mode_req == 'tutor_astra' or mode_req == 'academico')
    active_engine = get_tenant_engine(tenant_id)

    coco_id = data.get('coco_id') or 'coco_blanco'
    if coco_id in ('verde', 'coco_verde'):
        coco_id = 'coco_verde'
    todos = data.get('todos', [])
    notes = data.get('notes', [])

    if not file_data and 'contexto' in data and isinstance(data['contexto'], dict):
        ctx = data['contexto']
        b64 = ctx.get('archivo_base64') or ctx.get('base64')
        if b64:
            nombre = ctx.get('nombre') or ctx.get('name') or 'documento.txt'
            mime = 'application/pdf' if nombre.endswith('.pdf') else ('image/jpeg' if nombre.endswith(('.png', '.jpg', '.jpeg', '.webp')) else 'text/plain')
            file_data = {'data': b64, 'name': nombre, 'mime': mime}

    if not file_data:
        b64 = data.get('attachment') or data.get('image')
        if b64:
            nombre = data.get('filename') or data.get('name') or 'imagen.jpg'
            mime = data.get('mime_type') or data.get('mime') or ('image/jpeg' if nombre.endswith(('.png', '.jpg', '.jpeg', '.webp')) else 'application/octet-stream')
            file_data = {'data': b64, 'name': nombre, 'mime': mime}

    if not user_msg and file_data:
        if 'image' in str(file_data.get('mime', '')) or any(str(file_data.get('name', '')).lower().endswith(ext) for ext in ('.png', '.jpg', '.jpeg', '.webp', '.gif')):
            user_msg = "Analiza detalladamente esta imagen, describe qué ves y extrae cualquier texto o dato relevante."
        else:
            user_msg = f"Analiza detalladamente este archivo ({file_data.get('name', 'adjunto')}) y resume sus puntos clave."

    if not user_msg and not file_data:
        raise HTTPException(status_code=400, detail="Mensaje vacio")
    
    def process_chat():
        if coco_id in ("coco_verde", "verde"):
            try:
                from cocos.coco_verde import CocoVerde
                green = CocoVerde()
                return green.ejecutar(
                    mensaje=user_msg,
                    contexto={
                        "chat_id": chat_id,
                        "file": file_data,
                        "todos": todos,
                        "notes": notes,
                        "tenant_id": tenant_id
                    }
                )
            except Exception as e:
                logger.error(f"Error ejecutando CocoVerde en api_chat: {e}")
        from functional_core import procesar_mensaje_funcional
        return procesar_mensaje_funcional(
            user_id=chat_id,
            mensaje=user_msg,
            file_data=file_data,
            web_search_param=web_search,
            coco_id=coco_id,
            todos=todos,
            notes=notes
        )

    try:
        from core.flags import FeatureFlags
        if FeatureFlags.is_enabled("ENABLE_SHADOW_DEPLOYMENT", tenant_id):
            logger.info(f"👻 [Shadow Deploy] Ejecutando prompt V2 en la sombra para {chat_id}...")
            
        respuesta_final = await run_in_threadpool(process_chat)
        meta_nombres = {
            "coco_verde": "Coco Verde",
            "coco_rojo": "Coco Rojo",
            "coco_azul": "Coco Azul",
            "coco_blanco": "Coco Blanco",
        }
        meta_colores = {
            "coco_verde": "#10b981",
            "coco_rojo": "#ef4444",
            "coco_azul": "#3b82f6",
            "coco_blanco": "#ffffff",
        }
        
        reply_txt = ""
        metadatos = {}
        if isinstance(respuesta_final, dict):
            reply_txt = respuesta_final.get("respuesta") or respuesta_final.get("texto") or respuesta_final.get("reply") or str(respuesta_final)
            metadatos = respuesta_final.get("datos") or respuesta_final.get("metadatos") or {}
        elif isinstance(respuesta_final, tuple):
            reply_txt = respuesta_final[0]
        else:
            reply_txt = str(respuesta_final)

        if not metadatos and coco_id == "coco_verde":
            msg_l = user_msg.lower()
            metadatos = {
                "agente": "coco_verde",
                "estado": "intervenido" if any(w in msg_l for w in ["humano", "asesor", "persona", "operador"]) else "auto",
                "estado_pago": "confirmado" if any(w in msg_l for w in ["comprobante", "transferencia", "pago", "ticket"]) or file_data else "pendiente",
                "canal": "whatsapp"
            }

        res_payload = {
            "reply": reply_txt,
            "respuesta": reply_txt,
            "success": True,
            "coco_id": coco_id,
            "coco_nombre": meta_nombres.get(coco_id, "Coco Blanco"),
            "color": meta_colores.get(coco_id, "#ffffff"),
            "metadatos": metadatos
        }
        if isinstance(respuesta_final, tuple) and len(respuesta_final) > 1:
            res_payload["audio"] = respuesta_final[1]
        return res_payload
    except Exception as e:
        logger.error(f"Error en /api/chat: {e}")
        return {"error": str(e), "success": False}

@router.websocket("/stream")
async def websocket_chat(websocket: WebSocket):
    await websocket.accept()
    try:
        while True:
            data = await websocket.receive_text()
            payload = json.loads(data)
            
            chat_id = payload.get('chat_id', 9999)
            user_msg = payload.get('message', '')
            file_data = payload.get('file', None)
            mode_req = payload.get('mode', 'recepcion')
            tenant_id = int(payload.get('tenant_id', 1))
            web_search = payload.get('web_search', False)

            if mode_req == 'recepcion' or str(payload.get('chat_id', '')).startswith('rec_'):
                tenant_id = 1

            modo_tutor = (mode_req == 'tutor_astra' or mode_req == 'academico')
            try:
                from functional_core import procesar_mensaje_stream
                
                if not user_msg and not file_data:
                    await websocket.send_json({"error": "Mensaje vacio"})
                    continue
                    
                # Streaming nativo real desde la IA (zero latency)
                async for chunk in procesar_mensaje_stream(
                    chat_id,
                    user_msg,
                    file_data,
                    web_search
                ):
                    await websocket.send_json({"token": chunk, "done": False})
                    
                await websocket.send_json({"token": "", "done": True})
            except ImportError as ie:
                logger.error(f"ImportError en websocket: {ie}")
                await websocket.send_json({"error": f"Faltan instalar dependencias: {ie}. Ejecuta pip install -r requirements.txt"})
            except Exception as ex:
                logger.error(f"Error procesando mensaje funcional: {ex}")
                await websocket.send_json({"error": f"Error interno de IA: {ex}"})

    except WebSocketDisconnect:
        logger.info("Cliente desconectado del websocket")
    except Exception as e:
        logger.error(f"Error en websocket: {e}")
        try:
            await websocket.send_json({"error": "Error interno"})
        except:
            pass


# =============================================================================
# ENDPOINTS MODULARES AISLADOS POR MOCHI (Coucou / Coco Squad)
# =============================================================================
agentes_router = APIRouter(tags=["agentes_mochis"])

async def _despachar_mochi_aislado(request: Request, coco_id_fijo: str, nombre_mochi: str, color_hex: str):
    """Función interna auxiliar ejecutada de forma aislada por cada endpoint."""
    from fastapi.concurrency import run_in_threadpool
    from functional_core import procesar_mensaje_funcional

    data = await request.json()
    chat_id = data.get("chat_id", f"coucou_{coco_id_fijo}")
    user_msg = data.get("message") or data.get("query") or data.get("prompt") or ""
    file_data = data.get("file", None)
    web_search = data.get("web_search", coco_id_fijo == "coco_rojo")
    todos = data.get("todos", [])
    notes = data.get("notes", [])

    if not user_msg and not file_data:
        return {
            "reply": "No recibí ningún mensaje para procesar.",
            "response": "No recibí ningún mensaje para procesar.",
            "success": False,
            "coco_id": coco_id_fijo
        }

    def _run():
        if coco_id_fijo in ("coco_verde", "verde"):
            try:
                from cocos.coco_verde import CocoVerde
                green = CocoVerde()
                return green.ejecutar(
                    mensaje=user_msg,
                    contexto={
                        "chat_id": chat_id,
                        "file": file_data,
                        "todos": todos,
                        "notes": notes
                    }
                )
            except Exception as e:
                logger.error(f"Error delegando a CocoVerde en _despachar_mochi_aislado: {e}")
        return procesar_mensaje_funcional(
            user_id=chat_id,
            mensaje=user_msg,
            file_data=file_data,
            web_search_param=web_search,
            coco_id=coco_id_fijo,
            todos=todos,
            notes=notes
        )

    respuesta_final = await run_in_threadpool(_run)
    reply_txt = ""
    metadatos = {}
    if isinstance(respuesta_final, dict):
        reply_txt = respuesta_final.get("respuesta") or respuesta_final.get("texto") or respuesta_final.get("reply") or str(respuesta_final)
        metadatos = respuesta_final.get("datos") or respuesta_final.get("metadatos") or {}
    elif isinstance(respuesta_final, tuple):
        reply_txt = respuesta_final[0]
    else:
        reply_txt = str(respuesta_final)

    return {
        "reply": reply_txt,
        "response": reply_txt,
        "respuesta": reply_txt,
        "success": True,
        "coco_id": coco_id_fijo,
        "coco_nombre": nombre_mochi,
        "color": color_hex,
        "metadatos": metadatos
    }


@agentes_router.post("/agente/blanco")
async def endpoint_mochi_blanco(request: Request):
    try:
        return await _despachar_mochi_aislado(request, "coco_blanco", "Coco Blanco", "#ffffff")
    except Exception as e:
        logger.error(f"[Aislamiento /agente/blanco] Error: {e}")
        return {
            "reply": f"⚠️ Coco Blanco encontró un inconveniente temporal: {e}",
            "response": f"⚠️ Coco Blanco encontró un inconveniente temporal: {e}",
            "success": False,
            "coco_id": "coco_blanco"
        }


@agentes_router.post("/agente/verde")
async def endpoint_mochi_verde(request: Request):
    try:
        return await _despachar_mochi_aislado(request, "coco_verde", "Coco Verde", "#10b981")
    except Exception as e:
        logger.error(f"[Aislamiento /agente/verde] Error: {e}")
        return {
            "reply": f"⚠️ Coco Verde encontró un inconveniente temporal: {e}",
            "response": f"⚠️ Coco Verde encontró un inconveniente temporal: {e}",
            "success": False,
            "coco_id": "coco_verde"
        }


@agentes_router.post("/agente/azul")
async def endpoint_mochi_azul(request: Request):
    try:
        return await _despachar_mochi_aislado(request, "coco_azul", "Coco Azul", "#3b82f6")
    except Exception as e:
        logger.error(f"[Aislamiento /agente/azul] Error: {e}")
        return {
            "reply": f"⚠️ Coco Azul encontró un inconveniente temporal: {e}",
            "response": f"⚠️ Coco Azul encontró un inconveniente temporal: {e}",
            "success": False,
            "coco_id": "coco_azul"
        }


@agentes_router.post("/agente/rojo")
async def endpoint_mochi_rojo(request: Request):
    try:
        return await _despachar_mochi_aislado(request, "coco_rojo", "Coco Rojo", "#ef4444")
    except Exception as e:
        logger.error(f"[Aislamiento /agente/rojo] Error: {e}")
        return {
            "reply": f"⚠️ Coco Rojo encontró un inconveniente temporal: {e}",
            "response": f"⚠️ Coco Rojo encontró un inconveniente temporal: {e}",
            "success": False,
            "coco_id": "coco_rojo"
        }


@agentes_router.post("/api/coco/chat")
async def endpoint_fallback_coco_chat(request: Request):
    """Endpoint de respaldo (Fallback) que despacha a Coco Blanco por defecto."""
    try:
        return await _despachar_mochi_aislado(request, "coco_blanco", "Coco Blanco", "#ffffff")
    except Exception as e:
        logger.error(f"[Aislamiento Fallback /api/coco/chat] Error: {e}")
        return {
            "reply": f"⚠️ El servicio de respaldo encontró un inconveniente: {e}",
            "response": f"⚠️ El servicio de respaldo encontró un inconveniente: {e}",
            "success": False,
            "coco_id": "coco_blanco"
        }
