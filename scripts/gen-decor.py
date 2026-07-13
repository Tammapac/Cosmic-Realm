# ── Cosmic Realm decor generator (Phase 11: world enrichment) ────────────────
# Builds a reusable library of small/medium decorative sprites + per-zone
# placement manifests. Purely ADDITIVE: existing background layers are never
# touched — the renderer draws these as extra world-anchored parallax sprites.
#
# Library (frontend/public/bg/decor/*.png):
#   - ~100 procedurally painted pixel-art sprites (original, in-house):
#     satellites, metal debris, hull fragments, pipes, pylons, platforms,
#     machinery, containers, drones, nav beacons, ruins, gate fragments,
#     monolith shards, dead engines, comm dishes, crystals, biomech pods
#   - FX sprites baked white/grayscale, tinted per zone at runtime:
#     nebula puffs (NASA-derived), glow dots, anomaly rings, rifts, embers,
#     star shimmer patches
#   - Kenney "Space Shooter Redux" (CC0) UFOs/wings/engines reworked to the
#     game style (abandoned satellites + floating metal debris)
#
# Manifests (frontend/public/bg/<zone>/decor_<zone>.json):
#   Story clusters per zone theme (mining outposts, battlefields, ruins,
#   crystal fields, bio nests, anomalies, energy farms, graveyards, comm
#   posts) + scattered singles + ambient FX. Randomized rotation, scale,
#   tint, alpha, parallax band and animation (spin/pulse/blink/drift).
#
# Usage: py scripts/gen-decor.py [zone ...]
import json, math, os, random, sys
import numpy as np
from PIL import Image, ImageDraw, ImageFilter

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BG = os.path.join(ROOT, "frontend", "public", "bg")
DECOR = os.path.join(BG, "decor")
CACHE = os.path.join(ROOT, "scripts", "nasa_cache")
KPARTS = os.path.join(ROOT, "scripts", "asset_src", "kenney_parts")
os.makedirs(DECOR, exist_ok=True)

STEEL = np.array([132, 140, 158], dtype=np.float32)   # neutral hull tone
STEEL_D = np.array([84, 90, 104], dtype=np.float32)

def hex_rgb(h):
    h = h.lstrip("#")
    return np.array([int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16)], dtype=np.float32)

def tup(c, mul=1.0):
    return tuple(int(min(255, v * mul)) for v in c)

# ── shared finishing: shade, rim light, emissive glow, outline, pixelate ────
def finish(im, em=None, glow="#ffd27a", pixel=2, outline=True):
    arr = np.asarray(im).astype(np.float32)
    h, w = arr.shape[:2]
    y, x = np.mgrid[0:h, 0:w].astype(np.float32)
    shade = 1.14 - ((x + y) / (w + h)) * 0.42
    arr[..., :3] = np.clip(arr[..., :3] * shade[..., None], 0, 255)
    op = arr[..., 3] > 40
    rim = np.zeros_like(op)
    rim[1:, 1:] = op[1:, 1:] & (~op[:-1, 1:] | ~op[1:, :-1])
    arr[..., :3][rim] = np.clip(arr[..., :3][rim] * 1.8 + 30, 0, 255)
    im = Image.fromarray(arr.astype(np.uint8), "RGBA")
    if em is not None:
        lum = np.asarray(em, dtype=np.float32) / 255
        halo = np.asarray(em.filter(ImageFilter.GaussianBlur(4)), dtype=np.float32) / 255
        g = np.maximum(lum, halo * 0.6)
        col = hex_rgb(glow)
        white = np.array([255, 255, 255], dtype=np.float32)
        core = np.clip(lum * 1.8 - 0.4, 0, 1)[..., None]
        grgb = col[None, None] * (1 - core * 0.7) + white[None, None] * core * 0.7
        glay = Image.fromarray(np.concatenate([grgb, (g * 0.85)[..., None] * 255], axis=2).astype(np.uint8), "RGBA")
        base = glay.copy()
        base.alpha_composite(im)
        core_l = Image.fromarray(np.concatenate([grgb, (lum * 0.95)[..., None] * 255], axis=2).astype(np.uint8), "RGBA")
        base.alpha_composite(core_l)
        im = base
    a = np.asarray(im).copy()
    if outline:
        solid = a[..., 3] > 90
        er = np.zeros_like(solid)
        er[1:-1, 1:-1] = (~solid[1:-1, 1:-1]) & (solid[:-2, 1:-1] | solid[2:, 1:-1] | solid[1:-1, :-2] | solid[1:-1, 2:])
        a[er] = [8, 7, 7, 255]
    out = Image.fromarray(a, "RGBA")
    return out.resize((out.width * pixel, out.height * pixel), Image.NEAREST)

def canvas(w, h):
    im = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    em = Image.new("L", (w, h), 0)
    return im, ImageDraw.Draw(im), em, ImageDraw.Draw(em)

def save(name, img):
    img.save(os.path.join(DECOR, f"{name}.png"), optimize=True)

