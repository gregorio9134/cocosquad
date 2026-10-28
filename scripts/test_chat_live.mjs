// Test sending a real chat message to Coco Blanco
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
  const ws = new WebSocket(tabs[0].webSocketDebuggerUrl);
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

  // Type message into input
  const typeRes = await send('Runtime.evaluate', {
    expression: `(() => {
      const input = document.getElementById('chat-input');
      const sendBtn = document.getElementById('btn-send');
      if (input && sendBtn) {
        input.value = 'Agendame reunión con el contador mañana a las 10hs para revisar balances';
        sendBtn.click();
        return 'sent';
      }
      return 'elements not found';
    })()`,
    returnByValue: true
  });
  console.log('Message sent:', typeRes.result.value);

  // Wait 4 seconds for response and animation
  await new Promise(r => setTimeout(r, 4000));

  // Check chat history content
  const histRes = await send('Runtime.evaluate', {
    expression: `(() => {
      const bubbles = Array.from(document.querySelectorAll('.chat-bubble-row')).map(b => ({
        role: b.classList.contains('assistant') ? 'assistant' : 'user',
        text: b.textContent.trim().slice(0, 150)
      }));
      return JSON.stringify(bubbles);
    })()`,
    returnByValue: true
  });
  console.log('Chat bubbles:', histRes.result.value);

  // Take screenshot of chat
  const shot = await send('Page.captureScreenshot', { format: 'png' });
  const fs = await import('node:fs');
  fs.writeFileSync('/Users/Gregorio/.gemini/antigravity/brain/9003ef3a-a8dd-45b6-8e42-661fcb11d807/coco_blanco_chat_result.png', Buffer.from(shot.data, 'base64'));
  console.log('Saved chat screenshot to coco_blanco_chat_result.png');

  ws.close();
} finally {
  braveProc.kill();
}
