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

---

## Caso 8: Autenticación Multi-Tenant y Aislamiento por Token JWT

- **Objetivo:** Garantizar la segregación estricta de datos entre inquilinos (tenants) mediante tokens criptográficos JWT estándar (HS256), manteniendo bypass ilimitado para el Fundador (`tenant_id = 1`) y cuotas/aislamiento para clientes externos.
- **Implementación Técnica:**
  - **Emisión y Validación JWT:** En `fastapi_server.py`, funciones `create_jwt_token` y `decode_jwt_token` con soporte dual (PyJWT y HMAC-SHA256 nativo).
  - **Endpoints de Autenticación:**
    - `POST /api/auth/login`: Autentica email, sincroniza con `database/master.db` y devuelve token firmado con `{ "tenant_id": int, "email": str, "plan": str, "is_founder": bool }`.
    - `GET /api/auth/me`: Dependencia `get_current_tenant` valida `Authorization: Bearer <token>` y extrae el perfil del usuario autenticado.
  - **Inyección de Dependencia:** `get_current_tenant` protege endpoints y aisla el almacenamiento, garantizando que el Fundador mantenga cuota ilimitada sin interferir con otros tenants.
  - **Frontend UI & Tokens:** En `android.ts`, almacenamiento persistente en `localStorage` (`auth_token`, `tenant_id`, `user_email`, `user_plan`) e inclusión automática de `Authorization: Bearer <token>` y `x-tenant-id` en todas las peticiones a la API.
