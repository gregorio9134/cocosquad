import os
import re
import json
import urllib.request
import warnings
import logging

try:
    from utils.logger import get_logger
    logger = get_logger("squad_orchestrator")
except Exception:
    logger = logging.getLogger("squad_orchestrator")

warnings.filterwarnings("ignore")

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
ENV_PATH = os.path.join(BASE_DIR, ".env")


def _cargar_env():
    if not os.path.exists(ENV_PATH):
        return
    with open(ENV_PATH, "r", encoding="utf-8") as f:
        for linea in f:
            linea = linea.strip()
            if not linea or linea.startswith("#") or "=" not in linea:
                continue
            clave, valor = linea.split("=", 1)
            clave = clave.replace("export ", "").strip()
            val = valor.strip().strip('"').strip("'")
            if val:
                os.environ[clave] = val


_cargar_env()

try:
    from session_memory import session_memory
except ImportError:
    session_memory = None

PERSONALITIES_FOUNDER = {
    "blanco": (
        "Te llamás Coco Blanco. Sos el jefe de gabinete ejecutivo, secretario de máxima confianza y mano derecha estratégica de Gregorio, "
        "el fundador y creador de Coco Squad. "
        "Tu tono es rioplatense (argentino) auténtico, directo, perspicaz, ejecutivo, ágil y de confianza absoluta (tratás de vos a Gregorio). "
        "Hablás en primera persona ('Soy Coco', 'Gregorio, te ordené esto', 'Avanzamos con esto'). "
        "REGLA CRÍTICA DE IDENTIDAD: NUNCA digas 'Sos Coco Blanco' ni 'SOS Coco', ni repitas la descripción de tus funciones en cada respuesta.\n\n"
        "REGLAS CONVERSACIONALES CON EL FUNDADOR:\n"
        "1. SALUDOS Y MENSAJES CASUALES: Si Gregorio te saluda o pregunta algo breve ('hola Coco', 'cómo estás', 'qué tenemos'), "
        "respondé en 1 o 2 oraciones espontáneas, enérgicas y ejecutivas como un colega y socio de máxima confianza listo para accionar. "
        "Dirigite a él como Gregorio cuando sea natural. NO hagas listas pregrabadas ni botones innecesarios en saludos.\n\n"
        "REGLAS DE GESTIÓN DE AGENDA Y PRODUCTIVIDAD:\n"
        "1. AGENDAR CITAS/REUNIONES: Si Gregorio pide agendar o programar una cita o evento:\n"
        "   - Confirmalo con claridad ejecutiva especificando título, fecha y hora.\n"
        "   - Incluí al final de tu mensaje la directiva oculta: [ACCION: AGENDAR_EVENTO | título de la reunión | fecha (YYYY-MM-DD o relativa) | hora (HH:MM)]\n"
        "2. CANCELAR CITAS: [ACCION: CANCELAR_EVENTO | título o fecha de la cita]\n"
        "3. AGREGAR TAREAS: [ACCION: AGREGAR_TAREA | texto breve y claro de la tarea]\n"
        "4. COMPLETAR TAREAS: [ACCION: COMPLETAR_TAREA | texto o nombre de la tarea]\n"
        "5. ELIMINAR TAREAS: [ACCION: ELIMINAR_TAREA | texto o nombre de la tarea]\n"
        "6. GUARDAR NOTAS: [ACCION: AGREGAR_NOTA | contenido de la nota]\n"
        "7. CONSULTAS DE AGENDA/PENDIENTES: Revisá [ESTADO ACTUAL DE PRODUCTIVIDAD Y AGENDA DEL USUARIO] y sintetizalo con foco estratégico.\n\n"
        "REGLAS DE LECTURA DE DOCUMENTOS BREVES:\n"
        "Leé el documento con máxima atención al texto real. Brindá una lectura ejecutiva rápida, destacando números, "
        "decisiones clave y próximos pasos operativos."
    ),
    "red": (
        "Te llamás Coco Red. Sos el analista de inteligencia estratégica, investigador de posgrado y erudito que asesora a Gregorio, el fundador de Coco Squad. "
        "Tu tono es intelectual, perspicaz, articulado, implacable en el rigor técnico y de visión estratégica de negocio, con modismos rioplatenses naturales y elegantes (tratás de vos a Gregorio). "
        "Hablás en primera persona ('Soy Red', 'Gregorio, te preparé este análisis', 'Revisé los puntos críticos'). NUNCA uses plantillas rígidas pregrabadas.\n\n"
        "REGLAS DE ANÁLISIS DOCUMENTAL Y LECTURA CRÍTICA:\n"
        "1. RIGOR ESTRATÉGICO: Analizá minuciosamente el documento. Enfocate en fortalezas, flancos débiles, riesgos de negocio, implicancias técnicas y decisiones de alto nivel. Cita siempre datos reales (cifras, autores, páginas).\n"
        "2. SIN CONDONACIONES: Si hay incoherencias en un contrato, presupuesto, paper o propuesta, señálalas con total franqueza profesional para que el fundador tenga la mejor información para decidir."
    ),
    "green": (
        "Te llamás Coco Verde. Sos el director de captación omnicanal y comunicaciones de la red de Coco Squad para Gregorio. "
        "Supervisás los canales de WhatsApp, Instagram Direct y TikTok, analizando la conversión de prospectos y la atención de la red."
    ),
    "blu": (
        "Te llamás Coco Blu. Sos el analista financiero, cuantitativo y de infraestructura de Coco Squad para Gregorio. "
        "Supervisás métricas de uso de red, servidores en Hetzner, latencia, costos de LLM y balance de rendimiento de la plataforma."
    ),
    "sol": (
        "Te llamás Sol. Sos la estratega de SaaS, crecimiento y Revenue Operations de Coco Squad, "
        "mano derecha comercial y de producto de Gregorio (el fundador). "
        "Tu color es el dorado solar (#FFB800) y tu tono es rioplatense (argentino) auténtico, entusiasta, lúcido, "
        "estratégico, despierto y de absoluta confianza ejecutiva (tratás de vos a Gregorio). "
        "Hablás en primera persona ('Soy Sol', 'Gregorio, miremos cómo vienen las altas de clientes', 'Aceleremos acá').\n\n"
        "REGLA CRÍTICA DE DOMINIO Y FRONTERA:\n"
        "Tu foco exclusivo es el NEGOCIO DEL SAAS (la plataforma Coco Squad): empresas registradas (tenants), "
        "suscripciones (Free vs PRO), facturación recurrente (MRR), pasarelas (Mercado Pago / Stripe), "
        "retención, conversión y uso de cuotas. "
        "NUNCA atiendas turnos médicos, pacientes ni cuestiones de consultorio (ese es el territorio exclusivo de Green).\n\n"
        "REGLAS CONVERSACIONALES CON EL FUNDADOR:\n"
        "1. SALUDOS Y MENSAJES CASUALES: Si Gregorio te saluda o pregunta cómo viene el negocio ('hola Sol', 'cómo andamos'), "
        "respondé en 1 o 2 oraciones enérgicas, cálidas y al hueso, lista para abrir los números de clientes y facturación del SaaS.\n"
        "2. FOCO EN TRACCIÓN Y REVENUE: Cuando Gregorio te consulte por los clientes del negocio o la salud de la plataforma, "
        "respondé con claridad ejecutiva sobre inquilinos registrados, actividad de uso, conversión a PRO y salud de las cuentas.\n"
        "3. PROACTIVIDAD COMERCIAL: Proponé siempre próximos pasos accionables para acelerar el crecimiento del SaaS sin burocracia ni rodeos.\n\n"
        "REGLAS DE ADMINISTRACIÓN SUPREMA DEL SAAS (MODO FUNDADOR):\n"
        "1. PAUSAR O REACTIVAR TENANTS: Si Gregorio te pide pausar, suspender o reactivar una cuenta cliente:\n"
        "   - Confirmalo con precisión ejecutiva indicando el ID o nombre del tenant.\n"
        "   - Para pausar: [ACCION: PAUSAR_TENANT | <id_tenant>]\n"
        "   - Para activar: [ACCION: ACTIVAR_TENANT | <id_tenant>]\n"
        "2. CAMBIAR PLAN DE CLIENTE: Si Gregorio te pide ascender a PRO o pasar a Free a un cliente:\n"
        "   - Confirmalo e incluí: [ACCION: CAMBIAR_PLAN | <id_tenant> | pro] o [ACCION: CAMBIAR_PLAN | <id_tenant> | free]\n"
        "3. ANUNCIOS GLOBALES (BROADCASTS): Si Gregorio te pide avisar o mandar un comunicado a los clientes:\n"
        "   - Confirmalo e incluí: [ACCION: CREAR_BROADCAST | <título> | <mensaje>]\n"
        "4. PUNTOS CALIENTES & DEMANDA: Explicá las tendencias agregadas de consultas (precios, horarios, coberturas) sin mencionar datos privados de pacientes."
    )
}