# ── structural painters (steel palette, tint-friendly) ──────────────────────
def p_satellite(r):
    im, d, em, ed = canvas(46, 40)
    cx, cy = 23, 20
    d.rectangle([cx - 5, cy - 4, cx + 5, cy + 4], fill=tup(STEEL))              # body
    for sx in (-1, 1):                                                          # solar wings
        x0 = cx + sx * 6
        x1 = cx + sx * (14 + r.randint(0, 4))
        d.rectangle([min(x0, x1), cy - 3, max(x0, x1), cy + 3], fill=tup(np.array([70, 90, 140], np.float32)))
        for gx in range(min(x0, x1) + 1, max(x0, x1), 3):
            d.line([gx, cy - 3, gx, cy + 3], fill=tup(STEEL_D))
    d.line([cx, cy - 4, cx, cy - 10], fill=tup(STEEL), width=1)                  # mast
    d.ellipse([cx - 3, cy - 13, cx + 3, cy - 8], outline=tup(STEEL, 1.2))        # dish
    if r.random() < 0.8:
        ed.point((cx + r.choice([-4, 4]), cy + r.choice([-3, 3])), fill=255)     # status light
    return finish(im, em, "#ff5c5c" if r.random() < 0.5 else "#5cff8a")

def p_debris(r):
    s = r.randint(14, 30)
    im, d, em, ed = canvas(s + 6, s + 6)
    cx = (s + 6) / 2
    pts = []
    n = r.randint(5, 8)
    for i in range(n):
        a = math.tau * i / n
        rad = (s / 2) * (0.55 + r.random() * 0.45)
        pts.append((cx + math.cos(a) * rad, cx + math.sin(a) * rad))
    d.polygon(pts, fill=tup(STEEL, 0.8 + r.random() * 0.35))
    for _ in range(r.randint(1, 3)):                                             # panel lines
        a = r.uniform(0, math.tau)
        d.line([cx, cx, cx + math.cos(a) * s * 0.4, cx + math.sin(a) * s * 0.4], fill=tup(STEEL_D))
    if r.random() < 0.3:
        ed.point((int(cx + r.gauss(0, 3)), int(cx + r.gauss(0, 3))), fill=r.randint(120, 220))
    return finish(im, em, "#ff8a4e")

def p_hull(r):
    im, d, em, ed = canvas(58, 34)
    y0 = 10 + r.randint(-3, 3)
    pts = [(4, y0), (30, y0 - 5), (52, y0 - 2), (54, y0 + 8)]
    for k in range(5):                                                           # torn lower edge
        pts.append((50 - k * 10, y0 + 12 + (k % 2) * 5 + r.randint(-2, 2)))
    d.polygon(pts, fill=tup(STEEL, 0.9))
    for wx in range(10, 48, 6):                                                  # dead windows, one alive
        alive = r.random() < 0.18
        d.point((wx, y0 + 3), fill=(255, 220, 140, 255) if alive else tup(STEEL_D))
        if alive: ed.point((wx, y0 + 3), fill=220)
    return finish(im, em, "#ffd27a")

def p_pipe(r):
    ln = r.randint(26, 46)
    im, d, em, ed = canvas(ln + 8, 18)
    y = 9
    d.rectangle([4, y - 3, 4 + ln, y + 3], fill=tup(STEEL, 0.95))
    d.line([4, y - 3, 4 + ln, y - 3], fill=tup(STEEL, 1.3))
    for fx in (4, 4 + ln - 3):                                                   # flanges
        d.rectangle([fx, y - 5, fx + 3, y + 5], fill=tup(STEEL_D, 1.1))
    if r.random() < 0.5:                                                         # elbow stub
        mx = 4 + ln // 2
        d.rectangle([mx - 3, y - 9, mx + 3, y], fill=tup(STEEL, 0.9))
    return finish(im, em)

def p_pylon(r):
    im, d, em, ed = canvas(22, 46)
    cx = 11
    d.polygon([(cx - 2, 6), (cx + 2, 6), (cx + 4, 42), (cx - 4, 42)], fill=tup(STEEL, 0.9))
    for ry in (14, 22, 30):                                                      # insulator rings
        d.line([cx - 5, ry, cx + 5, ry], fill=tup(STEEL_D, 1.2), width=2)
    ed.ellipse([cx - 2, 2, cx + 2, 6], fill=255)                                 # emitter tip
    return finish(im, em, "#7fd9ff")

def p_platform(r):
    w = r.randint(34, 50)
    im, d, em, ed = canvas(w + 8, 26)
    cx = (w + 8) / 2
    d.polygon([(6, 10), (w + 2, 10), (w - 2, 18), (10, 18)], fill=tup(STEEL, 0.95))
    d.polygon([(6, 10), (w + 2, 10), (w + 2, 13), (6, 13)], fill=tup(STEEL, 1.2))
    for lx in range(10, w, 8):                                                   # edge lights
        if r.random() < 0.6: ed.point((lx, 11), fill=200)
    d.line([int(cx), 18, int(cx), 23], fill=tup(STEEL_D), width=2)               # keel
    return finish(im, em, "#ffd27a")

def p_machinery(r):
    im, d, em, ed = canvas(36, 30)
    d.rectangle([4, 8, 30, 26], fill=tup(STEEL, 0.85))
    d.rectangle([8, 4, 16, 8], fill=tup(STEEL_D, 1.1))                            # stack
    for vy in range(11, 24, 4):                                                  # vents
        d.line([7, vy, 15, vy], fill=tup(STEEL_D))
    d.ellipse([20, 12, 27, 19], outline=tup(STEEL, 1.25))                         # gear/port
    if r.random() < 0.6: ed.point((23, 22), fill=230)
    return finish(im, em, "#ff8a4e")

