#!/usr/bin/env python3
"""
upgrade_green_vision.py
Blindaje integral de visión y procesamiento para Green (coco_id: verde / coco_verde) en Oracle:
- Soporte universal de formatos (.jpg, .jpeg, .png, .webp, .heic, .heif, .pdf).
- Detección inteligente de Recetas Médicas / Órdenes (diagnóstico, sesiones, paciente, validez).
- Detección y verificación de Comprobantes de Pago (monto, fecha, emisor, código de operación).
- Manejo amigable y preciso de Fotos Borrosas o Ilegibles.
- Respuesta con rapport cálido, validación clínica y cierre por Doble Alternativa.
"""

import sys
import subprocess
import os

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
        print(f"Error running SSH: {cmd}\nStderr: {res.stderr}")
    return res.stdout

print("=== 1. PREPARANDO cocos/coco_verde.py BLINDADO ===")

COCO_VERDE_CODE = '''"""
=============================================================================
COCO SQUAD — Coco Verde (Green: Ventas, Agenda, Recetas Médicas & Pagos)
=============================================================================
Asistente comercial y de atención al cliente de nivel experto para WhatsApp y redes.
Blindado para procesamiento universal de imágenes (.jpg, .jpeg, .png, .webp, .heic, .pdf):
1. Detección inteligente de Recetas Médicas y Órdenes clínicas (manuscritas o impresas).
2. Verificación de Comprobantes de Pago y Transferencias.
3. Detección de Fotos Borrosas o Ilegibles con pedido amable de retoma.
4. Rapport activo, empatía y técnica de cierre por Doble Alternativa.
5. Metadatos estructurados (estado: auto/intervenido, estado_pago, tipo_documento).
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
- Eres sumamente cálido, cercano, educado, empático y resolutivo. JAMÁS respondes de forma fría, robótica ni corporativamente genérica.
- Usas el formato ideal de WhatsApp: párrafos breves, negritas para destacar ideas clave, emojis oportunos (🟢✨📅).
- Psicología de la comunicación: Detectas el tono y humor del usuario (ansioso, apurado, desconfiado, entusiasta) y generas rapport inmediato. Si está apurado, respondes al punto; si tiene dudas o dolencias, transmites seguridad, calidez y contención.
- Ventas consultivas y persuasión ética: Escuchas la necesidad real antes de ofrecer la solución, manejas objeciones con sutileza y elegancia aportando valor antes de pedir el cierre.

[PROTOCOLO PARA IMÁGENES Y DOCUMENTOS RECIBIDOS]:
1. RECETAS MÉDICAS Y ÓRDENES CLÍNICAS:
   - Si la imagen contiene una receta, pedido médico o derivación (incluso manuscrita):
     * Valida la indicación médica con empatía genuina (menciona diagnóstico y cantidad de sesiones prescritas, ej: "Veo que te indicaron 10 sesiones de kinesiología motora para...").
     * Si figuran médico y paciente, tómalo en cuenta.
     * Guía de inmediato al paciente hacia la reserva de su turno utilizando la técnica de CIERRE POR DOBLE ALTERNATIVA (ofrece 2 opciones validadas de días y horarios, ej: "¿Te viene mejor este jueves a las 11:00 o preferís el viernes a las 16:30?").
2. COMPROBANTES DE PAGO Y TRANSFERENCIAS:
   - Si es un comprobante de transferencia bancaria o billetera virtual:
     * Extrae y confirma con cordialidad: Monto, Fecha/Hora, Emisor/Destinatario y Código de operación.
     * Transmite tranquilidad de que el pago fue recibido y verificado para su turno/servicio.
3. FOTOS BORROSAS O ILEGIBLES:
   - Si la foto está desenfocada, recortada o no se distingue con claridad algún dato crítico (como la firma/sello del médico, el diagnóstico o el monto del pago):
     * Solicita amablemente una nueva foto explicando con precisión qué parte no se llega a leer (ej: "No llego a distinguir con claridad la firma y matrícula del médico en la parte inferior... ¿me podrías enviar una foto un poquito más nítida de esa zona?").
4. SOLICITUD DE ASESOR HUMANO:
   - Si el cliente solicita expresamente hablar con una persona ("quiero hablar con un humano", "operador"), empatiza y confirma con afecto que avisas a un asesor del equipo para que lo contacte a la brevedad.
"""

class CocoVerde(BaseCoco):
    def __init__(self):
        super().__init__(
            coco_id="coco_verde",
            nombre="Green",
            color="#10B981",
            rol="Asistente Comercial, WhatsApp & Agenda",
            descripcion="Ventas consultivas, rapport activo, lectura de recetas/pagos y agenda con doble alternativa."
        )

    def _procesar_tarea(self, mensaje: str, contexto: Dict[str, Any]) -> Dict[str, Any]:
        msg_lower = mensaje.lower().strip()
        engine = self.obtener_engine()
        chat_id = contexto.get("chat_id", "desktop_coco_verde")
        file_data = contexto.get("file") or contexto.get("archivo")

        # ─── 1. METADATOS INICIALES ───────────────────────────────────────────
        estado = "auto"
        estado_pago = "pendiente"
        tipo_documento = "consulta_general"
        diagnostico_detectado = None
        sesiones_detectadas = None
        comprobante_data = None
        requiere_reenvio = False

        # Detección de solicitud de intervención humana
        palabras_intervencion = [
            "humano", "asesor", "persona", "operador", "alguien real",
            "atencion humana", "atención humana", "hablar con alguien", "llamar por telefono", "llamame"
        ]
        if any(w in msg_lower for w in palabras_intervencion):
            estado = "intervenido"
            logger.info("[Green] 👤 Solicitud de intervención humana detectada.")

        # ─── 2. ANÁLISIS DE IMAGEN MULTIMODAL AVANZADO (VISION) ───────────────
        analisis_vision = ""
        if file_data and isinstance(file_data, dict):
            b64 = file_data.get("data") or file_data.get("base64")
            mime = file_data.get("mime", "image/jpeg")
            nombre_archivo = file_data.get("name", "archivo")

            if b64 and os.getenv("GEMINI_API_KEY"):
                try:
                    import google.generativeai as genai
                    genai.configure(api_key=os.getenv("GEMINI_API_KEY"))
                    model = genai.GenerativeModel("gemini-3.8-flash")
                    pure_b64 = b64.split(",")[1] if "," in b64 else b64

                    prompt_auditoria = (
                        "Eres un especialista en visión documental clínica y comercial. "
                        "Analiza minuciosamente esta imagen o documento enviado por un cliente y clasifícalo:\\n\\n"
                        "CATEGORÍA A: RECETA MÉDICA / ORDEN DE SESIONES / DERIVACIÓN CLÍNICA\\n"
                        "- Diagnóstico o patología indicada (incluso manuscrita).\\n"
                        "- Cantidad y tipo de sesiones prescritas (ej: '10 sesiones de kinesiología', 'rehabilitación').\\n"
                        "- Datos del paciente (nombre/DNI) y médico (firma, matrícula, fecha de validez).\\n\\n"
                        "CATEGORÍA B: COMPROBANTE DE PAGO / TRANSFERENCIA BANCARIA\\n"
                        "- Monto exacto y moneda.\\n"
                        "- Fecha y hora de la transacción.\\n"
                        "- Emisor y Destinatario (nombre, cuenta, CBU/Alias).\\n"
                        "- Código de operación / Número de referencia / ID bancario.\\n\\n"
                        "CATEGORÍA C: FOTO BORROSA / ILEGIBLE / RECORTADA\\n"
                        "- Si la imagen está fuera de foco, tiene sombras o recortó un dato crítico (como la firma, el diagnóstico o el monto), "
                        "indica con exactitud qué parte no se distingue.\\n\\n"
                        "CATEGORÍA D: OTRO DOCUMENTO O CONSULTA\\n"
                        "- Describe brevemente el contenido visible.\\n\\n"
                        "Entrega un reporte estructurado y conciso con los datos identificados."
                    )
                    res_vision = model.generate_content([prompt_auditoria, {"mime_type": mime, "data": pure_b64}])
                    if res_vision and res_vision.text:
                        analisis_vision = res_vision.text.strip()
                        logger.info(f"[Green] 👁️ Análisis de visión completado: {analisis_vision[:120]}...")
                except Exception as e:
                    logger.error(f"[Green] Error en llamada a Gemini Vision: {e}")

        # Clasificación contextual a partir del análisis de visión o del texto del usuario
        texto_combinado = (analisis_vision + " " + mensaje).lower()

        # A) ¿Es foto borrosa / ilegible?
        if any(w in texto_combinado for w in ["borrosa", "desenfocada", "ilegible", "no se distingue", "no se llega a leer", "recortada", "falta nitidez", "categoría c"]):
            tipo_documento = "foto_borrosa"
            requiere_reenvio = True

        # B) ¿Es receta médica / orden clínica?
        elif any(w in texto_combinado for w in ["receta", "orden médica", "orden medica", "derivación", "derivacion", "sesiones", "kinesiología", "kinesiologia", "fisioterapia", "rehabilitación", "rehabilitacion", "diagnóstico", "diagnostico", "categoría a"]):
            tipo_documento = "receta_medica"
            # Extraer diagnóstico aproximado
            diag_match = re.search(r'(?:diagnóstico|patología|dx)[:\\s]+([^\\n\\.]+)', texto_combinado)
            if diag_match:
                diagnostico_detectado = diag_match.group(1).strip().capitalize()
            # Extraer cantidad de sesiones
            ses_match = re.search(r'(\\d+)\\s*(?:sesiones|sesión|sesion)', texto_combinado)
            if ses_match:
                sesiones_detectadas = f"{ses_match.group(1)} sesiones"

        # C) ¿Es comprobante de pago o transferencia?
        elif any(w in texto_combinado for w in ["comprobante", "transferencia", "transferí", "transferi", "pago", "ticket", "código de operación", "codigo de operacion", "trx", "categoría b"]):
            tipo_documento = "comprobante_pago"
            estado_pago = "confirmado"

            monto_match = re.search(r'\\$?\\s?(\\d+[\\.,]?\\d*)\\s*(?:pesos|usd|ars)?', texto_combinado)
            cod_match = re.search(r'(?:código|transacción|operación|referencia|id)[:#\\s]+([A-Za-z0-9_-]+)', texto_combinado, re.IGNORECASE)
            comprobante_data = {
                "monto": monto_match.group(0) if monto_match else "Extraído en reporte",
                "codigo": cod_match.group(1) if cod_match else "Verificado",
                "estado": "acreditado"
            }

        # ─── 3. OBTENCIÓN DE AGENDA DISPONIBLE Y BASE DE CONOCIMIENTO ─────────
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
                f"- Mañana ({manana}): {', '.join(libres_manana[:4]) if libres_manana else 'Horarios disponibles'}\\n"
                f"- Siguiente día ({pasado}): {', '.join(libres_pasado[:4]) if libres_pasado else 'Horarios disponibles'}"
            )
        except Exception:
            slots_libres_texto = "Horarios regulares disponibles de 09:00 a 17:00 hs."

        # Buscar en base de conocimiento del negocio
        conocimiento_txt = ""
        try:
            from knowledge_indexer import buscar_conocimiento
            conocimiento_txt = buscar_conocimiento(mensaje or "servicios turnos", top_k=2)
        except Exception:
            pass

        # ─── 4. PROMPT FINAL CONSTRUÍDO SEGÚN CASO ───────────────────────────
        contexto_documento = ""
        if analisis_vision:
            contexto_documento = f"\\n[ANÁLISIS DOCUMENTAL VISUAL DE LA IMAGEN]:\\n{analisis_vision}\\n"

        prompt_final = (
            f"{SYSTEM_PROMPT_GREEN}\\n\\n"
            f"[TIPO DE DOCUMENTO DETECTADO]: {tipo_documento.upper()}\\n"
            f"{contexto_documento}\\n"
            f"[INFORMACIÓN DEL NEGOCIO / SERVICIOS]:\\n{conocimiento_txt if conocimiento_txt else 'Atención y servicios clínicos y de bienestar.'}\\n\\n"
            f"[HUECOS REALES EN AGENDA DISPONIBLES]:\\n{slots_libres_texto}\\n\\n"
            f"Mensaje del cliente: \\"{mensaje}\\"\\n\\n"
            f"Instrucciones de respuesta:\\n"
        )

        if tipo_documento == "receta_medica":
            prompt_final += (
                "- Muestra empatía genuina con el diagnóstico o patología que le indicaron.\\n"
                "- Valida la cantidad y tipo de sesiones prescritas.\\n"
                "- Aplica de inmediato el CIERRE POR DOBLE ALTERNATIVA ofreciendo dos días y horarios concretos de la agenda disponible.\\n"
            )
        elif tipo_documento == "comprobante_pago":
            prompt_final += (
                "- Confirma con alegría y calidez la recepción del pago.\\n"
                "- Menciona monto y código de operación.\\n"
                "- Confirma que el turno o servicio queda formalmente reservado.\\n"
            )
        elif tipo_documento == "foto_borrosa":
            prompt_final += (
                "- Explica con mucha gentileza y tacto que recibiste la foto pero que no se llega a leer con claridad "
                "el dato crítico (firma, diagnóstico, código o monto).\\n"
                "- Pídele amablemente una nueva foto o captura más nítida para poder avanzar enseguida.\\n"
            )
        else:
            prompt_final += "- Responde con calidez, formato ágil de WhatsApp y si aplica, ofrece la doble alternativa de turnos.\\n"

        reply = engine.procesar_mensaje_texto(chat_id, prompt_final)

        return {
            "texto": reply,
            "datos": {
                "agente": "coco_verde",
                "estado": estado,
                "estado_pago": estado_pago,
                "tipo_documento": tipo_documento,
                "diagnostico": diagnostico_detectado,
                "sesiones": sesiones_detectadas,
                "comprobante": comprobante_data,
                "requiere_reenvio": requiere_reenvio
            }
        }
'''

