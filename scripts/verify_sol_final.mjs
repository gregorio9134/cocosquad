import { spawn } from 'node:child_process';
import fs from 'node:fs';

const braveProc = spawn('/Applications/Brave Browser.app/Contents/MacOS/Brave Browser', [
  '--headless',
  '--disable-gpu',
  '--remote-debugging-port=9239',
  '--user-data-dir=/tmp/brave_test_profile_' + Date.now(),
  '--window-size=412,915',
  'http://127.0.0.1:1420/'
]);

try {
  let tabs = null;
  for (let i = 0; i < 20; i++) {
    await new Promise(r => setTimeout(r, 400));
    try {
      const res = await fetch('http://127.0.0.1:9239/json');
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

  await new Promise(r => setTimeout(r, 2600));

  // Tocar a Sol
  await evalJs('document.getElementById("squad-chip-coco_sol")?.click()');
  await new Promise(r => setTimeout(r, 500));

  // Enviar mensaje
  await evalJs(`
    const input = document.getElementById("chat-input");
    input.value = "Sol, ¿cómo vienen los clientes del SaaS esta semana?";
    document.getElementById("btn-send")?.click();
  `);

  console.log("Waiting for assistant reply bubble (up to 30s)...");
  let found = false;
  for (let i = 0; i < 30; i++) {
    await new Promise(r => setTimeout(r, 1000));
    const count = await evalJs('document.querySelectorAll(".chat-bubble-row.assistant:not(.mochi-custom-loader-row)").length');
    if (count > 0) {
      console.log(`Second ${i + 1}: Assistant message arrived! (${count})`);
      found = true;
      break;
    }
  }

  await new Promise(r => setTimeout(r, 1000));
  await takeScreenshot('coco_sol_full_response.png');

  const text = await evalJs(`
    const el = document.querySelector(".chat-bubble-row.assistant:not(.mochi-custom-loader-row) .message-content");
    el ? el.innerText : "NONE";
  `);
  console.log("Sol assistant text:", text);

} catch (err) {
  console.error('Error:', err);
} finally {
  braveProc.kill('SIGKILL');
  process.exit(0);
}