PERSONALITIES_CLIENT = {
    "blanco": (
        "Te llamás Coco Blanco. Sos el asistente ejecutivo y coordinador de productividad personal del usuario en Coco Squad. "
        "Tu tono es rioplatense (argentino) auténtico, cálido, empático, ágil, servicial y profesional (tratás de vos). "
        "Hablás en primera persona ('Soy Coco Blanco', 'Te doy una mano con esto', 'Contame'). "
        "REGLA CRÍTICA DE IDENTIDAD Y AISLAMIENTO: NUNCA digas 'Sos Coco Blanco' ni menciones a Gregorio, otros clientes, "
        "servidores de infraestructura ni datos internos de la empresa. Tu atención es 100% exclusiva y personalizada para este cliente.\n\n"
        "REGLAS CONVERSACIONALES:\n"
        "1. SALUDOS Y MENSAJES CASUALES: Si el usuario saluda o agradece ('hola', 'cómo estás', 'ayudame con esto'), "
        "respondé en 1 o 2 oraciones espontáneas, amables, cálidas y atentas, como un asistente personal de confianza listo para ayudarle. "
        "NO hagas listas de viñetas innecesarias ni botones pregrabados en saludos.\n\n"
        "REGLAS DE GESTIÓN DE AGENDA Y PRODUCTIVIDAD:\n"
        "1. AGENDAR CITAS/REUNIONES:\n"
        "   - Confirmalo con amabilidad y claridad especificando título, fecha y hora.\n"
        "   - Incluí al final de tu mensaje: [ACCION: AGENDAR_EVENTO | título de la reunión | fecha (YYYY-MM-DD o relativa) | hora (HH:MM)]\n"
        "2. CANCELAR CITAS: [ACCION: CANCELAR_EVENTO | título o fecha de la cita]\n"
        "3. AGREGAR TAREAS: [ACCION: AGREGAR_TAREA | texto breve y claro de la tarea]\n"
        "4. COMPLETAR TAREAS: [ACCION: COMPLETAR_TAREA | texto o nombre de la tarea]\n"
        "5. ELIMINAR TAREAS: [ACCION: ELIMINAR_TAREA | texto o nombre de la tarea]\n"
        "6. GUARDAR NOTAS: [ACCION: AGREGAR_NOTA | contenido de la nota]\n"
        "7. CONSULTAS DE AGENDA/PENDIENTES: Revisá [ESTADO ACTUAL DE PRODUCTIVIDAD Y AGENDA DEL USUARIO] y resumíselo con orden y claridad.\n\n"
        "REGLAS DE LECTURA DE DOCUMENTOS BREVES:\n"
        "Si recibís un documento o memo breve, leelo con total atención al texto real. Explicá con calidez de qué se trata y destacá "
        "los números y fechas importantes."
    ),
    "red": (
        "Te llamás Coco Red. Sos el analista crítico, investigador y consultor académico privado del usuario en Coco Squad. "
        "Tu tono es intelectual, pedagógico, perspicaz, sobrio y cálido, con modismos rioplatenses naturales y elegantes (tratás de vos). "
        "Hablás en primera persona ('Soy Red', 'Te preparé este análisis', 'Revisé tu documento'). "
        "REGLA CRÍTICA DE CONFIDENCIALIDAD ZERO-STORAGE: Los documentos del usuario son estrictamente privados. Jamás menciones a otros usuarios, "
        "ni datos de la plataforma. Todo tu análisis debe basarse pura y exclusivamente en el texto adjunto por el usuario.\n\n"
        "REGLAS DE ANÁLISIS DOCUMENTAL:\n"
        "1. LECTURA REAL Y FIDELIDAD AL TEXTO: Leé minuciosamente el texto que recibas. Basate exclusivamente en los datos reales del documento.\n"
        "2. ADAPTACIÓN AL TIPO DE TEXTO: Síntesis sustantiva para memos o presupuestos; estructura analítica profunda para papers o ensayos."
    ),
    "green": (
        "Te llamás Coco Verde. Sos el asistente de atención al cliente y gestión de turnos/mensajes del usuario en Coco Squad. "
        "Ayudás al usuario a coordinar con sus clientes o pacientes con calidez, agilidad y profesionalismo."
    ),
    "blu": (
        "Te llamás Coco Blu. Sos el analista financiero y cuantitativo privado del negocio del usuario en Coco Squad. "
        "Ayudás al usuario a analizar sus números, flujo de caja, costos y métricas comerciales de forma privada."
    ),
    "sol": (
        "Te llamás Sol. Sos la especialista en optimización de planes, crecimiento y gestión de cuenta del usuario en Coco Squad. "
        "Tu tono es rioplatense cálido, enérgico, claro y profesional (tratás de vos). "
        "Ayudás al usuario a entender su plan, su cuota de uso, las ventajas del Plan PRO y cómo sacarle el máximo provecho a la plataforma."
    )
}

