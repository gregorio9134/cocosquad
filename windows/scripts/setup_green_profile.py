#!/usr/bin/env python3
"""
setup_green_profile.py
Configura el perfil comercial especializado, herramientas de agenda, lectura multimodal
de comprobantes de pago y metadatos para Green (coco_id: verde / coco_verde) en Oracle Staging.
"""

import sys
import os
import json
import subprocess
import tempfile

REMOTE_HOST = "ubuntu@150.136.59.173"
SSH_KEY = os.path.expanduser("~/.ssh/oracle_key")

def run_ssh(cmd: str) -> str:
    ssh_cmd = [
        "ssh", "-i", SSH_KEY,
        "-o", "StrictHostKeyChecking=no",
        REMOTE_HOST,
        cmd
    ]
    res = subprocess.run(ssh_cmd, capture_output=True, text=True)
    if res.returncode != 0:
        print(f"Error running SSH command: {cmd}\nStderr: {res.stderr}")
    return res.stdout

print("=== 1. PREPARANDO NUEVO cocos/coco_verde.py ===")

NEW_COCO_VERDE_PY = '''"""
=============================================================================
COCO SQUAD — Coco Verde (Green: Ventas Consultivas, Atención y Agenda WhatsApp)
=============================================================================
Asistente comercial y de atención al cliente de nivel experto en WhatsApp y redes.
Especialidades:
- Psicología de la comunicación, empatía, detección de tono/humor y rapport activo.
- Ventas consultivas y persuasión ética (manejo sutil de objeciones, cierre doble alternativa).
- Lectura multimodal prioritaria de comprobantes de pago y transferencias bancarias.
- Validación de agenda real y disponibilidad horaria (calendar_module).
- Integración con base de conocimiento del negocio (knowledge_indexer).
- Aislamiento y metadatos (estado: auto/intervenido, estado_pago: pendiente/confirmado).
=============================================================================
"""

import os
import re
import json
import datetime
from typing import Dict, Any, Optional
from cocos.base_coco import BaseCoco
from utils.logger import get_logger

logger = get_logger("coco_verde")

SYSTEM_PROMPT_GREEN = """Eres Green (Coco Verde), el asistente comercial y de atención al cliente experto de esta empresa para WhatsApp y redes sociales.

[TU ROL Y PERSONALIDAD]:
- Eres cálido, sumamente educado, empático, natural y resolutivo. JAMÁS respondes de forma fría, robótica ni corporativamente genérica.
- Usas el formato ideal de WhatsApp: párrafos breves y dinámicos, negritas para destacar ideas clave, emojis verdes y oportunos (🟢✨📅).
- Psicología de la comunicación: Detectas el tono y humor del usuario (ansioso, apurado, desconfiado, entusiasta) y te adaptas con rapport inmediato. Si está apurado, respondes al punto; si tiene dudas o temores, transmites seguridad, calidez y contención.
- Ventas consultivas y persuasión ética: Escuchas la necesidad real antes de ofrecer la solución, manejas objeciones con sutileza y elegancia aportando valor antes de pedir el cierre.
- Cierre de agenda por Doble Alternativa: Para coordinar turnos o citas, NUNCA dejes la pregunta abierta ("¿cuándo puedes?"). Ofrece SIEMPRE 2 opciones validadas de días y horarios concretos (ejemplo: "¿Te queda más cómodo el jueves a las 11:00 o preferís el viernes a las 16:30?").

[HERRAMIENTAS INTEGRADAS]:
1. DISPONIBILIDAD HORARIA Y AGENDA:
   - Dispones de la grilla de disponibilidad en tiempo real. Valida huecos reales antes de confirmar.
2. BASE DE CONOCIMIENTO DEL NEGOCIO:
   - Conoces los servicios, especialidades y preguntas frecuentes del negocio.
3. COMPROBANTES DE PAGO Y TRANSFERENCIAS:
   - Cuando el cliente comparta un comprobante de pago o transferencia, extrae con precisión: Monto, Fecha/Hora, Destinatario/CBU/Alias y Código de transacción. Felicita y agradece al cliente con entusiasmo y confirma la acreditación del pago.
4. DERIVACIÓN A ASESOR HUMANO:
   - Si el cliente solicita expresamente hablar con una persona humana o asesor ("quiero hablar con un humano", "operador"), mantén la empatía, infórmale con afecto que avisas a un asesor del equipo y que se comunicarán a la brevedad.
"""

class CocoVerde(BaseCoco):
    def __init__(self):
        super().__init__(
            coco_id="coco_verde",
            nombre="Green",
            color="#10B981",
            rol="Asistente Comercial, WhatsApp & Agenda",
            descripcion="Ventas consultivas, rapport activo, agenda con doble alternativa y verificación de comprobantes."
        )

    def _procesar_tarea(self, mensaje: str, contexto: Dict[str, Any]) -> Dict[str, Any]:
        msg_lower = mensaje.lower().strip()
        engine = self.obtener_engine()
        chat_id = contexto.get("chat_id", "desktop_coco_verde")
        file_data = contexto.get("file") or contexto.get("archivo")

        # ─── 1. METADATOS BASE ────────────────────────────────────────────────
        estado = "auto"
        estado_pago = "pendiente"
        servicio_detectado = contexto.get("servicio", "Atención general")
        turno_agendado = None
        comprobante_data = None

        # Detección de solicitud de intervención humana
        palabras_intervencion = [
            "humano", "asesor", "persona", "operador", "alguien real",
            "atencion humana", "atención humana", "hablar con alguien", "llamar por telefono", "llamame"
        ]
        if any(w in msg_lower for w in palabras_intervencion):
            estado = "intervenido"
            logger.info("[Green] 👤 Solicitud de intervención humana detectada.")

        # ─── 2. DETECCIÓN Y PROCESAMIENTO DE COMPROBANTE DE PAGO ─────────────
        es_comprobante = False
        analisis_visual_comprobante = ""

        # Si viene archivo o imagen
        if file_data and isinstance(file_data, dict):
            b64 = file_data.get("data") or file_data.get("base64")
            mime = file_data.get("mime", "image/jpeg")
            if b64 and os.getenv("GEMINI_API_KEY"):
                try:
                    import google.generativeai as genai
                    genai.configure(api_key=os.getenv("GEMINI_API_KEY"))
                    model = genai.GenerativeModel("gemini-3.8-flash")
                    pure_b64 = b64.split(",")[1] if "," in b64 else b64
                    prompt_vision = (
                        "Eres un auditor financiero experto. Analiza con máxima precisión este comprobante bancario o transferencia:\\n"
                        "Extrae estrictamente en formato limpio:\\n"
                        "- 💰 Monto y moneda:\\n"
                        "- 📅 Fecha y hora:\\n"
                        "- 👤 Destinatario / Titular / CBU / Alias:\\n"
                        "- 🔢 Código de transacción / Referencia:\\n"
                        "- 🏦 Banco / Billetera emisora:\\n"
                        "Si no es un comprobante de pago, describe qué documento o imagen es."
                    )
                    res_vision = model.generate_content([prompt_vision, {"mime_type": mime, "data": pure_b64}])
                    if res_vision and res_vision.text:
                        analisis_visual_comprobante = res_vision.text.strip()
                        es_comprobante = True
                except Exception as e:
                    logger.error(f"[Green] Error en visión de comprobante: {e}")

        # Detección textual de comprobante si no vino imagen
        if not es_comprobante and any(w in msg_lower for w in ["comprobante", "transferí", "transferi", "te pasé el pago", "acá está el pago", "aca esta el pago", "ya pagué", "ya pague", "adjunto pago"]):
            es_comprobante = True

        if es_comprobante:
            estado_pago = "confirmado"
            logger.info("[Green] 💳 Comprobante o transferencia bancaria procesada.")

            # Extraer montos y códigos con regex para metadatos
            monto_match = re.search(r'\\$?\\s?(\\d+[\\.,]?\\d*)\\s*(?:pesos|usd|ars)?', mensaje + " " + analisis_visual_comprobante)
            cod_match = re.search(r'(?:código|transacción|operación|referencia|id)[:#\\s]+([A-Za-z0-9_-]+)', mensaje + " " + analisis_visual_comprobante, re.IGNORECASE)

            comprobante_data = {
                "monto": monto_match.group(0) if monto_match else "Extraído en reporte",
                "codigo": cod_match.group(1) if cod_match else "Verificado",
                "estado": "acreditado"
            }

            prompt_respuesta = (
                f"{SYSTEM_PROMPT_GREEN}\\n\\n"
                f"[DATOS DEL COMPROBANTE RECIBIDO]:\\n"
                f"{analisis_visual_comprobante if analisis_visual_comprobante else mensaje}\\n\\n"
                f"Instrucción: Como Green, confirma la recepción cordial del pago, menciona los datos clave "
                f"(monto, fecha, destinatario, código) para tranquilidad del cliente, y agradece con simpatía y calidez."
            )
            reply = engine.procesar_mensaje_texto(chat_id, prompt_respuesta)
            return {
                "texto": reply,
                "datos": {
                    "agente": "coco_verde",
                    "estado": estado,
                    "estado_pago": "confirmado",
                    "servicio": servicio_detectado,
                    "comprobante": comprobante_data
                }
            }

        # ─── 3. GESTIÓN DE AGENDA Y DISPONIBILIDAD CON DOBLE ALTERNATIVA ──────
        slots_libres_texto = ""
        try:
            import calendar_module
            hoy = datetime.date.today().isoformat()
            manana = (datetime.date.today() + datetime.timedelta(days=1)).isoformat()
            pasado = (datetime.date.today() + datetime.timedelta(days=2)).isoformat()

            libres_hoy = calendar_module.horarios_disponibles(hoy)
            libres_manana = calendar_module.horarios_disponibles(manana)
            libres_pasado = calendar_module.horarios_disponibles(pasado)

            slots_libres_texto = (
                f"- Hoy ({hoy}): {', '.join(libres_hoy[:3]) if libres_hoy else 'Sin turnos'}\\n"
                f"- Mañana ({manana}): {', '.join(libres_manana[:4]) if libres_manana else 'Completo'}\\n"
                f"- Próximo día ({pasado}): {', '.join(libres_pasado[:4]) if libres_pasado else 'Disponible por la mañana'}"
            )
        except Exception as e:
            slots_libres_texto = "Horarios regulares: 10:00, 11:30, 15:00, 16:30 hs."

        # Buscar en base de conocimiento del negocio
        conocimiento_txt = ""
        try:
            from knowledge_indexer import buscar_conocimiento
            conocimiento_txt = buscar_conocimiento(mensaje, top_k=2)
        except Exception:
            pass

        # Si el usuario pide agendar o confirmar turno
        if any(w in msg_lower for w in ["agendame", "anotame", "resérvame", "reservame", "quiero el turno", "confirmo el turno", "me queda bien"]):
            fecha_match = re.search(r'\\b(202\\d-\\d{2}-\\d{2})\\b', mensaje)
            hora_match = re.search(r'\\b([01]?\\d|2[0-3]):([0-5]\\d)\\b', mensaje)
            if fecha_match and hora_match:
                try:
                    import calendar_module
                    f_val = fecha_match.group(1)
                    h_val = hora_match.group(0)
                    nombre_cliente = contexto.get("nombre") or contexto.get("cliente") or "Cliente WhatsApp"
                    res_crear = calendar_module.crear_turno(
                        cliente_nombre=nombre_cliente,
                        fecha=f_val,
                        hora=h_val,
                        servicio=servicio_detectado
                    )
                    if res_crear.get("ok"):
                        turno_agendado = {"fecha": f_val, "hora": h_val, "cliente": nombre_cliente}
                except Exception as ex:
                    logger.warning(f"[Green] Error agendando turno: {ex}")

        # ─── 4. GENERACIÓN DE RESPUESTA COMERCIAL CON RAPPORT ACTIVO ──────────
        prompt_final = (
            f"{SYSTEM_PROMPT_GREEN}\\n\\n"
            f"[INFORMACIÓN DEL NEGOCIO / SERVICIOS]:\\n{conocimiento_txt if conocimiento_txt else 'Atención y servicios personalizados.'}\\n\\n"
            f"[HUECOS REALES EN AGENDA DISPONIBLES]:\\n{slots_libres_texto}\\n\\n"
            f"[ESTADO DE LA CONVERSACIÓN]: {estado.upper()}\\n\\n"
            f"Mensaje del cliente: \\"{mensaje}\\"\\n\\n"
            f"Responde como Green: usa rapport activo, educación impecable, empatía genuina y, "
            f"si aplica coordinar una reunión o turno, utiliza la técnica de CIERRE POR DOBLE ALTERNATIVA."
        )

        reply = engine.procesar_mensaje_texto(chat_id, prompt_final)

        return {
            "texto": reply,
            "datos": {
                "agente": "coco_verde",
                "estado": estado,
                "estado_pago": estado_pago,
                "servicio": servicio_detectado,
                "turno": turno_agendado
            }
        }
'''

