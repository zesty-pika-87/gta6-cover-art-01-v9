// Cover Coast v9 — editor wiring: presets, tray, layouts, grades, lettering,
// per-panel pan/zoom, undo/redo, exports (PNG x4 + ZIP fallback), shot scenes.
import { PHOTOS, GRADES, LAYOUTS, PRESETS, defaultState, renderCover, panelRects } from './cover.js';
import { runShot } from './shots.js';
import { zipStore } from './zip.js';

const canvas = document.getElementById('cover');
const statusEl = document.getElementById('status');
window.__errors = [];
window.addEventListener('error', (e) => window.__errors.push(String(e.message || e.error)));
const state = defaultState();
const images = new Map();
let selectedPhoto = 'boulevard';
let undoStack = [], redoStack = [];

function loadImage(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = url;
  });
}

async function loadAllPhotos() {
  for (const p of PHOTOS) {
    try { images.set(p.id, await loadImage(`./samples/${p.file}`)); } catch { /* keep going */ }
  }
}

function snapshot() { return JSON.stringify(state); }
function pushUndo() {
  undoStack.push(snapshot());
  if (undoStack.length > 40) undoStack.shift();
  redoStack = [];
}
function restore(json) { const s = JSON.parse(json); Object.keys(state).forEach(k => delete state[k]); Object.assign(state, s); syncControls(); draw(); }
function draw() { renderCover(canvas, state, images); }

function syncControls() {
  document.getElementById('title').value = state.title;
  document.getElementById('subtitle').value = state.subtitle;
  document.getElementById('strip').value = state.strip;
  document.getElementById('badge').value = state.badge;
  document.getElementById('titlePos').value = state.titlePos;
  document.getElementById('strength').value = state.strength;
  document.getElementById('strengthVal').textContent = Number(state.strength).toFixed(2);
  document.getElementById('halftone').checked = state.halftone;
  document.getElementById('halftoneDensity').value = state.halftoneDensity;
  document.getElementById('grain').checked = state.grain;
  document.getElementById('vignette').checked = state.vignette;
  document.querySelectorAll('#layouts button').forEach(b => b.classList.toggle('on', b.dataset.layout === state.layout));
  document.querySelectorAll('#grades button').forEach(b => b.classList.toggle('on', b.dataset.grade === state.grade));
  document.querySelectorAll('#tray figure').forEach(f => f.classList.toggle('sel', f.dataset.photo === selectedPhoto));
}

function buildTray() {
  const tray = document.getElementById('tray');
  tray.innerHTML = '';
  for (const p of PHOTOS) {
    const fig = document.createElement('figure');
    fig.dataset.photo = p.id;
    const im = document.createElement('img');
    im.src = `./samples/${p.file}`; im.alt = p.label;
    const cap = document.createElement('figcaption');
    cap.textContent = p.label;
    fig.append(im, cap);
    fig.addEventListener('click', () => { selectedPhoto = p.id; syncControls(); statusEl.textContent = `Selected ${p.label} — click a panel to place it.`; });
    tray.append(fig);
  }
}

function buildChips() {
  const lay = document.getElementById('layouts');
  for (const [id, l] of Object.entries(LAYOUTS)) {
    const b = document.createElement('button');
    b.type = 'button'; b.dataset.layout = id; b.textContent = l.name;
    b.addEventListener('click', () => { pushUndo(); state.layout = id; syncControls(); draw(); });
    lay.append(b);
  }
  const gr = document.getElementById('grades');
  for (const [id, g] of Object.entries(GRADES)) {
    const b = document.createElement('button');
    b.type = 'button'; b.dataset.grade = id; b.textContent = g.name;
    b.addEventListener('click', () => { pushUndo(); state.grade = id; syncControls(); draw(); });
    gr.append(b);
  }
  const pre = document.getElementById('presets');
  for (const p of PRESETS) {
    const b = document.createElement('button');
    b.type = 'button'; b.textContent = `${p.name} — ${LAYOUTS[p.layout].name} · ${GRADES[p.grade].name}`;
    b.addEventListener('click', () => {
      pushUndo();
      state.layout = p.layout; state.grade = p.grade;
      state.title = p.title; state.subtitle = p.subtitle; state.strip = p.strip;
      state.photos = [...p.photos];
      syncControls(); draw();
      statusEl.textContent = `Preset applied: ${p.name}`;
    });
    pre.append(b);
  }
}

