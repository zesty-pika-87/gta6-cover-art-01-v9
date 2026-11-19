// Cover Coast v9 — one deterministic renderer shared by preview and export.
// Layouts, LUT-style pixel grades, lettering, chips, badges, halftone + grain.
// Everything is drawn from the state object; the same function paints the
// on-screen canvas and the export canvases, so preview == export.

export const PHOTOS = [
  { id: 'boulevard', file: 'boulevard.jpg', label: 'Boulevard Queen', caption: 'OCEAN DRIVE / 6:42 PM — LOOKING FOR TROUBLE' },
  { id: 'pier', file: 'pier.jpg', label: 'The Angler', caption: 'SOUTH PIER / 7:15 AM — ONE LAST CAST' },
  { id: 'skyline', file: 'skyline.jpg', label: 'Skyline Dusk', caption: 'DOWNTOWN / 8:05 PM — LIGHTS ON, BRAKES OFF' },
  { id: 'neon', file: 'neon.jpg', label: 'Neon Street', caption: 'VICE ROW / 11:48 PM — NO WITNESSES' },
  { id: 'ocean', file: 'ocean.jpg', label: 'Speedboat', caption: 'LEONIDA BAY / 5:20 PM — FULL THROTTLE' },
  { id: 'palmroad', file: 'palmroad.jpg', label: 'Palm Road', caption: 'PALM HIGHWAY / 6:02 PM — GOLDEN HOUR RUN' },
];

export const GRADES = {
  vice:     { name: 'Vice Sunset',  stops: [[0, [255, 150, 60]], [0.5, [255, 90, 130]], [1, [90, 30, 120]]], lift: [8, -4, 10], sat: 1.25 },
  neon:     { name: 'Neon Nights',  stops: [[0, [40, 220, 255]], [0.5, [255, 50, 180]], [1, [20, 10, 60]]], lift: [-6, 6, 14], sat: 1.35 },
  palm:     { name: 'Palm Dusk',    stops: [[0, [255, 200, 110]], [0.5, [255, 130, 90]], [1, [70, 40, 100]]], lift: [6, 0, 6], sat: 1.15 },
  magenta:  { name: 'Magenta Heat', stops: [[0, [255, 120, 160]], [0.5, [230, 40, 140]], [1, [60, 10, 80]]], lift: [4, -6, 8], sat: 1.3 },
  teal:     { name: 'Teal Noir',    stops: [[0, [60, 220, 210]], [0.5, [30, 90, 130]], [1, [8, 14, 34]]], lift: [-4, 8, 10], sat: 1.2 },
  golden:   { name: 'Golden Hour',  stops: [[0, [255, 220, 130]], [0.5, [255, 160, 60]], [1, [120, 60, 20]]], lift: [10, 4, -6], sat: 1.2 },
  ink:      { name: 'Ink Poster',   stops: [[0, [255, 230, 90]], [0.5, [255, 90, 40]], [1, [30, 10, 50]]], lift: [0, 0, 0], sat: 1.5, posterize: 5 },
};

export const LAYOUTS = {
  fullbleed: { name: 'Full Bleed', panels: 1 },
  four:      { name: 'Four Panel', panels: 4 },
  hero3:     { name: 'Hero + Three', panels: 4 },
  hero4:     { name: 'Hero + Four', panels: 5 },
  nine:      { name: 'Nine Panel', panels: 9 },
  mosaic:    { name: 'Mosaic Nine', panels: 9 },
  tilted:    { name: 'Tilted Snapshots', panels: 5 },
  story:     { name: 'Story Stack', panels: 3 },
  strip:     { name: 'Poster Strip', panels: 6 },
};

