import { spawn } from 'node:child_process';
import fs from 'node:fs';

const braveProc = spawn('/Applications/Brave Browser.app/Contents/MacOS/Brave Browser', [
  '--headless',
  '--disable-gpu',
  '--remote-debugging-port=9240',
  '--user-data-dir=/tmp/brave_test_profile_' + Date.now(),
  '--window-size=430,932', // iPhone 16 Pro Max viewport
  'http://127.0.0.1:1420/'
]);

try {
  let tabs = null;
  for (let i = 0; i < 20; i++) {
    await new Promise(r => setTimeout(r, 400));
    try {
      const res = await fetch('http://127.0.0.1:9240/json');
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

  async function takeScreenshot(filename) {
    const shot = await send('Page.captureScreenshot', { format: 'png' });
    const p = `/Users/Gregorio/.gemini/antigravity/brain/9003ef3a-a8dd-45b6-8e42-661fcb11d807/${filename}`;
    fs.writeFileSync(p, Buffer.from(shot.data, 'base64'));
    console.log(`📸 Saved screenshot: ${filename}`);
  }

  await new Promise(r => setTimeout(r, 3000));

  console.log("Checking for Sol control button in header...");
  const btnText = await evalJs('document.getElementById("btn-open-sol-control")?.innerText');
  console.log("Header button text:", btnText);

  // Take screenshot of main app with the new Torre de Control button
  await takeScreenshot('coco_founder_header_with_sol_btn.png');

  // Click Torre de Control
  console.log("Opening Sol Dashboard...");
  await evalJs('document.getElementById("btn-open-sol-control")?.click()');
  await new Promise(r => setTimeout(r, 1200));

  // Take screenshot of Tenants view
  await takeScreenshot('sol_dashboard_tenants.png');

  // Click Hotspots tab
  console.log("Switching to Hotspots tab...");
  await evalJs('document.querySelector(\'[data-tab="hotspots"]\')?.click()');
  await new Promise(r => setTimeout(r, 600));

  // Take screenshot of Hotspots view
  await takeScreenshot('sol_dashboard_hotspots.png');

  // Click Broadcasts tab
  console.log("Switching to Broadcasts tab...");
  await evalJs('document.querySelector(\'[data-tab="broadcasts"]\')?.click()');
  await new Promise(r => setTimeout(r, 600));

  // Take screenshot of Broadcasts view
  await takeScreenshot('sol_dashboard_broadcasts.png');

  console.log("✅ All Sol Dashboard views captured successfully!");

} catch (err) {
  console.error('Error:', err);
} finally {
  braveProc.kill('SIGKILL');
  process.exit(0);
}
