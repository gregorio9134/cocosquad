import { spawn } from 'node:child_process';
import fs from 'node:fs';

const braveProc = spawn('/Applications/Brave Browser.app/Contents/MacOS/Brave Browser', [
  '--headless',
  '--disable-gpu',
  '--remote-debugging-port=9230',
  '--user-data-dir=/tmp/brave_test_profile_' + Date.now(),
  '--window-size=412,915',
  'http://127.0.0.1:1420/'
]);

try {
  let tabs = null;
  for (let i = 0; i < 20; i++) {
    await new Promise(r => setTimeout(r, 400));
    try {
      const res = await fetch('http://127.0.0.1:9230/json');
      tabs = await res.json();
      if (tabs && tabs.length > 0) break;
    } catch {}
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

  // Esperar carga y auto-login inicial (2.8s)
  await new Promise(r => setTimeout(r, 2800));

  // Switch a Modo Cliente
  await evalJs('document.querySelector(".nav-item-btn[data-tab=\\"tasks\\"]")?.click()');
  await new Promise(r => setTimeout(r, 600));
  await evalJs('document.getElementById("btn-tasks-switch-regular")?.click()');
  await new Promise(r => setTimeout(r, 1500));
  await evalJs('window.app?.closeAuthModal()');

  // Volver a Chat
  await evalJs('document.querySelector(".nav-item-btn[data-tab=\\"chat\\"]")?.click()');
  await new Promise(r => setTimeout(r, 600));

  // Tocar el chip de Blu en el top dock
  await evalJs('document.getElementById("squad-chip-coco_azul")?.click()');
  await new Promise(r => setTimeout(r, 600));

  // Enviar consulta de métricas de red
  await evalJs(`
    const input = document.getElementById("chat-input");
    input.value = "Estado del sistema y métricas de red";
    document.getElementById("btn-send")?.click();
  `);

  await new Promise(r => setTimeout(r, 1000));
  await takeScreenshot('coco_client_blu_rejection.png');

} catch (err) {
  console.error('Error durante test:', err);
} finally {
  braveProc.kill('SIGKILL');
  process.exit(0);
}
