// Test clicking on Red and checking the UI
const braveProc = await (async () => {
  const { spawn } = await import('node:child_process');
  const p = spawn('/Applications/Brave Browser.app/Contents/MacOS/Brave Browser', [
    '--headless',
    '--disable-gpu',
    '--remote-debugging-port=9222',
    '--window-size=500,850',
    'http://127.0.0.1:1420/'
  ]);
  await new Promise(r => setTimeout(r, 1500));
  return p;
})();

try {
  const res = await fetch('http://127.0.0.1:9222/json');
  const tabs = await res.json();
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

  // Wait for splash screen
  await new Promise(r => setTimeout(r, 2200));

  // Click on squad-chip-coco_rojo
  const clickRes = await send('Runtime.evaluate', {
    expression: `(() => {
      const btn = document.getElementById('squad-chip-coco_rojo');
      if (btn) {
        btn.click();
        return 'clicked';
      }
      return 'not found';
    })()`,
    returnByValue: true
  });
  console.log('Click on Red:', clickRes.result.value);

  // Wait 1 second for animation/transition
  await new Promise(r => setTimeout(r, 1000));

  // Capture screenshot of Red
  const shot = await send('Page.captureScreenshot', { format: 'png' });
  const fs = await import('node:fs');
  fs.writeFileSync('/Users/Gregorio/.gemini/antigravity/brain/9003ef3a-a8dd-45b6-8e42-661fcb11d807/coco_red_screen.png', Buffer.from(shot.data, 'base64'));
  console.log('Saved Red view to coco_red_screen.png');

  // Also inspect Devour tab
  await send('Runtime.evaluate', {
    expression: `(() => {
      const devTab = document.querySelector('[data-tab="devour"]');
      if (devTab) devTab.click();
    })()`
  });
  await new Promise(r => setTimeout(r, 1000));
  const shotDevour = await send('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync('/Users/Gregorio/.gemini/antigravity/brain/9003ef3a-a8dd-45b6-8e42-661fcb11d807/coco_devour_screen.png', Buffer.from(shotDevour.data, 'base64'));
  console.log('Saved Devour view to coco_devour_screen.png');

  // Also inspect Tasks tab
  await send('Runtime.evaluate', {
    expression: `(() => {
      const tasksTab = document.querySelector('[data-tab="tasks"]');
      if (tasksTab) tasksTab.click();
    })()`
  });
  await new Promise(r => setTimeout(r, 1000));
  const shotTasks = await send('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync('/Users/Gregorio/.gemini/antigravity/brain/9003ef3a-a8dd-45b6-8e42-661fcb11d807/coco_tasks_screen.png', Buffer.from(shotTasks.data, 'base64'));
  console.log('Saved Tasks view to coco_tasks_screen.png');

  ws.close();
} finally {
  braveProc.kill();
}
