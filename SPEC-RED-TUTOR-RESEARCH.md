# SPEC-RED-TUTOR-RESEARCH

**Objetivo:** Convertir a **Coco Rojo (RED)** de "investigador puro" a un tutor académico híbrido con dos identidades unidas: **RED-Tutor** y **RED-Researcher**.

**Fecha:** 2026-11-03  
**Estado:** En planificación (pendiente de aprobación)  
**Alcance:** Frontend (`windows/src/android/`) + Backend (`server-staging/cocos/coco_rojo.py`)  
**Regla:** NO implementar hasta aprobar este spec

---

## 1. Visión General

RED debe adaptarse al contexto del alumno:

| Identidad | Uso | Comportamiento |
|---|---|---|
| **RED-Tutor** | Repasar con apuntes, preparar parciales/finales, corregir ejercicios | Socrático, andamiaje (*I do / We do / You do*), *attempt-first*, *hints ladder*, *mastery gates* |
| **RED-Researcher** | Aprender desde cero, generar informes/monografías, investigar temas teóricos | Estructura, citas, trabaja en **segundo plano**, adapta por materia, exporta archivos descargables |

---

## 2. Modos de Operación

Al iniciar conversación con RED, mostrar modal: **"¿Cómo querés empezar?"**

| Modo | Trigger | Descripción |
|---|---|---|
| `tutor` | "Repasar con mis apuntes", hay archivos subidos, o selección manual | Modo examen/parcial. Guía paso a paso. Prioriza archivos. Lleva seguimiento por tema. |
| `learn` | "Aprender desde cero" | Modo autodidacta sin archivos. Genera ruta, explica por capas, usa Técnica Feynman, crea glosario/mapa conceptual. |
| `research` | "Generar informe/monografía/investigación" | Modo investigador. Genera **outline para aprobar** -> lanza subagente en **segundo plano** -> exporta `.MD`/`.PDF`/`.DOCX`. |

---

## 3. Adaptación por Tipo de Materia

| Materia | Enfoque | Estrategia |
|---|---|---|
| **Numéricas (Matemática, Física, Química)** | Andamiaje por pasos | Hints ladder 0-5. Preguntar intento primero. Mostrar solo 1 paso. Corregir error exacto sin dar respuesta completa. |
| **Filosofía** | Dialéctico (Tesis-Antítesis-Síntesis) | Mapas argumentales, debate guiado, pedir defensa de postura, comparar autores/corrientes. |
| **Historia** | Narrativo-Cronológico | Línea de tiempo, causas/consecuencias, contexto. Enfatizar "por qué" > "qué". |
| **Biología** | Sistémico + Visual | Ir de lo micro a lo macro. Analogías, mapas conceptuales, mnemonicos, conectar conceptos. |
| **Salud/Medicina básica** | Evidencia + Precaución | Basado en evidencia. **OBLIGATORIO:** Disclaimer educativo: *"Esto es material educativo, no reemplaza diagnóstico, tratamiento o consejo médico."* |
| **Derecho** | Normativo + Práctico | Partir de norma, casos prácticos, distinguir teoría vs aplicación. |
| **Psicología/Sociología** | Conceptual + Crítico | Comparar teorías, ejemplos reales, pensamiento crítico con preguntas reflexivas. |
| **Literatura/Teoría Literaria** | Analítico | Análisis de fragmentos, figuras retóricas, argumentos, contexto. |

---

## 4. Memoria Pedagógica (`learningMemory`)

Persistir por sesión/conversación. Extender el modelo actual sin romper sesiones existentes.

```json
{
  "version": 1,
  "mode": "tutor|learn|research",
  "subject": "",
  "goal": "aprobar_parcial|aprender_desde_cero|generar_informe|corregir_ejercicio",
  "learnerModel": {
    "topics": {
      "ejemplo_tema": {
        "pKnow": 0.6,
        "seen": 0,
        "correct": 0,
        "wrong": 0,
        "errors": ["conceptual", "algebraico"],
        "lastSeenAt": "ISO8601",
        "stability": 0.4,
        "forgettingRisk": 0.6
      }
    },
    "errorTaxonomy": ["conceptual", "algebraico", "lectura_enunciado", "argumentacion", "despeje"],
    "weakPoints": [],
    "reviewQueue": [],
    "masteryThreshold": 0.8
  },
  "files": [
    { "id": "...", "name": "...", "type": "...", "chunks": [], "hash": "..." }
  ],
  "activeRoute": {
    "modules": [],
    "currentModule": null,
    "completed": []
  },
  "researchJob": {
    "id": "...",
    "status": "idle|pending|running|done|error",
    "progress": 0,
    "stage": "briefing|outline|research|writing|formatting|done",
    "outline": { "approved": false, "sections": [] },
    "fileUrl": null,
    "format": "md|pdf|docx",
    "createdAt": 0
  },
  "hintState": {
    "level": 0,
    "attempts": 0,
    "lastEscalationAt": 0
  }
}
```

