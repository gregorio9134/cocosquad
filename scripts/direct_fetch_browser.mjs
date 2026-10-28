import { spawn } from 'node:child_process';

const braveProc = spawn('/Applications/Brave Browser.app/Contents/MacOS/Brave Browser', [
  '--headless',
  '--disable-gpu',
  '--remote-debugging-port=9238',
  '--user-data-dir=/tmp/brave_test_profile_' + Date.now(),
  '--window-size=412,915',
  'http://127.0.0.1:1420/'
]);

try {
  let tabs = null;
  for (let i = 0; i < 20; i++) {
    await new Promise(r => setTimeout(r, 400));
    try {
      const res = await fetch('http://127.0.0.1:9238/json');
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
    const res = await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true });
    return res && res.result ? res.result.value : null;
  }

  await new Promise(r => setTimeout(r, 2600));

  console.log("Evaluating fetch directly in browser window...");
  const fetchResult = await evalJs(`
    (async () => {
      try {
        const token = localStorage.getItem("auth_token") || "";
        const res = await fetch("http://127.0.0.1:8080/api/squad/interact", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-tenant-id": "1",
            "x-is-founder": "true",
            "x-user-plan": "founder",
            "Authorization": token ? ("Bearer " + token) : ""
          },
          body: JSON.stringify({
            message: "Hola Sol",
            current_agent: "coco_sol",
            tenant_id: 1,
            is_founder: true,
            user_plan: "founder",
            chat_id: "tenant_1"
          })
        });
        const status = res.status;
        const text = await res.text();
        return { status, text: text.substring(0, 300) };
      } catch (e) {
        return { error: e.message, stack: e.stack };
      }
    })()
  `);

  console.log("Fetch result from browser context:", JSON.stringify(fetchResult, null, 2));

} catch (err) {
  console.error('Error:', err);
} finally {
  braveProc.kill('SIGKILL');
  process.exit(0);
}
