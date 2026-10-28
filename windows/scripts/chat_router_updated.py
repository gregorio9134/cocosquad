from fastapi import APIRouter, Request, HTTPException, Depends, WebSocket, WebSocketDisconnect
from slowapi import Limiter
from slowapi.util import get_remote_address
from utils.logger import get_logger
from api.dependencies import get_tenant_engine, verify_admin_token, get_core_engine
import json
import asyncio
import os
import sys

# Agregar path local para módulos de pdf_extractor y session_memory
sys.path.append(os.path.dirname(os.path.abspath(__file__)))
from pdf_extractor import extract_text_from_file_data
from session_memory import session_memory, clean_prompt_artifacts

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
    chat_id = str(data.get('chat_id', 9999))
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

    # ── FALLA 1: EXTRACCIÓN REAL DE PDF EN MEMORIA RAM ─────────────────────────
    extracted_text = ""
    is_pdf = False
    doc_name = ""
    if file_data and isinstance(file_data, dict):
        doc_name = file_data.get('name') or file_data.get('filename') or 'documento.pdf'
        lower_name = doc_name.lower()
        is_pdf = lower_name.endswith('.pdf') or 'pdf' in str(file_data.get('mime', '')).lower()
        extracted_text, method = extract_text_from_file_data(file_data)
        
        if extracted_text:
            logger.info(f"📄 [api_chat] Texto extraído ({len(extracted_text)} chars) de {doc_name} vía {method}")
            # Guardar en memoria de sesión para preguntas de seguimiento
            session_memory.set_active_document(chat_id, doc_name, extracted_text, agent=coco_id)
            # REGLA: Forzar web_search = False para evitar alucinaciones con Wikipedia
            web_search = False
            user_msg = f"[CONTENIDO DEL DOCUMENTO ADJUNTO] ({doc_name}):\n\"\"\"\n{extracted_text[:25000]}\n\"\"\"\n\n{user_msg or 'Analiza detalladamente este documento y presenta una síntesis exhaustiva con puntos clave.'}"
        elif is_pdf:
            # Si es PDF y no se extrajo texto real, NO responder ni buscar en Google/Wikipedia
            return {
                "reply": f"⚠️ No pude extraer texto legible de '{doc_name}'. El documento parece estar escaneado exclusivamente como imagen o no contiene texto digital seleccionable.",
                "response": f"⚠️ No pude extraer texto legible de '{doc_name}'. El documento parece estar escaneado exclusivamente como imagen o no contiene texto digital seleccionable.",
                "respuesta": f"⚠️ No pude extraer texto legible de '{doc_name}'. El documento parece estar escaneado exclusivamente como imagen o no contiene texto digital seleccionable.",
                "success": False,
                "coco_id": coco_id
            }

    # ── FALLA 2: BUFFER DE MEMORIA DE SESIÓN (AMNESIA FIX) ─────────────────────
    if not extracted_text:
        saved_doc = session_memory.get_active_document(chat_id)
        if saved_doc and saved_doc.get("text"):
            # Si el usuario hace una pregunta de seguimiento ('punto 1.6', 'sección 2', etc.)
            web_search = False
            logger.info(f"🧠 [api_chat] Inyectando contexto de documento previo '{saved_doc['name']}' para sesión {chat_id}")
            doc_context = f"[CONTENIDO DEL DOCUMENTO ADJUNTO - SESIÓN PREVIA] ({saved_doc['name']}):\n\"\"\"\n{saved_doc['text'][:25000]}\n\"\"\"\n\n[INSTRUCCIÓN]: Basa tu respuesta directamente en el [CONTENIDO DEL DOCUMENTO ADJUNTO] arriba. Si el usuario pregunta por un punto específico, búscalo en el texto y explícalo con exactitud.\n\n"
            user_msg = doc_context + user_msg

    if not user_msg and not file_data:
        raise HTTPException(status_code=400, detail="Mensaje vacio")

    # ── FALLA 3: DELEGACIÓN REAL ENCADENADA ─────────────────────────────────────
    # Si Blanco recibe un documento técnico o extenso, derivar la ejecución a Red de inmediato
    delegated_target_agent = coco_id
    if is_pdf or (extracted_text and coco_id == "coco_blanco"):
        logger.info(f"🤝 [api_chat] Delegando ejecución real de análisis de {doc_name} a Coco Rojo...")
        delegated_target_agent = "coco_rojo"
    
    def process_chat():
        target_coco = delegated_target_agent
        if target_coco in ("coco_verde", "verde"):
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
        elif target_coco in ("coco_rojo", "rojo"):
            try:
                from cocos.coco_rojo import CocoRojo
                red = CocoRojo()
                return red.ejecutar(
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
                logger.error(f"Error ejecutando CocoRojo en api_chat: {e}")
        elif target_coco in ("coco_azul", "azul"):
            try:
                from cocos.coco_azul import CocoAzul
                blu = CocoAzul()
                return blu.ejecutar(
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
                logger.error(f"Error ejecutando CocoAzul en api_chat: {e}")

        from functional_core import procesar_mensaje_funcional
        return procesar_mensaje_funcional(
            user_id=chat_id,
            mensaje=user_msg,
            file_data=file_data,
            web_search_param=web_search,
            coco_id=target_coco,
            todos=todos,
            notes=notes
        )

    try:
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

        # ── LIMPIEZA DE FUGAS DE PROMPTS Y METACOMENTARIOS ───────────────────────
        reply_txt = clean_prompt_artifacts(reply_txt)

        # Registrar en memoria de sesión
        session_memory.add_turn(chat_id, "user", data.get("message", ""))
        session_memory.add_turn(chat_id, "assistant", reply_txt, agent_id=delegated_target_agent)

        effective_coco_id = delegated_target_agent
        res_payload = {
            "reply": reply_txt,
            "respuesta": reply_txt,
            "response": reply_txt,
            "success": True,
            "coco_id": effective_coco_id,
            "coco_nombre": meta_nombres.get(effective_coco_id, "Coco"),
            "color": meta_colores.get(effective_coco_id, "#ffffff"),
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
    """
    Función interna auxiliar ejecutada de forma aislada por cada endpoint
    con soporte integral de extracción de texto en RAM, memoria de sesión y delegación encadenada.
    """
    from fastapi.concurrency import run_in_threadpool
    from functional_core import procesar_mensaje_funcional

    data = await request.json()
    chat_id = str(data.get("chat_id") or f"coucou_{coco_id_fijo}")
    user_msg = data.get("message") or data.get("query") or data.get("prompt") or ""
    file_data = data.get("file", None)
    tenant_id = int(data.get("tenant_id", 1))
    web_search = data.get("web_search", False)
    todos = data.get("todos", [])
    notes = data.get("notes", [])

    if not file_data and "contexto" in data and isinstance(data["contexto"], dict):
        ctx = data["contexto"]
        b64 = ctx.get("archivo_base64") or ctx.get("base64")
        if b64:
            nombre = ctx.get("nombre") or ctx.get("name") or "documento.txt"
            mime = "application/pdf" if nombre.endswith(".pdf") else ("image/jpeg" if nombre.endswith((".png", ".jpg", ".jpeg", ".webp")) else "text/plain")
            file_data = {"data": b64, "name": nombre, "mime": mime}

    if not file_data:
        b64 = data.get("attachment") or data.get("image")
        if b64:
            nombre = data.get("filename") or data.get("name") or "imagen.jpg"
            mime = data.get("mime_type") or data.get("mime") or ("image/jpeg" if nombre.endswith((".png", ".jpg", ".jpeg", ".webp")) else "application/octet-stream")
            file_data = {"data": b64, "name": nombre, "mime": mime}

    # ── 1. EXTRACCIÓN REAL DE PDF EN MEMORIA RAM ──────────────────────────────
    extracted_text = ""
    is_pdf = False
    doc_name = ""
    if file_data and isinstance(file_data, dict):
        doc_name = file_data.get("name") or file_data.get("filename") or "documento.pdf"
        lower_name = doc_name.lower()
        is_pdf = lower_name.endswith(".pdf") or "pdf" in str(file_data.get("mime", "")).lower()
        extracted_text, method = extract_text_from_file_data(file_data)

        if extracted_text:
            logger.info(f"📄 [_despachar_mochi_aislado] Texto extraído ({len(extracted_text)} chars) de {doc_name} vía {method}")
            session_memory.set_active_document(chat_id, doc_name, extracted_text, agent=coco_id_fijo)
            # REGLA ESTRICTA: Forzar web_search = False para evitar alucinaciones
            web_search = False
            user_msg = f"[CONTENIDO DEL DOCUMENTO ADJUNTO] ({doc_name}):\n\"\"\"\n{extracted_text[:25000]}\n\"\"\"\n\n{user_msg or 'Analiza detalladamente este documento y presenta un informe exhaustivo con puntos clave, metodología y conclusiones.'}"
        elif is_pdf:
            return {
                "reply": f"⚠️ No pude extraer texto legible de '{doc_name}'. El documento parece estar escaneado exclusivamente como imagen o no contiene texto digital seleccionable.",
                "response": f"⚠️ No pude extraer texto legible de '{doc_name}'. El documento parece estar escaneado exclusivamente como imagen o no contiene texto digital seleccionable.",
                "respuesta": f"⚠️ No pude extraer texto legible de '{doc_name}'. El documento parece estar escaneado exclusivamente como imagen o no contiene texto digital seleccionable.",
                "success": False,
                "coco_id": coco_id_fijo,
                "coco_nombre": nombre_mochi,
                "color": color_hex
            }

    # ── 2. INYECCIÓN DE MEMORIA DE SESIÓN (AMNESIA FIX) ────────────────────────
    if not extracted_text:
        saved_doc = session_memory.get_active_document(chat_id)
        if saved_doc and saved_doc.get("text"):
            web_search = False
            logger.info(f"🧠 [_despachar_mochi_aislado] Inyectando contexto de documento previo '{saved_doc['name']}' para sesión {chat_id}")
            doc_context = f"[CONTENIDO DEL DOCUMENTO ADJUNTO - SESIÓN PREVIA] ({saved_doc['name']}):\n\"\"\"\n{saved_doc['text'][:25000]}\n\"\"\"\n\n[INSTRUCCIÓN]: Basa tu respuesta directamente en el [CONTENIDO DEL DOCUMENTO ADJUNTO] arriba. Si el usuario pregunta por un punto específico (ej: 'punto 1.6'), búscalo en el texto y explícalo con exactitud.\n\n"
            user_msg = doc_context + user_msg

    if not user_msg and not file_data:
        return {
            "reply": "No recibí ningún mensaje para procesar.",
            "response": "No recibí ningún mensaje para procesar.",
            "respuesta": "No recibí ningún mensaje para procesar.",
            "success": False,
            "coco_id": coco_id_fijo
        }

    # ── 3. DELEGACIÓN REAL ENCADENADA ──────────────────────────────────────────
    target_coco = coco_id_fijo
    effective_nombre = nombre_mochi
    effective_color = color_hex
    if (is_pdf or extracted_text) and coco_id_fijo == "coco_blanco":
        logger.info(f"🤝 [_despachar_mochi_aislado] Delegando ejecución real de análisis de {doc_name} a Coco Rojo...")
        target_coco = "coco_rojo"
        effective_nombre = "Coco Rojo"
        effective_color = "#ef4444"

    def _run():
        if target_coco in ("coco_verde", "verde"):
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
                logger.error(f"Error delegando a CocoVerde en _despachar_mochi_aislado: {e}")
        elif target_coco in ("coco_rojo", "rojo"):
            try:
                from cocos.coco_rojo import CocoRojo
                red = CocoRojo()
                return red.ejecutar(
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
                logger.error(f"Error delegando a CocoRojo en _despachar_mochi_aislado: {e}")
        elif target_coco in ("coco_azul", "azul"):
            try:
                from cocos.coco_azul import CocoAzul
                blu = CocoAzul()
                return blu.ejecutar(
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
                logger.error(f"Error delegando a CocoAzul en _despachar_mochi_aislado: {e}")

        return procesar_mensaje_funcional(
            user_id=chat_id,
            mensaje=user_msg,
            file_data=file_data,
            web_search_param=web_search,
            coco_id=target_coco,
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

    # ── 4. LIMPIEZA DE FUGAS DE PROMPTS Y METACOMENTARIOS ───────────────────────
    reply_txt = clean_prompt_artifacts(reply_txt)

    # Registrar turnos en memoria de sesión
    session_memory.add_turn(chat_id, "user", data.get("message") or data.get("query") or user_msg)
    session_memory.add_turn(chat_id, "assistant", reply_txt, agent_id=target_coco)

    return {
        "reply": reply_txt,
        "response": reply_txt,
        "respuesta": reply_txt,
        "success": True,
        "coco_id": target_coco,
        "coco_nombre": effective_nombre,
        "color": effective_color,
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
            "respuesta": f"⚠️ Coco Blanco encontró un inconveniente temporal: {e}",
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
            "respuesta": f"⚠️ Coco Verde encontró un inconveniente temporal: {e}",
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
            "respuesta": f"⚠️ Coco Azul encontró un inconveniente temporal: {e}",
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
            "respuesta": f"⚠️ Coco Rojo encontró un inconveniente temporal: {e}",
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
            "respuesta": f"⚠️ El servicio de respaldo encontró un inconveniente: {e}",
            "success": False,
            "coco_id": "coco_blanco"
        }