export const PRESETS = [
  { name: 'Vice Sunset Hero', layout: 'hero4', grade: 'vice', title: 'SUNSET HEIST', subtitle: 'Neon Tide', photos: ['boulevard', 'pier', 'skyline', 'neon', 'ocean'], strip: 'ONE COAST • NO RULES • COMING SOON' },
  { name: 'Neon Nights Nine', layout: 'nine', grade: 'neon', title: 'NEON COAST', subtitle: 'Six nights in paradise', photos: ['boulevard', 'neon', 'pier', 'skyline', 'ocean', 'palmroad', 'boulevard', 'neon', 'pier'], strip: 'EVERY LIGHT HAS A PRICE' },
  { name: 'Palm Dusk Strip', layout: 'strip', grade: 'palm', title: 'LEONIDA HEAT', subtitle: 'Boardwalk nights', photos: ['palmroad', 'boulevard', 'ocean', 'pier', 'skyline', 'neon'], strip: 'EVERY SUMMER HAS A STORY' },
  { name: 'Ink Heatwave', layout: 'hero3', grade: 'ink', title: 'HEATWAVE', subtitle: 'Coastline nights', photos: ['boulevard', 'skyline', 'ocean', 'pier'], strip: 'IN STORES SOMEWHERE SOON' },
  { name: 'Golden Getaway', layout: 'mosaic', grade: 'golden', title: 'VICE BLOOM', subtitle: 'Chasing the last light', photos: ['ocean', 'boulevard', 'palmroad', 'pier', 'neon', 'skyline', 'ocean', 'boulevard', 'palmroad'], strip: 'ONE COAST • NO WAY BACK' },
];

export function defaultState() {
  return {
    layout: 'hero4', grade: 'vice', strength: 0.85,
    title: 'SUNSET HEIST', subtitle: 'Neon Tide', titlePos: 'auto',
    halftone: true, halftoneDensity: 0.55, grain: true, vignette: true,
    strip: 'ONE COAST • NO RULES • COMING SOON',
    photos: ['boulevard', 'pier', 'skyline', 'neon', 'ocean'],
    pans: {}, // photoId -> {x, y, zoom} in -1..1 / 1..2.2
    chips: {}, // panel index -> caption string (default from photo)
    starMeter: 5, badge: 'ORIGINAL COVER ART',
  };
}

export function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// --- LUT / pixel-map grade -------------------------------------------------
const gradeCache = new Map();
export function gradedImage(img, gradeId, strength) {
  const key = `${img.src || img.id || 'proc'}|${gradeId}|${strength.toFixed(2)}`;
  if (gradeCache.has(key)) return gradeCache.get(key);
  const g = GRADES[gradeId] || GRADES.vice;
  const maxW = 560;
  const scale = Math.min(1, maxW / img.naturalWidth);
  const w = Math.max(2, Math.round(img.naturalWidth * scale));
  const h = Math.max(2, Math.round(img.naturalHeight * scale));
  const cv = document.createElement('canvas');
  cv.width = w; cv.height = h;
  const cx = cv.getContext('2d');
  cx.drawImage(img, 0, 0, w, h);
  const data = cx.getImageData(0, 0, w, h);
  const d = data.data;
  const s = strength;
  const steps = g.posterize || 0;
  for (let i = 0; i < d.length; i += 4) {
    let r = d[i], gg = d[i + 1], b = d[i + 2];
    // saturation boost (skin-safe: blend toward luminance, keep midtones)
    const lum = 0.299 * r + 0.587 * gg + 0.114 * b;
    const sat = 1 + (g.sat - 1) * s;
    r = lum + (r - lum) * sat; gg = lum + (gg - lum) * sat; b = lum + (b - lum) * sat;
    // 5-stop-ish grade map: push shadows toward stop[2], highlights toward stop[0]
    const t = lum / 255;
    const hi = g.stops[0][1], mid = g.stops[1][1], lo = g.stops[2][1];
    const mix = (base, tint, amt) => base + (tint - base) * amt;
    const amtHi = Math.max(0, t - 0.55) / 0.45 * 0.34 * s;
    const amtLo = Math.max(0, 0.45 - t) / 0.45 * 0.42 * s;
    r = mix(mix(r, mid[0], 0.10 * s), hi[0], amtHi); r = mix(r, lo[0], amtLo);
    gg = mix(mix(gg, mid[1], 0.10 * s), hi[1], amtHi); gg = mix(gg, lo[1], amtLo);
    b = mix(mix(b, mid[2], 0.10 * s), hi[2], amtHi); b = mix(b, lo[2], amtLo);
    r += g.lift[0] * s; gg += g.lift[1] * s; b += g.lift[2] * s;
    if (steps) {
      r = Math.round(r / 255 * steps) / steps * 255;
      gg = Math.round(gg / 255 * steps) / steps * 255;
      b = Math.round(b / 255 * steps) / steps * 255;
    }
    d[i] = Math.max(0, Math.min(255, r));
    d[i + 1] = Math.max(0, Math.min(255, gg));
    d[i + 2] = Math.max(0, Math.min(255, b));
  }
  cx.putImageData(data, 0, 0);
  if (gradeCache.size > 24) gradeCache.clear();
  gradeCache.set(key, cv);
  return cv;
}

