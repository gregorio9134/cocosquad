import { spawn } from 'node:child_process';
import fs from 'node:fs';

const braveProc = spawn('/Applications/Brave Browser.app/Contents/MacOS/Brave Browser', [
  '--headless',
  '--disable-gpu',
  '--remote-debugging-port=9226',
  '--user-data-dir=/tmp/brave_test_profile_' + Date.now(),
  '--window-size=412,915',
  'http://127.0.0.1:1420/'
]);

try {
  let tabs = null;
  for (let i = 0; i < 20; i++) {
    await new Promise(r => setTimeout(r, 400));
    try {
      const res = await fetch('http://127.0.0.1:9226/json');
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

  await new Promise(r => setTimeout(r, 2600));

  // Type and send a message
  await send('Runtime.evaluate', {
    expression: `(() => {
      const input = document.getElementById('chat-input');
      const sendBtn = document.getElementById('btn-send');
      input.value = "Hola Coco, armame un presupuesto para cliente nuevo";
      sendBtn.click();
    })()`
  });

  // Wait 4s for API response and session save
  await new Promise(r => setTimeout(r, 4000));

  // Open sidebar and capture screenshot
  await send('Runtime.evaluate', {
    expression: `(() => {
      document.getElementById('btn-toggle-sidebar')?.click();
    })()`
  });

  await new Promise(r => setTimeout(r, 600));

  const shot = await send('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync('/Users/Gregorio/.gemini/antigravity/brain/9003ef3a-a8dd-45b6-8e42-661fcb11d807/coco_sidebar_with_conversation.png', Buffer.from(shot.data, 'base64'));
  console.log('Saved screenshot: coco_sidebar_with_conversation.png');

  ws.close();
} finally {
  braveProc.kill();
}
