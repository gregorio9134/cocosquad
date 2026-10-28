import { spawn } from 'node:child_process';

const braveProc = spawn('/Applications/Brave Browser.app/Contents/MacOS/Brave Browser', [
  '--headless',
  '--disable-gpu',
  '--remote-debugging-port=9235',
  '--user-data-dir=/tmp/brave_test_profile_' + Date.now(),
  '--window-size=412,915',
  'http://127.0.0.1:1420/'
]);

try {
  let tabs = null;
  for (let i = 0; i < 20; i++) {
    await new Promise(r => setTimeout(r, 400));
    try {
      const res = await fetch('http://127.0.0.1:9235/json');
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

  await send('Console.enable');
  await send('Network.enable');

  ws.addEventListener('message', (event) => {
    const data = JSON.parse(event.data);
    if (data.method === 'Console.messageAdded') {
      console.log('BROWSER CONSOLE:', data.params.message.text);
    }
    if (data.method === 'Network.responseReceived') {
      console.log('NETWORK RESPONSE:', data.params.response.url, data.params.response.status);
    }
    if (data.method === 'Network.loadingFailed') {
      console.log('NETWORK FAILED:', data.params.errorText, data.params.requestId);
    }
  });

  async function evalJs(expr) {
    const res = await send('Runtime.evaluate', { expression: expr, returnByValue: true });
    return res && res.result ? res.result.value : null;
  }

  await new Promise(r => setTimeout(r, 2600));

  await evalJs('document.getElementById("squad-chip-coco_sol")?.click()');
  await new Promise(r => setTimeout(r, 500));

  console.log("Sending chat message to Sol...");
  await evalJs(`
    const input = document.getElementById("chat-input");
    input.value = "Sol, ¿cómo vienen los clientes del SaaS esta semana?";
    document.getElementById("btn-send")?.click();
  `);

  await new Promise(r => setTimeout(r, 10000));

} catch (err) {
  console.error('Error:', err);
} finally {
  braveProc.kill('SIGKILL');
  process.exit(0);
}