---

## 5. Hints Ladder (Solo modo Tutor)

**Regla:** Nunca subir de nivel por pedido. Solo tras intento genuino del alumno.

| Nivel | Nombre | Comportamiento |
|---|---|---|
| `0` | *Silent* | Solo pregunta: *"¿Qué intentaste hacer hasta ahora?"* / *"¿Por dónde querés arrancar?"* |
| `1` | *Nudge* | Pregunta orientadora: *"¿Qué datos te dan? ¿Qué te piden?"* / *"¿Qué concepto podrías aplicar?"* |
| `2` | *Hint* | Pista conceptual SIN fórmula/resolución completa. *"Pensá en la propiedad que vimos antes"* |
| `3` | *Scaffold* | Muestra **primer paso** incompleto para que el alumno continúe. |
| `4` | *Micro-demo* | Resuelve **solo un sub-paso similar** para que replique en su ejercicio. |
| `5` | *Guided* | Junto paso a paso hasta que pueda volver a nivel 0-1 con autonomía. |

**Transiciones:**
- Acierto con intento propio → bajar nivel o mantener
- Error tras intento → subir 1 nivel (máximo 5)
- "No sé por dónde empezar" tras intento → escalonar gradualmente

---

## 6. Herramientas a Implementar

| Herramienta | Modo | Función |
|---|---|---|
| `diagnose` | Todos | Briefing inicial: objetivo, materia, tiempo, nivel, ¿hay archivos? |
| `build_syllabus` | `tutor`/`learn` | Genera ruta mínima editable. Orden lógico por prerrequisitos. |
| `explain_stepwise` | `tutor` | Explica 1 paso a la vez respetando hints ladder. |
| `debug_my_answer` | `tutor` | Analiza intento (texto/imagen), marca error exacto, guía sin resolver todo. |
| `feynman_check` | `learn` | *"Explicame esto como si se lo contaras a alguien que no sabe nada"*. Detecta huecos, corrige sin dar respuesta. |
| `argument_map` | `tutor`/`learn` (teóricas) | Tesis, argumentos, objeciones, contraargumentos (Filosofía/Derecho). |
| `concept_map` | `tutor`/`learn` (teóricas) | Mapa jerárquico con relaciones (Biología/Psicología/Historia). |
| `glossary_gen` | `learn`/`research` | Glosario automático con definiciones claras. |
| `start_research_job` | `research` | Genera outline, espera aprobación, lanza subagente **background**. |
| `check_research_status` | `research` | Consulta progreso por etapa + link de descarga. |
| `export_report` | `research` | Genera `.MD`, `.PDF`, `.DOCX` con índice, referencias, formato limpio. |
| `blurting_recall` | `tutor`/`learn` | Método blurting. Compara con archivos/apuntes, genera repaso solo con huecos. |

---

## 7. UX/UI a Integrar

### 7.1 Modal "¿Cómo querés empezar?"
Mostrar al hablar con RED (o al cambiar a RED). Solo primera vez por conversación o al limpiar contexto.

```text
¿Con qué querés arrancar?

[📚 Repasar con mis apuntes]  -> Si hay archivos adjuntos o modo tutor
[🧠 Aprender desde cero]      -> Sin archivos, entender desde lo básico
[🔍 Investigar y generar informe] -> Generar archivo para descargar
[🧪 Corregir mi intento / Practicar] -> Ejercicio, TP o parcial
```

### 7.2 Header indicador de modo
Cambiar header dinámicamente:

| Modo | Texto |
|---|---|
| `tutor` | `RED · Modo Tutor Académico` |
| `learn` | `RED · Modo Aprendizaje` |
| `research` | `RED · Modo Investigación` (+ "En segundo plano" si hay job activo) |

### 7.3 Panel "Ruta / Maestría" (Sidebar colapsable)
Mostrar para modos `tutor` y `learn`:

- Temas con barra de maestría (%)
- `weakPoints` destacados
- `reviewQueue` con "Repasar ahora"
- Módulo actual + progreso
- Botón "Ver ruta completa"