def p_container(r):
    im, d, em, ed = canvas(30, 20)
    col = STEEL * (0.75 + r.random() * 0.4)
    d.rectangle([3, 4, 27, 16], fill=tup(col))
    for gx in range(6, 26, 4):
        d.line([gx, 4, gx, 16], fill=tup(col * 0.75))
    d.rectangle([3, 4, 27, 6], fill=tup(col * 1.2))
    return finish(im, em)

def p_drone(r):
    im, d, em, ed = canvas(18, 14)
    d.ellipse([6, 5, 12, 10], fill=tup(STEEL))
    d.line([2, 7, 6, 7], fill=tup(STEEL_D), width=1)
    d.line([12, 7, 16, 7], fill=tup(STEEL_D), width=1)
    ed.point((9, 6), fill=255)
    return finish(im, em, "#5cff8a")

def p_buoy(r):
    im, d, em, ed = canvas(14, 22)
    d.line([7, 6, 7, 18], fill=tup(STEEL), width=2)
    d.polygon([(4, 18), (10, 18), (8, 21), (6, 21)], fill=tup(STEEL_D))
    ed.ellipse([5, 3, 9, 7], fill=255)
    return finish(im, em, r.choice(["#ffb84e", "#ff5c5c", "#5cd9ff"]))

def p_ruin(r):
    kind = r.random()
    if kind < 0.5:                                                               # broken column
        im, d, em, ed = canvas(18, 36)
        h = r.randint(18, 26)
        d.rectangle([6, 32 - h, 12, 32], fill=tup(STEEL * 0.9 + np.array([26, 18, 4], np.float32)))
        d.rectangle([4, 32 - h - 4, 14, 32 - h], fill=tup(STEEL_D * 1.15))
        d.polygon([(6, 32 - h), (12, 32 - h), (10, 32 - h - 5)], fill=tup(STEEL_D))
        if r.random() < 0.5: ed.line([7, 20, 11, 20], fill=200, width=2)          # glyph
    else:                                                                        # wall/arch chunk
        im, d, em, ed = canvas(30, 24)
        d.polygon([(4, 20), (8, 8), (18, 5), (26, 10), (24, 20)], fill=tup(STEEL * 0.85 + np.array([24, 16, 2], np.float32)))
        d.arc([8, 8, 24, 24], 200, 320, fill=tup(STEEL_D), width=2)
        if r.random() < 0.6: ed.line([12, 14, 17, 14], fill=190, width=2)
    return finish(im, em, "#ffd25e")

def p_gatefrag(r):
    im, d, em, ed = canvas(34, 30)
    d.arc([2, 2, 44, 44], 195, 275, fill=tup(STEEL * 0.95), width=6)
    ed.arc([5, 5, 41, 41], 205, 265, fill=170, width=2)
    return finish(im, em, "#ffd25e")

def p_monoshard(r):
    im, d, em, ed = canvas(16, 30)
    sk = r.randint(-3, 3)
    d.polygon([(5 + sk, 4), (11 + sk, 4), (13, 26), (3, 26)], fill=tup(STEEL_D * 1.1))
    ed.line([7, r.randint(9, 13), 10, r.randint(9, 13)], fill=230, width=2)
    return finish(im, em, "#c9a2ff")

def p_engine(r):
    im, d, em, ed = canvas(28, 22)
    d.rectangle([3, 6, 16, 16], fill=tup(STEEL, 0.9))
    d.polygon([(16, 5), (25, 3), (25, 19), (16, 17)], fill=tup(STEEL_D, 1.1))
    if r.random() < 0.4: ed.ellipse([22, 8, 27, 14], fill=140)                    # faint dying glow
    return finish(im, em, "#7fd9ff")

def p_dish(r):
    im, d, em, ed = canvas(26, 24)
    d.polygon([(6, 4), (22, 8), (12, 20)], fill=tup(STEEL, 1.05))
    d.line([12, 12, 18, 18], fill=tup(STEEL_D), width=2)
    d.rectangle([16, 17, 21, 21], fill=tup(STEEL_D, 1.1))
    ed.point((9, 8), fill=200)
    return finish(im, em, "#5cd9ff")

def p_crystal(r):
    im, d, em, ed = canvas(24, 28)
    cx, cy = 12, 24
    n = r.randint(2, 4)
    for i in range(n):
        a = -math.pi / 2 + (i / max(1, n - 1) - 0.5) * 1.1 + r.gauss(0, 0.08)
        ln = r.randint(10, 20)
        wd = r.randint(3, 5)
        tx, ty = cx + math.cos(a) * ln, cy + math.sin(a) * ln
        nx, ny = -math.sin(a), math.cos(a)
        d.polygon([(cx - nx * wd, cy - ny * wd), (tx, ty), (cx, cy)], fill=(205, 215, 235, 255))
        d.polygon([(cx + nx * wd, cy + ny * wd), (tx, ty), (cx, cy)], fill=(120, 130, 158, 255))
        ed.line([cx, cy - 2, tx, ty], fill=150, width=2)
        ed.point((tx, ty), fill=255)
    d.ellipse([cx - 7, cy - 4, cx + 7, cy + 3], fill=tup(STEEL_D))
    return finish(im, em, "#ffffff")   # tinted per zone at runtime

