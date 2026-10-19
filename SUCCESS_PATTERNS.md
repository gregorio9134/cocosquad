# COCO SQUAD - COMPENDIO DE CASOS DE ÉXITO Y PATRONES PROBADOS (SUCCESS_PATTERNS.md)

Este documento consolida la línea base arquitectónica, funcional y estética del proyecto. Cualquier nuevo desarrollo, extensión o refactorización debe reutilizar estos patrones probados y respetar sus garantías técnicas.

---

## Caso 1: Identidad Visual y Splash Nativo

- **Objetivo:** Proporcionar un arranque de aplicación nativo, fluido y sin parpadeos, estableciendo la identidad visual de Coco Squad en entornos PWA y desktop.
- **Implementación Técnica:**
  - **Estructura del Splash:** Contenedor `#splash-screen` con overlay de fondo oscuro (`#0b0d14`), desenfoque y logo transparente oficial centrado.
  - **Temporización de Retención:** 1.2 segundos fijos de presencia tras la carga inicial (`initApp`), seguido de una transición de salida suave con clase `.fade-out` y remoción completa del nodo en 420 ms.
  - **Contenedor Centrado PWA:** El diseño completo vive dentro de `#app` con `max-width: 440px`, centrado horizontalmente en pantallas anchas y ajustado a `100vh` con variables `--safe-top` y `--safe-bottom` en dispositivos móviles.