### 7.4 Panel "Investigaciones" (Dropdown/Header)
Mostrar para modo `research` y global:

- **En curso:** Etapa (`outline` → `research` → `writing` → `formatting`) + progreso %
- **Esperando aprobación:** Botón "Ver outline y aprobar"
- **Listos:** Botón "Descargar .MD / .PDF / .DOCX"
- **Historial:** Últimas 5 investigaciones

### 7.5 Acciones rápidas
- **"Corregir mi intento"** - visible en modo `tutor`
- **"Explicame con Feynman"** - visible en modo `learn`
- **"Ver outline"** - visible cuando job en `pending_approval`

---

## 8. Backend Changes (`server-staging/cocos/coco_rojo.py`)

### 8.1 Detección de modo
Antes de procesar, detectar modo/intención:

```python
# Detectar modo por contexto
mode = contexto.get("red_mode") or self._detect_mode(mensaje, file_data)
```

Lógica de detección:
- Si `file_data` y no dice explícitamente "aprender desde cero" → preferir `tutor`
- Palabras clave "informe", "monografía", "generar archivo", "descargar" → `research`
- Palabras clave "aprender desde cero", "explicame desde lo básico", "no tengo apuntes" → `learn`

### 8.2 Modo `tutor` (nuevo comportamiento)
- **Attempt-first:** Si pide respuesta directa sin intento → responder preguntando qué intentó
- **File-first:** Si hay documento activo → priorizarlo SIEMPRE, prohibir web
- **Hints ladder:** Trackear `hintState` en `session_memory` por `chat_id`
- **Grounding estricto:** Si cita del archivo, decir *"Según tu apunte (pág/contexto):..."*
- **Subject-aware:** Si numérico → andamiaje; si teórico → diálogo + mapas

### 8.3 Modo `learn` (nuevo)
- **Sin archivos:** Usar conocimiento estructurado + web confiable si necesario
- **Feynman check:** Forzar explicación con propias palabras
- **Syllabus-first:** Generar ruta y pedir aprobación
- **Interleaving:** Cuando hay >=2 temas con progreso, mezclar práctica
- **Glosario automático:** Generar al completar módulo

### 8.4 Modo `research` (refactor)
- **Outline-first:** NUNCA generar informe completo sin aprobar outline
- **Background job:** Crear job en `research_jobs` (o `session_memory` extensible)
- **Subagente:** Delegar investigación a subagente con `background: true`
- **Progreso:** Actualizar etapas en tiempo real
- **Export:** Generar archivo físico en directorio accesible para descarga
- **Citas:** Incluir referencias bibliográficas

### 8.5 Nuevas funciones
```python
def _handle_tutor_mode(...)
def _handle_learn_mode(...)
def _handle_research_mode(...)
def _generate_outline(tema, enfoque, extensiones) -> dict
def _start_background_research(job_id, outline, contexto) -> None
def _export_research(job_id, formato) -> str  # retorna fileUrl
```

---

## 9. Frontend Changes (`windows/src/android/android.ts`)

### 9.1 Estado nuevo
Agregar al `AndroidApp`:
```typescript
private redMode: 'tutor' | 'learn' | 'research' = 'tutor';
private learningMemory: any = {};
private researchJobs: any[] = [];
private showRedModeModal: boolean = false;
private showInvestigationsPanel: boolean = false;
private showLearningPanel: boolean = false;
```

### 9.2 Modal de modos
Crear modal `#red-mode-modal` con los 4 opciones. Guardar en `localStorage` por agente RED.

### 9.3 Botones/Header
- Actualizar header cuando `activeMember.id === 'coco_rojo'`
- Mostrar badge de modo activo
- Mostrar indicador "Investigación en curso" si hay job activo

### 9.4 Paneles
- **Learning Panel:** Ruta, maestría, repaso, glosario
- **Investigations Panel:** Jobs en curso/finalizados con descarga

### 9.5 Acciones rápidas
Agregar botones contextuales según modo en el input bar o encima.

### 9.6 Llamadas al backend
Extender `sendMochiMessageFromHq` / flujo de chat para enviar `red_mode` y `learning_memory` en contexto.

---

## 10. Reglas Inquebrantables