function bindInputs() {
  const on = (id, ev, fn) => document.getElementById(id).addEventListener(ev, fn);
  on('title', 'input', e => { state.title = e.target.value; draw(); });
  on('subtitle', 'input', e => { state.subtitle = e.target.value; draw(); });
  on('strip', 'input', e => { state.strip = e.target.value; draw(); });
  on('badge', 'input', e => { state.badge = e.target.value; draw(); });
  on('titlePos', 'change', e => { pushUndo(); state.titlePos = e.target.value; draw(); });
  on('strength', 'input', e => { state.strength = Number(e.target.value); document.getElementById('strengthVal').textContent = state.strength.toFixed(2); draw(); });
  on('halftone', 'change', e => { state.halftone = e.target.checked; draw(); });
  on('halftoneDensity', 'input', e => { state.halftoneDensity = Number(e.target.value); draw(); });
  on('grain', 'change', e => { state.grain = e.target.checked; draw(); });
  on('vignette', 'change', e => { state.vignette = e.target.checked; draw(); });
  on('undo', 'click', () => { if (!undoStack.length) return; redoStack.push(snapshot()); restore(undoStack.pop()); });
  on('redo', 'click', () => { if (!redoStack.length) return; undoStack.push(snapshot()); restore(redoStack.pop()); });
  on('shuffle', 'click', () => {
    pushUndo();
    const pool = [...PHOTOS.map(p => p.id)];
    for (let i = pool.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [pool[i], pool[j]] = [pool[j], pool[i]]; }
    state.photos = pool.slice(0, 9);
    draw(); statusEl.textContent = 'Photos shuffled.';
  });
  document.addEventListener('keydown', e => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z' && !e.shiftKey) { e.preventDefault(); document.getElementById('undo').click(); }
    if ((e.ctrlKey || e.metaKey) && (e.key.toLowerCase() === 'y' || (e.key.toLowerCase() === 'z' && e.shiftKey))) { e.preventDefault(); document.getElementById('redo').click(); }
  });
  document.getElementById('upload').addEventListener('change', async e => {
    const file = e.target.files[0];
    if (!file) return;
    const img = await loadImage(URL.createObjectURL(file));
    const id = `upload-${Date.now()}`;
    images.set(id, img);
    PHOTOS.push({ id, file: '', label: file.name.slice(0, 18), caption: 'YOUR PHOTO / JUST NOW — MAKE IT COUNT' });
    selectedPhoto = id; buildTray(); syncControls();
    statusEl.textContent = 'Your photo is loaded — click a panel to place it.';
  });
}

