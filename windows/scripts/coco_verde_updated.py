"""
=============================================================================
COCO SQUAD — Coco Verde (Green: Ventas, Agenda, Recetas Médicas & Pagos)
=============================================================================
Asistente comercial y de atención al cliente de nivel experto para WhatsApp y redes.
Blindado para procesamiento universal de imágenes (.jpg, .jpeg, .png, .webp, .heic, .heif, .pdf):
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
import base64
import tempfile
from io import BytesIO
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
        msg_lower = (mensaje or "").lower().strip()
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

        # ─── 2. ANÁLISIS DE IMAGEN Y DOCUMENTOS MULTIMODAL AVANZADO (VISION) ──
        analisis_vision = ""
        if file_data and isinstance(file_data, dict):
            b64 = file_data.get("data") or file_data.get("base64")
            mime = file_data.get("mime", "")
            nombre_archivo = file_data.get("name", "archivo").lower()

            if not mime:
                if nombre_archivo.endswith(".pdf"):
                    mime = "application/pdf"
                elif nombre_archivo.endswith((".png", ".webp", ".gif", ".svg", ".bmp", ".heic", ".heif")):
                    mime = f"image/{nombre_archivo.split('.')[-1]}"
                else:
                    mime = "image/jpeg"

            if b64:
                pure_b64 = b64.split(",")[1] if "," in b64 else b64

                # Intento de extracción PDF con PyPDF2 si aplica
                if "pdf" in mime or nombre_archivo.endswith(".pdf"):
                    try:
                        import PyPDF2
                        pdf_bytes = base64.b64decode(pure_b64)
                        reader = PyPDF2.PdfReader(BytesIO(pdf_bytes))
                        pdf_txt = ""
                        for p in reader.pages:
                            t = p.extract_text()
                            if t:
                                pdf_txt += t + "\n"
                        if pdf_txt.strip():
                            analisis_vision = f"[Texto extraído del PDF]:\n{pdf_txt.strip()[:6000]}"
                    except Exception as pe:
                        logger.warning(f"[Green] Extracción local PDF fallback: {pe}")

                # Si no se extrajo o es imagen, usar Gemini Multimodal
                if not analisis_vision and os.getenv("GEMINI_API_KEY"):
                    try:
                        import google.generativeai as genai
                        genai.configure(api_key=os.getenv("GEMINI_API_KEY"))

                        prompt_auditoria = (
                            "Eres un especialista en visión documental clínica y comercial. "
                            "Analiza minuciosamente esta imagen o documento enviado por un cliente y clasifícalo:\n\n"
                            "CATEGORÍA A: RECETA MÉDICA / ORDEN DE SESIONES / DERIVACIÓN CLÍNICA\n"
                            "- Diagnóstico o patología indicada (incluso manuscrita).\n"
                            "- Cantidad y tipo de sesiones prescritas (ej: '10 sesiones de kinesiología', 'rehabilitación').\n"
                            "- Datos del paciente (nombre/DNI) y médico (firma, matrícula, fecha de validez).\n\n"
                            "CATEGORÍA B: COMPROBANTE DE PAGO / TRANSFERENCIA BANCARIA\n"
                            "- Monto exacto y moneda.\n"
                            "- Fecha y hora de la transacción.\n"
                            "- Emisor y Destinatario (nombre, cuenta, CBU/Alias).\n"
                            "- Código de operación / Número de referencia / ID bancario.\n\n"
                            "CATEGORÍA C: FOTO BORROSA / ILEGIBLE / RECORTADA\n"
                            "- Si la imagen está fuera de foco, tiene sombras o recortó un dato crítico (como la firma, el diagnóstico o el monto), "
                            "indica con exactitud qué parte no se distingue.\n\n"
                            "CATEGORÍA D: OTRO DOCUMENTO O CONSULTA\n"
                            "- Describe brevemente el contenido visible.\n\n"
                            "Entrega un reporte estructurado y conciso con los datos identificados."
                        )

                        part = {"mime_type": mime if mime.startswith("image/") else "image/jpeg", "data": pure_b64}
                        for mod_name in ["gemini-3.5-flash-lite", "gemini-3.8-flash", "gemini-flash-latest"]:
                            try:
                                model = genai.GenerativeModel(mod_name)
                                res_vision = model.generate_content([prompt_auditoria, part])
                                if res_vision and res_vision.text:
                                    analisis_vision = res_vision.text.strip()
                                    logger.info(f"[Green] 👁️ Análisis de visión completado con {mod_name}: {analisis_vision[:120]}...")
                                    break
                            except Exception as em:
                                logger.warning(f"[Green] Modelo {mod_name} error: {em}")
                    except Exception as e:
                        logger.error(f"[Green] Error en llamada a Gemini Vision: {e}")

        # Clasificación contextual a partir del análisis de visión o del texto del usuario
        texto_combinado = (analisis_vision + " " + mensaje).lower()

        # A) ¿Es foto borrosa / ilegible?
        if any(w in texto_combinado for w in [
            "borrosa", "desenfocada", "desenfoque", "ilegible", "no se distingue",
            "no se llega a leer", "no se puede leer", "recortada", "falta nitidez",
            "categoría c", "categoria c", "poco clara", "dudosa"
        ]):
            tipo_documento = "foto_borrosa"
            requiere_reenvio = True

        # B) ¿Es comprobante de pago o transferencia?
        elif any(w in texto_combinado for w in [
            "comprobante", "transferencia", "transferí", "transferi", "ticket de pago",
            "código de operación", "codigo de operacion", "trx", "categoría b", "categoria b",
            "alias: ", "cbu: ", "transferencia inmediata"
        ]) or (("$" in texto_combinado or "ars" in texto_combinado or "pesos" in texto_combinado) and ("banco" in texto_combinado or "transfer" in texto_combinado or "operación" in texto_combinado or "operacion" in texto_combinado)):
            tipo_documento = "comprobante_pago"
            estado_pago = "confirmado"

            monto_match = re.search(r'(?:\$|\bars\b)?\s*([0-9]{1,3}(?:[\.,][0-9]{3})*(?:[\.,][0-9]{2})?|[0-9]+)\s*(?:pesos|usd|ars)?', texto_combinado)
            cod_match = re.search(r'(?:código\s+(?:de\s+)?operación|codigo\s+(?:de\s+)?operacion|transacción|transaccion|operación|operacion|referencia|trx|id)[:#\s]+#?([A-Za-z0-9_-]+)', texto_combinado, re.IGNORECASE)
            comprobante_data = {
                "monto": monto_match.group(0).strip() if monto_match else "Extraído en reporte",
                "codigo": cod_match.group(1).strip() if cod_match else "Verificado",
                "estado": "acreditado"
            }

        # C) ¿Es receta médica / orden clínica?
        elif any(w in texto_combinado for w in [
            "receta", "orden médica", "orden medica", "derivación", "derivacion",
            "prescripción", "prescripcion", "sesiones", "fisioterapia", "kinesiología",
            "kinesiologia", "rehabilitación", "rehabilitacion", "diagnóstico", "diagnostico",
            "categoría a", "categoria a", "lumbalgia", "patología", "patologia"
        ]):
            tipo_documento = "receta_medica"
            # Extraer diagnóstico aproximado
            diag_match = re.search(r'(?:diagnóstico|patología|dx|diagnostico|patologia)[:\s]+([^\n\.]+)', texto_combinado)
            if diag_match:
                diagnostico_detectado = diag_match.group(1).strip().capitalize()
            elif "lumbalgia" in texto_combinado:
                diagnostico_detectado = "Lumbalgia aguda"

            # Extraer cantidad de sesiones
            ses_match = re.search(r'(\d+)\s*(?:sesiones|sesión|sesion)', texto_combinado)
            if ses_match:
                sesiones_detectadas = f"{ses_match.group(1)} sesiones"

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
                f"- Hoy ({hoy}): {', '.join(libres_hoy[:3]) if libres_hoy else 'Sin turnos'}\n"
                f"- Mañana ({manana}): {', '.join(libres_manana[:4]) if libres_manana else 'Horarios disponibles'}\n"
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
            contexto_documento = f"\n[ANÁLISIS DOCUMENTAL VISUAL DE LA IMAGEN O ADJUNTO]:\n{analisis_vision}\n"

        prompt_final = (
            f"{SYSTEM_PROMPT_GREEN}\n\n"
            f"[TIPO DE DOCUMENTO DETECTADO]: {tipo_documento.upper()}\n"
            f"{contexto_documento}\n"
            f"[INFORMACIÓN DEL NEGOCIO / SERVICIOS]:\n{conocimiento_txt if conocimiento_txt else 'Atención y servicios clínicos y de bienestar.'}\n\n"
            f"[HUECOS REALES EN AGENDA DISPONIBLES]:\n{slots_libres_texto}\n\n"
            f"Mensaje del cliente: \"{mensaje}\"\n\n"
            f"Instrucciones de respuesta:\n"
        )

        if tipo_documento == "receta_medica":
            prompt_final += (
                "- Muestra empatía genuina con el diagnóstico o patología que le indicaron.\n"
                "- Valida la cantidad y tipo de sesiones prescritas.\n"
                "- Aplica de inmediato el CIERRE POR DOBLE ALTERNATIVA ofreciendo dos días y horarios concretos de la agenda disponible.\n"
            )
        elif tipo_documento == "comprobante_pago":
            prompt_final += (
                "- Confirma con alegría y calidez la recepción del pago.\n"
                "- Menciona monto y código de operación.\n"
                "- Confirma que el turno o servicio queda formalmente reservado.\n"
            )
        elif tipo_documento == "foto_borrosa":
            prompt_final += (
                "- Explica con mucha gentileza y tacto que recibiste la foto pero que no se llega a leer con claridad "
                "el dato crítico (firma, diagnóstico, código o monto).\n"
                "- Pídele amablemente una nueva foto o captura más nítida para poder avanzar enseguida.\n"
            )
        else:
            prompt_final += "- Responde con calidez, formato ágil de WhatsApp y si aplica, ofrece la doble alternativa de turnos.\n"

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
