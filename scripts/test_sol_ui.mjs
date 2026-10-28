import { spawn } from 'node:child_process';
import fs from 'node:fs';

const braveProc = spawn('/Applications/Brave Browser.app/Contents/MacOS/Brave Browser', [
  '--headless',
  '--disable-gpu',
  '--remote-debugging-port=9232',
  '--user-data-dir=/tmp/brave_test_profile_' + Date.now(),
  '--window-size=412,915',
  'http://127.0.0.1:1420/'
]);

try {
  let tabs = null;
  for (let i = 0; i < 20; i++) {
    await new Promise(r => setTimeout(r, 400));
    try {
      const res = await fetch('http://127.0.0.1:9232/json');
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

  // Esperar carga inicial (2.8s)
  await new Promise(r => setTimeout(r, 2800));

  // Tocar el chip de Sol (#squad-chip-coco_sol)
  console.log('Seleccionando a Sol...');
  await evalJs('document.getElementById("squad-chip-coco_sol")?.click()');
  await new Promise(r => setTimeout(r, 600));

  // Screenshot de Sol en estado inicial
  await takeScreenshot('coco_sol_initial_view.png');

  // Enviar mensaje a Sol
  console.log('Enviando mensaje a Sol...');
  await evalJs(`
    const input = document.getElementById("chat-input");
    input.value = "Sol, ¿cómo viene la tracción de clientes y cuentas en Coco Squad?";
    document.getElementById("btn-send")?.click();
  `);

  // Esperar respuesta de Sol
  await new Promise(r => setTimeout(r, 3500));
  await takeScreenshot('coco_sol_active_chat.png');

  const replyText = await evalJs(`
    const msgs = document.querySelectorAll(".chat-bubble-row.assistant .message-content");
    msgs[msgs.length - 1]?.textContent?.trim()
  `);
  console.log('Respuesta de Sol en pantalla:', replyText);

} catch (err) {
  console.error('Error durante test:', err);
} finally {
  braveProc.kill('SIGKILL');
  process.exit(0);
}