- **Archivos de Referencia:**
  - [fastapi_server.py](file:///Users/Gregorio/Desktop/coco%20squad/windows/scripts/fastapi_server.py)
  - [android.ts](file:///Users/Gregorio/Desktop/coco%20squad/windows/src/android/android.ts)
  - [android.css](file:///Users/Gregorio/Desktop/coco%20squad/windows/src/android/android.css)

---

## Caso 9: Pasarela de Cobros Híbrida (Mercado Pago + Stripe)

- **Objetivo:** Habilitar monetización flexible con soporte de facturación local en pesos argentinos (Mercado Pago / ARS) y suscripciones internacionales recurrentes en dólares (Stripe / USD).
- **Implementación Técnica:**
  - **Módulo Backend (`billing.py`):**
    - `POST /api/billing/checkout/mercadopago`: Genera preferencia de pago en Mercado Pago por $29.900 ARS/mes con `external_reference = tenant_id`.
    - `POST /api/billing/checkout/stripe`: Genera sesión de Stripe Checkout por $29.00 USD/mes con `client_reference_id = tenant_id`.
    - `POST /api/billing/webhook/mercadopago` y `POST /api/billing/webhook/stripe`: Receptores de confirmación de pago que actualizan inmediatamente el estado del tenant en `subscriptions` a `plan = 'pro'`.
    - `GET /api/billing/status`: Consulta del estado actual de suscripción y precios disponibles.
  - **Componente de Suscripción en UI:** Modal dark glassmorphism integrado (`#auth-modal-card`), selector de moneda y pasarela con pills interactivos, enlace directo que no rompe la experiencia PWA (`window.open(url, '_blank')`) y opción de simulación inmediata para pruebas.
  - **Inmutabilidad y No-Regresión:** Morfología Mochi intacta con 2 ojos simétricos ($80\times 80$ buffer, $40\times 40$ CSS), política Zero-Storage estricta en Oracle y diseño en contenedor vertical centrado.
- **Archivos de Referencia:**
  - [billing.py](file:///Users/Gregorio/Desktop/coco%20squad/windows/scripts/billing.py)
  - [fastapi_server.py](file:///Users/Gregorio/Desktop/coco%20squad/windows/scripts/fastapi_server.py)
  - [android.ts](file:///Users/Gregorio/Desktop/coco%20squad/windows/src/android/android.ts)
  - [android.css](file:///Users/Gregorio/Desktop/coco%20squad/windows/src/android/android.css)

---

## Caso 10: Switch Rápido Fundador vs Cliente Regular y Gating de Telemetría en Blu

- **Objetivo:** Permitir alternar de forma síncrona e instantánea entre el Modo Fundador (`tenant_id = 1`, `is_founder = true`) y un Cliente Regular (`tenant_id = 2`, `plan = 'free'`, `is_founder = false`), validando la experiencia de usuario diferenciada, el gating de permisos en Blu y la visibilidad de planes de pago.
- **Implementación Técnica:**
  - **Switch Rápido en UI (`android.ts`, `android.css`):**
    - Añadidos botones directos en `#pane-login` (`#btn-auth-quick-founder` y `#btn-auth-quick-regular`) y en la vista de tareas/configuración (`#page-tasks`).
    - Al pulsar cada botón, se invoca `switchAccount(tenantId, email, plan, isFounder)`, emitiendo/guardando el token JWT correspondiente en `localStorage` y actualizando de inmediato la UI.
  - **Diferenciación Visual en Header (`updateHeaderBadge`):**
    - Modo Fundador: Muestra insignia dorada `👑 Fundador` con animación de brillo suave.
    - Cliente Regular: La insignia de fundador desaparece por completo y se reemplaza por el badge verde esmeralda `🌱 Cliente Regular` (`.founder-badge.client-badge`).
  - **Gating de Telemetría Global en Blu (`coco_azul.py` / `android.ts`):**
    - Fundador: Consultas sobre "telemetría", "métricas de red" o "estado del sistema" devuelven el informe financiero/operativo ejecutivo completo.
    - Cliente Regular: Rechazo cortés e informativo con `🔒 Acceso Denegado · Modo Fundador Requerido`, informando que la telemetría global está restringida a Tenant #1 e invitando a mejorar a Plan PRO.
  - **Selector de Planes Activo:**
    - Para el Cliente Regular, la vista de suscripción expone de forma destacada la tarjeta de Plan Free (20 mensajes/min) y el selector interactivo de planes para Mercado Pago ($29.900 ARS/mes) y Stripe ($29.00 USD/mes).
- **Archivos de Referencia:**
  - [android.ts](file:///Users/Gregorio/Desktop/coco%20squad/windows/src/android/android.ts)
  - [android.css](file:///Users/Gregorio/Desktop/coco%20squad/windows/src/android/android.css)
  - [coco_azul.py](file:///Users/Gregorio/Desktop/coco%20squad/windows/scripts/coco_azul_updated.py)

---

## Caso 11: Quick Wins Fase 1 (Webhooks Desacoplados, Campos Fiscales en MP y Micro-Tour de Onboarding)

- **Objetivo:** Resolver los tres cuellos de botella prioritarios identificados en las pruebas de saturación y simulación de mercado para preparar el lanzamiento comercial.
- **Implementación Técnica:**
  - **Webhooks Asíncronos Desacoplados (`fastapi_server.py`):**
    - Rutas `/api/webhooks/whatsapp`, `/api/webhooks/instagram`, `/api/webhooks/tiktok` devuelven síncronamente `{"status": "received", "channel": channel, "queued": true}` en $< 50\text{ ms}$ con HTTP 200.
    - La ejecución pesada de inferencia comercial de Coco Verde se delega a `fastapi.BackgroundTasks` (`process_webhook_background`), eliminando timeouts de pasarelas de mensajería bajo saturación.
  - **Soporte Fiscal para Factura A / CUIT en Mercado Pago (`billing.py` / `android.ts`):**
    - En `billing.py`, el modelo `CheckoutRequest` incorpora `cuit`, `condicion_fiscal` y `razon_social`. Se guardan en la tabla `tenants` y se inyectan en los metadatos de la preferencia de pago de Mercado Pago.
    - En `android.ts`, la tarjeta de pago ARS incluye un formulario opcional con selector de Condición Fiscal (Consumidor Final, Responsable Inscripto - Factura A, Monotributo) y CUIT.
  - **Micro-Tour de Onboarding Guiado (`android.ts` / `android.css`):**
    - Despliegue automático 1.4 s tras inicio si `!localStorage.getItem('onboarding_completed')`.
    - Tour interactivo de 3 pasos:
      1. Asistente general Coco Blanco (texto o arrastrar archivos).
      2. Intervención interdisciplinaria Squad Assist (Green, Red, Blu).
      3. Privacidad Zero-Storage en RAM y navegador.
    - Botón "Entendido" que graba `onboarding_completed = true` en `localStorage` y destruye el modal con transición suave sin alterar la morfología visual ni los 2 ojos simétricos del Mochi.
- **Archivos de Referencia:**
  - [fastapi_server.py](file:///Users/Gregorio/Desktop/coco%20squad/windows/scripts/fastapi_server.py)
  - [billing.py](file:///Users/Gregorio/Desktop/coco%20squad/windows/scripts/billing.py)
  - [android.ts](file:///Users/Gregorio/Desktop/coco%20squad/windows/src/android/android.ts)
  - [android.css](file:///Users/Gregorio/Desktop/coco%20squad/windows/src/android/android.css)

---

## Caso 12: Simulación de Mercado y Validación Cuantitativa Fase 2 (MiroFish OASIS)

- **Objetivo:** Auditar empíricamente el impacto de los Quick Wins de Fase 1 (webhooks desacoplados, CUIT/Factura A en Mercado Pago y Micro-Tour) mediante una población de 100 agentes sintéticos en 4 cohortes a 30 días y pruebas reales de concurrencia.
- **Implementación Técnica:**
  - **Runner de Simulación (`scripts/simulation/mirofish_coco_sim_v2.py`):**
    - Ejecuta pruebas concurrentes HTTP (10, 25, 50, 75 hilos) contra el servidor de producción validando latencias medianas y percentiles p95.
    - Simula el ciclo de vida de 100 agentes estructurados en 4 cohortes: Salud (25), Academia (25), Retail/D2C (25), Servicios B2B (25).
    - Aplica las tasas de retención por etapa (D1, D3, D7, D14, D30), conversión a PRO, scoring de NPS sintético (S-NPS) y coeficiente de viralidad (K-Factor).
  - **Resultados Validados:**
    - Latencia de webhooks reducida en un 99.5% (de 7,244 ms a 38.2 ms).
    - Tasa de éxito bajo concurrencia extrema (75 hilos) elevada de 23.0% a 100.0%.
    - Conversión a Plan PRO aumentada de 34.0% a 59.0% (con 84% de adopción en PyMEs y Comercios).
    - Retención D1 del 100.0% y Retención D30 del 88.0%.
    - S-NPS consolidado elevado a **+64.8** (rango de excelencia) y K-Factor de **1.2** (crecimiento orgánico autosostenible).
- **Archivos de Referencia:**
  - [mirofish_coco_sim_v2.py](file:///Users/Gregorio/Desktop/coco%20squad/scripts/simulation/mirofish_coco_sim_v2.py)
  - [SIMULATION_FEEDBACK_REPORT_V2.md](file:///Users/Gregorio/Desktop/coco%20squad/SIMULATION_FEEDBACK_REPORT_V2.md)

---

## Caso 13: Modelo de Precios Segmentado y Programa de Referidos Escalonado (MiroFish V3)

- **Objetivo:** Proyectar la viabilidad financiera, el coeficiente de contagio viral y la retención a 90 días combinando un precio accesible para estudiantes ($9.900 ARS) con un precio PyME ($24.900 ARS) y una mecánica de descuentos por referidos de +5% por colega activo hasta el 25% OFF.
- **Implementación Técnica:**
  - **Runner de Simulación (`scripts/simulation/mirofish_referrals_sim_v3.py`):**
    - Simula 100 agentes en 4 cohortes ponderadas: Estudiantes (40%), Emprendedores D2C (30%), Profesionales (20%), PyMEs (10%).
    - Modela el ciclo en 5 hitos: Día 1 (onboarding), Día 14 (conversión con 15% OFF inicial), Día 30 (primer ciclo de referidos), Día 60 (acumulación de escalones), Día 90 (madurez y retención).
    - Evalúa el tope del 25% OFF como barrera de 'costo hundido' frente a planes gratuitos al 100%.
  - **Resultados Consolidados:**
    - Conversión a pago global a Día 90: **73.0%** (29 Starter / 44 PRO).
    - Tasa de penetración del programa de referidos: **71.2%** de los clientes de pago tienen $\ge 1$ referido activo.
    - K-Factor supercrítico: **1.51** (desata viralidad autosostenible sin dependencia de pauta publicitaria).
    - Churn mensual promedio: **2.8%** (0.8% en usuarios con descuento activo vs. 4.2% sin descuento).
    - S-NPS proyectado: **+56.4** (58 Promotores, 31 Pasivos, 5 Detractores).
    - Escala 1.000 clientes: **$17.753.424 ARS/mes (~$14.202 USD/mes MRR)** con **97.2% de margen neto operativo** tras costos de inferencia ($450 ARS/usuario).
- **Archivos de Referencia:**
  - [mirofish_referrals_sim_v3.py](file:///Users/Gregorio/Desktop/coco%20squad/scripts/simulation/mirofish_referrals_sim_v3.py)
  - [SIMULATION_REFERRALS_REPORT_V3.md](file:///Users/Gregorio/Desktop/coco%20squad/SIMULATION_REFERRALS_REPORT_V3.md)

---

## Caso 14: Simulación de Afiliados Multinivel y Economía de Red (MiroFish V4)

- **Objetivo:** Cuantificar el impacto del pasaje a un modelo de afiliados de 3 niveles (Nivel 1: 12%, Nivel 2: 5%, Nivel 3: 3%; 20% comisionado total) con condición de suscripción activa obligatoria ("lucro cesante"), sobre 100 agentes en 4 cohortes regionales a 90 días.
- **Implementación Técnica:**
  - **Runner de Simulación (`scripts/simulation/mirofish_affiliates_sim_v4.py`):**
    - Modela 100 agentes ponderados: Estudiantes (40%), Comercios D2C (30%), Profesionales (20%), PyMEs (10%).
    - Simula la cascada de referidos en 3 niveles de profundidad: L1 (12%), L2 (5%), L3 (3%).
    - Computa el efecto psicológico de lucro cesante (retención atada a comisiones devengadas $\ge$ costo de suscripción).
    - Monitorea fricción de reputación de marca según denominación ("Red Multinivel" vs "Programa de Partners Oficiales").
  - **Resultados Consolidados:**
    - K-Factor Directo (L1): **1.84** (+21.8% vs V3).
    - K-Factor de Red Total (L1+L2+L3): **2.48** (+64.2% de expansión horizontal).
    - Penetración de afiliados cobrando comisiones: **76.7%**.
    - Usuarios "Auto-pagados" (comisión mensual $\ge$ cuota de plan): **34.2%** de los clientes.
    - Churn mensual en usuarios comisionados: **0.2%** (vs 1.9% promedio global y 2.8% en V3).
    - Synthetic NPS (S-NPS): **+62.1** (+5.7 pts vs V3; +78 en estudiantes, +65 en D2C).
    - P&L a 1.000 clientes: **$19.200.000 ARS/mes (~$15.360 USD MRR)** con **75.1% de margen neto operativo ($14.399.200 ARS/mes libres)** tras deducir 15.2% de comisiones efectivas de red, 7.2% de pasarela Mercado Pago y $450 ARS/usuario de inferencia IA.
    - Tiempo proyectado para alcanzar 1.000 clientes: Reducido de 10 a **7 meses**.
- **Archivos de Referencia:**
  - [mirofish_affiliates_sim_v4.py](file:///Users/Gregorio/Desktop/coco%20squad/scripts/simulation/mirofish_affiliates_sim_v4.py)
  - [SIMULATION_AFFILIATES_REPORT_V4.md](file:///Users/Gregorio/Desktop/coco%20squad/SIMULATION_AFFILIATES_REPORT_V4.md)

---

## Caso 15: Orquestación Viva, Interacción Empática y Squad Dock de 4 Mochis (Pilar 1)

- **Objetivo:** Implementar la dinámica de interacción gestual, natural y empática entre los 4 Mochis (Pilar 1: Orquestación Viva y UX Afectiva) con hand-offs fluidos, micro-animaciones con física de resorte y un Squad Dock superior flotante que preserva la simetría inmutable de los avatares.
- **Implementación Técnica:**
  - **Módulo de Orquestación Backend (`windows/scripts/squad_orchestrator.py` & `fastapi_server.py`):**
    - Analiza de forma síncrona el mensaje y archivos adjuntos clasificando el target entre los 4 agentes.
    - Cuando Coco Blanco recibe una tarea especializada, genera una secuencia temporal (`timeline`) con reconocimiento afectivo (`acknowledgement`), salto y pase de manos (`hand_off`), activación de loader personalizado (`loader_state`) y respuesta del especialista (`response`).
    - Expuesto en FastAPI bajo `@app.post("/api/squad/interact")`.
  - **Micro-Animaciones CSS con Física de Resorte (`android.css`):**
    - `@keyframes mochi-breathe`: respiración tierna elástica (escala 1.04, 0.96) en reposo.
    - `@keyframes mochi-hop`: salto alegre de transición y pase de manos (`translateY(-16px)` con amortiguación cúbica).
    - `@keyframes mochi-hand-off`: transición visual suave con estela y halo de color del Mochi activo.
    - `.squad-dock-capsule`: cápsula flotante redondeada con los 4 Mochis interactivos, halo brillante de foco y micro-acciones independientes a 60 FPS en canvas 2D.
  - **Línea de Tiempo del Chat con Hand-Off & Loaders Personalizados (`android.ts`):**
    - Cada mensaje asistente renderiza el avatar, nombre, rol y badge coloreado del Mochi emisor.
    - Indicador de carga dinámico adaptado al especialista: 📖 Libro abierto para Red (lectura concentrada), 💬 Señal vivaz para Verde (WhatsApp y canales), 📊 Balance para Blu (precisión y números) y ⚪ Respiración para Blanco (coordinación).
    - Clic directo en cualquiera de los 4 avatares del dock para fijar o conmutar la conversación con ese Mochi (@mochi).
- **Archivos de Referencia:**
  - [squad_orchestrator.py](file:///Users/Gregorio/Desktop/coco%20squad/windows/scripts/squad_orchestrator.py)
  - [fastapi_server.py](file:///Users/Gregorio/Desktop/coco%20squad/windows/scripts/fastapi_server.py)
  - [android.ts](file:///Users/Gregorio/Desktop/coco%20squad/windows/src/android/android.ts)
  - [android.css](file:///Users/Gregorio/Desktop/coco%20squad/windows/src/android/android.css)
  - [state.ts](file:///Users/Gregorio/Desktop/coco%20squad/windows/src/core/state.ts)

---

## Caso 16: Resolución Definitiva de Extracción de PDF en RAM, Memoria de Sesión Contextual y Delegación Encadenada sin Regresiones

- **Objetivo:** Erradicar de raíz los tres defectos críticos de producción detectados en Oracle Cloud (`http://150.136.59.173:8080`):
  1. Extracción real de texto plano de PDFs en memoria RAM eliminando alucinaciones de búsqueda web (Soda Stereo / Costa Rica) y fugas de prompts (`# DOSSIER...`, `INSTRUCCIONES ESTRICTAS...`).
  2. Eliminación de la amnesia de sesión ante preguntas de seguimiento sobre documentos analizados (`"¿qué podés decirme del punto 1.6?"`).
  3. Eliminación de la falsa delegación de Blanco a Red, garantizando ejecución encadenada síncrona en la misma petición HTTP.
- **Implementación Técnica:**
  - **Extractor Multi-Tier en RAM (`windows/scripts/pdf_extractor.py`):**
    - Deserializa el buffer base64 directamente en memoria RAM sin escribir en disco.
    - Cascada de extracción: `pypdf` -> `pdfplumber` -> `pymupdf (fitz)` -> `PyPDF2` -> fallback OCR Gemini.
    - Si el archivo no contiene texto digital seleccionable, aborta con error informativo y prohíbe taxativamente la búsqueda en la web o Wikipedia.
  - **Buffer de Memoria de Sesión y Sanitizador (`windows/scripts/session_memory.py`):**
    - Mantiene en RAM (`SessionMemoryBuffer`) por `chat_id` / `session_id` el último documento procesado (nombre, texto plano, timestamp) y hasta 12 turnos recientes.
    - Cuando el usuario realiza una pregunta de seguimiento sin re-adjuntar el archivo, el backend detecta el contexto previo y reconstituye el prompt inyectando `[DOCUMENTO PREVIO EN SESIÓN ({nombre})]: {texto_extraido}` con instrucción de anclaje estricto.
    - Sanitizador regex `clean_prompt_artifacts` que depura cualquier directiva interna, metacomentario o plantilla filtrada.
  - **Coco Rojo Grounded y Desacoplado de Búsqueda Web (`windows/scripts/coco_rojo_updated.py`):**
    - `CocoRojo._procesar_tarea`: Si el contexto incluye archivo, texto extraído o documento previo en sesión, omite `DeepResearchTool` y ejecuta `engine.procesar_mensaje_texto` con `web_search=False` y modo analista académico riguroso.
  - **Delegación Encadenada en Endpoints (`api/routers/chat.py` & `squad_orchestrator.py`):**
    - En `/agente/blanco`, `/api/chat` y `/api/squad/interact`, si Blanco recibe un archivo técnico o PDF, delega la ejecución de forma inmediata a Coco Rojo en el mismo ciclo de petición, entregando el análisis real de Red al cliente sin intermediación ni dead-ends.
  - **Validación en Producción (Oracle Staging `150.136.59.173:8080`):**
    - Test 1 (Extracción & Cero Alucinación): PDF de Burgos analizado exclusivamente desde su texto. Soda Stereo/Costa Rica: `False`. Fugas de prompt: `False`.
    - Test 2 (Memoria de Sesión): Pregunta "¿qué podés decirme del punto 1.6?" respondió con desglose conceptual exacto de la frase de Burgos sin amnesia (`False`).
    - Test 3 (Delegación Encadenada): Llamada a Blanco devolvió `coco_id: coco_rojo` con análisis substantive completo (`is_fake = False`, `has_analysis = True`).
- **Archivos de Referencia:**
  - [pdf_extractor.py](file:///Users/Gregorio/Desktop/coco%20squad/windows/scripts/pdf_extractor.py)
  - [session_memory.py](file:///Users/Gregorio/Desktop/coco%20squad/windows/scripts/session_memory.py)
  - [squad_orchestrator.py](file:///Users/Gregorio/Desktop/coco%20squad/windows/scripts/squad_orchestrator.py)
  - [coco_rojo_updated.py](file:///Users/Gregorio/Desktop/coco%20squad/windows/scripts/coco_rojo_updated.py)
  - [chat_router_updated.py](file:///Users/Gregorio/Desktop/coco%20squad/windows/scripts/chat_router_updated.py)
  - [fastapi_server.py](file:///Users/Gregorio/Desktop/coco%20squad/windows/scripts/fastapi_server.py)
  - [android.ts](file:///Users/Gregorio/Desktop/coco%20squad/windows/src/android/android.ts)

---

## Caso 17: Infraestructura HTTPS para Pruebas Móviles, PWA Standalone y Túnel Cloudflare

- **Objetivo:** Permitir la ejecución y prueba de Coco Squad PWA en teléfonos móviles (iOS / Android) con soporte completo de cámara (WebRTC / `getUserMedia`), instalación en pantalla completa ("Agregar a pantalla de inicio") y extracción documental conectada.
- **Implementación Técnica:**
  - **Instalación y Orquestación de Cloudflared:**
    - Binario oficial `cloudflared` instalado en `/usr/local/bin/cloudflared` en Oracle Cloud.
    - Script `start_tunnel.sh`: inicia túnel efímero no bloqueante apuntando a `http://127.0.0.1:8080`, parsea dinámicamente la URL `https://*.trycloudflare.com` y la almacena en `tunnel_url.txt`.
    - Script `stop_tunnel.sh`: detiene el proceso de túnel limpiando descriptores.
  - **Configuración PWA & Web Contexts:**
    - Servido de `manifest.json` y `sw.js` con soporte tanto para `GET` como para `HEAD` en `fastapi_server.py`.
    - Iconos de alta resolución (`128x128.png`, `icon.png`) disponibles en la raíz y `/icons/`.
    - Conexión segura TLS 1.3 que activa automáticamente los permisos de hardware para la cámara WebRTC en móviles.
  - **Verificación en Producción:**
    - Endpoint público verificado: `https://contents-buses-profession-reasoning.trycloudflare.com`
    - Carga de PWA: `/version.json`, `/manifest.json`, `/sw.js` retornaron HTTP 200 OK.
    - Flujo E2E móvil: subida de PDF, extracción en RAM (`[CONTENIDO DEL DOCUMENTO ADJUNTO]`), consulta sobre punto 1.6 y estado de memoria `/api/session/mobile_user_session_777` validados al 100%.
- **Archivos de Referencia:**
  - [start_tunnel.sh](file:///Users/Gregorio/Desktop/coco%20squad/windows/scripts/start_tunnel.sh)
  - [stop_tunnel.sh](file:///Users/Gregorio/Desktop/coco%20squad/windows/scripts/stop_tunnel.sh)
  - [manifest.json](file:///Users/Gregorio/Desktop/coco%20squad/windows/public/manifest.json)
  - [fastapi_server.py](file:///Users/Gregorio/Desktop/coco%20squad/windows/scripts/fastapi_server.py)


## Caso 18: Sesión Honesta de Punta a Punta (Cliente ↔ Token ↔ Backend)

- **Objetivo:** Que "iniciar sesión" sea una condición real y verificable de punta a punta: el cliente refleja el estado real del token, `/api/chat` exige identidad del token (nunca del cuerpo) y ningún secreto del fundador queda escrito en el terminal, el transcript o el repositorio.
- **Implementación Técnica:**
  - **Identidad por token (backend):**
    - `api/dependencies.py` → `verify_session_or_internal(request)`: acepta `Bearer JARVIS_API_KEY` (llamadas internas servidor-a-servidor) o un JWT de tenant válido; devuelve la identidad resuelta desde el token.
    - `api/routers/chat.py` → `api_chat` depende de `verify_session_or_internal` y usa `sesion["tenant_id"]`. El `tenant_id` del cuerpo se ignora y el override `mode_req == 'recepcion'` se eliminó.
    - `fastapi_server.py` → `api_auth_login`: las cuentas fundador (`founder@cocosquad.ai`, `admin@cocosquad.ai`) reutilizan el inquilino 1 (`Coco Squad Global (Founder)`) y **no** insertan filas nuevas en `tenants`.
  - **Cliente honesto (PWA):**
    - `windows/src/android/android.ts`: `hasSession`/`tenantId`/`userPlan` derivan del token real; sello del encabezado con `badgeLabel()` → `🔒 Sin sesión` / `👑 Fundador` / `💎 Plan PRO` / `🌱 Tenant #N`.
    - `initAuth()` sin login silencioso; `loginUser()` exige contraseña para las cuentas fundador; `refreshProfile()` con 401 → `logout()` + aviso; `logout()` borra `auth_token`, `tenant_id`, `user_email` y `user_plan`.
    - `getAuthHeaders()` manda `Authorization: Bearer <auth_token>` y **nunca** `x-tenant-id`.
    - Flujo de archivos: 401 → el mensaje de espera se reemplaza por "🔒 Necesitás una sesión para analizar archivos. Iniciá sesión y lo intentamos de nuevo." (una sola vez, sin duplicar en el historial) y la sesión se cierra.
    - `showSessionNotice(mensaje, agregarAlChat = true)`: crea el historial del chat si no existía (si no, el aviso se perdía en silencio) y permite avisar sin duplicar el mensaje.
  - **Cero fuga de credenciales:**
    - Puente local de un solo uso en `127.0.0.1` que entrega la contraseña del fundador al navegador sin escribirla en el terminal, el transcript, la URL ni el repositorio.
  - **Verificación ejecutada (no declarativa):**
    - Servidor (staging `150.136.59.173:8080`): `/api/chat` sin token → 401 `{"detail":"Unauthorized"}`; con `JARVIS_API_KEY` → 400 (mensaje vacío); con JWT de fundador → 200 con respuesta real; con JWT de otro inquilino y `tenant_id: 1` en el cuerpo → 200 (manda el token); token adulterado → 401; login del fundador → `tenant_id 1`, `plan founder`, y `tenants` en DB **5 antes / 5 después** (no crea cuenta).
    - Navegador (traza de red real): `POST /api/chat → 401`, `POST /api/auth/login → 200`, `POST /api/chat → 200` con análisis real de imagen (la IA describe el contenido de la imagen), `POST /api/auth/login → 200` (cliente regular), `POST /api/squad/interact → 200`.
    - Estado visible en pantalla: "🔒 Sin sesión" al arrancar, "👑 Fundador" tras login, "🌱 Tenant #7" para cliente regular, aviso "🔒 Tu sesión expiró…" visible en el chat al caer el token, y "🔒 Sin sesión" + storage limpio tras cerrar sesión.
    - Suites: 22 tests locales en verde (`pytest tests/ -q`) y 3 tests en el servidor; `npx tsc --noEmit` con 0 errores; `npx vite build` OK.
- **Archivos de Referencia:**
  - [android.ts](file:///Users/Gregorio/Desktop/coco%20squad/windows/src/android/android.ts)
  - [bridge.ts](file:///Users/Gregorio/Desktop/coco%20squad/windows/src/core/bridge.ts)
  - [dependencies.py](file:///Users/Gregorio/Desktop/coco%20squad/server-staging/api/dependencies.py)
  - [chat.py](file:///Users/Gregorio/Desktop/coco%20squad/server-staging/api/routers/chat.py)
  - [fastapi_server.py](file:///Users/Gregorio/Desktop/coco%20squad/server-staging/fastapi_server.py)









## Caso 19: Entorno de Pruebas Reproducible y Cero Tests Saltados en Silencio

- **Objetivo:** Que la suite de tests del backend sea reproducible desde cero en cualquier máquina (incluido después de un reinicio) y que ningún test de seguridad pueda quedar sin ejecutarse sin que se note.
- **Implementación Técnica:**
  - **Entorno local reconstruible:** venv temporal en `$TMP/coco-venv` con `pytest`, `fastapi`, `uvicorn[standard]`, `python-jose`, `PyJWT`, `requests`, `python-multipart`, `httpx`, `python-dotenv`, `pydantic-settings`, `sentry-sdk` y `slowapi`. El `python-jose[cryptography]` con extra **no** instala en Python 3.9/macOS (compila `cryptography` con Rust y falla): se instala `python-jose` sin extra.
  - **Stub honesto de `jarvis_core`:** vive **fuera** del repo (en `$TMP/jarvis_stub/`) porque el módulo real solo está en el servidor y arrastra claves de proveedores. Expone `JarvisCoreEngine` (con `procesar_mensaje_texto`, `procesar_multimodal`, `chat_histories`, `chat_memory_db`, `es_maestro`, `tenant_id`, `nombre_empresa`, `learning_engine`, `stock_mgr`, `trading_engine`, `whatsapp_gateway`, `_guardar_aprendizaje`, `generar_mazo_flashcards`, `generar_quiz_estructurado`) y `buscar_web_en_tiempo_real`, con respuestas deterministas y **sin claves**.
  - **Comando de verificación:** `cd server-staging && PYTHONPATH="$TMP/jarvis_stub" "$TMP/coco-venv/bin/python" -m pytest tests/ -q -rs`.
- **Verificación ejecutada:**
  - Tras reconstruir el entorno: **22 passed, 0 skipped, 0 failed** (antes: 20 passed + 2 skipped por `sentry_sdk`/`slowapi` ausentes).
  - `python -m unittest tests.test_security tests.test_squad_orchestrator` → **19 tests OK**.
  - En el servidor de staging (`150.136.59.173`): **3 passed**, proceso `python3 fastapi_server.py` PID 33931 vivo, `/version.json` → 200, `/api/chat` sin token → 401.
  - Cliente: `npx tsc --noEmit` → 0 errores; `npx vite build` OK; el build servido en `:5173` contiene el manejo de sesión (`assets/island-CeICt6pu.js`).
  - Navegador (traza de red real, entorno recién reiniciado): `POST /api/auth/login → 200`, `POST /api/squad/interact → 200` (Coco Blanco respondió con texto real), cierre de sesión → sello "🔒 Sin sesión" y `auth_token`/`tenant_id`/`user_email`/`user_plan` en `null`.
- **Archivos de Referencia:**
  - [test_core.py](file:///Users/Gregorio/Desktop/coco%20squad/server-staging/tests/test_core.py)
  - [test_security.py](file:///Users/Gregorio/Desktop/coco%20squad/server-staging/tests/test_security.py)
