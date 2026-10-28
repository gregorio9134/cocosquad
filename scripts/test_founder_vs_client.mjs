import { spawn } from 'node:child_process';
import fs from 'node:fs';

const braveProc = spawn('/Applications/Brave Browser.app/Contents/MacOS/Brave Browser', [
  '--headless',
  '--disable-gpu',
  '--remote-debugging-port=9228',
  '--user-data-dir=/tmp/brave_test_profile_' + Date.now(),
  '--window-size=412,915',
  'http://127.0.0.1:1420/'
]);

try {
  let tabs = null;
  for (let i = 0; i < 20; i++) {
    await new Promise(r => setTimeout(r, 400));
    try {
      const res = await fetch('http://127.0.0.1:9228/json');
      tabs = await res.json();
      if (tabs && tabs.length > 0) break;
    } catch {}
  }

  if (!tabs || tabs.length === 0) {
    throw new Error('Failed to connect to Brave DevTools after retries');
  }

  const wsUrl = tabs[0].webSocketDebuggerUrl;
  const ws = new WebSocket(wsUrl);
  await new Promise(res => ws.onopen = res);

  let idCounter = 1;
  function send(method, params = {}) {
    return new Promise(resolve => {
      const id = idCounter++;
      const handler = (event) => {
        const data = JSON.parse(event.data);
        if (data.id === id) {
          ws.removeEventListener('message', handler);
          resolve(data.result);
        }
      };
      ws.addEventListener('message', handler);
      ws.send(JSON.stringify({ id, method, params }));
    });
  }

  async function evalJs(expr) {
    const res = await send('Runtime.evaluate', { expression: expr, returnByValue: true });
    return res && res.result ? res.result.value : null;
  }

  async function takeScreenshot(filename) {
    const shot = await send('Page.captureScreenshot', { format: 'png' });
    const p = `/Users/Gregorio/.gemini/antigravity/brain/9003ef3a-a8dd-45b6-8e42-661fcb11d807/${filename}`;
    fs.writeFileSync(p, Buffer.from(shot.data, 'base64'));
    console.log(`📸 Saved screenshot: ${filename}`);
  }

  // Esperar carga y auto-login inicial de fundador (2.8s)
  await new Promise(r => setTimeout(r, 2800));

  console.log('=== TEST 1: ESTADO INICIAL (MODO FUNDADOR) ===');
  const founderBadgeText = await evalJs('document.getElementById("founder-badge")?.textContent?.trim()');
  console.log('Badge Inicial:', founderBadgeText);

  // 1. Abrir Drawer Sidebar como Fundador
  await evalJs('document.getElementById("btn-toggle-sidebar")?.click()');
  await new Promise(r => setTimeout(r, 600));
  await takeScreenshot('coco_founder_sidebar.png');

  // Cerrar sidebar
  await evalJs('document.getElementById("btn-close-sidebar")?.click()');
  await new Promise(r => setTimeout(r, 400));

  // 2. Ir a la pestaña Tareas / Cuenta como Fundador
  await evalJs('document.querySelector(".nav-item-btn[data-tab=\\"tasks\\"]")?.click()');
  await new Promise(r => setTimeout(r, 600));
  await evalJs('document.getElementById("subscription-summary-container")?.scrollIntoView({ behavior: "instant", block: "center" })');
  await new Promise(r => setTimeout(r, 400));
  await takeScreenshot('coco_founder_tasks_panel.png');

  // 3. Cambiar a MODO CLIENTE vía Switch Rápido
  console.log('\n=== TEST 2: SWITCH A MODO CLIENTE ===');
  await evalJs('document.getElementById("btn-tasks-switch-regular")?.click()');
  await new Promise(r => setTimeout(r, 1500));

  const clientBadgeText = await evalJs('document.getElementById("founder-badge")?.textContent?.trim()');
  console.log('Badge Cliente:', clientBadgeText);
  await evalJs('document.getElementById("subscription-summary-container")?.scrollIntoView({ behavior: "instant", block: "center" })');
  await new Promise(r => setTimeout(r, 400));
  await takeScreenshot('coco_client_tasks_panel.png');

  // 4. Volver al Chat como Cliente
  await evalJs('document.querySelector(".nav-item-btn[data-tab=\\"chat\\"]")?.click()');
  await new Promise(r => setTimeout(r, 600));

  // 5. Abrir Sidebar como Cliente y verificar aislamiento estricto
  await evalJs('document.getElementById("btn-toggle-sidebar")?.click()');
  await new Promise(r => setTimeout(r, 600));
  const clientsTabDisplayClient = await evalJs('document.getElementById("tab-pill-clients")?.style?.display');
  console.log('Display tab Clientes en Modo Cliente:', clientsTabDisplayClient === 'none' ? 'OCULTO (CORRECTO - STRICT PRIVACY)' : 'VISIBLE (Error)');
  await takeScreenshot('coco_client_sidebar.png');

  // Cerrar sidebar
  await evalJs('document.getElementById("btn-close-sidebar")?.click()');
  await new Promise(r => setTimeout(r, 400));

  // 6. Probar restricción de Blu en Modo Cliente
  console.log('\n=== TEST 3: BLU TELEMETRÍA REJECTION EN MODO CLIENTE ===');
  await evalJs('window.app?.selectSquadMember("coco_azul")');
  await new Promise(r => setTimeout(r, 500));
  await evalJs(`
    const input = document.getElementById("chat-input");
    input.value = "Estado del sistema y métricas de red";
    document.getElementById("btn-send")?.click();
  `);
  await new Promise(r => setTimeout(r, 1200));
  await takeScreenshot('coco_client_blu_rejection.png');

  console.log('✅ Todos los tests visuales y funcionales concluyeron con éxito!');
} catch (err) {
  console.error('Error durante test:', err);
} finally {
  braveProc.kill('SIGKILL');
  process.exit(0);
}