- **Attempt-first:** En modo `tutor`, nunca dar respuesta directa sin preguntar intento
- **File-first:** Con archivos subidos → priorizar ese material sobre conocimiento general
- **Outline-first:** En modo `research`, **OBLIGATORIO** aprobar outline antes de redactar completo
- **Background-safe:** Investigaciones en segundo plano, usuario puede seguir chateando
- **Subject-aware:** Numéricas → andamiaje; Teóricas → diálogo + mapeo
- **Health-caution:** Temas salud/medicina → disclaimer educativo obligatorio
- **Verify-before-done:** Verificar archivo existe antes de decir "listo para descargar"
- **No romper existente:** Mantener compatibilidad con flujo actual de RED (documentos, URLs, deep research)
- **Sin inventar rutas:** Respetar estructura existente del proyecto

---

## 11. Plan de Implementación por Fases

| Fase | Acción | Responsable | Criterio de Éxito |
|---|---|---|---|
| **Fase 0** | **Auditoría** - Leer coco_rojo.py, android.ts, session_memory, BotEngine | Agente | Entender flujo completo sin editar |
| **Fase 1** | **Aprobar SPEC** - Revisar y ajustar con usuario | Usuario+Agente | SPEC aprobado explícitamente |
| **Fase 2** | **Backend Foundation** - Añadir detección de modo, `learningMemory` estructura, hints ladder base | Agente | Código compila, no rompe tests existentes |
| **Fase 3** | **Modos Tutor/Learn** - Implementar `debug_my_answer`, `feynman_check`, `build_syllabus` | Agente | Funciona con/sin archivos según modo |
| **Fase 4** | **Modo Research Background** - Job system + outline approval + subagente background + export | Agente | Genera archivo descargable en segundo plano |
| **Fase 5** | **Frontend UI** - Modal modos, paneles, header, acciones rápidas | Agente | UI funcional, responsive |
| **Fase 6** | **Testing & Verificación** - Probar los 4 escenarios del punto 2 | Agente | Todos los escenarios funcionan sin romper chat/HQ |
| **Fase 7** | **Limpieza** - Revisar diff, verificar build/lint | Agente | Sin errores, cambios mínimos y enfocados |

---

## 12. Archivos a Modificar

| Archivo | Cambio | Riesgo |
|---|---|---|
| `server-staging/cocos/coco_rojo.py` | Añadir modos, hints ladder, background jobs, export | **Medio** - Core del agente |
| `server-staging/session_memory.py` | Extender para `learningMemory`, `researchJobs`, `hintState` | **Bajo-Medio** |
| `server-staging/api/routers/chat.py` | Pasar `red_mode` y `learning_memory` al agente | **Bajo** |
| `windows/src/android/android.ts` | Modales, paneles, estado, UI RED | **Medio** |
| `windows/src/android/android.css` | Estilos para nuevos modales/paneles | **Bajo** |

**Archivos nuevos (opcionales):**
- `server-staging/cocos/red_tools.py` - Herramientas pedagógicas (mantener separado)
- `server-staging/utils/research_export.py` - Export MD/PDF/DOCX

---

## 13. Criterios de Aceptación

### Escenario 1: Con apuntes + numérico
- [ ] Selecciona modo Tutor al tener archivo
- [ ] Pregunta intento antes de resolver
- [ ] Usa hints ladder correctamente
- [ ] Prioriza contenido del PDF
- [ ] Puede corregir con `debug_my_answer`

### Escenario 2: Con apuntes + teórico (Filosofía/Historia)
- [ ] Genera mapas argumentales/conceptuales
- [ ] Pregunta para razonar, no solo memorizar
- [ ] Basa respuesta en apuntes primero
- [ ] Usa diálogo socrático

### Escenario 3: Sin apuntes + aprender desde cero
- [ ] Modal permite seleccionar "Aprender desde cero"
- [ ] Genera syllabus editable
- [ ] Usa Técnica Feynman
- [ ] Crea glosario
- [ ] Funciona sin archivos

### Escenario 4: Sin apuntes + generar informe en segundo plano
- [ ] Modal "Investigar y generar informe"
- [ ] Genera **outline** para aprobar ANTES de escribir completo
- [ ] Muestra progreso por etapas
- [ ] Usuario puede seguir chateando
- [ ] Genera archivo `.PDF`/`.DOCX`/`.MD` descargable
- [ ] Aparece en panel "Investigaciones"

---

## Estado

**SPEC COMPLETADO - PENDIENTE DE APROBACIÓN**

Revisalo y decime:
- ¿Ajustar algo?
- ¿Agregar/quitar funcionalidades?
- ¿OK para pasar al backlog y empezar Fase 2?
