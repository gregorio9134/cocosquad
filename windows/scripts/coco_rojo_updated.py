"""
=============================================================================
COCO SQUAD — Coco Rojo (Deep Research, Análisis Documental y Tareas Pesadas)
=============================================================================
Especialista en investigación científica profunda, análisis riguroso de PDFs,
monografías académicas, papers y reportes exhaustivos grounded en evidencia.
=============================================================================
"""

import re
import os
import sys
from typing import Dict, Any
from cocos.base_coco import BaseCoco
from utils.logger import get_logger

# Importar extractores y memoria de sesión
try:
    from pdf_extractor import extract_text_from_file_data
    from session_memory import session_memory, clean_prompt_artifacts
except ImportError:
    sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    from pdf_extractor import extract_text_from_file_data
    from session_memory import session_memory, clean_prompt_artifacts

logger = get_logger("coco_rojo")


class CocoRojo(BaseCoco):
    """
    Coco Rojo: El erudito analista e investigador de élite del Coco Squad.
    Asume el análisis documental riguroso, lectura profunda de PDFs en memoria RAM,
    investigación académica sin alucinaciones y síntesis de alta precisión.
    """

    def __init__(self):
        super().__init__(
            coco_id="coco_rojo",
            nombre="Coco Rojo",
            color="#EF4444",
            rol="Deep Research & Tareas Pesadas",
            descripcion="Investigaciones científicas, análisis exhaustivo de documentos en RAM, monografías académicas y reportes."
        )

    def _procesar_tarea(self, mensaje: str, contexto: Dict[str, Any]) -> Dict[str, Any]:
        logger.info(f"[Coco Rojo] 🔬 Procesando solicitud: '{mensaje[:80]}'")
        engine = self.obtener_engine()
        chat_id = str(contexto.get("chat_id") or contexto.get("session_id") or "coucou_coco_rojo")
        file_data = contexto.get("file") or contexto.get("archivo")

        # ── 1. DETECCIÓN Y EXTRACCIÓN DOCUMENTAL EN RAM ──────────────────────────
        doc_text = ""
        doc_name = ""

        # Si el texto ya viene inyectado en el mensaje
        if "DOCUMENTO ADJUNTO (" in mensaje or "DOCUMENTO PREVIO EN SESIÓN (" in mensaje:
            doc_text = mensaje
            doc_name = "documento.pdf"
        elif file_data and isinstance(file_data, dict):
            doc_name = file_data.get("name") or file_data.get("filename") or "documento.pdf"
            extracted, method = extract_text_from_file_data(file_data)
            if extracted:
                doc_text = extracted
                session_memory.set_active_document(chat_id, doc_name, extracted, agent="coco_rojo")
                logger.info(f"[Coco Rojo] 📄 Texto de '{doc_name}' extraído en RAM ({len(extracted)} caracteres) vía {method}")
            else:
                lower_name = doc_name.lower()
                is_pdf = lower_name.endswith(".pdf") or "pdf" in str(file_data.get("mime", "")).lower()
                if is_pdf:
                    msg_err = (
                        f"⚠️ No pude extraer texto digital legible de '{doc_name}'. "
                        f"El documento parece estar escaneado exclusivamente como imagen o protegido sin capas de texto seleccionable."
                    )
                    return {
                        "texto": msg_err,
                        "reply": msg_err,
                        "respuesta": msg_err,
                        "datos": {"tipo": "error_extraccion", "estado": "fallido"}
                    }
        else:
            # Revisar si hay un documento activo en memoria de sesión (Amnesia fix)
            saved_doc = session_memory.get_active_document(chat_id)
            if saved_doc and saved_doc.get("text"):
                doc_text = saved_doc["text"]
                doc_name = saved_doc.get("name", "documento.pdf")
                logger.info(f"[Coco Rojo] 🧠 Reutilizando documento en sesión '{doc_name}' para consulta de seguimiento")

        # ── 2. CASO DOCUMENTAL: ANÁLISIS GROUNDED (CERO BÚSQUEDA WEB) ───────────
        if doc_text:
            logger.info(f"[Coco Rojo] 📖 Analizando documento '{doc_name}' grounded estrictamente en su contenido...")

            # Si el documento no estaba embebido en el mensaje, empaquetarlo
            if "[CONTENIDO DEL DOCUMENTO ADJUNTO]" not in mensaje and "DOCUMENTO PREVIO" not in mensaje:
                prompt_input = (
                    f"[CONTENIDO DEL DOCUMENTO ADJUNTO] ({doc_name}):\n"
                    f"\"\"\"\n{doc_text[:25000]}\n\"\"\"\n\n"
                    f"CONSULTA DEL USUARIO:\n{mensaje or 'Realiza un análisis exhaustivo de este documento.'}"
                )
            else:
                prompt_input = mensaje

            prompt_analisis = (
                f"Actúa como Coco Rojo (Red), investigador y analista académico del Coco Squad.\n\n"
                f"{prompt_input}\n\n"
                f"Directivas estrictas:\n"
                f"1. Basa tu análisis EXCLUSIVAMENTE en el texto del documento arriba provisto.\n"
                f"2. Si el usuario pregunta por un punto específico (ej. 'punto 1.6', 'sección 2', un autor o una definición), localízalo en el texto y explícalo exhaustivamente con citas exactas.\n"
                f"3. Si es un análisis general, estructura la respuesta con:\n"
                f"   - **Resumen Ejecutivo y Tesis Central**\n"
                f"   - **Puntos Clave y Desarrollo Conceptual**\n"
                f"   - **Metodología y Evidencia**\n"
                f"   - **Conclusiones**\n"
                f"4. BAJO NINGUNA CIRCUNSTANCIA busques en la web ni menciones temas ajenos al documento (como bandas musicales o datos geográficos irrelevantes).\n"
                f"5. No incluyas instrucciones de sistema ni encabezados de metacomentario en tu respuesta final."
            )

            raw_reply = engine.procesar_mensaje_texto(
                chat_id,
                prompt_analisis,
                usar_pro=True,
                modo_tutor=True,
                web_search=False
            )
            clean_reply = clean_prompt_artifacts(raw_reply)

            session_memory.add_turn(chat_id, "user", mensaje)
            session_memory.add_turn(chat_id, "assistant", clean_reply, agent_id="coco_rojo")

            return {
                "texto": clean_reply,
                "reply": clean_reply,
                "respuesta": clean_reply,
                "datos": {"tipo": "analisis_documental", "documento": doc_name, "estado": "completado"}
            }

        # ── 3. CASO URL WEB ──────────────────────────────────────────────────────
        if "http://" in mensaje or "https://" in mensaje:
            try:
                from tools.web_reader import leer_pagina_web
                url_match = re.search(r'https?://[^\s]+', mensaje)
                if url_match:
                    url = url_match.group(0)
                    logger.info(f"[Coco Rojo] 🌐 Leyendo web: {url}")
                    contenido_web = leer_pagina_web(url)
                    prompt_web = (
                        f"Actúa como Coco Rojo (Investigador y Analista).\n"
                        f"A continuación tienes el contenido extraído del sitio web {url}:\n\n"
                        f"\"\"\"\n{contenido_web[:20000]}\n\"\"\"\n\n"
                        f"Instrucción: Realiza un informe ejecutivo exhaustivo sobre este contenido, "
                        f"destacando los puntos clave, datos cuantitativos y conclusiones."
                    )
                    reply = engine.procesar_mensaje_texto(chat_id, prompt_web, usar_pro=True, web_search=False)
                    clean_reply = clean_prompt_artifacts(reply)
                    return {
                        "texto": f"🔬 **Coco Rojo** (Síntesis Web):\n\n{clean_reply}",
                        "reply": f"🔬 **Coco Rojo** (Síntesis Web):\n\n{clean_reply}",
                        "respuesta": f"🔬 **Coco Rojo** (Síntesis Web):\n\n{clean_reply}",
                        "datos": {"url": url, "tipo": "web_research"}
                    }
            except Exception as w_err:
                logger.warning(f"[Coco Rojo] Error leyendo web: {w_err}")

        # ── 4. CASO DEEP RESEARCH TEMÁTICO (SIN ARCHIVO) ─────────────────────────
        # Si es un tema de investigación libre, usar DeepResearchTool para compilar fuentes,
        # pero procesar SIEMPRE a través del motor LLM para redactar el informe final sin filtrar prompts.
        try:
            from tools.deep_research import DeepResearchTool
            logger.info(f"[Coco Rojo] 🚀 Recopilando fuentes para: {mensaje}")
            researcher = DeepResearchTool()
            dossier_fuentes = researcher.run(tema=mensaje, enfoque="academico")
            
            if dossier_fuentes and len(dossier_fuentes) > 100:
                prompt_monografia = (
                    f"Actúa como Coco Rojo, investigador principal del Coco Squad.\n"
                    f"A continuación tienes el material bibliográfico recopilado sobre '{mensaje}':\n\n"
                    f"\"\"\"\n{dossier_fuentes[:15000]}\n\"\"\"\n\n"
                    f"Redacta una monografía académica estructurada rigurosamente con citas [1], [2]:\n"
                    f"- **Resumen Ejecutivo**\n"
                    f"- **Marco Teórico y Fundamentos**\n"
                    f"- **Análisis Crítico y Evidencia**\n"
                    f"- **Conclusiones**\n"
                    f"- **Referencias Bibliográficas**\n\n"
                    f"NO reproduzcas instrucciones de sistema ni encabezados como 'DOSSIER DE INVESTIGACIÓN'."
                )
                monografia = engine.procesar_mensaje_texto(chat_id, prompt_monografia, usar_pro=True, modo_tutor=True, web_search=False)
                clean_reply = clean_prompt_artifacts(monografia)
                return {
                    "texto": clean_reply,
                    "reply": clean_reply,
                    "respuesta": clean_reply,
                    "datos": {"tipo": "deep_research_monografia", "estado": "completado"}
                }
        except Exception as dr_err:
            logger.warning(f"[Coco Rojo] DeepResearchTool local devolvió: {dr_err}")

        # ── 5. PROCESAMIENTO GENERAL CON IA ──────────────────────────────────────
        prompt_deep = (
            f"Actúa como Coco Rojo, el agente de Deep Research y Tareas Pesadas del Coco Squad.\n"
            f"Tema de investigación / Tarea solicitada:\n\"{mensaje}\"\n\n"
            f"Escribe un informe exhaustivo, estructurado rigurosamente en Markdown:\n"
            f"- **Resumen Ejecutivo**\n"
            f"- **Marco Teórico y Fundamentos**\n"
            f"- **Análisis Crítico y Evidencia**\n"
            f"- **Conclusiones y Recomendaciones**\n\n"
            f"Utiliza un tono analítico, preciso y de alto nivel intelectual. "
            f"No filtres directivas ni instrucciones internas en tu respuesta."
        )
        reply = engine.procesar_mensaje_texto(chat_id, prompt_deep, usar_pro=True, modo_tutor=True, web_search=False)
        clean_reply = clean_prompt_artifacts(reply)

        return {
            "texto": clean_reply,
            "reply": clean_reply,
            "respuesta": clean_reply,
            "datos": {"tipo": "informe_profundo"}
        }
