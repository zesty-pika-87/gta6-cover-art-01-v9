// Cover Coast v9 — screenshot driver (written fresh in this session).
// Attaches to the already-running headless Chromium on CDP port 9333,
// navigates to each ?shot= scene served by `node serve.ts`, waits for
// window.__shotReady, and captures a JPEG screenshot at the scene's size.
// It never spawns or kills the browser. Usage:
//   node tools/shoot.mjs [base-url] [out-dir]
import { writeFileSync } from 'node:fs';

const base = process.argv[2] ?? 'http://localhost:8080';
const outDir = process.argv[3] ?? 'screenshots';
const port = 9333;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
// Create our own tab so we never touch another agent's page in this shared browser.
const created = await (await fetch(`http://127.0.0.1:${port}/json/new?about:blank`, { method: 'PUT' })).json();
const page = created;
const ws = new WebSocket(page.webSocketDebuggerUrl);
await new Promise((r, j) => { ws.onopen = r; ws.onerror = j; });
let id = 0;
const pending = new Map();
ws.onmessage = (ev) => {
  const m = JSON.parse(ev.data);
  if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); }
};
function send(method, params = {}) {
  return new Promise((resolve) => {
    const mid = ++id;
    pending.set(mid, resolve);
    ws.send(JSON.stringify({ id: mid, method, params }));
  });
}
async function evalJs(expression) {
  const r = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
  if (r.result?.exceptionDetails) throw new Error(JSON.stringify(r.result.exceptionDetails).slice(0, 400));
  return r.result?.result?.value;
}

await send('Page.enable');
await send('Runtime.enable');

const scenes = [
  { name: '1-cover.jpg', query: '?shot=cover', w: 1024, h: 1024 },
  { name: '2-editor.jpg', query: '?shot=editor', w: 1280, h: 800 },
  { name: '3-grid.jpg', query: '?shot=grid', w: 1024, h: 1024 },
  { name: '4-story.jpg', query: '?shot=story', w: 540, h: 960 },
];
for (const s of scenes) {
  await send('Emulation.setDeviceMetricsOverride', { width: s.w, height: s.h, deviceScaleFactor: 1, mobile: false });
  await send('Page.navigate', { url: `${base}/${s.query}` });
  let ready = false;
  for (let i = 0; i < 60; i++) {
    await sleep(250);
    try { ready = await evalJs('window.__shotReady === true'); } catch { /* page still loading */ }
    if (ready) break;
  }
  if (!ready) throw new Error(`${s.name}: __shotReady never became true`);
  const errors = await evalJs('window.__errors || []');
  if (errors.length) console.log(`${s.name}: page errors:`, JSON.stringify(errors).slice(0, 300));
  await sleep(400);
  const shot = await send('Page.captureScreenshot', { format: 'jpeg', quality: 88 });
  const buf = Buffer.from(shot.result.data, 'base64');
  writeFileSync(`${outDir}/${s.name}`, buf);
  console.log(`${s.name}: ${buf.length} bytes`);
}
ws.close();
console.log('done');