- **Archivos de Referencia:**
  - [index.html](file:///Users/Gregorio/Desktop/coco%20squad/windows/index.html)
  - [android.ts](file:///Users/Gregorio/Desktop/coco%20squad/windows/src/android/android.ts#L3050-L3065)
  - [android.css](file:///Users/Gregorio/Desktop/coco%20squad/windows/src/android/android.css)

---

## Caso 2: Coreografía Squad Assist Funcional

- **Objetivo:** Representar visualmente la colaboración interdisciplinaria entre agentes sin ensuciar la conversación del agente derivador.
- **Implementación Técnica:**
  - **Detección:** El backend o el evaluador de frontend identifica una derivación mediante el comando `DELEGAR:agente|instrucción` o reglas de threshold.
  - **Actor Efímero:** Se genera un elemento temporal (`squad-ephemeral-actor`) posicionado en coordenadas absolutas sobre el avatar del especialista en la barra superior.
  - **Vuelo Parabólico:** Animación con curva elástica `cubic-bezier(0.18, 0.9, 0.32, 1.25)` hacia la última burbuja del chat del agente emisor.
  - **Micro-Globo de Diálogo:** Se despliega un bocadillo flotante con glassmorphism (`squad-ephemeral-speech-balloon`) con el texto *"¡Yo me encargo!"* durante 1300 ms.
  - **Retorno Limpio:** El actor vuela de regreso a su chip en la barra superior (`mochi-returned-pulse`), se destruyen los elementos temporales del DOM y no queda ningún mensaje permanente del especialista en el chat de origen.
- **Archivos de Referencia:**
  - [android.ts](file:///Users/Gregorio/Desktop/coco%20squad/windows/src/android/android.ts#L1520-L1595) (`executeEphemeralSquadAssist`)
  - [android.css](file:///Users/Gregorio/Desktop/coco%20squad/windows/src/android/android.css#L2475-L2530)

---

## Caso 3: Navegación Automática Post-Handoff

- **Objetivo:** Conducir al usuario de manera intuitiva y sin fricción al espacio de trabajo del especialista que resolverá su consulta.
- **Implementación Técnica:**
  - **Transición Programática:** Al concluir la animación de retorno del Squad Assist, se ejecuta síncronamente `this.selectSquadMember(summonedMember)`.
  - **Aislamiento de Contexto:** Cada agente posee su propio almacén reactivo `chatHistories[agentId]`. El informe del especialista (e.g., investigación profunda de Red, balances de Blu o gestión de turnos de Green) se renderiza única y exclusivamente en su sala.
  - **Sincronización de Estado:** Se actualizan dinámicamente las variables CSS globales (`--coco-accent`, `--coco-glow`, `--coco-bg-tint`), el título del encabezado, el placeholder del chat y el canvas del Mochi activo.
- **Archivos de Referencia:**
  - [android.ts](file:///Users/Gregorio/Desktop/coco%20squad/windows/src/android/android.ts#L1085-L1145) (`selectSquadMember`)

---

## Caso 4: Animación de Devorar no Invasiva

- **Objetivo:** Transmitir la ingesta táctil de archivos y documentos sin deformar la geometría anatómica del Mochi ni provocar fallos de renderizado facial.
- **Implementación Técnica:**
  - **Transformación CSS Pura:** Squash & stretch elástico aplicado sobre el contenedor `#avatar-btn` mediante `transform: scale(1.15, 0.85)` y rebote de amortiguación hacia `scale(1)` vía curva de elasticidad.
  - **Inmutabilidad del Canvas:** Las dimensiones del buffer ($80\times 80$ px) y de pantalla ($40\times 40$ px) se mantienen fijas y nunca se reinicializan dentro de `triggerDevourAnimation`.
  - **Integridad Facial:** Prohibición absoluta de dibujar tajos o aberturas de boca en el canvas 2D durante o después del efecto. Ambos ojos simétricos ($x=32\%$ y $x=68\%$) permanecen visibles e inalterados en todo momento.
- **Archivos de Referencia:**
  - [android.ts](file:///Users/Gregorio/Desktop/coco%20squad/windows/src/android/android.ts#L840-L900) (`triggerDevourAnimation`)
  - [android.css](file:///Users/Gregorio/Desktop/coco%20squad/windows/src/android/android.css) (`@keyframes devourSquash`)

---

## Caso 5: Bóveda Local Zero-Storage

- **Objetivo:** Garantizar la máxima privacidad del usuario al procesar y almacenar documentos médicos, comerciales o personales, sin comprometer datos en la nube.
- **Implementación Técnica:**
  - **Persistencia Client-Side:** Base de datos IndexedDB `CocoVaultDB` con almacén de objetos `vault_files` que guarda el binario, tipo MIME, nombre, tamaño y páginas estimadas.
  - **Criptografía en Cliente:** Generación de huella hash SHA-256 única mediante `crypto.subtle.digest("SHA-256", buffer)` en el navegador.
  - **Regla Zero-Storage en Oracle:** El backend (`fastapi_server.py`) recibe los adjuntos en memoria RAM (`io.BytesIO`), ejecuta la inferencia de IA y descarta el payload. Queda terminantemente prohibido escribir en `/tmp` o almacenamiento persistente del servidor.
  - **UI de Gestión:** Tarjeta de visualización en la pestaña de Tareas con contador dinámico, botón de consulta directa en el chat y eliminación local en un solo toque.
- **Archivos de Referencia:**
  - [vault.ts](file:///Users/Gregorio/Desktop/coco%20squad/windows/src/android/vault.ts)
  - [android.ts](file:///Users/Gregorio/Desktop/coco%20squad/windows/src/android/android.ts#L1675-L1765) (`renderVaultDocuments`)

---

## Caso 6: Umbral Estricto de Lectura de Coco Blanco

- **Objetivo:** Definir la frontera de capacidad de Coco Blanco (asistente ágil y de productividad) frente a Red (investigador técnico exhaustivo).
- **Implementación Técnica:**
  - **Límites de Evaluación:** Documentos con peso $\le 2\text{ MB}$ y extensión estimada de $\le 4\text{ páginas}$ de texto son absorbidos y analizados directamente en el chat de Coco Blanco.
  - **Disparador de Delegación:** Si el archivo excede los $2\text{ MB}$ o supera las $4\text{ páginas}$, Coco Blanco emite el mensaje de derivación oficial (*"Ese documento extenso e investigación lo analiza Red. Ya se lo derivo para un informe exhaustivo."*) y transfiere el archivo automáticamente a Red activando el Squad Assist.
  - **Blindaje en Entrada:** Inspección con `evaluateCocoDocumentThreshold(file)` y extracción previa con `getDocumentPageCount(file)`.
- **Archivos de Referencia:**
  - [fileGuard.ts](file:///Users/Gregorio/Desktop/coco%20squad/windows/src/android/fileGuard.ts)
  - [android.ts](file:///Users/Gregorio/Desktop/coco%20squad/windows/src/android/android.ts#L2980-L3040) (`processFileToDevour`)

---

## Caso 7: Modo Fundador (God Mode) y Telemetría en Blu

- **Objetivo:** Proporcionar un perfil de control maestro para el tenant raíz (`tenant_id = 1`, `is_founder: true`) con cuota ilimitada, bypass total de rate limits y acceso transparente a la telemetría operativa y métricas de red mediante Blu.
- **Implementación Técnica:**
  - **Identificación y Bypass Backend:** En `fastapi_server.py`, toda petición con cabecera `x-tenant-id: 1` o parámetro `tenant_id=1` se valida como Fundador. Se intercepta `limiter._check_request_limit` para eximir completamente de límites de tasa a este rol.
  - **Endpoint de Telemetría Protegido:** `/api/founder/telemetry` valida `tenant_id == 1` (retorna HTTP 403 Forbidden para otros tenants). Provee estadísticas de total de mensajes atendidos, desglose por agente (Coco, Green, Red, Blu), total de intervenciones Squad Assist y estado del servidor.
  - **Consultas Ejecutivas en Blu:** En `cocos/coco_azul.py` y `android.ts`, ante consultas sobre telemetría, métricas de red o estado del sistema, Blu consulta el endpoint `/api/founder/telemetry` y formatea un balance ejecutivo financiero/operativo.
  - **Distintivo en UI y Respeto de Morfología:** En `android.ts`, si `tenant_id === 1`, se muestra el badge dorado `👑 Fundador` en la cabecera. Se preservan estrictamente los 2 ojos simétricos del Mochi ($80\times 80$ buffer, $40\times 40$ CSS) y el flujo único de chat vertical.
- **Archivos de Referencia:**
  - [fastapi_server.py](file:///Users/Gregorio/Desktop/coco%20squad/windows/scripts/fastapi_server.py)
  - [coco_azul_updated.py](file:///Users/Gregorio/Desktop/coco%20squad/windows/scripts/coco_azul_updated.py)
  - [android.ts](file:///Users/Gregorio/Desktop/coco%20squad/windows/src/android/android.ts#L463-L466)
  - [android.css](file:///Users/Gregorio/Desktop/coco%20squad/windows/src/android/android.css#L1070-L1085)