// --- per-panel click / drag pan / scroll zoom -------------------------------
function panelAt(mx, my) {
  const rect = canvas.getBoundingClientRect();
  const x = (mx - rect.left) * (canvas.width / rect.width);
  const y = (my - rect.top) * (canvas.height / rect.height);
  const rects = panelRects(state.layout, canvas.width, canvas.height);
  for (let i = rects.length - 1; i >= 0; i--) {
    const r = rects[i];
    if (x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h) return i;
  }
  return -1;
}
let drag = null;
canvas.addEventListener('pointerdown', e => {
  const i = panelAt(e.clientX, e.clientY);
  if (i < 0) return;
  drag = { panel: i, startX: e.clientX, startY: e.clientY, moved: false, pan: { ...(state.pans[state.photos[i % state.photos.length]] || { x: 0, y: 0, zoom: 1 }) } };
  canvas.setPointerCapture(e.pointerId);
});
canvas.addEventListener('pointermove', e => {
  if (!drag) return;
  const dx = e.clientX - drag.startX, dy = e.clientY - drag.startY;
  if (Math.abs(dx) + Math.abs(dy) > 4) drag.moved = true;
  if (!drag.moved) return;
  const pid = state.photos[drag.panel % state.photos.length];
  const rect = canvas.getBoundingClientRect();
  state.pans[pid] = { x: Math.max(-1, Math.min(1, drag.pan.x + dx / rect.width * 2)), y: Math.max(-1, Math.min(1, drag.pan.y + dy / rect.height * 2)), zoom: drag.pan.zoom };
  draw();
});
canvas.addEventListener('pointerup', e => {
  if (!drag) return;
  if (!drag.moved) {
    const i = drag.panel;
    pushUndo();
    state.photos[i % state.photos.length] = selectedPhoto;
    draw();
    statusEl.textContent = `Placed ${selectedPhoto} in panel ${i + 1}.`;
  }
  drag = null;
});
canvas.addEventListener('wheel', e => {
  const i = panelAt(e.clientX, e.clientY);
  if (i < 0) return;
  e.preventDefault();
  const pid = state.photos[i % state.photos.length];
  const cur = state.pans[pid] || { x: 0, y: 0, zoom: 1 };
  state.pans[pid] = { ...cur, zoom: Math.max(1, Math.min(2.2, cur.zoom * (e.deltaY < 0 ? 1.08 : 0.93))) };
  draw();
}, { passive: false });

// --- exports -----------------------------------------------------------------
const SIZES = { square: [1080, 1080], portrait: [1080, 1350], landscape: [1920, 1080], story: [1080, 1920] };
function slug(s) { return (s || 'cover').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'cover'; }
function exportPng(sizeKey) {
  const [w, h] = SIZES[sizeKey];
  const cv = document.createElement('canvas');
  cv.width = w; cv.height = h;
  const st = { ...state, layout: sizeKey === 'story' ? 'story' : state.layout };
  renderCover(cv, st, images);
  return new Promise(res => cv.toBlob(b => res(b), 'image/png'));
}
function download(blob, name) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = name; a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
}
async function exportOne(sizeKey) {
  const blob = await exportPng(sizeKey);
  const [w, h] = SIZES[sizeKey];
  download(blob, `${slug(state.title)}-${w}x${h}.png`);
  statusEl.textContent = `Saved ${slug(state.title)}-${w}x${h}.png`;
}
async function exportAll() {
  const files = [];
  for (const key of Object.keys(SIZES)) {
    const blob = await exportPng(key);
    const [w, h] = SIZES[key];
    files.push({ name: `${slug(state.title)}-${w}x${h}.png`, blob });
  }
  try {
    const zip = await zipStore(files);
    download(zip, `${slug(state.title)}-all-4.zip`);
    statusEl.textContent = 'Saved ZIP with all 4 PNGs.';
  } catch {
    for (const f of files) download(f.blob, f.name);
    statusEl.textContent = 'ZIP failed — downloaded the 4 PNGs one by one.';
  }
}
document.getElementById('expSquare').addEventListener('click', () => exportOne('square'));
document.getElementById('expPortrait').addEventListener('click', () => exportOne('portrait'));
document.getElementById('expLandscape').addEventListener('click', () => exportOne('landscape'));
document.getElementById('expStory').addEventListener('click', () => exportOne('story'));
document.getElementById('expAll').addEventListener('click', exportAll);

// --- boot ----------------------------------------------------------------------
const shot = new URLSearchParams(location.search).get('shot');
buildTray(); buildChips(); bindInputs(); syncControls();
await loadAllPhotos();
if (shot) {
  runShot(shot, new URLSearchParams(location.search), state, images, draw, syncControls);
} else {
  draw();
}