def p_biopod(r):
    im, d, em, ed = canvas(22, 20)
    d.ellipse([3, 5, 19, 17], fill=(52, 44, 58, 255))
    d.ellipse([6, 8, 12, 13], fill=(72, 60, 80, 255))
    for _ in range(r.randint(2, 4)):
        px, py = r.randint(6, 16), r.randint(7, 15)
        ed.ellipse([px - 1, py - 1, px + 1, py + 1], fill=255)
    return finish(im, em, "#ffffff")

# ── FX painters (white/gray — tinted at runtime with zone accents) ──────────
NEB_SRCS = []
try:
    with open(os.path.join(CACHE, "manifest.json")) as f:
        NEB_SRCS = [os.path.join(CACHE, m["file"]) for m in json.load(f) if m["q"] == "nebula"]
except Exception:
    pass

def p_fx_puff(r):
    size = 96
    if NEB_SRCS:
        img = Image.open(r.choice(NEB_SRCS)).convert("L")
        s = min(img.size)
        side = int(s * (0.25 + r.random() * 0.3))
        x0 = r.randint(0, img.width - side); y0 = r.randint(0, img.height - side)
        lum = np.asarray(img.crop((x0, y0, x0 + side, y0 + side)).resize((size, size), Image.LANCZOS), np.float32) / 255
        lo, hi = np.percentile(lum, 5), np.percentile(lum, 97)
        lum = np.clip((lum - lo) / max(1e-4, hi - lo), 0, 1)
    else:
        g = np.random.default_rng(r.randint(0, 1 << 30))
        lum = np.zeros((size, size), np.float32)
        for c in (4, 8, 16):
            grid = g.random((c, c)).astype(np.float32)
            lum += np.asarray(Image.fromarray((grid * 255).astype(np.uint8)).resize((size, size), Image.BICUBIC), np.float32) / 255 / 3
    y, x = np.mgrid[0:size, 0:size].astype(np.float32)
    cxy = (size - 1) / 2
    mask = np.clip(1 - np.sqrt(((x - cxy) / cxy) ** 2 + ((y - cxy) / cxy) ** 2), 0, 1) ** 1.6
    a = (lum * mask) ** 1.25
    rgb = np.full((size, size, 3), 255, np.float32)
    out = Image.fromarray(np.concatenate([rgb, a[..., None] * 210], axis=2).astype(np.uint8), "RGBA")
    small = out.resize((size // 2, size // 2), Image.BILINEAR).resize((size, size), Image.NEAREST)
    return small

def p_fx_glow(r):
    size = r.choice([28, 44, 64])
    im = Image.new("L", (size, size), 0)
    d = ImageDraw.Draw(im)
    c = size // 2
    for rad, ga in ((c - 1, 40), (int(c * 0.6), 90), (int(c * 0.28), 200)):
        d.ellipse([c - rad, c - rad, c + rad, c + rad], fill=ga)
    im = im.filter(ImageFilter.GaussianBlur(size * 0.09))
    rgb = Image.new("L", im.size, 255)
    return Image.merge("RGBA", (rgb, rgb, rgb, im))

def p_fx_ring(r):
    size = 72
    im = Image.new("L", (size, size), 0)
    d = ImageDraw.Draw(im)
    c = size // 2
    rr = r.randint(22, 30)
    ry = int(rr * r.uniform(0.5, 1.0))
    d.ellipse([c - rr, c - ry, c + rr, c + ry], outline=230, width=2)
    im = im.filter(ImageFilter.GaussianBlur(1.6))
    rgb = Image.new("L", im.size, 255)
    out = Image.merge("RGBA", (rgb, rgb, rgb, im))
    return out.resize((size, size), Image.NEAREST)

def p_fx_rift(r):
    size = 64
    im = Image.new("L", (size, size), 0)
    d = ImageDraw.Draw(im)
    x, y = size * 0.2, size * r.uniform(0.3, 0.7)
    a = r.uniform(-0.5, 0.5)
    for _ in range(r.randint(5, 8)):
        a += r.gauss(0, 0.35)
        nx, ny = x + math.cos(a) * 9, y + math.sin(a) * 9
        d.line([x, y, nx, ny], fill=255, width=2)
        x, y = nx, ny
    halo = im.filter(ImageFilter.GaussianBlur(5))
    comp = np.maximum(np.asarray(im, np.float32), np.asarray(halo, np.float32) * 0.7)
    rgb = Image.new("L", im.size, 255)
    return Image.merge("RGBA", (rgb, rgb, rgb, Image.fromarray(comp.astype(np.uint8))))

def p_fx_shimmer(r):
    size = 56
    im = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    for _ in range(r.randint(16, 26)):
        px = int(r.gauss(size / 2, size / 5)) % size
        py = int(r.gauss(size / 2, size / 5)) % size
        d.point((px, py), fill=(255, 255, 255, r.randint(120, 255)))
    return im

# ── Kenney pack rework: abandoned satellites + metal debris ─────────────────
def kenney_rework(name, src_path, r, target=34):
    src = Image.open(src_path).convert("RGBA")
    im = src.rotate(r.uniform(0, 360), expand=True, resample=Image.BICUBIC)
    ratio = target / max(im.size)
    im = im.resize((max(1, int(im.width * ratio)), max(1, int(im.height * ratio))), Image.LANCZOS)
    arr = np.asarray(im).astype(np.float32)
    solid = arr[..., 3] > 110
    lum = (arr[..., 0] * 0.35 + arr[..., 1] * 0.45 + arr[..., 2] * 0.2) / 255.0
    rgb = (STEEL[None, None] * (0.5 + lum[..., None] * 0.9))
    out = np.zeros_like(arr)
    out[..., :3] = np.clip(rgb, 0, 255)
    out[..., 3] = np.where(solid, 255, 0)
    er = np.zeros_like(solid)
    er[1:-1, 1:-1] = (~solid[1:-1, 1:-1]) & (solid[:-2, 1:-1] | solid[2:, 1:-1] | solid[1:-1, :-2] | solid[1:-1, 2:])
    out[er] = [8, 7, 7, 255]
    img = Image.fromarray(out.astype(np.uint8), "RGBA")
    return img.resize((img.width * 2, img.height * 2), Image.NEAREST)

# ── build the library ────────────────────────────────────────────────────────
LIB: dict[str, list[str]] = {}
def build_lib():
    r = random.Random("decor-lib-v1")
    painters = [
        ("sat", p_satellite, 6), ("deb", p_debris, 10), ("hull", p_hull, 6),
        ("pipe", p_pipe, 5), ("pylon", p_pylon, 4), ("plat", p_platform, 4),
        ("mach", p_machinery, 5), ("cont", p_container, 5), ("drone", p_drone, 4),
        ("buoy", p_buoy, 4), ("ruin", p_ruin, 6), ("gatefrag", p_gatefrag, 4),
        ("mono", p_monoshard, 4), ("engine", p_engine, 4), ("dish", p_dish, 3),
        ("cry", p_crystal, 6), ("bio", p_biopod, 4),
        ("fx_puff", p_fx_puff, 6), ("fx_glow", p_fx_glow, 3), ("fx_ring", p_fx_ring, 3),
        ("fx_rift", p_fx_rift, 3), ("fx_shimmer", p_fx_shimmer, 2),
    ]
    for prefix, fn, count in painters:
        LIB[prefix] = []
        for i in range(count):
            name = f"{prefix}_{i:02d}"
            save(name, fn(r))
            LIB[prefix].append(name)
    # Kenney rework
    kfiles = sorted(os.listdir(KPARTS)) if os.path.isdir(KPARTS) else []
    LIB["ksat"] = []
    LIB["kdeb"] = []
    for f in kfiles:
        base = os.path.splitext(f)[0]
        if base.startswith("ufo"):
            name = f"ksat_{base[3:].lower()}"
            save(name, kenney_rework(name, os.path.join(KPARTS, f), r, target=30))
            LIB["ksat"].append(name)
        else:
            name = f"kdeb_{base.lower()}"
            save(name, kenney_rework(name, os.path.join(KPARTS, f), r, target=26))
            LIB["kdeb"].append(name)
    total = sum(len(v) for v in LIB.values())
    print(f"library: {total} sprites in {len(LIB)} categories")

# ── zone themes: accents + story recipe list ─────────────────────────────────
# stories: named cluster recipes; fill: scatter categories for singles
Z = {
 "1-1": dict(acc="#5f9dff", acc2="#9fdcff", stories=["comm_post", "outpost", "graveyard"],
             fill=["sat", "ksat", "deb", "cont", "drone", "buoy"], fx=14),
 "1-2": dict(acc="#d4aaff", acc2="#7fe6ff", stories=["crystal_field", "crystal_field", "anomaly"],
             fill=["cry", "deb", "mono"], fx=16),
 "1-3": dict(acc="#ff6a78", acc2="#ffb35e", stories=["battlefield", "battlefield", "graveyard"],
             fill=["deb", "kdeb", "hull", "engine"], fx=12),
 "1-4": dict(acc="#3fe8c4", acc2="#b8fff0", stories=["anomaly", "ruins"],
             fill=["mono", "deb"], fx=12),
 "1-5": dict(acc="#ffae4a", acc2="#ffe89a", stories=["mining_outpost", "mining_outpost", "comm_post"],
             fill=["cont", "pipe", "mach", "deb", "buoy"], fx=12),
 "2-1": dict(acc="#ff7a30", acc2="#ffd257", stories=["graveyard", "battlefield", "mining_outpost"],
             fill=["deb", "kdeb", "engine", "mach"], fx=14),
 "2-2": dict(acc="#ffd876", acc2="#fff3c0", stories=["ruins", "ruins", "comm_post"],
             fill=["ruin", "gatefrag", "mono", "deb"], fx=14),
 "2-3": dict(acc="#ff3d68", acc2="#ff9aa8", stories=["bio_nest", "battlefield", "anomaly"],
             fill=["bio", "deb", "hull"], fx=13),
 "2-4": dict(acc="#b45bff", acc2="#ff9de0", stories=["anomaly", "ruins", "graveyard"],
             fill=["mono", "deb", "ruin"], fx=15),
 "2-5": dict(acc="#7f6bff", acc2="#4ee2ff", stories=["energy_farm", "comm_post", "anomaly"],
             fill=["pylon", "sat", "drone", "deb"], fx=16),
 "3-1": dict(acc="#7ade6a", acc2="#d8ffc0", stories=["outpost", "ruins", "comm_post"],
             fill=["sat", "cont", "plat", "deb", "drone"], fx=13),
 "3-2": dict(acc="#c0ee3a", acc2="#5aff8a", stories=["bio_nest", "bio_nest", "graveyard"],
             fill=["bio", "deb", "cont"], fx=14),
 "3-3": dict(acc="#3cff8e", acc2="#c8ffe2", stories=["crystal_field", "energy_farm", "anomaly"],
             fill=["cry", "pylon", "deb"], fx=16),
 "3-4": dict(acc="#9fe0ff", acc2="#ffffff", stories=["crystal_field", "graveyard", "ruins"],
             fill=["cry", "deb", "hull"], fx=12),
 "3-5": dict(acc="#aaff44", acc2="#44ffd0", stories=["energy_farm", "energy_farm", "outpost"],
             fill=["pylon", "drone", "sat", "deb"], fx=15),
 "4-1": dict(acc="#ff4560", acc2="#ffae4a", stories=["battlefield", "battlefield", "graveyard", "anomaly"],
             fill=["deb", "kdeb", "hull", "engine"], fx=14),
 "4-2": dict(acc="#ff7433", acc2="#ffd257", stories=["mining_outpost", "graveyard", "battlefield"],
             fill=["mach", "pipe", "cont", "deb"], fx=13),
 "4-3": dict(acc="#ff3fa0", acc2="#a86bff", stories=["bio_nest", "bio_nest", "anomaly", "graveyard"],
             fill=["bio", "deb", "mono"], fx=15),
 "4-4": dict(acc="#c264ff", acc2="#6be8ff", stories=["ruins", "anomaly", "anomaly"],
             fill=["mono", "ruin", "deb"], fx=16),
 "4-5": dict(acc="#8a55ff", acc2="#ffd76b", stories=["ruins", "anomaly", "energy_farm"],
             fill=["gatefrag", "mono", "ruin"], fx=17),
}

STRUCT_PAR = (0.3, 0.46)   # parallax bands: structures nearer
FX_PAR = (0.2, 0.32)       # fx further back

def item(r, tex, x, y, s, rot, a, tint, par, anim="none", sp=0.0):
    return {"t": tex, "x": int(x), "y": int(y), "s": round(s, 2), "r": round(rot, 2),
            "a": round(a, 2), "c": tint, "p": round(par, 2), "an": anim, "sp": round(sp, 3)}

def pick(r, cat):
    return r.choice(LIB[cat])

def spinish(r, p=0.6, lo=0.02, hi=0.12):
    return ("spin", r.choice([-1, 1]) * r.uniform(lo, hi)) if r.random() < p else ("none", 0)

# ── cluster recipes: each returns a list of items around (cx, cy) ────────────
def c_mining_outpost(r, cx, cy, z):
    out = [item(r, pick(r, "mach"), cx, cy, r.uniform(1.4, 1.9), r.uniform(-0.3, 0.3), 1, "#ffffff", 0.4)]
    for i in range(r.randint(2, 3)):
        out.append(item(r, pick(r, "pipe"), cx + r.gauss(0, 90), cy + r.gauss(0, 60), r.uniform(1, 1.5), r.uniform(0, 6.3), 0.95, "#ffffff", 0.4))
    for i in range(r.randint(2, 4)):
        an, sp = spinish(r, 0.5)
        out.append(item(r, pick(r, "cont"), cx + r.gauss(0, 120), cy + r.gauss(0, 90), r.uniform(0.9, 1.4), r.uniform(0, 6.3), 0.95, "#ffffff", 0.4, an, sp))
    out.append(item(r, pick(r, "buoy"), cx + r.gauss(0, 140), cy + r.gauss(0, 100), 1.2, 0, 1, "#ffffff", 0.42, "blink", r.uniform(0.5, 1.1)))
    out.append(item(r, pick(r, "drone"), cx + r.gauss(0, 100), cy + r.gauss(0, 80), 1, 0, 1, "#ffffff", 0.44, "drift", r.uniform(0.3, 0.7)))
    return out

def c_battlefield(r, cx, cy, z):
    out = []
    for i in range(r.randint(2, 3)):
        an, sp = spinish(r, 0.7, 0.01, 0.05)
        out.append(item(r, pick(r, "hull"), cx + r.gauss(0, 160), cy + r.gauss(0, 120), r.uniform(1.2, 1.9), r.uniform(0, 6.3), 0.95, "#ffffff", r.uniform(0.36, 0.44), an, sp))
    for i in range(r.randint(6, 10)):
        an, sp = spinish(r, 0.8)
        cat = r.choice(["deb", "kdeb", "engine"])
        out.append(item(r, pick(r, cat), cx + r.gauss(0, 220), cy + r.gauss(0, 170), r.uniform(0.6, 1.3), r.uniform(0, 6.3), r.uniform(0.8, 1), "#ffffff", r.uniform(0.34, 0.46), an, sp))
    for i in range(r.randint(3, 5)):
        out.append(item(r, pick(r, "fx_glow"), cx + r.gauss(0, 200), cy + r.gauss(0, 150), r.uniform(0.4, 0.8), 0, r.uniform(0.3, 0.5), z["acc"], 0.34, "pulse", r.uniform(0.4, 1.0)))
    return out

def c_ruins(r, cx, cy, z):
    out = []
    for i in range(r.randint(4, 6)):
        out.append(item(r, pick(r, "ruin"), cx + r.gauss(0, 150), cy + r.gauss(0, 110), r.uniform(1, 1.7), r.uniform(-0.4, 0.4), 0.95, "#ffffff", r.uniform(0.36, 0.44)))
    for i in range(r.randint(1, 2)):
        out.append(item(r, pick(r, "mono"), cx + r.gauss(0, 170), cy + r.gauss(0, 120), r.uniform(1.2, 1.8), r.uniform(-0.3, 0.3), 1, "#ffffff", 0.4))
    if r.random() < 0.8:
        an, sp = spinish(r, 0.6, 0.01, 0.04)
        out.append(item(r, pick(r, "gatefrag"), cx + r.gauss(0, 120), cy + r.gauss(0, 90), r.uniform(1.4, 2), r.uniform(0, 6.3), 0.95, "#ffffff", 0.38, an, sp))
    out.append(item(r, pick(r, "fx_glow"), cx, cy, r.uniform(0.8, 1.2), 0, 0.32, z["acc2"], 0.36, "pulse", 0.3))
    return out

def c_crystal_field(r, cx, cy, z):
    out = []
    for i in range(r.randint(7, 11)):
        an = "pulse" if r.random() < 0.4 else "none"
        out.append(item(r, pick(r, "cry"), cx + r.gauss(0, 200), cy + r.gauss(0, 150), r.uniform(0.8, 1.8), r.uniform(-0.5, 0.5), r.uniform(0.85, 1), z["acc"], r.uniform(0.34, 0.44), an, r.uniform(0.3, 0.8)))
    for i in range(2):
        out.append(item(r, pick(r, "fx_glow"), cx + r.gauss(0, 160), cy + r.gauss(0, 120), r.uniform(0.7, 1.1), 0, 0.35, z["acc"], 0.34, "pulse", r.uniform(0.3, 0.6)))
    return out

def c_bio_nest(r, cx, cy, z):
    out = []
    for i in range(r.randint(4, 6)):
        out.append(item(r, pick(r, "bio"), cx + r.gauss(0, 130), cy + r.gauss(0, 100), r.uniform(1, 1.8), r.uniform(0, 6.3), 0.95, z["acc"], r.uniform(0.36, 0.44), "pulse", r.uniform(0.25, 0.6)))
    out.append(item(r, pick(r, "fx_puff"), cx, cy, r.uniform(1.4, 2), r.uniform(0, 6.3), 0.4, z["acc"], 0.3, "drift", 0.2))
    return out

def c_anomaly(r, cx, cy, z):
    out = [item(r, pick(r, "fx_ring"), cx, cy, r.uniform(1.2, 2), r.uniform(0, 6.3), 0.55, z["acc2"], 0.3, "pulse", r.uniform(0.3, 0.7))]
    out.append(item(r, pick(r, "fx_rift"), cx + r.gauss(0, 60), cy + r.gauss(0, 50), r.uniform(1, 1.6), r.uniform(0, 6.3), 0.6, z["acc"], 0.3, "pulse", r.uniform(0.4, 0.9)))
    out.append(item(r, pick(r, "fx_glow"), cx, cy, r.uniform(0.9, 1.4), 0, 0.4, z["acc"], 0.3, "pulse", 0.5))
    for i in range(r.randint(2, 4)):
        an, sp = spinish(r, 1, 0.05, 0.2)
        out.append(item(r, pick(r, "deb"), cx + r.gauss(0, 110), cy + r.gauss(0, 90), r.uniform(0.5, 0.9), r.uniform(0, 6.3), 0.85, "#ffffff", 0.32, an, sp))
    return out

def c_outpost(r, cx, cy, z):
    out = [item(r, pick(r, "plat"), cx, cy, r.uniform(1.4, 1.8), r.uniform(-0.15, 0.15), 1, "#ffffff", 0.42)]
    for i in range(2):
        cat = "ksat" if (LIB.get("ksat") and r.random() < 0.5) else "sat"
        an, sp = spinish(r, 0.6, 0.01, 0.05)
        out.append(item(r, pick(r, cat), cx + r.gauss(0, 130), cy + r.gauss(0, 90), r.uniform(0.9, 1.3), r.uniform(0, 6.3), 1, "#ffffff", 0.42, an, sp))
    out.append(item(r, pick(r, "dish"), cx + r.gauss(0, 110), cy + r.gauss(0, 70), r.uniform(1, 1.4), r.uniform(-0.4, 0.4), 1, "#ffffff", 0.42))
    out.append(item(r, pick(r, "buoy"), cx + r.gauss(0, 150), cy + r.gauss(0, 100), 1.1, 0, 1, "#ffffff", 0.44, "blink", r.uniform(0.6, 1.2)))
    for i in range(2):
        out.append(item(r, pick(r, "drone"), cx + r.gauss(0, 120), cy + r.gauss(0, 90), 1, 0, 1, "#ffffff", 0.44, "drift", r.uniform(0.3, 0.8)))
    return out

def c_graveyard(r, cx, cy, z):
    out = []
    for i in range(r.randint(5, 8)):
        an, sp = spinish(r, 0.75, 0.01, 0.07)
        cat = r.choice(["deb", "kdeb", "engine", "pipe", "cont"])
        out.append(item(r, pick(r, cat), cx + r.gauss(0, 240), cy + r.gauss(0, 180), r.uniform(0.7, 1.3), r.uniform(0, 6.3), r.uniform(0.75, 0.95), "#ffffff", r.uniform(0.32, 0.44), an, sp))
    if r.random() < 0.7:
        out.append(item(r, pick(r, "hull"), cx + r.gauss(0, 150), cy + r.gauss(0, 120), r.uniform(1.3, 1.8), r.uniform(0, 6.3), 0.9, "#ffffff", 0.38, "spin", r.choice([-1, 1]) * 0.02))
    return out

def c_energy_farm(r, cx, cy, z):
    out = []
    n = r.randint(4, 6)
    ang = r.uniform(0, math.pi)
    for i in range(n):
        px = cx + math.cos(ang) * (i - n / 2) * 110 + r.gauss(0, 20)
        py = cy + math.sin(ang) * (i - n / 2) * 110 + r.gauss(0, 20)
        out.append(item(r, pick(r, "pylon"), px, py, r.uniform(1.1, 1.5), r.uniform(-0.15, 0.15), 1, "#ffffff", 0.4))
        out.append(item(r, pick(r, "fx_glow"), px, py - 34, 0.4, 0, 0.5, z["acc"], 0.4, "pulse", r.uniform(0.5, 1.1)))
    return out

def c_comm_post(r, cx, cy, z):
    out = [item(r, pick(r, "dish"), cx, cy, r.uniform(1.3, 1.7), r.uniform(-0.3, 0.3), 1, "#ffffff", 0.42)]
    cat = "ksat" if (LIB.get("ksat") and r.random() < 0.5) else "sat"
    an, sp = spinish(r, 0.7, 0.01, 0.05)
    out.append(item(r, pick(r, cat), cx + r.gauss(0, 110), cy + r.gauss(0, 80), r.uniform(0.9, 1.2), r.uniform(0, 6.3), 1, "#ffffff", 0.42, an, sp))
    out.append(item(r, pick(r, "buoy"), cx + r.gauss(0, 130), cy + r.gauss(0, 90), 1.1, 0, 1, "#ffffff", 0.44, "blink", r.uniform(0.5, 1.2)))
    return out

RECIPES = dict(mining_outpost=c_mining_outpost, battlefield=c_battlefield, ruins=c_ruins,
               crystal_field=c_crystal_field, bio_nest=c_bio_nest, anomaly=c_anomaly,
               outpost=c_outpost, graveyard=c_graveyard, energy_farm=c_energy_farm,
               comm_post=c_comm_post)

WORLD = 4400  # placement half-extent

def gen_zone(label, z):
    r = random.Random(f"decor:{label}:v1")
    items = []
    # story clusters — spread across quadrants so regions feel authored
    centers = []
    for si, story in enumerate(z["stories"]):
        for _ in range(30):
            cx = r.uniform(-WORLD, WORLD); cy = r.uniform(-WORLD, WORLD)
            if all(math.hypot(cx - ox, cy - oy) > 2400 for ox, oy in centers):
                break
        centers.append((cx, cy))
        items += RECIPES[story](r, cx, cy, z)
    # scattered singles fill the space between clusters
    for _ in range(r.randint(22, 30)):
        cat = r.choice(z["fill"])
        if not LIB.get(cat):
            continue
        an, sp = spinish(r, 0.55, 0.01, 0.1)
        items.append(item(r, pick(r, cat), r.uniform(-WORLD, WORLD), r.uniform(-WORLD, WORLD),
                          r.uniform(0.6, 1.5), r.uniform(0, 6.3), r.uniform(0.7, 1),
                          "#ffffff", r.uniform(*STRUCT_PAR), an, sp))
    # ambient fx: puffs, glows, shimmer patches
    for _ in range(z["fx"]):
        roll = r.random()
        if roll < 0.45:
            tex, a, an, sp = pick(r, "fx_puff"), r.uniform(0.22, 0.4), "drift", r.uniform(0.1, 0.3)
        elif roll < 0.75:
            tex, a, an, sp = pick(r, "fx_glow"), r.uniform(0.25, 0.45), "pulse", r.uniform(0.2, 0.6)
        else:
            tex, a, an, sp = pick(r, "fx_shimmer"), r.uniform(0.5, 0.8), "pulse", r.uniform(0.3, 0.8)
        tint = z["acc"] if r.random() < 0.65 else z["acc2"]
        items.append(item(r, tex, r.uniform(-WORLD, WORLD), r.uniform(-WORLD, WORLD),
                          r.uniform(0.8, 2.2), r.uniform(0, 6.3), a, tint, r.uniform(*FX_PAR), an, sp))
    out = os.path.join(BG, label, f"decor_{label}.json")
    with open(out, "w") as f:
        json.dump({"v": 1, "items": items}, f, separators=(",", ":"))
    print(f"  {label}: {len(items)} decor items ({len(z['stories'])} story clusters)")

only = set(sys.argv[1:])
build_lib()
for label, z in Z.items():
    if only and label not in only:
        continue
    gen_zone(label, z)
print("DECOR DONE")