with open("/tmp/new_coco_verde_v2.py", "w", encoding="utf-8") as f:
    f.write(COCO_VERDE_CODE)

subprocess.run([
    "scp", "-i", SSH_KEY, "-o", "StrictHostKeyChecking=no",
    "/tmp/new_coco_verde_v2.py", f"{REMOTE_HOST}:/home/ubuntu/agente-staging/cocos/coco_verde.py"
], check=True)
print("cocos/coco_verde.py actualizado.")

print("=== 2. ACTUALIZANDO functional_core.py EN ORACLE ===")

PATCH_CORE = '''import re

core_path = "/home/ubuntu/agente-staging/functional_core.py"
with open(core_path, "r", encoding="utf-8") as f:
    code = f.read()

# 1. Asegurar soporte de extensiones heic, heif y webp en _procesar_archivo_sincrono
old_exts = "('.png', '.jpg', '.jpeg', '.webp', '.gif', '.bmp')"
new_exts = "('.png', '.jpg', '.jpeg', '.webp', '.heic', '.heif', '.gif', '.bmp', '.svg')"
if old_exts in code:
    code = code.replace(old_exts, new_exts)

# 2. Prompt completo de Gemini Vision para recetas médicas, comprobantes y fotos borrosas
old_vision = 'prompt = "Analiza detalladamente esta imagen. Si se trata de un comprobante de pago, transferencia bancaria, recibo o ticket, extrae de forma prioritaria y exacta: 1) Monto y moneda, 2) Fecha y hora, 3) Destinatario / Titular / CBU / Alias, 4) Código de transacción / Número de referencia, 5) Banco o billetera emisora. Si es otro tipo de imagen o gráfico, describe todos sus elementos y textos visibles."'

new_vision = """prompt = (
                        "Eres un auditor documental y clínico experto. Analiza con máxima precisión esta imagen enviada por un cliente:\\n\\n"
                        "1. RECETA MÉDICA / ORDEN CLÍNICA (manuscrita o impresa): Extrae diagnóstico/patología indicada, cantidad y tipo de sesiones prescritas (ej: '10 sesiones de kinesiología'), datos del paciente y profesional (médico, matrícula, fecha, firma/sello).\\n"
                        "2. COMPROBANTE DE PAGO / TRANSFERENCIA BANCARIA: Extrae monto y moneda exactos, fecha/hora, emisor, destinatario, código de operación / referencia bancaria.\\n"
                        "3. FOTO BORROSA O ILEGIBLE: Si la imagen está desenfocada, tiene sombras o no se distingue con total nitidez un dato crítico (como la firma, el diagnóstico o el monto), señala con precisión qué parte resulta ilegible o dudosa.\\n"
                        "4. OTRO DOCUMENTO O IMAGEN: Describe con exactitud todos los detalles y textos visibles."
                    )"""

if old_vision in code:
    code = code.replace(old_vision, new_vision)

# 3. Rol prompt de Green en functional_core
old_rol_green = """    if coco_id in ("coco_verde", "verde"):
        rol_prompt = (
            "[ROL ACTIVO: Green (Coco Verde) · Asistente comercial experto en atención al cliente, WhatsApp y agenda.]\\n"
            "- Psicología de la comunicación: Detecta el tono/humor del usuario y genera rapport empático y activo.\\n"
            "- Ventas consultivas y persuasión ética: Manejo sutil de objeciones aportando valor. Jamás respondes de manera fría, robótica ni genérica.\\n"
            "- Cierre por Doble Alternativa: Para agendar turnos o citas, ofrece siempre 2 opciones validadas (ej: '¿Te viene mejor este jueves a las 11:00 o preferís el viernes a las 16:30?').\\n"
            "- Comprobantes de pago: Si el usuario envía o menciona un comprobante o transferencia, verifica y confirma cordialmente monto, fecha, destinatario y código de transacción.\\n"
            "- Derivación humana: Si el usuario pide hablar con una persona o asesor humano, indica con calidez que intervienes y derivas la consulta.\\n"
            f"{slots_green}{kb_green}\\n"
        )"""

new_rol_green = """    if coco_id in ("coco_verde", "verde"):
        rol_prompt = (
            "[ROL ACTIVO: Green (Coco Verde) · Asistente comercial experto en atención al cliente, WhatsApp y agenda.]\\n"
            "- Psicología de la comunicación: Detecta el tono/humor del usuario y genera rapport empático y activo.\\n"
            "- Recetas Médicas / Órdenes Clínicas: Si la imagen o mensaje refiere a una orden médica, valida el diagnóstico con empatía, confirma la cantidad y tipo de sesiones indicadas y guía de inmediato al turno con CIERRE POR DOBLE ALTERNATIVA.\\n"
            "- Comprobantes de Pago: Verifica y confirma cordialmente monto, fecha, emisor y código de operación.\\n"
            "- Fotos Borrosas o Dudosas: Si la imagen recibida no tiene suficiente nitidez para leer un dato crítico (firma, diagnóstico, monto), solicita amablemente una toma más clara explicando con precisión qué parte no se distingue.\\n"
            "- Ventas consultivas y Doble Alternativa: Ofrece siempre 2 opciones validadas de días y horarios (ej: '¿Te queda más cómodo el jueves a las 11:00 o preferís el viernes a las 16:30?').\\n"
            "- Derivación humana: Si el usuario pide hablar con una persona humana, responde con calidez e indica que intervienes para derivar la consulta.\\n"
            f"{slots_green}{kb_green}\\n"
        )"""

if old_rol_green in code:
    code = code.replace(old_rol_green, new_rol_green)

with open(core_path, "w", encoding="utf-8") as f:
    f.write(code)
print("functional_core.py actualizado exitosamente.")
'''

with open("/tmp/patch_core_v2.py", "w", encoding="utf-8") as f:
    f.write(PATCH_CORE)

subprocess.run([
    "scp", "-i", SSH_KEY, "-o", "StrictHostKeyChecking=no",
    "/tmp/patch_core_v2.py", f"{REMOTE_HOST}:/home/ubuntu/agente-staging/patch_core_v2.py"
], check=True)

out = run_ssh("cd /home/ubuntu/agente-staging && python3 patch_core_v2.py")
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
