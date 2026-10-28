import { spawn } from 'node:child_process';
import fs from 'node:fs';

const braveProc = spawn('/Applications/Brave Browser.app/Contents/MacOS/Brave Browser', [
  '--headless',
  '--disable-gpu',
  '--remote-debugging-port=9225',
  '--user-data-dir=/tmp/brave_test_profile_' + Date.now(),
  '--window-size=412,915',
  'http://127.0.0.1:1420/'
]);

try {
  let tabs = null;
  for (let i = 0; i < 20; i++) {
    await new Promise(r => setTimeout(r, 400));
    try {
      const res = await fetch('http://127.0.0.1:9225/json');
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

  async function takeScreenshot(filename) {
    const shot = await send('Page.captureScreenshot', { format: 'png' });
    const p = `/Users/Gregorio/.gemini/antigravity/brain/9003ef3a-a8dd-45b6-8e42-661fcb11d807/${filename}`;
    fs.writeFileSync(p, Buffer.from(shot.data, 'base64'));
    console.log(`Saved screenshot: ${filename}`);
  }

  // Wait 2.5s for app and splash screen to dismiss
  await new Promise(r => setTimeout(r, 2600));

  // 1. Initial view screenshot
  await takeScreenshot('coco_initial_with_toggle_btn.png');

  // 2. Click sidebar toggle button
  const toggleResult = await send('Runtime.evaluate', {
    expression: `(() => {
      const btn = document.getElementById('btn-toggle-sidebar');
      if (!btn) return { ok: false, error: 'btn-toggle-sidebar not found' };
      btn.click();
      const drawer = document.getElementById('coco-sidebar-drawer');
      return { ok: true, isOpen: drawer?.classList.contains('open') };
    })()`,
    returnByValue: true
  });
  console.log('Toggle sidebar result:', toggleResult.result.value);

  await new Promise(r => setTimeout(r, 600));
  await takeScreenshot('coco_sidebar_open.png');

  // 3. Switch to Clientes tab
  const switchTabResult = await send('Runtime.evaluate', {
    expression: `(() => {
      const tabClients = document.getElementById('tab-pill-clients');
      if (!tabClients) return { ok: false, error: 'tab-pill-clients not found' };
      tabClients.click();
      const cards = document.querySelectorAll('.sidebar-client-card');
      return { ok: true, clientCardsCount: cards.length };
    })()`,
    returnByValue: true
  });
  console.log('Switch tab result:', switchTabResult.result.value);

  await new Promise(r => setTimeout(r, 500));
  await takeScreenshot('coco_sidebar_clients_tab.png');

  // 4. Click the first client card to open modal
  const openClientModalResult = await send('Runtime.evaluate', {
    expression: `(() => {
      const firstCard = document.querySelector('.sidebar-client-card');
      if (!firstCard) return { ok: false, error: 'no client card' };
      firstCard.click();
      const modal = document.getElementById('client-modal-overlay');
      return { ok: true, isModalOpen: !modal?.classList.contains('hidden') };
    })()`,
    returnByValue: true
  });
  console.log('Open client modal result:', openClientModalResult.result.value);

  await new Promise(r => setTimeout(r, 500));
  await takeScreenshot('coco_client_modal_open.png');

  // 5. Close client modal and test New Conversation
  await send('Runtime.evaluate', {
    expression: `(() => {
      document.getElementById('btn-close-client-modal')?.click();
      document.getElementById('tab-pill-sessions')?.click();
      document.getElementById('btn-sidebar-new-chat')?.click();
    })()`
  });

  await new Promise(r => setTimeout(r, 600));
  await takeScreenshot('coco_new_chat_active.png');

  ws.close();
} finally {
  braveProc.kill();
}