// --- layout geometry -------------------------------------------------------
export function panelRects(layout, W, H) {
  const g = Math.max(6, Math.round(W * 0.012)); // cream gutter
  const pad = Math.round(W * 0.018);
  const x0 = pad, y0 = pad, w0 = W - pad * 2, h0 = H - pad * 2;
  const R = (x, y, w, h, rot = 0) => ({ x, y, w, h, rot });
  switch (layout) {
    case 'fullbleed': return [R(x0, y0, w0, h0)];
    case 'four': {
      const cw = (w0 - g) / 2, ch = (h0 - g) / 2;
      return [R(x0, y0, cw, ch), R(x0 + cw + g, y0, cw, ch), R(x0, y0 + ch + g, cw, ch), R(x0 + cw + g, y0 + ch + g, cw, ch)];
    }
    case 'hero3': {
      const hw = w0 * 0.58, rw = w0 - hw - g, rh = (h0 - g * 2) / 3;
      return [R(x0, y0, hw, h0), R(x0 + hw + g, y0, rw, rh), R(x0 + hw + g, y0 + rh + g, rw, rh), R(x0 + hw + g, y0 + 2 * (rh + g), rw, rh)];
    }
    case 'hero4': {
      // Hero besar kiri + 4 panel kanan dalam grid 2x2 (seperti rank 2).
      const hw = w0 * 0.56, rw = w0 - hw - g, cw = (rw - g) / 2, rh = (h0 - g) / 2;
      const rx = x0 + hw + g;
      return [R(x0, y0, hw, h0),
        R(rx, y0, cw, rh), R(rx + cw + g, y0, cw, rh),
        R(rx, y0 + rh + g, cw, rh), R(rx + cw + g, y0 + rh + g, cw, rh)];
    }
    case 'nine': {
      const cw = (w0 - g * 2) / 3, ch = (h0 - g * 2) / 3, out = [];
      for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) out.push(R(x0 + c * (cw + g), y0 + r * (ch + g), cw, ch));
      return out;
    }
    case 'mosaic': {
      const cw = (w0 - g * 2) / 3, ch = (h0 - g * 2) / 3, out = [];
      for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) {
        const big = (r === 0 && c === 0);
        out.push(R(x0 + c * (cw + g), y0 + r * (ch + g), big ? cw * 1.0 : cw, ch));
      }
      out[0] = R(x0, y0, cw * 2 + g, ch * 2 + g);
      out[1] = R(x0 + 2 * (cw + g), y0, cw, ch);
      out[2] = R(x0 + 2 * (cw + g), y0 + ch + g, cw, ch);
      out[3] = R(x0, y0 + 2 * (ch + g), cw, ch);
      out[4] = R(x0 + cw + g, y0 + 2 * (ch + g), cw, ch);
      out[5] = R(x0 + 2 * (cw + g), y0 + 2 * (ch + g), cw, ch);
      return out.slice(0, 6);
    }
    case 'tilted': {
      const cw = w0 * 0.46, ch = h0 * 0.42;
      return [R(x0 + w0 * 0.04, y0 + h0 * 0.03, cw, ch, -3), R(x0 + w0 * 0.5, y0 + h0 * 0.02, cw, ch, 2.5),
        R(x0 + w0 * 0.02, y0 + h0 * 0.52, cw, ch, 2), R(x0 + w0 * 0.52, y0 + h0 * 0.53, cw, ch, -2),
        R(x0 + w0 * 0.27, y0 + h0 * 0.30, cw * 0.9, ch * 0.85, 0)];
    }
    case 'story': {
      const ch = (h0 - g * 2) / 3;
      return [R(x0, y0, w0, ch), R(x0, y0 + ch + g, w0, ch), R(x0, y0 + 2 * (ch + g), w0, ch)];
    }
    case 'strip': {
      const stripH = Math.round(h0 * 0.16), top = h0 - stripH;
      const cw = (w0 - g * 2) / 3, ch = (top - g * 2) / 3, out = [];
      for (let r = 0; r < 2; r++) for (let c = 0; c < 3; c++) out.push(R(x0 + c * (cw + g), y0 + r * (ch + g), cw, ch));
      return out;
    }
    default: return [R(x0, y0, w0, h0)];
  }
}