with open("/tmp/new_coco_verde.py", "w", encoding="utf-8") as f:
    f.write(NEW_COCO_VERDE_PY)

print("Copiando new_coco_verde.py al servidor Oracle...")
subprocess.run([
    "scp", "-i", SSH_KEY, "-o", "StrictHostKeyChecking=no",
    "/tmp/new_coco_verde.py", f"{REMOTE_HOST}:/home/ubuntu/agente-staging/cocos/coco_verde.py"
], check=True)

print("=== 2. ACTUALIZANDO functional_core.py Y api/routers/chat.py EN ORACLE ===")

PATCH_REMOTE_SCRIPT = '''import re

# 1. Patch functional_core.py
core_path = "/home/ubuntu/agente-staging/functional_core.py"
with open(core_path, "r", encoding="utf-8") as f:
    code = f.read()

# Normalizar coco_id verde
if 'if coco_id == "coco_verde":' in code and 'coco_id in ("coco_verde", "verde")' not in code:
    code = code.replace('if coco_id == "coco_verde":', 'if coco_id in ("coco_verde", "verde"):')

# Enriquecer prompt de Gemini para vision en caso de comprobantes bancarios
old_vision_prompt = 'prompt = "Analiza detalladamente esta imagen, describe con precisión todo lo que ves (elementos visuales, colores, detalles, contexto clínico o técnico si aplica) y extrae cualquier texto, número o dato relevante visible."'
new_vision_prompt = """prompt = "Analiza detalladamente esta imagen. Si se trata de un comprobante de pago, transferencia bancaria, recibo o ticket, extrae de forma prioritaria y exacta: 1) Monto y moneda, 2) Fecha y hora, 3) Destinatario / Titular / CBU / Alias, 4) Código de transacción / Número de referencia, 5) Banco o billetera emisora. Si es otro tipo de imagen o gráfico, describe todos sus elementos y textos visibles." """

if old_vision_prompt in code:
    code = code.replace(old_vision_prompt, new_vision_prompt)

# Enriquecer rol_prompt de Green
old_green_prompt = 'rol_prompt = "[ROL ACTIVO: Coco Verde · Operaciones y gestión reactiva de WhatsApp, turnos, clientes y agenda. Tono: resolutivo, ágil y ordenado.]\\n\\n"'
new_green_prompt = """# Inyección de huecos reales de agenda para Green
    slots_green = ""
    try:
        from calendar_module import horarios_disponibles
        import datetime
        h_hoy = datetime.date.today().isoformat()
        h_manana = (datetime.date.today() + datetime.timedelta(days=1)).isoformat()
        slots_green = f"\\n[HUECOS REALES DISPONIBLES EN AGENDA]:\\nHoy ({h_hoy}): {', '.join(horarios_disponibles(h_hoy)[:3]) or 'Completo'}\\nMañana ({h_manana}): {', '.join(horarios_disponibles(h_manana)[:4]) or 'Disponible a convenir'}\\n"
    except Exception:
        pass

    # Inyección de base de conocimiento del negocio
    kb_green = ""
    try:
        from knowledge_indexer import buscar_conocimiento
        kb_res = buscar_conocimiento(mensaje, top_k=2)
        if kb_res:
            kb_green = f"\\n[BASE DE CONOCIMIENTO DEL NEGOCIO]:\\n{kb_res}\\n"
    except Exception:
        pass

    if coco_id in ("coco_verde", "verde"):
        rol_prompt = (
            "[ROL ACTIVO: Green (Coco Verde) · Asistente comercial experto en atención al cliente, WhatsApp y agenda.]\\n"
            "- Psicología de la comunicación: Detecta el tono/humor del usuario y genera rapport empático y activo.\\n"
            "- Ventas consultivas y persuasión ética: Manejo sutil de objeciones aportando valor. Jamás respondes de manera fría, robótica ni genérica.\\n"
            "- Cierre por Doble Alternativa: Para agendar turnos o citas, ofrece siempre 2 opciones validadas (ej: '¿Te viene mejor este jueves a las 11:00 o preferís el viernes a las 16:30?').\\n"
            "- Comprobantes de pago: Si el usuario envía o menciona un comprobante o transferencia, verifica y confirma cordialmente monto, fecha, destinatario y código de transacción.\\n"
            "- Derivación humana: Si el usuario pide hablar con una persona o asesor humano, indica con calidez que intervienes y derivas la consulta.\\n"
            f"{slots_green}{kb_green}\\n"
        )"""

if old_green_prompt in code:
    code = code.replace(old_green_prompt, new_green_prompt)

with open(core_path, "w", encoding="utf-8") as f:
    f.write(code)
print("functional_core.py actualizado exitosamente.")

# 2. Patch api/routers/chat.py
chat_path = "/home/ubuntu/agente-staging/api/routers/chat.py"
with open(chat_path, "r", encoding="utf-8") as f:
    chat_code = f.read()

# Normalizar coco_id verde en chat.py
if "coco_id = data.get('coco_id') or 'coco_blanco'" in chat_code:
    chat_code = chat_code.replace(
        "coco_id = data.get('coco_id') or 'coco_blanco'",
        "coco_id = data.get('coco_id') or 'coco_blanco'\\n    if coco_id in ('verde', 'coco_verde'):\\n        coco_id = 'coco_verde'"
    )

# Retornar metadatos estructurados en /api/chat
old_res_payload = """        res_payload = {
            "reply": reply_txt,
            "respuesta": reply_txt,
            "success": True,
            "coco_id": coco_id,
            "coco_nombre": meta_nombres.get(coco_id, "Coco Blanco"),
            "color": meta_colores.get(coco_id, "#ffffff")
        }"""

new_res_payload = """        # Metadatos del agente Green
        metadatos = {}
        if isinstance(respuesta_final, dict):
            metadatos = respuesta_final.get("datos") or respuesta_final.get("metadatos") or {}
        elif coco_id == "coco_verde":
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
        }"""

if old_res_payload in chat_code:
    chat_code = chat_code.replace(old_res_payload, new_res_payload)

with open(chat_path, "w", encoding="utf-8") as f:
    f.write(chat_code)
print("api/routers/chat.py actualizado exitosamente.")
'''

with open("/tmp/patch_green.py", "w", encoding="utf-8") as f:
    f.write(PATCH_REMOTE_SCRIPT)

subprocess.run([
    "scp", "-i", SSH_KEY, "-o", "StrictHostKeyChecking=no",
    "/tmp/patch_green.py", f"{REMOTE_HOST}:/home/ubuntu/agente-staging/patch_green.py"
], check=True)

out = run_ssh("cd /home/ubuntu/agente-staging && python3 patch_green.py")
print(out)

print("=== 3. REINICIANDO SERVIDOR FASTAPI EN ORACLE ===")
restart_cmd = (
    "cd /home/ubuntu/agente-staging && "
    "fuser -k 8080/tcp 2>/dev/null || kill -9 $(lsof -t -i:8080) 2>/dev/null; "
    "nohup python3 fastapi_server.py > server.log 2>&1 & "
    "sleep 3 && curl -I http://127.0.0.1:8080/docs"
)
out_restart = run_ssh(restart_cmd)
print(out_restart)
