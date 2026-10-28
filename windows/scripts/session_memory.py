"""
=============================================================================
COCO SQUAD — Buffer de Memoria de Sesión y Limpieza de Prompts
=============================================================================
Mantiene en memoria RAM por chat_id / session_id:
1. El último documento procesado (nombre, texto extraído, resumen, timestamp).
2. Los últimos turnos de la conversación (historial reciente de 6-12 mensajes).
3. Sanitizador estricto de metacomentarios y artefactos de prompts.
=============================================================================
"""

import time
import re
import logging
from typing import Dict, Any, List, Optional

logger = logging.getLogger("session_memory")

class SessionMemoryBuffer:
    """
    Buffer en memoria RAM indexado por session_id (o chat_id / tenant_id).
    Garantiza continuidad cognitiva y elimina la amnesia de sesión ante preguntas
    de seguimiento sobre documentos ('¿qué podés decirme del punto 1.6?').
    """

    def __init__(self, max_history_turns: int = 12):
        self.max_history_turns = max_history_turns
        self.sessions: Dict[str, Dict[str, Any]] = {}

    def _normalize_session_key(self, session_id: Any) -> str:
        return str(session_id or "default_session").strip()

    def get_session(self, session_id: Any) -> Dict[str, Any]:
        key = self._normalize_session_key(session_id)
        if key not in self.sessions:
            self.sessions[key] = {
                "last_document": None,
                "history": [],
                "created_at": time.time(),
                "updated_at": time.time(),
            }
        return self.sessions[key]

    def set_active_document(
        self,
        session_id: Any,
        doc_name: str,
        doc_text: str,
        doc_summary: str = "",
        agent: str = "coco_rojo"
    ):
        """Almacena el documento activo en la sesión para permitir preguntas de seguimiento."""
        sess = self.get_session(session_id)
        sess["last_document"] = {
            "name": doc_name,
            "text": doc_text,
            "summary": doc_summary,
            "timestamp": time.time(),
            "agent": agent,
        }
        sess["updated_at"] = time.time()
        logger.info(f"💾 [SessionMemory] Guardado documento '{doc_name}' ({len(doc_text)} caracteres) para sesión '{session_id}'")

    def get_active_document(self, session_id: Any) -> Optional[Dict[str, Any]]:
        """Recupera el último documento activo si existe y no ha expirado."""
        sess = self.get_session(session_id)
        doc = sess.get("last_document")
        if not doc:
            return None
        # Vence tras 4 horas de inactividad
        if time.time() - doc.get("timestamp", 0) > 14400:
            sess["last_document"] = None
            return None
        return doc

    def add_turn(self, session_id: Any, role: str, content: str, agent_id: str = "coco"):
        """Registra un turno en el historial reciente."""
        sess = self.get_session(session_id)
        sess["history"].append({
            "role": role,
            "content": content,
            "agent_id": agent_id,
            "timestamp": time.time()
        })
        if len(sess["history"]) > self.max_history_turns:
            sess["history"] = sess["history"][-self.max_history_turns:]
        sess["updated_at"] = time.time()

    def get_recent_history(self, session_id: Any, count: int = 6) -> List[Dict[str, str]]:
        """Devuelve los últimos turnos en formato [{'role': 'user'|'assistant', 'content': '...'}]"""
        sess = self.get_session(session_id)
        recent = sess["history"][-count:]
        return [{"role": item["role"], "content": item["content"]} for item in recent]

    def build_contextual_prompt(self, session_id: Any, user_message: str, current_extracted_doc: Optional[str] = None, doc_name: str = "") -> str:
        """
        Construye el prompt enriquecido con el documento actual O el documento previo en sesión.
        """
        active_doc = current_extracted_doc
        active_name = doc_name

        # Si no hay documento nuevo en este turno, buscar en la memoria de sesión
        if not active_doc:
            saved_doc = self.get_active_document(session_id)
            if saved_doc:
                active_doc = saved_doc.get("text", "")
                active_name = saved_doc.get("name", "documento_previo.pdf")

        prompt_parts = []

        if active_doc:
            prompt_parts.append(
                f"[CONTENIDO DEL DOCUMENTO ADJUNTO] ({active_name}):\n"
                f"\"\"\"\n{active_doc[:25000]}\n\"\"\"\n\n"
                f"[REGLA ESTRICTA]: Basa tu respuesta directamente en el [CONTENIDO DEL DOCUMENTO ADJUNTO] arriba provisto. "
                f"Si el usuario pregunta por un punto específico (ej: 'punto 1.6', 'sección 2', o un concepto), "
                f"búscalo en el texto adjunto y explícalo con exactitud. "
                f"No inventes datos externos ni cites temas no presentes en el documento."
            )

        prompt_parts.append(f"CONSULTA DEL USUARIO:\n{user_message}")
        return "\n\n".join(prompt_parts)


def clean_prompt_artifacts(text: str) -> str:
    """
    Elimina del output del modelo cualquier encabezado de metacomentario,
    instrucciones de sistema filtradas o artefactos de prompt.
    """
    if not text:
        return ""

    # 1. Eliminar bloques de instrucciones filtradas completas
    cleaned = re.sub(
        r'(?i)(?:^|\n)\s*#*\s*📋?\s*INSTRUCCIONES?\s+ESTRICTAS?\s+PARA\s+REDACTAR\s+[^\n]*:?[\s\S]*$',
        '',
        text
    )

    # 2. Eliminar encabezados de metacomentario y directivas internas
    meta_patterns = [
        r'(?i)^\s*#*\s*INSTRUCCIONES?\s+ESTRICTAS?\s+PARA\s+[^\n]+:?\s*\n*',
        r'(?i)^\s*#*\s*DOSSIER\s+DE\s+INVESTIGACI[OÓ]N\s+PROFUNDA:?\s*[^\n]*\n*',
        r'(?i)^\s*#*\s*INFORME\s+DE\s+DEEP\s+RESEARCH:?\s*\n*',
        r'(?i)^\s*#*\s*DIRECTIVAS?\s+DE\s+OPERACI[OÓ]N\s+DE\s+COCO\s+[A-Z]+:?\s*\n*',
        r'(?i)\[SUB-AGENTE\s+ESPECIALIZADO\]:?[^\n]*\n*',
        r'(?i)\[DIRECTIVAS?\s+DE\s+OPERACI[OÓ]N\]:?[^\n]*\n*',
        r'(?i)\[INSTRUCCI[OÓ]N\]:?[^\n]*\n*',
        r'(?i)\[PERFIL\s+DEL\s+USUARIO[^\]]*\]:?[^\n]*\n*',
        r'(?i)\[REGLA\s+ESTRICTA\]:?[^\n]*\n*',
        r'(?i)\[DOCUMENTO\s+(?:ADJUNTO|PREVIO)[^\]]*\]:?[^\n]*\n*',
        r'(?i)\[CONTENIDO\s+DEL\s+DOCUMENTO\s+(?:ADJUNTO|PREVIO)[^\]]*\]:?[^\n]*\n*',
        r'(?i)^\s*ACT[UÚ]A\s+COMO\s+COCO\s+[A-Z]+[^\n]*\n*',
    ]

    for p in meta_patterns:
        cleaned = re.sub(p, '', cleaned)

    # 3. Limpieza de líneas iniciales vacías o artefactos residuales
    cleaned = re.sub(r'^\s*[\r\n]+', '', cleaned)
    return cleaned.strip()


# Instancia global exportable
session_memory = SessionMemoryBuffer()