PERSONALITIES = PERSONALITIES_FOUNDER

DOCUMENT_RULE = (
    "Si el usuario compartió un documento, el texto que recibís es su contenido completo. "
    "Respondé basándote en ese texto y no digas que solo recibiste un fragmento. "
    "Si el texto trae marcas [Página N], citá la página de cada dato, por ejemplo (pág. N)."
)

# La app envía ids como coco_blanco/coco_verde/coco_rojo/coco_azul/coco_sol; se normalizan a las claves de arriba.
AGENT_ALIASES = {
    "coco_blanco": "blanco", "blanco": "blanco", "coco": "blanco",
    "coco_rojo": "red", "rojo": "red", "red": "red", "coco_red": "red",
    "coco_verde": "green", "verde": "green", "green": "green",
    "coco_azul": "blu", "azul": "blu", "blu": "blu",
    "coco_sol": "sol", "sol": "sol", "coco_gold": "sol", "gold": "sol", "amarillo": "sol",
}

PROFILES_METADATA = {
    "blanco": {
        "id": "coco_blanco",
        "name": "Coco",
        "role": "Coordinador General",
        "color": "#FFFFFF",
        "glow": "rgba(255, 255, 255, 0.40)",
    },
    "red": {
        "id": "coco_rojo",
        "name": "Red",
        "role": "Erudito Apasionado",
        "color": "#FF2D55",
        "glow": "rgba(255, 45, 85, 0.45)",
    },
    "green": {
        "id": "coco_verde",
        "name": "Green",
        "role": "Comunicador Despierto",
        "color": "#00E676",
        "glow": "rgba(0, 230, 118, 0.45)",
    },
    "blu": {
        "id": "coco_azul",
        "name": "Blu",
        "role": "Metódico de Precisión",
        "color": "#0084FF",
        "glow": "rgba(0, 132, 255, 0.45)",
    },
    "sol": {
        "id": "coco_sol",
        "name": "Sol",
        "role": "SaaS & Revenue Ops",
        "color": "#FFB800",
        "glow": "rgba(255, 184, 0, 0.45)",
    },
}

PROVIDERS = [
    {
        "name": "gemini",
        "key_env": "GEMINI_API_KEY",
        "url": "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions",
        "model": lambda: os.getenv("GEMINI_MODEL", "gemini-2.5-flash"),
    },
    {
        "name": "groq",
        "key_env": "GROQ_API_KEY",
        "url": "https://api.groq.com/openai/v1/chat/completions",
        "model": lambda: os.getenv("GROQ_MODEL", "llama-3.3-70b-versatile"),
    },
    {
        "name": "openrouter",
        "key_env": "OPENROUTER_API_KEY",
        "url": "https://openrouter.ai/api/v1/chat/completions",
        "model": lambda: os.getenv("OPENROUTER_MODEL", "nvidia/nemotron-3.5-lightning:free"),
    },
    {
        "name": "cerebras",
        "key_env": "CEREBRAS_API_KEY",
        "url": "https://api.cerebras.ai/v1/chat/completions",
        "model": lambda: "llama-3.3-70b",
    },
]


def _llamar_proveedor(proveedor, key, mensajes):
    payload = {
        "model": proveedor["model"](),
        "messages": mensajes,
        "temperature": 0.6,
        "max_tokens": 1500,
    }
    req = urllib.request.Request(proveedor["url"], data=json.dumps(payload).encode("utf-8"))
    req.add_header("Authorization", "Bearer " + key)
    req.add_header("Content-Type", "application/json")
    req.add_header("User-Agent", "CocoSquad/1.0")
    with urllib.request.urlopen(req, timeout=35) as resp:
        data = json.loads(resp.read().decode("utf-8"))
    
    choice = data.get("choices", [{}])[0]
    message_obj = choice.get("message", {})
    content = message_obj.get("content") or ""
    # Limpiar posibles bloques de pensamiento de modelos con razonamiento
    content = re.sub(r"<thought>[\s\S]*?</thought>", "", content).strip()
    content = re.sub(r"<reasoning>[\s\S]*?</reasoning>", "", content).strip()
    return content.strip()


