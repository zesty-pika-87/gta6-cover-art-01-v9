"""Generate 4 textured procedural sample photos (1080x720 JPEG) for Cover Coast v9.
Deterministic (seeded), drawn with PIL only: noisy gradient skies, sun glow,
silhouettes with lit windows, palm fronds, ocean waves, neon signs, film grain.
Written fresh in this session for gta6-cover-art-01-v9."""
import math, random
from PIL import Image, ImageDraw, ImageFilter

W, H = 1080, 720
OUT = "app/samples"

def noise(img, amt, seed):
    rnd = random.Random(seed)
    px = img.load()
    for y in range(H):
        for x in range(0, W, 2):
            n = rnd.randint(-amt, amt)
            for xx in (x, x + 1):
                if xx < W:
                    r, g, b = px[xx, y]
                    px[xx, y] = (max(0, min(255, r + n)), max(0, min(255, g + n)), max(0, min(255, b + n)))
    return img

def vgrad(w, h, stops):
    img = Image.new("RGB", (w, h))
    px = img.load()
    for y in range(h):
        t = y / max(1, h - 1)
        for i in range(len(stops) - 1):
            t0, c0 = stops[i]; t1, c1 = stops[i + 1]
            if t0 <= t <= t1:
                f = 0 if t1 == t0 else (t - t0) / (t1 - t0)
                px[0, y] = tuple(int(c0[k] + (c1[k] - c0[k]) * f) for k in range(3))
                break
        else:
            px[0, y] = stops[-1][1]
    for x in range(1, w):
        for y in range(h):
            px[x, y] = px[0, y]
    return img