// dark-zone detection: average luminance of top vs bottom third of a canvas
function zoneLuminance(imgCv) {
  const cv = document.createElement('canvas');
  cv.width = 24; cv.height = 24;
  const cx = cv.getContext('2d');
  cx.drawImage(imgCv, 0, 0, 24, 24);
  const d = cx.getImageData(0, 0, 24, 24).data;
  let top = 0, bot = 0;
  for (let y = 0; y < 24; y++) for (let x = 0; x < 24; x++) {
    const i = (y * 24 + x) * 4, l = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
    if (y < 8) top += l; else if (y >= 16) bot += l;
  }
  return { top: top / (24 * 8), bottom: bot / (24 * 8) };
}

function drawPanel(ctx, img, rect, pan, state, index, images, hideChip) {
  const { x, y, w, h, rot } = rect;
  if (w <= 0 || h <= 0) return;
  ctx.save();
  if (rot) { ctx.translate(x + w / 2, y + h / 2); ctx.rotate(rot * Math.PI / 180); ctx.translate(-w / 2, -h / 2); }
  else ctx.translate(x, y);
  ctx.beginPath(); ctx.rect(0, 0, w, h); ctx.clip();
  const graded = gradedImage(img, state.grade, state.strength);
  const iw = graded.width, ih = graded.height;
  const base = Math.max(w / iw, h / ih);
  const zoom = base * (pan?.zoom || 1);
  const pw = iw * zoom, ph = ih * zoom;
  const ox = (w - pw) / 2 + (pan?.x || 0) * w * 0.25;
  const oy = (h - ph) / 2 + (pan?.y || 0) * h * 0.25;
  ctx.drawImage(graded, ox, oy, pw, ph);
  // halftone dots across the sky band (top 38% of the panel)
  if (state.halftone) {
    const rnd = mulberry32(9000 + index * 77);
    const gap = Math.max(5, Math.round(w * 0.028 * (1.4 - state.halftoneDensity)));
    ctx.fillStyle = 'rgba(20,8,30,0.16)';
    for (let yy = gap / 2; yy < h * 0.32; yy += gap) {
      for (let xx = gap / 2; xx < w; xx += gap) {
        const r = gap * 0.16 * (0.6 + rnd() * 0.8) * state.halftoneDensity * 2;
        ctx.beginPath(); ctx.arc(xx, yy, Math.max(0.6, r), 0, Math.PI * 2); ctx.fill();
      }
    }
  }
  // chip caption, bottom-left of the panel (skipped on the hero panel when
  // the title sits at the bottom — the title would cover it anyway)
  const photoId = state.photos[index % state.photos.length];
  const photo = PHOTOS.find(p => p.id === photoId);
  const cap = state.chips[index] ?? photo?.caption ?? '';
  if (cap && !hideChip) {
    const padX = Math.round(w * 0.02), padY = Math.round(h * 0.035);
    const maxW = w * 0.94 - padX * 2;
    let fs = Math.max(11, Math.round(w * 0.028));
    ctx.font = `bold ${fs}px Arial, sans-serif`;
    while (ctx.measureText(cap).width > maxW && fs > 9) {
      fs -= 1;
      ctx.font = `bold ${fs}px Arial, sans-serif`;
    }
    let text = cap;
    if (ctx.measureText(text).width > maxW) {
      while (text.length > 4 && ctx.measureText(text + '…').width > maxW) text = text.slice(0, text.lastIndexOf(' ') > 4 ? text.lastIndexOf(' ') : text.length - 1);
      text += '…';
    }
    const tw = ctx.measureText(text).width;
    const bw = tw + padX * 2, bh = Math.max(18, Math.round(h * 0.075));
    ctx.fillStyle = 'rgba(8,4,16,0.82)';
    ctx.beginPath();
    const bx = padX, by = h - bh - padY;
    ctx.roundRect(bx, by, bw, bh, bh / 2.4); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    ctx.fillText(text, bx + padX, by + bh / 2 + 1);
  }
  ctx.restore();
}

