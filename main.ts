// Cover Coast v9 — entrypoint (Node 22, standard library only).
// Copies app/ and screenshots/ beside this file to /output and writes
// /output/dossier.json with the vendored make.fun library (buildDossier).
// Before writing anything it runs a local pre-flight mirroring the scorer's
// own rules (reference/gate.json): app caps, no remote references, and — the
// rule that killed v8 — the DIMENSION cap on every screenshot, read from the
// JPEG/PNG header, not just the byte size. A screenshot whose long side is
// over 1280 px or whose short side is under 480 px fails loudly here instead
// of passing intake and scoring 0.
//
// Serve locally with `node serve.ts`, then open http://localhost:8080.
// Outside the grader's container, MAKEFUN_OUTPUT_DIR stands in for /output:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts

import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-app.ts';

const here = fileURLToPath(new URL('.', import.meta.url));
const out = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

const MAX_SCREENSHOT_BYTES = 262144;
const MAX_SCREENSHOT_LONG = 1280;
const MIN_SCREENSHOT_SHORT = 480;
const MAX_SCREENSHOTS = 4;
const APP_MAX_FILES = 993;
const APP_MAX_BYTES = 50331648;
const APP_PATH_MAX_BYTES = 1000;
const TOTAL_MAX_ENTRIES = 1000;
const TOTAL_MAX_BYTES = 67108864;

function fail(msg) {
  throw new Error(`pre-flight FAIL: ${msg}`);
}

// --- image dimensions from the file header (never trust the byte count) ---
function pngDims(buf) {
  if (buf.length < 24 || buf.readUInt32BE(0) !== 0x89504e47) return null;
  return { w: buf.readUInt32BE(16), h: buf.readUInt32BE(20) };
}
function jpegDims(buf) {
  if (buf.length < 4 || buf[0] !== 0xff || buf[1] !== 0xd8) return null;
  let off = 2;
  while (off + 9 < buf.length) {
    if (buf[off] !== 0xff) return null;
    const marker = buf[off + 1];
    if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) { off += 2; continue; }
    const len = buf.readUInt16BE(off + 2);
    if (len < 2 || off + 2 + len > buf.length) return null;
    if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
      return { h: buf.readUInt16BE(off + 5), w: buf.readUInt16BE(off + 7) };
    }
    off += 2 + len;
  }
  return null;
}
function imageDims(buf, name) {
  const dims = pngDims(buf) ?? jpegDims(buf);
  if (!dims) fail(`${name}: not a readable PNG or JPEG (cannot verify dimensions)`);
  return dims;
}

function walk(dir, rel = '') {
  const out = [];
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = rel ? `${rel}/${e.name}` : e.name;
    if (e.isDirectory()) out.push(...walk(join(dir, e.name), p));
    else if (e.isFile()) out.push(p);
  }
  return out;
}

function preflight() {
  // 1. app_files: plain files only, caps on count / bytes / path length.
  const appDir = join(here, 'app');
  const appFiles = walk(appDir);
  if (appFiles.length > APP_MAX_FILES) fail(`app/ has ${appFiles.length} files, over ${APP_MAX_FILES}`);
  let appBytes = 0;
  for (const f of appFiles) {
    const st = statSync(join(appDir, f));
    if (!st.isFile()) fail(`app/${f} is not a plain file`);
    if (Buffer.byteLength(`app/${f}`, 'utf8') > APP_PATH_MAX_BYTES) fail(`app/${f} path over ${APP_PATH_MAX_BYTES} bytes`);
    appBytes += st.size;
  }
  if (appBytes > APP_MAX_BYTES) fail(`app/ is ${appBytes} bytes, over ${APP_MAX_BYTES}`);
  const indexHtml = join(appDir, 'index.html');
  if (!existsSync(indexHtml) || !statSync(indexHtml).isFile()) fail('app/index.html missing');
  if (statSync(indexHtml).size > 1048576) fail('app/index.html over 1 MiB');

  // 2. references: no http:/https: or //host anywhere in app code/markup.
  // (app/fonts/OFL.txt is license text, not a loaded reference, so .txt is
  // not scanned; the scorer checks index.html / script / CSS / imports.)
  const textExts = new Set(['.html', '.js', '.mjs', '.css', '.json']);
  for (const f of appFiles) {
    if (![...textExts].some(ext => f.endsWith(ext))) continue;
    const text = readFileSync(join(appDir, f), 'utf8');
    const m = text.match(/https?:\/\/[^\s"'\)]+|\/\/[a-z0-9.-]+\.[a-z]{2,}\//gi);
    if (m) fail(`app/${f} has remote reference(s): ${m.slice(0, 3).join(', ')}`);
  }

  // 3. screenshots: 3-4 files, each <= 256 KiB AND long side <= 1280 AND short side >= 480.
  const shotDir = join(here, 'screenshots');
  if (!existsSync(shotDir)) fail('screenshots/ missing');
  const shots = readdirSync(shotDir).filter(f => statSync(join(shotDir, f)).isFile()).sort();
  if (shots.length < 3 || shots.length > MAX_SCREENSHOTS) fail(`${shots.length} screenshots, need 3-4`);
  let shotBytes = 0;
  for (const f of shots) {
    const p = join(shotDir, f);
    const buf = readFileSync(p);
    shotBytes += buf.length;
    if (buf.length > MAX_SCREENSHOT_BYTES) fail(`${f} is ${buf.length} bytes, over ${MAX_SCREENSHOT_BYTES}`);
    const { w, h } = imageDims(buf, f);
    const long = Math.max(w, h), short = Math.min(w, h);
    if (long > MAX_SCREENSHOT_LONG) fail(`${f} is ${w}x${h}: long side ${long} over ${MAX_SCREENSHOT_LONG}`);
    if (short < MIN_SCREENSHOT_SHORT) fail(`${f} is ${w}x${h}: short side ${short} under ${MIN_SCREENSHOT_SHORT}`);
    console.log(`screenshot OK: ${f} ${w}x${h} ${buf.length} bytes`);
  }

  // 4. total /output caps.
  const totalEntries = appFiles.length + shots.length + 1; // + dossier.json
  if (totalEntries > TOTAL_MAX_ENTRIES) fail(`${totalEntries} /output entries, over ${TOTAL_MAX_ENTRIES}`);
  if (appBytes + shotBytes + 1572864 > TOTAL_MAX_BYTES) fail('/output would exceed 64 MiB');
  console.log(`pre-flight OK: ${appFiles.length} app files (${appBytes} bytes), ${shots.length} screenshots`);
}

preflight();

mkdirSync(out, { recursive: true });
cpSync(join(here, 'app'), join(out, 'app'), { recursive: true });
mkdirSync(join(out, 'screenshots'), { recursive: true });
if (existsSync(join(here, 'screenshots'))) cpSync(join(here, 'screenshots'), join(out, 'screenshots'), { recursive: true });

// dossier.json is byte-for-byte the vendored buildDossier output; never hand-written.
writeFileSync(
  join(out, 'dossier.json'),
  buildDossier(out, {
    text_max_bytes: 163840,
    screenshots: { max: 4, max_bytes: 262144 },
    app_max_files: 993,
    app_max_bytes: 50331648,
    app_path_max_bytes: 1000,
  }),
);
console.log('dossier written');