def sun(d, cx, cy, r, core, glow):
    for rr in range(r, 0, -6):
        a = 1 - rr / r
        col = tuple(int(glow[k] + (core[k] - glow[k]) * a) for k in range(3))
        d.ellipse([cx - rr, cy - rr, cx + rr, cy + rr], fill=col)
    d.ellipse([cx - r // 3, cy - r // 3, cx + r // 3, cy + r // 3], fill=core)

def palm(d, x, y, s, col, rnd):
    d.line([x, y, x + 6 * s, y - 150 * s], fill=col, width=max(3, int(7 * s)))
    top = (x + 6 * s, y - 150 * s)
    for a in range(7):
        ang = math.pi * (0.08 + 0.14 * a)
        ex = top[0] + math.cos(ang) * 95 * s * (1 if a < 4 else -1)
        ey = top[1] - math.sin(ang) * 55 * s
        pts = []
        for t in range(9):
            f = t / 8
            pts.append((top[0] + (ex - top[0]) * f, top[1] + (ey - top[1]) * f - 18 * s * math.sin(math.pi * f)))
        d.line(pts, fill=col, width=max(2, int(4 * s)))
    for _ in range(5):
        cx0 = x + rnd.randint(-30, 10)
        d.ellipse([cx0, y - rnd.randint(0, 20), cx0 + rnd.randint(10, 40), y + 8], fill=col)

def skyline(d, base, col, win_cols, rnd, seed):
    x = -20
    while x < W + 40:
        bw = rnd.randint(55, 130); bh = rnd.randint(90, 300)
        d.rectangle([x, base - bh, x + bw, base], fill=col)
        for wy in range(base - bh + 12, base - 10, 26):
            for wx in range(x + 8, x + bw - 8, 20):
                if rnd.random() < 0.45:
                    d.rectangle([wx, wy, wx + 9, wy + 13], fill=rnd.choice(win_cols))
        if rnd.random() < 0.3:
            d.rectangle([x + bw // 2 - 3, base - bh - 26, x + bw // 2 + 3, base - bh], fill=col)
        x += bw + rnd.randint(4, 18)

def grain_finish(img, seed, amt=14):
    return noise(img, amt, seed).filter(ImageFilter.GaussianBlur(0.4))

# --- 1. sunset skyline -------------------------------------------------------
rnd = random.Random(11)
img = vgrad(W, H, [(0.0, (255, 122, 26)), (0.45, (255, 84, 112)), (0.7, (94, 38, 110)), (1.0, (30, 12, 54))])
d = ImageDraw.Draw(img)
sun(d, 760, 330, 150, (255, 236, 170), (255, 110, 60))
for i in range(60):
    sx, sy = rnd.randint(0, W - 3), rnd.randint(0, 300)
    d.ellipse([sx, sy, sx + 2, sy + 2], fill=(255, 220, 180))
skyline(d, 560, (38, 14, 58), [(255, 190, 90), (255, 120, 160), (140, 240, 255)], rnd, 11)
d.rectangle([0, 560, W, H], fill=(24, 8, 44))
for i in range(26):
    y = 580 + i * 5
    d.line([0, y, W, y], fill=(255, 120 + i, 90), width=2)
palm(d, 90, 700, 1.15, (16, 5, 30), rnd)
palm(d, 990, 710, 0.95, (16, 5, 30), rnd)
img = grain_finish(img, 101)
img.save(f"{OUT}/skyline.jpg", quality=88)

# --- 2. neon street ----------------------------------------------------------
rnd = random.Random(22)
img = vgrad(W, H, [(0.0, (12, 8, 38)), (0.55, (38, 10, 64)), (1.0, (8, 4, 22))])
d = ImageDraw.Draw(img)
skyline(d, 470, (14, 8, 34), [(255, 60, 180), (60, 230, 255), (255, 210, 80)], rnd, 22)
for sx, sy, col, txt in [(150, 180, (255, 45, 150), "NEON"), (620, 140, (40, 220, 255), "VICE"),
                         (880, 240, (255, 200, 60), "24H"), (380, 260, (120, 255, 170), "OPEN")]:
    d.rectangle([sx - 8, sy - 8, sx + 150, sy + 42], outline=col, width=4)
    d.ellipse([sx - 30, sy - 30, sx + 180, sy + 70], outline=col, width=2)
    d.text((sx + 6, sy + 4), txt, fill=col)
d.polygon([(0, 720), (430, 470), (650, 470), (1080, 720)], fill=(26, 12, 44))
for i in range(40):
    x = 470 + i * 5
    d.line([x, 470 + i * 6, x, 470 + i * 6 + 3], fill=(255, 60, 180), width=3)
for i in range(18):
    y = 500 + i * 12
    d.line([480, y, 600, y], fill=(60, 220, 255), width=2)
palm(d, 60, 700, 1.0, (8, 4, 20), rnd)
img = grain_finish(img, 202)
img.save(f"{OUT}/neon.jpg", quality=88)

# --- 3. ocean / speedboat ----------------------------------------------------
rnd = random.Random(33)
img = vgrad(W, H, [(0.0, (255, 170, 80)), (0.4, (255, 110, 120)), (0.55, (60, 90, 180)), (1.0, (8, 30, 90))])
d = ImageDraw.Draw(img)
sun(d, 540, 300, 120, (255, 240, 190), (255, 130, 70))
for y in range(400, H, 14):
    f = (y - 400) / 320
    for x in range(0, W, 26):
        wob = int(10 * math.sin(x / 60 + y / 30))
        col = (int(20 + 200 * f), int(60 + 120 * f), int(140 + 60 * f))
        d.line([x, y + wob, x + 18, y + wob], fill=col, width=5)
d.polygon([(300, 470), (760, 470), (700, 520), (360, 520)], fill=(245, 245, 250))
d.polygon([(430, 470), (470, 380), (500, 470)], fill=(20, 20, 40))
d.rectangle([300, 515, 760, 535], fill=(200, 30, 60))
for i in range(30):
    d.ellipse([280 + i * 16, 535 + rnd.randint(-4, 10), 300 + i * 16, 545 + rnd.randint(0, 14)], fill=(240, 250, 255))
img = grain_finish(img, 303)
img.save(f"{OUT}/ocean.jpg", quality=88)

# --- 4. palm road ------------------------------------------------------------
rnd = random.Random(44)
img = vgrad(W, H, [(0.0, (255, 190, 110)), (0.45, (255, 120, 140)), (0.7, (120, 60, 140)), (1.0, (40, 20, 70))])
d = ImageDraw.Draw(img)
sun(d, 540, 360, 130, (255, 238, 180), (255, 120, 80))
d.polygon([(430, 720), (510, 420), (570, 420), (650, 720)], fill=(30, 14, 50))
for i in range(9):
    y = 440 + i * 32
    wdt = 6 + i * 2
    d.rectangle([535 - wdt // 2, y, 545 + wdt // 2, y + 16], fill=(255, 220, 120))
for side in (-1, 1):
    for i, (px_, py_) in enumerate([(180, 640), (300, 540), (400, 470), (880, 640), (770, 540), (670, 470)]):
        if (side < 0) == (px_ < 540):
            palm(d, px_, py_, 0.55 + 0.13 * i, (24, 8, 44), rnd)
d.rectangle([0, 640, W, H], fill=(26, 12, 46))
img = grain_finish(img, 404)
img.save(f"{OUT}/palmroad.jpg", quality=88)
print("samples done")