function drawStarburst(ctx, cx, cy, r, fill, label) {
  ctx.save(); ctx.translate(cx, cy);
  ctx.beginPath();
  for (let i = 0; i < 28; i++) {
    const a = (i / 28) * Math.PI * 2, rr = i % 2 === 0 ? r : r * 0.72;
    const px = Math.cos(a) * rr, py = Math.sin(a) * rr;
    if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
  }
  ctx.closePath(); ctx.fillStyle = fill; ctx.fill();
  ctx.lineWidth = 2; ctx.strokeStyle = 'rgba(0,0,0,0.35)'; ctx.stroke();
  ctx.fillStyle = '#1a0a2e'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.font = `bold ${Math.max(9, Math.round(r * 0.22))}px Arial, sans-serif`;
  const words = label.split(' ');
  words.forEach((wd, i) => ctx.fillText(wd, 0, (i - (words.length - 1) / 2) * r * 0.26));
  ctx.restore();
}

export function renderCover(canvas, state, images) {
  const ctx = canvas.getContext('2d');
  const W = canvas.width, H = canvas.height;
  // cream frame
  ctx.fillStyle = '#f6ead2'; ctx.fillRect(0, 0, W, H);
  // The bottom strip is reserved first: panels end above it, so no chip or
  // panel bottom ever hides under the strip.
  const stripH = state.layout === 'strip' ? Math.round(H * 0.13) : Math.round(H * 0.055);
  const contentH = H - stripH;
  const rects = panelRects(state.layout, W, contentH);
  const heroImg = images.get(state.photos[0]);
  // --- lettering placement: dark-zone aware (decided before panels draw,
  // so the hero chip can be hidden when the title sits at the bottom) ---
  let placeTop = state.titlePos === 'top';
  if (state.titlePos === 'auto' && heroImg) {
    const z = zoneLuminance(gradedImage(heroImg, state.grade, state.strength));
    placeTop = z.top < z.bottom;
  } else if (state.titlePos === 'auto') placeTop = false;
  rects.forEach((rect, i) => {
    const pid = state.photos[i % state.photos.length];
    const img = images.get(pid);
    if (!img) return;
    drawPanel(ctx, img, rect, state.pans[pid], state, i, images, i === 0 && !placeTop);
    // white gutter border per panel
    ctx.save();
    ctx.strokeStyle = '#f6ead2'; ctx.lineWidth = Math.max(3, Math.round(W * 0.006));
    ctx.strokeRect(rect.x, rect.y, rect.w, rect.h);
    ctx.restore();
  });
  // --- lettering (placement decided above, before the panels) ---
  const title = (state.title || 'SUNSET HEIST').toUpperCase();
  let tSize = Math.round(W * (title.length > 12 ? 0.115 : 0.14));
  ctx.save();
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.font = `${tSize}px Anton, 'Arial Black', sans-serif`;
  while (ctx.measureText(title).width > W * 0.94 && tSize > 20) {
    tSize -= 4;
    ctx.font = `${tSize}px Anton, 'Arial Black', sans-serif`;
  }
  const ty = placeTop ? contentH * 0.16 : contentH * 0.87;
  const grad = ctx.createLinearGradient(0, ty - tSize / 2, 0, ty + tSize / 2);
  grad.addColorStop(0, '#ffe259'); grad.addColorStop(0.5, '#ff7e2e'); grad.addColorStop(1, '#ff2e88');
  ctx.font = `${tSize}px Anton, 'Arial Black', sans-serif`;
  ctx.lineJoin = 'round';
  ctx.shadowColor = 'rgba(0,0,0,0.55)'; ctx.shadowBlur = tSize * 0.18; ctx.shadowOffsetY = tSize * 0.05;
  ctx.strokeStyle = '#14061f'; ctx.lineWidth = tSize * 0.16;
  ctx.strokeText(title, W / 2, ty);
  ctx.fillStyle = grad; ctx.fillText(title, W / 2, ty);
  ctx.shadowColor = 'transparent'; ctx.shadowBlur = 0; ctx.shadowOffsetY = 0;
  // subtitle script overlapping the title's lower edge
  const sub = state.subtitle || '';
  if (sub) {
    const sSize = Math.round(W * 0.052);
    const sy = ty + (placeTop ? tSize * 0.62 : -tSize * 0.62);
    ctx.font = `${sSize}px Pacifico, cursive`;
    ctx.lineWidth = sSize * 0.14; ctx.strokeStyle = '#14061f';
    ctx.strokeText(sub, W / 2, sy);
    ctx.fillStyle = '#ff5fa2'; ctx.fillText(sub, W / 2, sy);
  }
  ctx.restore();
  // starburst badge, top-right
  drawStarburst(ctx, W * 0.88, H * 0.10, Math.round(W * 0.075), '#ffd23e', state.badge || 'ORIGINAL COVER ART');
  // star meter + edition line, top-left on a dark pill (never collides with
  // the title, which sits at the bottom in the default placement)
  const smY = Math.round(H * 0.045);
  ctx.save();
  ctx.font = `${Math.round(W * 0.042)}px Arial, sans-serif`;
  ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
  const estText = 'EST. 2026  •  VOL. 01';
  ctx.font = `bold ${Math.round(W * 0.026)}px Arial, sans-serif`;
  const estW = ctx.measureText(estText).width;
  const starsW = W * 0.05 * 5;
  const pillW = W * 0.045 + starsW + W * 0.01 + estW + W * 0.03;
  const pillH = Math.round(H * 0.055);
  ctx.fillStyle = 'rgba(8,4,16,0.72)';
  ctx.beginPath(); ctx.roundRect(W * 0.02, smY - pillH / 2, pillW, pillH, pillH / 2); ctx.fill();
  let sx = W * 0.045;
  ctx.font = `${Math.round(W * 0.042)}px Arial, sans-serif`;
  for (let i = 0; i < 5; i++) {
    ctx.fillStyle = i < state.starMeter ? '#ffd23e' : 'rgba(255,255,255,0.35)';
    ctx.fillText('★', sx, smY); sx += W * 0.05;
  }
  ctx.fillStyle = '#fff'; ctx.font = `bold ${Math.round(W * 0.026)}px Arial, sans-serif`;
  ctx.fillText(estText, sx + W * 0.01, smY);
  ctx.restore();
  // bottom strip tagline
  ctx.save();
  ctx.fillStyle = 'rgba(10,4,20,0.88)';
  ctx.fillRect(0, H - stripH, W, stripH);
  ctx.fillStyle = '#ffe9a8'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.font = `bold ${Math.round(W * 0.030)}px Arial, sans-serif`;
  ctx.fillText((state.strip || '').toUpperCase(), W / 2, H - stripH / 2);
  // palm silhouettes on the strip
  ctx.fillStyle = '#0a0414';
  for (const px0 of [W * 0.06, W * 0.93]) {
    ctx.beginPath(); ctx.moveTo(px0, H - 4);
    ctx.lineTo(px0 - W * 0.012, H - stripH * 0.72); ctx.lineTo(px0 + W * 0.012, H - stripH * 0.72);
    ctx.closePath(); ctx.fill();
  }
  ctx.restore();
  // vignette + seeded grain, identical in preview and export
  if (state.vignette) {
    const vg = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.42, W / 2, H / 2, Math.max(W, H) * 0.72);
    vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(10,4,20,0.34)');
    ctx.fillStyle = vg; ctx.fillRect(0, 0, W, H);
  }
  if (state.grain) {
    const rnd = mulberry32(4242);
    ctx.fillStyle = 'rgba(255,255,255,0.05)';
    for (let i = 0; i < 2600; i++) ctx.fillRect(rnd() * W, rnd() * H, 1.4, 1.4);
    ctx.fillStyle = 'rgba(0,0,0,0.06)';
    for (let i = 0; i < 1800; i++) ctx.fillRect(rnd() * W, rnd() * H, 1.4, 1.4);
  }
}
