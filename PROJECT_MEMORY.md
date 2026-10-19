# COCO SQUAD - BITÁCORA DE APRENDIZAJE Y ANTI-PATRONES

Este documento registra los errores históricos del proyecto para evitar que vuelvan a introducirse en futuras iteraciones. Ante cualquier modificación o reporte de error, es obligatorio consultar y actualizar esta bitácora.

---

### Lección 1: Inicialización de Canvas en Frío (Bug del Mochi Tuerto)
- **Problema:** En la primera carga de un archivo tras refrescar la página o en arranque en frío, el avatar principal aparecía con un solo ojo o con el ojo derecho truncado/invisible.
- **Causa Raíz:** Lectura y asignación de `clientWidth` / `canvas.width` en milisegundo cero con dimensiones de layout no calculadas por el motor de renderizado, provocando un desbalance de escala que proyectaba el ojo derecho fuera de rango o generaba una relación de aspecto achatada.
- **Regla Aprendida:** 
  1. Las dimensiones del canvas de los avatares deben ser explícitas y fijas desde el HTML y el constructor (`width="80" height="80"` en buffer, `style="width: 40px; height: 40px;"` en CSS).
  2. Nunca inicializar ni mutar las dimensiones del lienzo dentro de las rutinas de devorar (`triggerDevourAnimation`).
  3. Ejecutar de inmediato el renderizado síncrono del estado de reposo (Idle) en Frame 0 garantizando dos ojos separados en $x = 32\%$ y $x = 68\%$.

---

### Lección 2: Toast de Versión en Bucle Infinito
- **Problema:** Al hacer clic en "Actualizar ahora" o en la "X" de cierre y recargar la página, el cartel flotante de actualización volvía a saltar indefinidamente en un bucle continuo.
- **Causa Raíz:** La versión local se comparaba contra una propiedad en memoria hardcodeada en `"1.0.0"`. Al refrescar la página, el valor volvía a `"1.0.0"`, difiriendo siempre de `"1.0.1"` en `version.json`, sin persistir la versión aceptada en almacenamiento del navegador.
- **Regla Aprendida:** 
  1. Inicializar la versión de la aplicación desde almacenamiento local: `localStorage.getItem("app_version") || "1.0.0"`.
  2. Guardar síncronamente `localStorage.setItem('app_version', remoteVersion)` tanto al pulsar *"Actualizar ahora"* como al descartar con la *"X"*.
  3. Destruir físicamente el nodo del DOM del toast con `toast?.remove()` antes de ejecutar `window.location.reload()`, asegurando que tras la recarga `remoteVersion === storedVersion` y el cartel nunca reincida.

---

### Lección 3: Ruptura de Flujo por Pantallas Divididas (Split-Screen en Green)
- **Problema:** Al interactuar con Green o enviar archivos en su sala, la interfaz montaba contenedores secundarios o paneles paralelos de selector de contactos, quebrando el diseño móvil vertical unificado.
- **Regla Aprendida:** 
  1. Toda la aplicación opera estrictamente en un único contenedor vertical de chat móvil centrado.
  2. No instanciar paneles paralelos ni vistas divididas (split-screen) bajo ningún concepto.
  3. La omnicanalidad de Green (WhatsApp, Instagram, TikTok) se resuelve mediante badges integrados en las burbujas y selectores sutiles en la barra de entrada, manteniendo el flujo conversacional 100% nativo.

---

### Lección 4: Contaminación de Chats en Delegaciones
- **Problema:** Tras derivar un documento o consulta compleja, el análisis o reporte exhaustivo de Red o Blu aparecía incrustado en el historial de chat de Coco Blanco o Green.
- **Regla Aprendida:** 
  1. La asistencia entre agentes (Squad Assist) es estrictamente una coreografía efímera: el especialista desciende, muestra un globo de diálogo flotante y temporal ("¡Yo me encargo!"), y regresa a su estación en la barra superior.
  2. Queda terminantemente prohibido inyectar burbujas de respuesta permanente del especialista dentro de la conversación del agente derivador.
  3. Tras la animación de retorno, la interfaz ejecuta de forma automática la conmutación a la vista del especialista (`selectSquadMember`), donde se presenta el informe completo.
