// Inspect UI layout and bounding boxes via Brave CDP
const braveProc = await (async () => {
  const { spawn } = await import('node:child_process');
  const p = spawn('/Applications/Brave Browser.app/Contents/MacOS/Brave Browser', [
    '--headless',
    '--disable-gpu',
    '--remote-debugging-port=9222',
    '--window-size=412,915',
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

  // Wait for splash screen to disappear
  await new Promise(r => setTimeout(r, 2500));

  const evalRes = await send('Runtime.evaluate', {
    expression: `(() => {
      const getBox = (sel) => {
        const el = document.querySelector(sel);
        if (!el) return null;
        const r = el.getBoundingClientRect();
        return { sel, x: Math.round(r.x), y: Math.round(r.y), width: Math.round(r.width), height: Math.round(r.height), right: Math.round(r.right) };
      };
      return JSON.stringify({
        windowWidth: window.innerWidth,
        app: getBox('#app'),
        topBar: getBox('.compact-top-bar'),
        topBarLeft: getBox('.top-bar-left'),
        topBarRight: getBox('.top-bar-right'),
        squadCapsule: getBox('.squad-dock-capsule'),
        squadChips: Array.from(document.querySelectorAll('.squad-mochi-chip')).map(el => {
          const r = el.getBoundingClientRect();
          return { id: el.id, x: Math.round(r.x), y: Math.round(r.y), width: Math.round(r.width), height: Math.round(r.height), right: Math.round(r.right) };
        }),
        triageChips: Array.from(document.querySelectorAll('.triage-chip-btn')).map(el => ({ text: el.textContent, agent: el.dataset.triageAgent })),
        bottomNav: getBox('.bottom-nav-bar')
      }, null, 2);
    })()`,
    returnByValue: true
  });

  console.log('UI LAYOUT ANALYSIS:');
  console.log(evalRes.result.value);

  // Take full screenshot
  const shot = await send('Page.captureScreenshot', { format: 'png' });
  const fs = await import('node:fs');
  fs.writeFileSync('/Users/Gregorio/.gemini/antigravity/brain/9003ef3a-a8dd-45b6-8e42-661fcb11d807/coco_app_inspected.png', Buffer.from(shot.data, 'base64'));
  console.log('Screenshot saved to coco_app_inspected.png');

  ws.close();
} finally {
  braveProc.kill();
}