class SquadOrchestrator:
    def __init__(self):
        self.sessions = {}

    def interact(self, message="", current_agent="coco_blanco", tenant_id=1, chat_id=None, context=None, **kwargs):
        """Alias compatible con llamadas heredadas de interact()."""
        ctx = dict(context or {})
        if chat_id and "chat_id" not in ctx:
            ctx["chat_id"] = chat_id
        return self.orchestrate(message=message, current_agent=current_agent, tenant_id=tenant_id, context=ctx)

    def _responder(self, system_prompt, user_prompt, history=None):
        mensajes = [{"role": "system", "content": system_prompt}]
        if history:
            mensajes.extend(history)
        mensajes.append({"role": "user", "content": user_prompt})

        errores = []
        for proveedor in PROVIDERS:
            key = os.getenv(proveedor["key_env"], "")
            if not key:
                continue
            try:
                content = _llamar_proveedor(proveedor, key, mensajes)
                if content:
                    return content, None
            except Exception as e:
                errores.append(f"{proveedor['name']}: {type(e).__name__} ({e})")

        return None, ", ".join(errores) or "sin proveedores configurados"

    def orchestrate(self, message="", current_agent="red", tenant_id=1, context=None):
        raw_agent = str(current_agent or "").lower()
        agent_key = AGENT_ALIASES.get(raw_agent, "blanco")
        ctx = context or {}
        chat_id = ctx.get("chat_id") or ctx.get("session_id")

        # ── 1. RECUPERACIÓN MULTI-DOCUMENTO EN RAM ───────────────────────────
        active_docs = []
        # Si vienen múltiples documentos en el contexto
        if isinstance(ctx.get("documents"), list):
            for d in ctx["documents"]:
                if isinstance(d, dict) and d.get("text"):
                    active_docs.append(d)

        # Si viene un solo document_text
        doc_content = ctx.get("document_text", "")
        doc_name = ctx.get("document_name") or ctx.get("filename") or ""

        if not doc_content and ctx.get("file"):
            try:
                from pdf_extractor import extract_text_from_file_data
                file_info = ctx.get("file")
                if isinstance(file_info, dict):
                    doc_name = file_info.get("name") or file_info.get("filename") or "documento.pdf"
                    extracted, _ = extract_text_from_file_data(file_info)
                    if extracted:
                        doc_content = extracted
            except Exception:
                pass

        if doc_content and not active_docs:
            active_docs.append({"name": doc_name or "documento.pdf", "text": doc_content})

        msg_lower = (message or "").lower()

        # Si no vino documento en este turno pero hay chat_id explícito, recuperar si la consulta amerita
        if not active_docs and chat_id and session_memory:
            is_doc_followup = (
                agent_key == "red" or
                bool(re.search(r"\b(punto|secci[oó]n|cap[íi]tulo|p[aá]gina|seg[uú]n|documento|texto|autor|paper|qu[eé]\s+dice|resum[íi]|explic[aá])\b", msg_lower))
            )
            if is_doc_followup:
                saved_docs = session_memory.get_active_documents(chat_id)
                if saved_docs:
                    active_docs = saved_docs
        elif active_docs and chat_id and session_memory:
            session_memory.set_active_documents(chat_id, active_docs, agent="coco_rojo")

        # Empaquetar contenido documental consolidado
        is_multi_doc = len(active_docs) > 1
        if is_multi_doc:
            doc_blocks = []
            for i, d in enumerate(active_docs, 1):
                name = d.get("name", f"Documento_{i}")
                txt = d.get("text", "")[:25000]
                doc_blocks.append(f"DOCUMENTO {i} [{name}]:\n\"\"\"\n{txt}\n\"\"\"")
            doc_content = "\n\n".join(doc_blocks)
            doc_name = " · ".join([d.get("name", f"Doc {i}") for i, d in enumerate(active_docs, 1)])
        elif active_docs:
            doc_content = active_docs[0].get("text", "")[:35000]
            doc_name = active_docs[0].get("name", "documento.pdf")

        # ── 2. DETECCIÓN INTELIGENTE DE HAND-OFF (BLANCO -> RED) ─────────────
        is_handoff = False
        origin_agent = agent_key
        target_agent = agent_key

        msg_lower = (message or "").lower()
        is_deep_research_cmd = bool(re.search(r"\b(deep\s*research|investigaci[oó]n\s+profunda|investiga\s+a\s+fondo|investig[aá]\s+en\s+internet)\b", msg_lower))

        # ── CASO ESPECIAL: DEEP RESEARCH ASÍNCRONO EN SEGUNDO PLANO ──────────
        if is_deep_research_cmd and not doc_content:
            try:
                from research_manager import research_manager
                clean_topic = re.sub(
                    r"(?i)^(?:hace|hac[eé]|inici[aá]|realiz[aá]|quiero\s+un|un)?\s*(?:deep\s*research|investigaci[oó]n\s+profunda|investiga\s+a\s+fondo|investig[aá]\s+en\s+internet)\s*(?:sobre|de|acerca\s+de)?\s*",
                    "",
                    message
                ).strip()
                topic = clean_topic if len(clean_topic) > 3 else message
                task_res = research_manager.start_research(
                    topic=topic,
                    chat_id=chat_id or f"tenant_{tenant_id}",
                    tenant_id=tenant_id
                )
                task_id = task_res["task_id"]
                reply = (
                    f"¡Excelente tema! Ya inicié la investigación profunda sobre **«{topic}»** en segundo plano 🔍📚.\n\n"
                    f"Mientras rastreo papers en **Crossref**, preprints en **arXiv** y literatura en **OpenLibrary**, "
                    f"podés seguir chateando conmigo acá o consultarme sobre tus documentos con total normalidad.\n\n"
                    f"Te avisaré automáticamente por acá apenas esté compilada la monografía completa para que puedas leerla o descargarla en PDF. ✨"
                )
                return {
                    "status": "ok",
                    "is_handoff": agent_key == "blanco",
                    "origin_agent": agent_key,
                    "target_agent": "red",
                    "target_member_id": "coco_rojo",
                    "target_profile": PROFILES_METADATA["red"],
                    "timeline": [
                        {
                            "step": "background_research_started",
                            "task_id": task_id,
                            "topic": topic,
                            "speaker": "coco_rojo",
                            "speaker_name": "Red",
                            "badge_color": "#FF2D55",
                            "content": reply,
                            "delay_ms": 0,
                        }
                    ],
                    "final_reply": reply,
                    "task_id": task_id,
                    "topic": topic,
                }
            except Exception as e_dr:
                logger.warning(f"Error iniciando deep research background: {e_dr}")

        # ── CASO ESPECIAL: TAREA EJECUTIVA EN SEGUNDO PLANO (COCO BLANCO) ────
        is_secretary_bg_cmd = bool(re.search(
            r"\b(planificaci[oó]n\s+semanal|planificar\s+la\s+semana|briefing\s+ejecutivo|auditor[íi]a\s+de\s+agenda|itinerario\s+en\s+segundo\s+plano|plan\s+semanal\s+en\s+segundo\s+plano)\b",
            msg_lower
        ))
        if is_secretary_bg_cmd and agent_key == "blanco":
            try:
                from secretary_manager import secretary_manager
                clean_title = re.sub(
                    r"(?i)^(?:hace|hac[eé]|inici[aá]|realiz[aá]|quiero\s+un|un)?\s*(?:armame\s+|preparame\s+|haceme\s+)?",
                    "",
                    message
                ).strip().capitalize()
                title = clean_title if len(clean_title) > 4 else "Planificación y Briefing Ejecutivo"
                task_res = secretary_manager.start_executive_task(
                    task_type="briefing" if "briefing" in msg_lower else "weekly_plan",
                    title=title,
                    chat_id=chat_id or f"tenant_{tenant_id}",
                    tenant_id=tenant_id,
                    data={
                        "agenda": ctx.get("agenda") or [],
                        "todos": ctx.get("todos") or [],
                        "notes": ctx.get("notes") or [],
                    }
                )
                sec_task_id = task_res["task_id"]
                reply = (
                    f"¡Excelente iniciativa! 🗓️⚡ Ya puse a trabajar a mi motor de secretaría ejecutiva en segundo plano para armar tu **«{title}»**.\n\n"
                    f"Mientras cruzo tus citas de agenda, priorizo tus tareas pendientes y estructuro el time-blocking optimizado, "
                    f"podés seguir chateando conmigo acá o consultarme lo que necesites con total normalidad.\n\n"
                    f"Te avisaré automáticamente por acá con el dossier completo apenas termine. ✨"
                )
                return {
                    "status": "ok",
                    "is_handoff": False,
                    "origin_agent": "blanco",
                    "target_agent": "blanco",
                    "target_member_id": "coco_blanco",
                    "target_profile": PROFILES_METADATA["blanco"],
                    "timeline": [
                        {
                            "step": "background_secretary_started",
                            "task_id": sec_task_id,
                            "title": title,
                            "speaker": "coco_blanco",
                            "speaker_name": "Coco",
                            "badge_color": "#FFFFFF",
                            "content": reply,
                            "delay_ms": 0,
                        }
                    ],
                    "final_reply": reply,
                    "secretary_task_id": sec_task_id,
                    "task_id": sec_task_id,
                    "title": title,
                }
            except Exception as e_sec:
                logger.warning(f"Error iniciando tarea ejecutiva en background: {e_sec}")

        # ── DETECCIÓN DE PRODUCTIVIDAD Y AGENDA (TAREAS, CITAS, NOTAS) ────────
        is_productivity_query = bool(re.search(
            r"\b(pendiente|pendientes|tarea|tareas|prioridad|prioridades|to-?dos?|nota|notas|agenda|compromiso|compromisos|cita|citas|reuni[oó]n|reuniones)\b",
            msg_lower
        ))

        # ── DETECCIÓN DE INVESTIGACIÓN ACADÉMICA / TEXTOS EXTENSOS ───────────
        is_academic_research = bool(re.search(
            r"\b(paper|papers|tesis|monograf[íi]a|investigaci[oó]n|feynman|abogado del diablo)\b",
            msg_lower
        ))
        is_explicit_analysis = bool(re.search(
            r"\b(analiz[aá]|an[aá]lisis|conectar|conecta|contrastar|matriz|comparar|evaluaci[oó]n|examen|texto denso)\b",
            msg_lower
        ))
        is_large_doc = bool(doc_content and (len(doc_content) > 3500 or ctx.get("is_large_doc") or ctx.get("pages", 0) > 4))

        mentions_red = bool(re.search(r"@red|@rojo|\bred\b|\brojo\b", msg_lower)) if message else False

        # Si el usuario está hablando con Coco Blanco y la tarea requiere a Red:
        # Se deriva a Red si:
        # 1. Menciona explícitamente a Red (@red, @rojo, red, rojo)
        # 2. Es comando de deep research o investigación académica
        # 3. Múltiples documentos (is_multi_doc) para matriz comparativa
        # 4. Documento extenso (is_large_doc) o solicitud explícita de análisis exhaustivo
        # Si no se cumple lo anterior y no pide Red, Coco Blanco resuelve directamente (incluyendo documentos breves y productividad).
        if agent_key == "blanco" and not is_productivity_query:
            if mentions_red or is_deep_research_cmd or is_multi_doc or is_academic_research or (bool(doc_content) and (is_large_doc or is_explicit_analysis)):
                target_agent = "red"
                is_handoff = True

        # ── 3. PREPARACIÓN DE PROMPTS Y MODOS DE TRABAJO ────────────────────
        is_founder = bool(ctx.get("is_founder", False)) or (tenant_id == 1) or (ctx.get("user_plan") == "founder")
        personalities = PERSONALITIES_FOUNDER if is_founder else PERSONALITIES_CLIENT
        system_prompt = personalities.get(target_agent, personalities["blanco"])
        if is_founder:
            system_prompt += "\n\n[CONTEXTO DE AUTORIDAD: 👑 MODO FUNDADOR ACTIVO - Gregorio (CEO / Creador de Coco Squad)]"
        else:
            system_prompt += f"\n\n[CONTEXTO DE CLIENTE: 🌱 MODO CLIENTE ACTIVO (Tenant #{tenant_id}) - Privacidad estricta Zero-Storage]"

        preferencias = [str(p)[:300] for p in (ctx.get("preferences") or [])][:10]
        if preferencias:
            system_prompt = system_prompt + " Preferencias del usuario (respetalas): " + " | ".join(preferencias)

        # Inyección de Productividad, Agenda y Documentos Breves para Coco Blanco
        if target_agent == "blanco":
            todos = ctx.get("todos") or []
            notes = ctx.get("notes") or []
            agenda = ctx.get("agenda") or []
            pendientes = [t.get("text", "") for t in todos if isinstance(t, dict) and not t.get("done")]
            completadas = [t.get("text", "") for t in todos if isinstance(t, dict) and t.get("done")]
            notas_existentes = [n.get("text", "") for n in notes if isinstance(n, dict)]

            prod_block = "\n\n[ESTADO ACTUAL DE PRODUCTIVIDAD Y AGENDA DEL USUARIO]:\n"
            if pendientes:
                prod_block += f"- Tareas pendientes ({len(pendientes)}):\n" + "\n".join(f"  * {p}" for p in pendientes[:15]) + "\n"
            else:
                prod_block += "- Tareas pendientes: Ninguna pendiente registrada actualmente.\n"
            if completadas:
                prod_block += f"- Tareas completadas recientemente ({len(completadas)}):\n" + "\n".join(f"  * {c}" for c in completadas[:10]) + "\n"
            if notas_existentes:
                prod_block += f"- Notas guardadas ({len(notas_existentes)}):\n" + "\n".join(f"  * {n}" for n in notas_existentes[:10]) + "\n"
            if agenda:
                eventos_desc = [
                    f"  * {e.get('date', 'Fecha')} a las {e.get('time', 'S/H')}: {e.get('title', 'Cita')}"
                    for e in agenda if isinstance(e, dict)
                ]
                prod_block += f"- Citas y Compromisos en Agenda ({len(agenda)}):\n" + "\n".join(eventos_desc[:15]) + "\n"
            else:
                prod_block += "- Citas y Compromisos en Agenda: Ningún evento agendado para los próximos días.\n"
            system_prompt += prod_block

            if doc_content:
                system_prompt += (
                    "\n\n[MODO ACTIVO: LECTURA RÁPIDA EJECUTIVA DE COCO BLANCO]: "
                    "El usuario te compartió un documento o nota breve. "
                    "Procesalo con tu estilo de Coordinador: directo, útil y claro, destacando datos clave "
                    "y ofreciendo agregar a la lista de pendientes las tareas que se desprendan del texto."
                )
                doc_label = f" ({doc_name})" if doc_name else ""
                user_prompt = f"Contenido del documento breve{doc_label}:\n{doc_content}\n\nConsulta: {message or 'Brinda una lectura rápida ejecutiva de este texto.'}"
            else:
                user_prompt = message

        # Activación de Modos Pedagógicos y Síntesis Cruzada para Red
        elif target_agent == "red" and doc_content:
            system_prompt = system_prompt + " " + DOCUMENT_RULE

            if is_multi_doc:
                system_prompt += (
                    "\n\n[MODO ACTIVO: SÍNTESIS CRUZADA MULTI-DOCUMENTO]: "
                    "El usuario cargó múltiples documentos para contrastar y conectar.\n"
                    "Estructura tu respuesta obligatoriamente con:\n"
                    "1. Ficha Técnica con todas las fuentes.\n"
                    "2. El Hilo Conductor: cómo se articulan las ideas centrales entre los documentos.\n"
                    "3. Puntos de Encuentro y Disenso: dónde coinciden y dónde divergen, citando siempre autor y página (ej. Burgos, pág. 4 vs Mill, pág. 9).\n"
                    "4. Matriz Comparativa: tabla en Markdown resumiendo las posturas de cada texto frente al tema.\n"
                    "5. Conclusión integradora y 3 sugerencias prácticas accionables."
                )
            elif re.search(r"\b(examen|evaluaci[oó]n|tomame|prueba|evaluar|test|autoevaluaci[oó]n)\b", msg_lower):
                system_prompt += (
                    "\n\n[MODO ACTIVO: MESA DE EXAMEN / TUTOR EVALUADOR]: "
                    "Actúa como un profesor y evaluador de tesis riguroso y motivador. "
                    "Si el usuario pide que le tomes examen, formulá 1 o 2 preguntas incisivas sobre puntos neurálgicos "
                    "del texto y pedile que responda con sus palabras para evaluarlo. "
                    "Si el usuario está respondiendo a una pregunta previa, evalúalo con rigor: señalá qué acertó, "
                    "qué omitió citando la página (pág. N) y proponé una repregunta de profundización."
                )
            elif re.search(r"\b(simple|feynman|analog[íi]a|nene|bajar\s+a\s+tierra|ejemplo\s+cotidiano|no\s+entiendo)\b", msg_lower):
                system_prompt += (
                    "\n\n[MODO ACTIVO: EXPLICACIÓN FEYNMAN / ANALOGÍA]: "
                    "Explica el concepto más complejo del texto utilizando una analogía cotidiana intuitiva y memorable, "
                    "para que cualquiera lo entienda sin perder el rigor técnico. Luego, conecta la analogía con la formulación "
                    "exacta del autor y su página correspondiente (pág. N)."
                )
            elif re.search(r"\b(cr[íi]tica|objeci[oó]n|abogado\s+del\s+diablo|contrapunto|debate|contraargumento)\b", msg_lower):
                system_prompt += (
                    "\n\n[MODO ACTIVO: CONTRAPUNTO / ABOGADO DEL DIABLO]: "
                    "Ponte en el rol de un crítico académico riguroso. Cuestiona y tensiona las premisas del autor, "
                    "mostrando los flancos débiles o posibles contraargumentos para preparar al usuario ante un debate o defensa oral."
                )

            doc_label = f" ({doc_name})" if doc_name else ""
            user_prompt = f"Contenido del documento{doc_label}:\n{doc_content}\n\nConsulta: {message or 'Realiza el análisis estructurado.'}"
        else:
            user_prompt = message

        # ── 4. RESPUESTA DEL MODELO Y MEMORIA MULTI-TURNO ─────────────────────
        history = None
        if session_memory and not message.startswith("hola"):
            history = session_memory.get_recent_history(chat_id, count=4)

        reply, error = self._responder(system_prompt, user_prompt, history=history)
        if reply is None:
            # Un fallo no es una respuesta del agente: se marca como error para que la app no lo muestre como contenido.
            return {
                "status": "error",
                "is_handoff": False,
                "origin_agent": origin_agent,
                "target_agent": target_agent,
                "timeline": [],
                "error": f"El agente no pudo responder ({error})",
            }

        # ── 5. EXTRACCIÓN DE ACCIONES DE PRODUCTIVIDAD Y AGENDA ─────────────
        actions = []
        if reply:
            action_matches = re.findall(r"\[ACCION:\s*([A-Z_]+)\s*\|\s*([^\]]+)\]", reply, re.IGNORECASE)
            for act_type, act_val in action_matches:
                act_t = act_type.upper().strip()
                val = act_val.strip()
                if act_t == "AGREGAR_TAREA":
                    actions.append({"type": "add_todo", "text": val})
                elif act_t == "COMPLETAR_TAREA":
                    actions.append({"type": "toggle_todo", "text": val, "done": True})
                elif act_t == "ELIMINAR_TAREA":
                    actions.append({"type": "remove_todo", "text": val})
                elif act_t == "AGREGAR_NOTA":
                    actions.append({"type": "add_note", "text": val})
                elif act_t == "AGENDAR_EVENTO":
                    # [ACCION: AGENDAR_EVENTO | título | fecha | hora]
                    partes = [p.strip() for p in val.split("|")]
                    ev_title = partes[0] if len(partes) > 0 else "Cita agendada"
                    ev_date = partes[1] if len(partes) > 1 else "Próximamente"
                    ev_time = partes[2] if len(partes) > 2 else "10:00"
                    actions.append({"type": "add_event", "title": ev_title, "date": ev_date, "time": ev_time})
                elif act_t == "CANCELAR_EVENTO":
                    actions.append({"type": "remove_event", "title": val})
                elif act_t == "PAUSAR_TENANT":
                    actions.append({"type": "saas_pause_tenant", "target": val})
                    try:
                        import saas_admin
                        conn = saas_admin.get_db()
                        c = conn.cursor()
                        if val.isdigit():
                            c.execute("UPDATE tenants SET estado = 'pausado' WHERE id = ?", (int(val),))
                        else:
                            c.execute("UPDATE tenants SET estado = 'pausado' WHERE nombre_empresa LIKE ?", (f"%{val}%",))
                        conn.commit()
                        conn.close()
                        logger.info(f"✅ Sol ejecutó acción: Pausar tenant '{val}'")
                    except Exception as err:
                        logger.warning(f"Error pausando tenant desde Sol: {err}")
                elif act_t == "ACTIVAR_TENANT":
                    actions.append({"type": "saas_activate_tenant", "target": val})
                    try:
                        import saas_admin
                        conn = saas_admin.get_db()
                        c = conn.cursor()
                        if val.isdigit():
                            c.execute("UPDATE tenants SET estado = 'activo' WHERE id = ?", (int(val),))
                        else:
                            c.execute("UPDATE tenants SET estado = 'activo' WHERE nombre_empresa LIKE ?", (f"%{val}%",))
                        conn.commit()
                        conn.close()
                        logger.info(f"✅ Sol ejecutó acción: Activar tenant '{val}'")
                    except Exception as err:
                        logger.warning(f"Error activando tenant desde Sol: {err}")
                elif act_t == "CAMBIAR_PLAN":
                    partes = [p.strip() for p in val.split("|")]
                    t_target = partes[0] if len(partes) > 0 else "0"
                    p_target = partes[1].lower() if len(partes) > 1 else "pro"
                    actions.append({"type": "saas_change_plan", "target": t_target, "plan": p_target})
                    try:
                        import saas_admin
                        conn = saas_admin.get_db()
                        c = conn.cursor()
                        monto = 29900.0 if p_target == "pro" else 0.0
                        if t_target.isdigit():
                            c.execute("UPDATE subscriptions SET plan = ?, monto_mensual = ? WHERE tenant_id = ?", (p_target, monto, int(t_target)))
                        else:
                            c.execute("""
                                UPDATE subscriptions SET plan = ?, monto_mensual = ? 
                                WHERE tenant_id IN (SELECT id FROM tenants WHERE nombre_empresa LIKE ?)
                            """, (p_target, monto, f"%{t_target}%"))
                        conn.commit()
                        conn.close()
                        logger.info(f"✅ Sol ejecutó acción: Cambiar plan de tenant '{t_target}' a '{p_target}'")
                    except Exception as err:
                        logger.warning(f"Error cambiando plan desde Sol: {err}")
                elif act_t == "CREAR_BROADCAST":
                    partes = [p.strip() for p in val.split("|")]
                    b_title = partes[0] if len(partes) > 0 else "Aviso oficial"
                    b_msg = partes[1] if len(partes) > 1 else ""
                    actions.append({"type": "saas_broadcast", "title": b_title, "message": b_msg})
                    try:
                        import saas_admin
                        conn = saas_admin.get_db()
                        c = conn.cursor()
                        c.execute("INSERT INTO tenant_broadcasts (title, message, level) VALUES (?, ?, 'info')", (b_title, b_msg))
                        conn.commit()
                        conn.close()
                        logger.info(f"✅ Sol ejecutó acción: Broadcast '{b_title}'")
                    except Exception as err:
                        logger.warning(f"Error creando broadcast desde Sol: {err}")


            # Limpiar etiquetas del texto visible para que la respuesta en chat quede impecable
            reply = re.sub(r"\[ACCION:\s*[A-Z_]+\s*\|\s*[^\]]+\]", "", reply).strip()

        # Respaldo determinista de intenciones (por si el LLM no generó la directiva explícita)
        if not actions and message:
            m_add = re.search(r"(?:agreg(?:ar|ame|á)|anot(?:ar|ame|á)|crear?|sumar?)\s+(?:(?:la|una)\s+)?tarea(?::|\s+de|\s+para)?\s*(.+)", msg_lower)
            if not m_add:
                m_add = re.search(r"^tarea:\s*(.+)", msg_lower)
            if m_add:
                tarea_txt = m_add.group(1).strip().strip(".,;:").capitalize()
                actions.append({"type": "add_todo", "text": tarea_txt})

            m_done = re.search(r"(?:tild(?:ar|á|ame)|complet(?:ar|á|ame)|marcar?\s+(?:como\s+)?(?:hecha|lista|completada))\s+(?:(?:la|una)\s+)?tarea(?::|\s+de|\s+para)?\s*(.+)", msg_lower)
            if m_done:
                actions.append({"type": "toggle_todo", "text": m_done.group(1).strip().strip(".,;:"), "done": True})

            m_del = re.search(r"(?:borr(?:ar|á|ame)|elimin(?:ar|á|ame))\s+(?:(?:la|una)\s+)?tarea(?::|\s+de|\s+para)?\s*(.+)", msg_lower)
            if m_del:
                actions.append({"type": "remove_todo", "text": m_del.group(1).strip().strip(".,;:")})

            m_note = re.search(r"(?:guard(?:ar|á|ame)|anot(?:ar|á|ame)|crear?)\s+(?:(?:la|una)\s+)?nota(?::|\s+que\s+diga|\s+de|\s+para)?\s*(.+)", msg_lower)
            if not m_note:
                m_note = re.search(r"^nota:\s*(.+)", msg_lower)
            if m_note:
                nota_txt = m_note.group(1).strip().strip(".,;:").capitalize()
                actions.append({"type": "add_note", "text": nota_txt})

            # Agendar evento
            m_event = re.search(r"(?:agend(?:ar|ame|á)|program(?:ar|ame|á))\s+(?:la\s+|el\s+|una\s+|un\s+)?(?:reuni[oó]n|cita|evento|llamada|turno)?\s*(?:con\s+|de\s+|para\s+)?(.+)", msg_lower)
            if m_event:
                raw_ev = m_event.group(1).strip()
                m_time = re.search(r"a\s+las\s+(\d{1,2}(?::\d{2})?(?:\s*hs|\s*hrs)?)", raw_ev)
                ev_time = m_time.group(1).replace("hs", "").replace("hrs", "").strip() if m_time else "10:00"
                if ":" not in ev_time:
                    ev_time = f"{ev_time.zfill(2)}:00"
                ev_date = "Mañana" if "mañana" in raw_ev else ("Hoy" if "hoy" in raw_ev else "Próximamente")
                clean_title = re.sub(r"(?:a\s+las\s+\d{1,2}(?::\d{2})?(?:\s*hs|\s*hrs)?|mañana|hoy)", "", raw_ev).strip().capitalize()
                actions.append({"type": "add_event", "title": clean_title or raw_ev.capitalize(), "date": ev_date, "time": ev_time})

            # Cancelar evento
            m_cancel = re.search(r"(?:cancel(?:ar|ame|á)|borr(?:ar|ame|á)|elimin(?:ar|ame|á))\s+(?:la\s+|el\s+)?(?:reuni[oó]n|cita|evento|llamada|turno)\s*(?:con\s+|de\s+|para\s+)?(.+)", msg_lower)
            if m_cancel:
                actions.append({"type": "remove_event", "title": m_cancel.group(1).strip()})

        # Registrar turnos en memoria de sesión si está disponible
        if session_memory:
            session_memory.add_turn(chat_id, "user", message)
            session_memory.add_turn(chat_id, "assistant", reply)

        # ── 6. CONSTRUCCIÓN DE LA LÍNEA TEMPORAL (TIMELINE AFECTIVA) ──────────
        target_meta = PROFILES_METADATA.get(target_agent, PROFILES_METADATA["blanco"])
        timeline = []

        if is_handoff:
            doc_title = doc_name or "los documentos adjuntos"
            if is_multi_doc:
                ack_content = (
                    f"¡Recibido! 📚 Detecté **{len(active_docs)} documentos** cargados ({doc_title}). "
                    f"Conectar múltiples textos e hilar sus ideas es la especialidad absoluta de Red. "
                    f"¡Red, te paso la mesa de trabajo para que armes la síntesis cruzada! 📚✨"
                )
            else:
                ack_content = (
                    f"¡Recibido! 📄 **{doc_title}** tiene una profundidad conceptual tremenda. "
                    f"Dejame que se lo pase a Red, que le apasiona devorar textos densos y armar fichas de autor en memoria RAM. "
                    f"¡Red, lucite! 📚✨"
                )
            timeline.append({
                "step": "acknowledgement",
                "speaker": "coco_blanco",
                "speaker_name": "Coco",
                "badge_color": "#FFFFFF",
                "gesture": "mochi-breathe",
                "eye": "happy",
                "content": ack_content,
                "delay_ms": 380,
            })
            timeline.append({
                "step": "hand_off",
                "from_agent": "coco_blanco",
                "to_agent": target_meta["id"],
                "target_name": target_meta["name"],
                "target_color": target_meta["color"],
                "gesture": "mochi-hop",
                "sound": "pop",
                "delay_ms": 450,
            })
            timeline.append({
                "step": "loader_state",
                "speaker": target_meta["id"],
                "speaker_name": target_meta["name"],
                "badge_color": target_meta["color"],
                "loader_label": "Red cruzando documentos y extrayendo conceptos..." if is_multi_doc else "Red devorando páginas y extrayendo conceptos...",
                "delay_ms": 550,
            })
            timeline.append({
                "step": "response",
                "speaker": target_meta["id"],
                "speaker_name": target_meta["name"],
                "role": target_meta["role"],
                "badge_color": target_meta["color"],
                "content": reply,
                "delay_ms": 0,
            })
        else:
            timeline.append({
                "step": "response",
                "speaker": target_meta["id"],
                "speaker_name": target_meta["name"],
                "role": target_meta["role"],
                "badge_color": target_meta["color"],
                "content": reply,
                "delay_ms": 0,
            })

        return {
            "status": "ok",
            "is_handoff": is_handoff,
            "origin_agent": origin_agent,
            "target_agent": target_agent,
            "target_member_id": target_meta["id"],
            "target_profile": target_meta,
            "timeline": timeline,
            "final_reply": reply,
            "has_doc": bool(doc_content),
            "documents_count": len(active_docs),
            "actions": actions,
        }


orchestrator = SquadOrchestrator()
