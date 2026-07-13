# ── Cosmic Realm environment generator v4 ───────────────────────────────────
# Builds per-zone background layers for all maps. The preserved 1-1 core art
# (Layer1/2/3) and ALL planets (Layer4_*.png) are NEVER touched.
#
# Sources:
#   - NASA public-domain imagery (nebulae / galaxies / clusters / supernova
#     filaments), heavily processed: multi-patch soft-masked composition,
#     tritone palette grading, alpha shaping, pixelation → original look.
#     Source IDs + licenses: scripts/nasa_cache/manifest.json
#   - fully procedural art (stars, clusters, dust, veins, auroras, streams,
#     plasma, debris, asteroids and all Layer8 landmark paintings)
#
# Layers written per zone:
#   Layer1  stars + clusters + optional milky band            (1024, tiled)
#   Layer2  multi-patch nebula composition                    (2048, tiled)
#   Layer3  zone effect: veins/aurora/streams/plasma/...      (2048, tiled)
#   Layer5  cosmic dust + soft glow regions + anomalies       (1024, tiled)
#   Layer6  foreground debris silhouettes (+ belt lanes)      (1024, tiled)
#   Layer7  distant galaxies + tiny background smudges        (2048, tiled)
#   Layer8  painted landmark (gate/wreck/crystal/citadel/...) (sprite)
#   ast1-4  rotating foreground asteroid sprites
#
# Usage: py scripts/gen-environments.py [zone ...]   (default: all)
import json, math, os, random, sys
import numpy as np
from PIL import Image, ImageDraw, ImageFilter

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BG = os.path.join(ROOT, "frontend", "public", "bg")
CACHE = os.path.join(ROOT, "scripts", "nasa_cache")

# ── zone themes ──────────────────────────────────────────────────────────────
# Every zone gets a unique palette + a unique combination of effect layer,
# landmark kind and extras so no two maps read the same.
#   lo/mid/hi  nebula tritone     acc/acc2  effect accents
#   fx    Layer3 effect kind      lm        Layer8 landmark kind
#   band  faint milky star band   belt      debris belt lane
#   anomalies  glowing specks     hero_gal  big centerpiece galaxy
THEMES = {
    # ── Earth faction: blue home, crystal, war-red, dark void, mining belt ──
    "1-1": dict(name="Azure Home Sector", lo="#060e2e", mid="#22448f", hi="#7fa8ff",
                dust="#3a5a8c", star="#cfe0ff", cluster="#88aaff", gal="#a9c4ff",
                acc="#5f9dff", acc2="#9fdcff", density=0.5, fx=None, lm="ringstation",
                lmc=dict(hull="#323a4e", glow="#ffb84e", glow2="#4ea8ff"), extras_only=True),
    "1-2": dict(name="Amethyst Crystal Nebula", lo="#140a38", mid="#5a3ab8", hi="#c49aff",
                dust="#6a4bbf", star="#e0d4ff", cluster="#b088ff", gal="#b9a0ff",
                acc="#d4aaff", acc2="#7fe6ff", density=0.85, fx="veins", lm="crystal",
                lmc=dict(hull="#3a2f58", glow="#c9a2ff", glow2="#8fecff"), band=True),
    "1-3": dict(name="Crimson Pulse", lo="#2a0812", mid="#8f1f33", hi="#ff5566",
                dust="#99333f", star="#ffd4d6", cluster="#ff7788", gal="#dd8899",
                acc="#ff6a78", acc2="#ffb35e", density=0.75, fx="streams", lm="gate",
                lmc=dict(hull="#442830", glow="#ff4a5c", glow2="#ffb35e")),
    "1-4": dict(name="Void Expanse", lo="#04201c", mid="#0e4a42", hi="#37c2a8",
                dust="#0f5a4c", star="#bfeee2", cluster="#33ddb3", gal="#7fd4c0",
                acc="#3fe8c4", acc2="#b8fff0", density=0.30, fx="wisp", lm="monolith",
                lmc=dict(hull="#243634", glow="#3fe8c4", glow2="#d8fff6"), anomalies=3),
    "1-5": dict(name="Golden Forge Belt", lo="#241204", mid="#8a4d1c", hi="#ffa040",
                dust="#b36a2a", star="#ffe2bc", cluster="#ffaa55", gal="#cc9977",
                acc="#ffae4a", acc2="#ffe89a", density=0.80, fx="streams", lm="rig",
                lmc=dict(hull="#42332a", glow="#ffc14e", glow2="#ff7a30"), streak="h", belt=True),
    # ── Mars faction: volcanic, golden ancient, blood, royal void, maelstrom ─
    "2-1": dict(name="Volcanic Corona", lo="#260a02", mid="#a03414", hi="#ff6a2a",
                dust="#aa5522", star="#ffd9bb", cluster="#ff9955", gal="#cc9988",
                acc="#ff7a30", acc2="#ffd257", density=0.70, fx="plasma", lm="wreck",
                lmc=dict(hull="#3d2a1e", glow="#ff8130", glow2="#ffcf47"), streak="h"),
    "2-2": dict(name="Golden Ancient Reach", lo="#201404", mid="#8f6a24", hi="#ffd270",
                dust="#96652f", star="#f4e6c8", cluster="#ffcf70", gal="#cbb383",
                acc="#ffd876", acc2="#fff3c0", density=0.85, fx="filament", lm="temple",
                lmc=dict(hull="#4a3818", glow="#ffd25e", glow2="#fff0b0"), band=True, belt=True),
    "2-3": dict(name="Blood Abyss", lo="#20040e", mid="#7a1230", hi="#ff3860",
                dust="#8f2f44", star="#ffc4cc", cluster="#ff6688", gal="#cc7788",
                acc="#ff3d68", acc2="#ff9aa8", density=0.75, fx="veins", lm="biomech",
                lmc=dict(hull="#38202a", glow="#ff3d68", glow2="#ffb0ba")),
    "2-4": dict(name="Royal Void", lo="#16041e", mid="#55199a", hi="#b054ff",
                dust="#5f2f80", star="#ddbbff", cluster="#cc77ff", gal="#aa88dd",
                acc="#b45bff", acc2="#ff9de0", density=0.55, fx="plasma", lm="citadel",
                lmc=dict(hull="#342350", glow="#c46bff", glow2="#ff9de0"), anomalies=2),
    "2-5": dict(name="Indigo Maelstrom", lo="#0e0630", mid="#3a2a9a", hi="#8a70ff",
                dust="#4a3aa0", star="#c9c0ff", cluster="#9977ff", gal="#a8a0ff",
                acc="#7f6bff", acc2="#4ee2ff", density=0.85, fx="aurora", lm="beacon",
                lmc=dict(hull="#2c2650", glow="#8a70ff", glow2="#4ee2ff"), hero_gal=True, band=True),
    # ── Venus faction: verdant, toxic, emerald energy, frozen, lime surge ────
    "3-1": dict(name="Verdant Reach", lo="#08200a", mid="#2a7a2f", hi="#7ade6a",
                dust="#3f7a2f", star="#d6f0c9", cluster="#88dd66", gal="#99cc88",
                acc="#7ade6a", acc2="#d8ffc0", density=0.60, fx="wisp", lm="ringstation",
                lmc=dict(hull="#2c3d28", glow="#8fe86a", glow2="#ffe89a")),
    "3-2": dict(name="Toxic Bloom", lo="#142004", mid="#5f8f1a", hi="#c8f03a",
                dust="#7a8f2f", star="#eef6cc", cluster="#ccee44", gal="#aabb77",
                acc="#c0ee3a", acc2="#5aff8a", density=0.70, fx="plasma", lm="wreck",
                lmc=dict(hull="#333d1e", glow="#b8e832", glow2="#5aff8a"), streak="h"),
    "3-3": dict(name="Emerald Energy Field", lo="#04240f", mid="#0f9a4c", hi="#3cff8e",
                dust="#1f8f4c", star="#c9f6dd", cluster="#55ff99", gal="#77cc99",
                acc="#3cff8e", acc2="#c8ffe2", density=0.68, fx="veins", lm="crystal",
                lmc=dict(hull="#1e4a30", glow="#3cff8e", glow2="#d8ffee")),
    "3-4": dict(name="Glacial Drift", lo="#061826", mid="#2f6a9a", hi="#bfeaff",
                dust="#4a7a9a", star="#eef8ff", cluster="#9fd4ff", gal="#a8c8e0",
                acc="#9fe0ff", acc2="#ffffff", density=0.45, fx="aurora", lm="citadel",
                lmc=dict(hull="#2a3d4e", glow="#9fe0ff", glow2="#ffffff"), band=True),
    "3-5": dict(name="Lime Surge", lo="#0d2a06", mid="#4c8f1f", hi="#aef03c",
                dust="#4c8f1f", star="#e6f8c9", cluster="#aaff44", gal="#99cc66",
                acc="#aaff44", acc2="#44ffd0", density=0.85, fx="aurora", lm="beacon",
                lmc=dict(hull="#2e401e", glow="#aaff44", glow2="#44ffd0")),
    # ── Danger zones: warzone, volcanic rift, corruption, void amethyst, sanctum ─
    "4-1": dict(name="Scarlet Warzone", lo="#260610", mid="#8f1f33", hi="#ff4560",
                dust="#8f2f3f", star="#ffc4c9", cluster="#ff5577", gal="#cc7788",
                acc="#ff4560", acc2="#ffae4a", density=0.70, fx="streams", lm="wreck",
                lmc=dict(hull="#382028", glow="#ff5540", glow2="#ffc14e"), belt=True),
    "4-2": dict(name="Volcanic Rift", lo="#260a04", mid="#9a3410", hi="#ff7433",
                dust="#96422a", star="#ffd0bb", cluster="#ff8855", gal="#bb8877",
                acc="#ff7433", acc2="#ffd257", density=0.75, fx="plasma", lm="rig",
                lmc=dict(hull="#3f2c1e", glow="#ff8130", glow2="#ffe27a"), belt=True),
    "4-3": dict(name="Corrupted Deep", lo="#22041a", mid="#8f1a5e", hi="#ff2f96",
                dust="#8f2266", star="#ffbbdd", cluster="#ff55aa", gal="#cc77aa",
                acc="#ff3fa0", acc2="#a86bff", density=0.75, fx="veins", lm="biomech",
                lmc=dict(hull="#38203c", glow="#ff3fa0", glow2="#b98aff"), anomalies=3),
    "4-4": dict(name="Void Amethyst", lo="#16031f", mid="#5c1f8f", hi="#c264ff",
                dust="#5f2a80", star="#e0bbff", cluster="#dd66ff", gal="#aa88cc",
                acc="#c264ff", acc2="#6be8ff", density=0.65, fx="filament", lm="monolith",
                lmc=dict(hull="#302044", glow="#c264ff", glow2="#efd0ff"), invert=True),
    "4-5": dict(name="Deep Void Sanctum", lo="#0d0224", mid="#3a1a8f", hi="#9a5eff",
                dust="#452a8f", star="#cfbbff", cluster="#9955ff", gal="#a090ee",
                acc="#8a55ff", acc2="#ffd76b", density=0.55, fx="aurora", lm="gate",
                lmc=dict(hull="#34284e", glow="#ffd25e", glow2="#9a5eff"), band=True, anomalies=4),
}

# ── basics ──────────────────────────────────────────────────────────────────
def hex_rgb(h):
    h = h.lstrip("#")
    return np.array([int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16)], dtype=np.float32)

def rng_for(label, salt):
    return random.Random(f"{label}:{salt}:v4")

def np_rng(label, salt):
    return np.random.default_rng(abs(hash(f"{label}:{salt}:v4")) % (2**32))

with open(os.path.join(CACHE, "manifest.json")) as f:
    MANIFEST = json.load(f)
def srcs(tag):
    return [os.path.join(CACHE, m["file"]) for m in MANIFEST if tag in m["q"]]
NEB_SRCS, GAL_SRCS, FIL_SRCS, CLU_SRCS = srcs("nebula"), srcs("galaxy"), srcs("filament"), srcs("cluster")
print(f"sources: {len(NEB_SRCS)} nebulae · {len(GAL_SRCS)} galaxies · {len(FIL_SRCS)} filaments · {len(CLU_SRCS)} clusters")

def load_gray_square(path, size, crop_rng=None, frac=None):
    im = Image.open(path).convert("L")
    mw, mh = int(im.width * 0.09), int(im.height * 0.09)  # trim caption bars
    im = im.crop((mw, mh, im.width - mw, im.height - mh))
    w, h = im.size
    side = min(w, h)
    if crop_rng:
        side = int(side * (frac if frac else (0.55 + crop_rng.random() * 0.4)))
        x0 = crop_rng.randint(0, w - side)
        y0 = crop_rng.randint(0, h - side)
    else:
        x0, y0 = (w - side) // 2, (h - side) // 2
    im = im.crop((x0, y0, x0 + side, y0 + side)).resize((size, size), Image.LANCZOS)
    a = np.asarray(im, dtype=np.float32) / 255.0
    lo, hi = np.percentile(a, 2), np.percentile(a, 98)
    return np.clip((a - lo) / max(1e-4, hi - lo), 0, 1)

def ellipse_mask(size, rr, soft=1.7):
    """Soft elliptical falloff mask, 1 at center → 0 at radius."""
    y, x = np.mgrid[0:size, 0:size].astype(np.float32)
    c = (size - 1) / 2
    d = np.sqrt(((x - c) / (c * rr)) ** 2 + ((y - c) / c) ** 2)
    return np.clip(1.0 - d, 0, 1) ** soft

def fbm(g, size, cells=(6, 12, 24, 48, 96), gain=0.55):
    acc = np.zeros((size, size), dtype=np.float32)
    amp, tot = 1.0, 0.0
    for c in cells:
        grid = g.random((c, c)).astype(np.float32)
        up = np.array(Image.fromarray((grid * 255).astype(np.uint8)).resize((size, size), Image.BICUBIC), dtype=np.float32) / 255
        acc += up * amp; tot += amp; amp *= gain
    return acc / tot

def pixelate(arr, factor=2):
    im = Image.fromarray(arr)
    small = im.resize((im.width // factor, im.height // factor), Image.BILINEAR)
    return np.asarray(small.resize(im.size, Image.NEAREST))

def save_png(path, rgba):
    Image.fromarray(rgba, "RGBA").save(path, optimize=True)
    print(" ", os.path.relpath(path, ROOT), f"{os.path.getsize(path)//1024}KB")

def tritone(lum, lo, hi, mid=None, g=1.25):
    """Grade grayscale into lo→mid→hi palette."""
    t = np.clip(lum, 0, 1)[..., None] ** g
    lo, hi = hex_rgb(lo), hex_rgb(hi)
    if mid is None:
        return lo[None, None] * (1 - t) + hi[None, None] * t
    mid = hex_rgb(mid)
    a = np.clip(t * 2, 0, 1); b = np.clip(t * 2 - 1, 0, 1)
    return (lo[None, None] * (1 - a) + mid[None, None] * a) * (1 - b) + hi[None, None] * b

def paste_torus(canvas, spr, x, y):
    """Paste sprite with wraparound so the canvas tiles seamlessly."""
    W, H = canvas.size
    for dx in (-W, 0, W):
        for dy in (-H, 0, H):
            px, py = x + dx, y + dy
            if px + spr.width > 0 and px < W and py + spr.height > 0 and py < H:
                canvas.alpha_composite(spr, (px, py))

def glow_from(lum_img, color, blurs=((3, 0.9), (10, 0.5), (26, 0.30))):
    """Build an RGBA glow layer from a grayscale intensity image."""
    lum = np.asarray(lum_img, dtype=np.float32) / 255
    acc = lum.copy()
    for rad, wgt in blurs:
        b = np.asarray(lum_img.filter(ImageFilter.GaussianBlur(rad)), dtype=np.float32) / 255
        acc = np.maximum(acc, b * wgt)
    col = hex_rgb(color)
    white = np.array([255, 255, 255], dtype=np.float32)
    core = np.clip(lum * 1.9 - 0.4, 0, 1)[..., None]
    rgb = col[None, None] * (1 - core * 0.8) + white[None, None] * core * 0.8
    alpha = np.clip(acc, 0, 1)
    return np.concatenate([rgb * np.ones_like(alpha)[..., None] / 1.0, alpha[..., None] * 255], axis=2).astype(np.uint8)

# ── Layer1: stars, clusters, star clouds, milky band ────────────────────────
def make_stars(label, b, out, size=1024):
    r = rng_for(label, "stars")
    canvas = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    d = ImageDraw.Draw(canvas)
    star_tint = tuple(hex_rgb(b["star"]).astype(int))
    acc2 = tuple(hex_rgb(b["acc2"]).astype(int))

    # optional milky band: broad diagonal lane of faint micro stars + haze
    if b.get("band"):
        ang = r.uniform(-0.6, 0.6) + (0 if r.random() < 0.5 else math.pi / 2)
        cx0, cy0 = size / 2, size / 2
        nx, ny = -math.sin(ang), math.cos(ang)   # band normal
        haze = Image.new("L", (size, size), 0)
        hd = ImageDraw.Draw(haze)
        bw = r.randint(170, 240)
        for i in range(2400):
            # rejection-free: sample along band axis, gauss across
            u = r.uniform(-0.75 * size, 0.75 * size)
            v = r.gauss(0, bw * 0.45)
            x = (cx0 + math.cos(ang) * u + nx * v) % size
            y = (cy0 + math.sin(ang) * u + ny * v) % size
            a = int(max(12, 110 - abs(v) / bw * 110))
            if r.random() < 0.12:
                hd.point((x, y), fill=min(140, a + 30))
            d.point((x, y), fill=(255, 255, 255, min(150, a + r.randint(-10, 30))))
        haze = haze.filter(ImageFilter.GaussianBlur(34))
        band_rgba = glow_from(haze, b["star"], blurs=((20, 0.7),))
        band_rgba[..., 3] = (band_rgba[..., 3] * 0.3).astype(np.uint8)
        canvas.alpha_composite(Image.fromarray(band_rgba, "RGBA"))
        d = ImageDraw.Draw(canvas)

    # base field
    n = int(320 + 300 * b["density"])
    for _ in range(n):
        x, y = r.randint(4, size - 5), r.randint(4, size - 5)
        roll = r.random()
        cr = r.random()
        col = (255, 255, 255) if cr < 0.74 else (star_tint if cr < 0.92 else acc2)
        a = r.randint(90, 255)
        if roll < 0.62:
            d.point((x, y), fill=col + (a,))
        elif roll < 0.88:
            d.rectangle([x, y, x + 1, y + 1], fill=col + (a,))
        elif roll < 0.965:
            d.line([x - 2, y, x + 2, y], fill=col + (a,))
            d.line([x, y - 2, x, y + 2], fill=col + (a,))
        else:
            for rad, ga in ((5, 40), (3, 90), (1, 220)):
                d.ellipse([x - rad, y - rad, x + rad, y + rad], fill=col + (ga,))

    # 1-2 faint star clouds (loose gaussian clumps of micro stars)
    for _ in range(1 + (1 if r.random() < 0.75 else 0)):
        cx, cy = r.randint(120, size - 120), r.randint(120, size - 120)
        rad = r.randint(90, 170)
        for _ in range(r.randint(130, 210)):
            sx = int(cx + r.gauss(0, rad * 0.5)) % size
            sy = int(cy + r.gauss(0, rad * 0.5)) % size
            d.point((sx, sy), fill=(255, 255, 255, r.randint(35, 110)))

    # luminous star clusters (halo + dense core)
    ccol = tuple(hex_rgb(b["cluster"]).astype(int))
    for _ in range(1 + (1 if r.random() < 0.8 else 0)):
        cx, cy = r.randint(200, size - 200), r.randint(200, size - 200)
        halo = Image.new("RGBA", (size, size), (0, 0, 0, 0))
        hd = ImageDraw.Draw(halo)
        hr = r.randint(70, 125)
        for rad, ga in ((hr, 16), (int(hr * 0.6), 26), (int(hr * 0.3), 38)):
            hd.ellipse([cx - rad, cy - rad, cx + rad, cy + rad], fill=ccol + (ga,))
        halo = halo.filter(ImageFilter.GaussianBlur(24))
        canvas.alpha_composite(halo)
        for _ in range(r.randint(70, 110)):
            angs = r.uniform(0, math.tau)
            rad = abs(r.gauss(0, hr * 0.42))
            sx, sy = int(cx + math.cos(angs) * rad), int(cy + math.sin(angs) * rad)
            if 2 <= sx < size - 2 and 2 <= sy < size - 2:
                a = r.randint(130, 255)
                if r.random() < 0.72:
                    d.point((sx, sy), fill=(255, 255, 255, a))
                else:
                    d.rectangle([sx, sy, sx + 1, sy + 1], fill=ccol + (a,))
        # a couple of bright members with cross flare
        for _ in range(2):
            fx = int(cx + r.gauss(0, hr * 0.3)); fy = int(cy + r.gauss(0, hr * 0.3))
            d.line([fx - 3, fy, fx + 3, fy], fill=(255, 255, 255, 230))
            d.line([fx, fy - 3, fx, fy + 3], fill=(255, 255, 255, 230))
    save_png(out, np.asarray(canvas))

# ── Layer2: multi-patch nebula composition ──────────────────────────────────
def make_nebula(label, b, out, size=2048):
    r = rng_for(label, "nebula")
    build = size // 2  # compose at 1024, upscale NEAREST (pixel look built-in)
    canvas = Image.new("RGBA", (build, build), (0, 0, 0, 0))
    n_patches = 2 + (1 if b["density"] > 0.6 else 0)
    pool = NEB_SRCS[:]
    r.shuffle(pool)
    for pi in range(n_patches):
        src = pool[pi % len(pool)]
        psize = int(build * (0.55 + r.random() * 0.4))
        lum = load_gray_square(src, psize, r)
        mask = ellipse_mask(psize, r.uniform(0.8, 1.0), soft=r.uniform(1.0, 1.4))
        rgb = tritone(lum, b["lo"], b["hi"], b["mid"], g=1.05)
        alpha = (lum ** 1.3) * mask * (0.7 + 0.3 * b["density"])
        rgba = np.concatenate([rgb, alpha[..., None] * 255], axis=2).astype(np.uint8)
        spr = Image.fromarray(rgba, "RGBA").rotate(r.uniform(0, 360), expand=True, resample=Image.BICUBIC)
        paste_torus(canvas, spr, r.randint(-build // 4, build - spr.width + build // 4),
                    r.randint(-build // 4, build - spr.height + build // 4))
    # procedural fill patch keeps large empty stretches interesting
    g = np_rng(label, "nebfill")
    psize = int(build * 0.6)
    lum = fbm(g, psize, cells=(4, 8, 16, 32), gain=0.6)
    lum = np.clip((lum - 0.32) * 2.1, 0, 1) * ellipse_mask(psize, 0.9, soft=1.3)
    rgb = tritone(lum, b["lo"], b["mid"], None, g=1.0)
    alpha = (lum ** 1.35) * 0.55 * b["density"]
    spr = Image.fromarray(np.concatenate([rgb, alpha[..., None] * 255], axis=2).astype(np.uint8), "RGBA")
    paste_torus(canvas, spr, r.randint(0, build - psize), r.randint(0, build - psize))

    arr = np.asarray(canvas)
    if b.get("streak"):
        im = Image.fromarray(arr)
        im = im.resize((build, build // 5), Image.LANCZOS).resize((build, build), Image.LANCZOS)
        arr = np.asarray(im)
    a = arr.copy(); a[..., 3][a[..., 3] < 5] = 0
    out_im = Image.fromarray(a, "RGBA").resize((size, size), Image.NEAREST)
    save_png(out, np.asarray(out_im))

# ── Layer3 effects ──────────────────────────────────────────────────────────
def _fx_canvas(build):
    return Image.new("L", (build, build), 0)

def edge_fade(size, margin=90):
    """Soft border fade so a non-periodic layer still tiles without seams."""
    y, x = np.mgrid[0:size, 0:size].astype(np.float32)
    d = np.minimum(np.minimum(x, size - 1 - x), np.minimum(y, size - 1 - y))
    return np.clip(d / margin, 0, 1) ** 1.4

def _apply_edge_fade(rgba, size, margin=90):
    out = rgba.copy()
    out[..., 3] = (out[..., 3].astype(np.float32) * edge_fade(size, margin)).astype(np.uint8)
    return out

def fx_veins(label, b, build, r):
    """Branching glowing light veins radiating from 2-3 energy epicenters."""
    lum = _fx_canvas(build)
    d = ImageDraw.Draw(lum)
    def walk(x, y, ang, steps, width, depth):
        pts = [(x, y)]
        for _ in range(steps):
            ang += r.gauss(0, 0.26)
            x += math.cos(ang) * r.uniform(9, 15)
            y += math.sin(ang) * r.uniform(9, 15)
            pts.append((x, y))
            if depth < 2 and r.random() < 0.055:
                walk(x, y, ang + r.choice([-1, 1]) * r.uniform(0.5, 0.9),
                     int(steps * 0.55), max(2, width - 1), depth + 1)
        for i in range(len(pts) - 1):
            fade = 1 - i / len(pts) * 0.45
            d.line([pts[i], pts[i + 1]], fill=int(255 * fade), width=width)
    for _ in range(r.randint(2, 3)):
        ex, ey = r.randint(140, build - 140), r.randint(140, build - 140)
        # epicenter flash
        d.ellipse([ex - 5, ey - 5, ex + 5, ey + 5], fill=255)
        for k in range(r.randint(3, 5)):
            walk(ex, ey, r.uniform(0, math.tau), r.randint(30, 52), 4, 0)
    return _apply_edge_fade(glow_from(lum, b["acc"], blurs=((2, 1.0), (6, 0.7), (16, 0.45), (38, 0.26))), build)

def fx_aurora(label, b, build, r):
    """Curtain-like aurora ribbons with a bright lower edge.
    All frequencies are integers so the layer tiles seamlessly."""
    out = np.zeros((build, build, 4), dtype=np.float32)
    X = np.arange(build, dtype=np.float32)
    Y = np.arange(build, dtype=np.float32)[:, None]
    c1, c2 = hex_rgb(b["acc"]), hex_rgb(b["acc2"])
    for k in range(r.randint(2, 3)):
        y0 = r.uniform(0.22, 0.78) * build
        yc = y0 + sum(np.sin(X * f * math.tau / build + p) * a for f, p, a in
                      [(r.randint(1, 2), r.uniform(0, 6), r.uniform(30, 70)),
                       (r.randint(3, 4), r.uniform(0, 6), r.uniform(10, 26)),
                       (r.randint(6, 9), r.uniform(0, 6), r.uniform(3, 9))])
        h = (55 + 55 * np.sin(X * r.randint(1, 3) * math.tau / build + r.uniform(0, 6)) ** 2) * r.uniform(0.8, 1.3)
        dY = (Y - yc[None, :])
        up = np.clip(1 + dY / (h[None, :] * 2.4), 0, 1)      # fades upward
        edge = np.exp(-(dY / (h[None, :] * 0.22)) ** 2)      # bright base edge
        body = np.clip(1 - np.abs(dY) / (h[None, :] * 2.4), 0, 1) ** 2.2 * up
        inten = np.clip(body * 0.5 + edge * 0.85, 0, 1)
        mixv = 0.5 + 0.5 * np.sin(X * math.tau / build * r.randint(1, 2) + r.uniform(0, 6))
        rgb = c1[None, None] * (1 - mixv[None, :, None]) + c2[None, None] * mixv[None, :, None]
        a = inten[..., None]
        out[..., :3] = out[..., :3] * (1 - a) + rgb * a
        out[..., 3:] = np.maximum(out[..., 3:], a * 0.9)
    im = Image.fromarray(np.concatenate([out[..., :3], out[..., 3:] * 255], axis=2).astype(np.uint8), "RGBA")
    im = im.filter(ImageFilter.GaussianBlur(2))
    return np.asarray(im)

def fx_streams(label, b, build, r):
    """Fast directional energy streams with bright heads."""
    lum = _fx_canvas(build)
    d = ImageDraw.Draw(lum)
    base_ang = r.uniform(0, math.tau)
    for _ in range(r.randint(10, 16)):
        ang = base_ang + r.gauss(0, 0.16)
        ln = r.uniform(160, 520)
        x0, y0 = r.randint(0, build), r.randint(0, build)
        steps = 26
        for i in range(steps):
            t0, t1 = i / steps, (i + 1) / steps
            xa, ya = x0 + math.cos(ang) * ln * t0, y0 + math.sin(ang) * ln * t0
            xb, yb = x0 + math.cos(ang) * ln * t1, y0 + math.sin(ang) * ln * t1
            w = max(1, int(3 * (1 - t0)))
            d.line([(xa % build, ya % build), ((xb - xa) + xa % build, (yb - ya) + ya % build)],
                   fill=int(60 + 170 * (1 - t0) ** 1.5), width=w)
        hx, hy = x0 % build, y0 % build
        d.ellipse([hx - 2, hy - 2, hx + 2, hy + 2], fill=255)
    return _apply_edge_fade(glow_from(lum, b["acc"], blurs=((2, 0.8), (7, 0.45), (18, 0.22))), build)

def fx_plasma(label, b, build, r):
    """Blobby plasma clouds with an electric bright rim."""
    g = np_rng(label, "plasma")
    lum = fbm(g, build, cells=(5, 10, 20, 40, 80), gain=0.58)
    blobs = np.clip((lum - 0.52) * 5.0, 0, 1)
    im_b = Image.fromarray((blobs * 255).astype(np.uint8))
    er = np.asarray(im_b.filter(ImageFilter.MinFilter(7)), dtype=np.float32) / 255
    rim = np.clip(blobs - er, 0, 1)
    body_rgb = tritone(blobs * 0.7, b["lo"], b["acc"], None, g=1.0)
    rim_col = hex_rgb(b["acc2"])
    rgb = body_rgb * (1 - rim[..., None]) + rim_col[None, None] * rim[..., None]
    alpha = np.clip(blobs * 0.5 + rim * 1.0, 0, 1) * edge_fade(build, 130)
    rgba = np.concatenate([rgb, alpha[..., None] * 255], axis=2).astype(np.uint8)
    im = Image.fromarray(rgba, "RGBA").filter(ImageFilter.GaussianBlur(1.2))
    return np.asarray(im)

def fx_filament(label, b, build, r):
    """Supernova-remnant filaments graded to the zone accent."""
    src = FIL_SRCS[abs(hash(label)) % len(FIL_SRCS)]
    lum = load_gray_square(src, build, r, frac=0.8)
    if b.get("invert"):
        lum = np.clip(1.0 - lum * 1.15, 0, 1) * 0.85
    blur = np.asarray(Image.fromarray((lum * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(26)), dtype=np.float32) / 255
    fil = np.clip((lum - blur) * 2.6 + 0.05, 0, 1)
    fil *= ellipse_mask(build, 0.95, soft=1.4)
    rgb = tritone(fil, b["lo"], b["acc2"], b["acc"], g=1.05)
    alpha = (fil ** 1.7) * 0.85
    return np.concatenate([rgb, alpha[..., None] * 255], axis=2).astype(np.uint8)

def fx_wisp(label, b, build, r):
    src = NEB_SRCS[(abs(hash(label)) + 7) % len(NEB_SRCS)]
    lum = load_gray_square(src, build, r)
    blur = np.asarray(Image.fromarray((lum * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(30)), dtype=np.float32) / 255
    lum = np.clip((lum - blur) * 2.2 + 0.08, 0, 1)
    lum *= ellipse_mask(build, 0.95, soft=1.3)
    rgb = tritone(lum, b["lo"], b["hi"], b["mid"], g=1.3)
    alpha = (lum ** 2.4) * 0.7 * b["density"]
    return np.concatenate([rgb, alpha[..., None] * 255], axis=2).astype(np.uint8)

FX = dict(veins=fx_veins, aurora=fx_aurora, streams=fx_streams,
          plasma=fx_plasma, filament=fx_filament, wisp=fx_wisp)

def make_effect(label, b, out, size=2048):
    r = rng_for(label, "fx")
    build = size // 2
    rgba = FX[b["fx"]](label, b, build, r)
    a = rgba.copy(); a[..., 3][a[..., 3] < 5] = 0
    out_im = Image.fromarray(a, "RGBA").resize((size, size), Image.NEAREST)
    save_png(out, np.asarray(out_im))

# ── Layer5: cosmic dust + glow regions + anomalies ──────────────────────────
def make_dust(label, b, out, size=1024):
    g = np_rng(label, "dust")
    r = rng_for(label, "dustx")
    half = size // 2
    acc = np.zeros((half, half), dtype=np.float32)
    amp, tot = 1.0, 0.0
    for cells in (6, 12, 24, 48, 96):
        grid = g.random((cells, cells)).astype(np.float32)
        up = np.array(Image.fromarray((grid * 255).astype(np.uint8)).resize((half, half), Image.BICUBIC), dtype=np.float32) / 255
        acc += up * amp; tot += amp; amp *= 0.55
    acc /= tot
    full = np.block([[acc, np.fliplr(acc)], [np.flipud(acc), np.flipud(np.fliplr(acc))]])
    lum = np.clip((full - 0.42) * 2.4, 0, 1)
    col = hex_rgb(b["dust"])
    rgb = np.broadcast_to(col[None, None], (size, size, 3)).copy()
    alpha = (lum ** 1.6) * 0.45
    base = Image.fromarray(np.concatenate([rgb, alpha[..., None] * 255], axis=2).astype(np.uint8), "RGBA")

    # soft glow regions — large luminous patches that fill negative space
    overlay = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    for _ in range(r.randint(2, 4)):
        grad = r.randint(150, 300)
        spr_l = Image.new("L", (grad * 2, grad * 2), 0)
        sd = ImageDraw.Draw(spr_l)
        for rad, ga in ((grad, 40), (int(grad * 0.62), 62), (int(grad * 0.3), 82)):
            sd.ellipse([grad - rad, grad - rad, grad + rad, grad + rad], fill=ga)
        spr_l = spr_l.filter(ImageFilter.GaussianBlur(grad * 0.35))
        col2 = tuple(int(v) for v in hex_rgb(b["acc" if r.random() < 0.6 else "acc2"]).astype(int))
        spr = Image.merge("RGBA", (*(Image.new("L", spr_l.size, c) for c in col2), spr_l))
        paste_torus(overlay, spr, r.randint(0, size) - grad, r.randint(0, size) - grad)
    # glowing anomaly specks
    for _ in range(b.get("anomalies", 0)):
        x, y = r.randint(30, size - 30), r.randint(30, size - 30)
        spr_l = Image.new("L", (56, 56), 0)
        sd = ImageDraw.Draw(spr_l)
        for rad, ga in ((24, 60), (12, 130), (4, 255)):
            sd.ellipse([28 - rad, 28 - rad, 28 + rad, 28 + rad], fill=ga)
        spr_l = spr_l.filter(ImageFilter.GaussianBlur(5))
        col2 = tuple(int(v) for v in hex_rgb(b["acc2"]).astype(int))
        spr = Image.merge("RGBA", (*(Image.new("L", spr_l.size, c) for c in col2), spr_l))
        paste_torus(overlay, spr, x - 28, y - 28)
    base.alpha_composite(overlay)
    save_png(out, pixelate(np.asarray(base), 2))

# ── Layer6: foreground debris silhouettes (+ optional belt lane) ────────────
def _rock(r, sz, base, glow=None):
    im = Image.new("RGBA", (sz, sz), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    cx = sz / 2
    pts = []
    n = r.randint(7, 11)
    for i in range(n):
        ang = math.tau * i / n
        rad = (sz / 2 - 2) * (0.66 + r.random() * 0.34)
        pts.append((cx + math.cos(ang) * rad, cx + math.sin(ang) * rad))
    rock = tuple((base * (0.85 + r.random() * 0.3)).astype(int))
    d.polygon(pts, fill=rock + (255,))
    arr = np.asarray(im).astype(np.float32)
    y, x = np.mgrid[0:sz, 0:sz].astype(np.float32)
    shade = 1.2 - ((x + y) / (2 * sz)) * 0.7
    arr[..., :3] = np.clip(arr[..., :3] * shade[..., None], 0, 255)
    im = Image.fromarray(arr.astype(np.uint8), "RGBA")
    if glow is not None and r.random() < 0.4:
        d = ImageDraw.Draw(im)
        gx, gy = int(cx + r.gauss(0, sz * 0.14)), int(cy_ := cx + r.gauss(0, sz * 0.14))
        d.point((gx, gy), fill=tuple(glow.astype(int)) + (220,))
    return im

def make_debris(label, b, out, size=1024):
    r = rng_for(label, "debris")
    base = hex_rgb(b["dust"]) * 0.38 + np.array([42, 40, 40], dtype=np.float32) * 0.62
    glow = hex_rgb(b["acc"])
    canvas = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    # sparse free rocks
    for _ in range(r.randint(5, 8)):
        sz = r.randint(10, 26)
        spr = _rock(r, sz, base, glow)
        paste_torus(canvas, spr, r.randint(0, size), r.randint(0, size))
    # tiny shard clusters
    for _ in range(r.randint(2, 4)):
        cx, cy = r.randint(0, size), r.randint(0, size)
        for _ in range(r.randint(4, 8)):
            sz = r.randint(3, 7)
            spr = _rock(r, sz, base)
            paste_torus(canvas, spr, int(cx + r.gauss(0, 40)), int(cy + r.gauss(0, 40)))
    # belt lane: a dense diagonal band of silhouettes
    if b.get("belt"):
        ang = r.uniform(-0.5, 0.5)
        y0 = r.randint(0, size)
        for _ in range(r.randint(26, 40)):
            u = r.uniform(0, size)
            v = r.gauss(0, 46)
            x = int(u); y = int((y0 + math.tan(ang) * u + v) % size)
            sz = r.randint(4, 15)
            spr = _rock(r, sz, base * 0.9, glow)
            paste_torus(canvas, spr, x, y)
    save_png(out, pixelate(np.asarray(canvas), 2))

# ── Layer7: galaxies ────────────────────────────────────────────────────────
def make_galaxies(label, b, out, size=2048):
    r = rng_for(label, "galaxy")
    build = size // 2
    canvas = Image.new("RGBA", (build, build), (0, 0, 0, 0))
    hero = b.get("hero_gal", False)
    tint = hex_rgb(b["gal"])
    pool = GAL_SRCS[:]
    r.shuffle(pool)
    count = 2 + (1 if r.random() < 0.5 else 0) + (1 if hero else 0)
    placed = []
    for gi in range(count):
        src = pool[gi % len(pool)]
        gsize = (300 if hero and gi == 0 else r.randint(90, 170))
        lum = load_gray_square(src, gsize)
        y, x = np.mgrid[0:gsize, 0:gsize].astype(np.float32)
        cxx = (gsize - 1) / 2
        dist = np.sqrt((x - cxx) ** 2 + (y - cxx) ** 2) / cxx
        mask = np.clip(1.2 - dist * 1.25, 0, 1) ** 1.6
        lum = np.clip(lum * mask, 0, 1)
        t = lum[..., None] ** 1.1
        white = np.array([235, 240, 255], dtype=np.float32)
        rgb = tint[None, None] * (1 - t * 0.7) * 0.9 + white[None, None] * (t * 0.7)
        rgb = np.clip(rgb * (0.35 + lum[..., None] * 0.85), 0, 255)
        alpha = (lum ** 1.35) * (0.95 if hero and gi == 0 else 0.75)
        spr = Image.fromarray(np.concatenate([rgb, alpha[..., None] * 255], axis=2).astype(np.uint8), "RGBA")
        spr = spr.rotate(r.uniform(0, 360), expand=True, resample=Image.BICUBIC)
        for _ in range(24):
            px = r.randint(60, build - 60 - spr.width)
            py = r.randint(60, build - 60 - spr.height)
            if all(abs(px - ox) + abs(py - oy) > 260 for ox, oy in placed):
                break
        placed.append((px, py))
        canvas.alpha_composite(spr, (px, py))
    # tiny background smudge galaxies
    d = ImageDraw.Draw(canvas)
    for _ in range(r.randint(6, 10)):
        gx, gy = r.randint(10, build - 10), r.randint(10, build - 10)
        gl = Image.new("L", (26, 26), 0)
        gd = ImageDraw.Draw(gl)
        gd.ellipse([6, 10, 20, 16], fill=120)
        gl = gl.rotate(r.uniform(0, 180), resample=Image.BICUBIC).filter(ImageFilter.GaussianBlur(2.2))
        colt = tuple(int(v) for v in (tint * (0.8 + r.random() * 0.4)).clip(0, 255).astype(int))
        spr = Image.merge("RGBA", (*(Image.new("L", gl.size, c) for c in colt), gl.point(lambda v: int(v * 0.55))))
        canvas.alpha_composite(spr, (gx - 13, gy - 13))
    out_im = Image.fromarray(np.asarray(canvas), "RGBA").resize((size, size), Image.NEAREST)
    save_png(out, np.asarray(out_im))

# ── Layer8: painted landmarks ───────────────────────────────────────────────
# All landmarks are hand-painted 2D pixel art (drawn procedurally): dark hull
# tones + emissive accents with a soft baked glow. No 3D renders.
C = 340  # paint canvas; exported at 2x NEAREST → 680px sprite

def _lm_canvas():
    im = Image.new("RGBA", (C, C), (0, 0, 0, 0))
    em = Image.new("L", (C, C), 0)
    return im, ImageDraw.Draw(im), em, ImageDraw.Draw(em)

def _windows(d, ed, x0, y0, x1, y1, r, col, every=5, p=0.6):
    """Row of tiny lit windows along a segment."""
    ln = math.hypot(x1 - x0, y1 - y0)
    n = max(1, int(ln / every))
    for i in range(n + 1):
        if r.random() > p: continue
        t = i / max(1, n)
        x, y = x0 + (x1 - x0) * t, y0 + (y1 - y0) * t
        d.point((x, y), fill=col + (255,))
        ed.point((x, y), fill=200)

def _hullshade(im, dark=0.72):
    """Darken lower-right for volume + light the top-left silhouette edge."""
    arr = np.asarray(im).astype(np.float32)
    h, w = arr.shape[:2]
    y, x = np.mgrid[0:h, 0:w].astype(np.float32)
    shade = 1.12 - ((x + y) / (w + h)) * (1.12 - dark)
    arr[..., :3] = np.clip(arr[..., :3] * shade[..., None], 0, 255)
    # rim light: opaque pixels whose up/left neighbour is transparent
    op = arr[..., 3] > 40
    rim = np.zeros_like(op)
    rim[1:, 1:] = op[1:, 1:] & (~op[:-1, 1:] | ~op[1:, :-1])
    arr[..., :3][rim] = np.clip(arr[..., :3][rim] * 1.9 + 34, 0, 255)
    return Image.fromarray(arr.astype(np.uint8), "RGBA")

def _finish(im, em, glowA, glowB=None, halo=0.55):
    im = _hullshade(im)
    g1 = glow_from(em, glowA, blurs=((4, 0.8), (12, 0.5), (28, 0.3)))
    g1[..., 3] = (g1[..., 3] * halo).astype(np.uint8)
    base = Image.fromarray(g1, "RGBA")
    base.alpha_composite(im)
    # re-stamp emissive cores at full brightness on top
    core = glow_from(em, glowB or glowA, blurs=((1, 0.9),))
    core[..., 3] = (core[..., 3] * 0.9).astype(np.uint8)
    base.alpha_composite(Image.fromarray(core, "RGBA"))
    out = base.resize((C * 2, C * 2), Image.NEAREST)
    return np.asarray(out)

def _hex(h): return tuple(hex_rgb(h).astype(int))

def lm_ringstation(r, hull, glowA, glowB):
    im, d, em, ed = _lm_canvas()
    hc = _hex(hull); cx = cy = C // 2
    R, th = 118, 20
    broken = r.random() < 0.5
    segs = 18
    skip = set(r.sample(range(segs), 4)) if broken else set()
    for i in range(segs):
        if i in skip: continue
        a0, a1 = math.tau * i / segs + 0.02, math.tau * (i + 1) / segs - 0.02
        pts = []
        for a in (a0, a1):
            pts.append((cx + math.cos(a) * (R + th), cy + math.sin(a) * (R + th) * 0.62))
        for a in (a1, a0):
            pts.append((cx + math.cos(a) * (R - th), cy + math.sin(a) * (R - th) * 0.62))
        d.polygon(pts, fill=hc + (255,))
        mx = cx + math.cos((a0 + a1) / 2) * R
        my = cy + math.sin((a0 + a1) / 2) * R * 0.62
        _windows(d, ed, mx - 6, my, mx + 6, my, r, _hex(glowA), every=4, p=0.7)
    # hub + spokes
    d.ellipse([cx - 26, cy - 18, cx + 26, cy + 18], fill=hc + (255,))
    ed.ellipse([cx - 4, cy - 3, cx + 4, cy + 3], fill=255)
    for a in (0.5, 2.6, 4.2):
        d.line([cx, cy, cx + math.cos(a) * R, cy + math.sin(a) * R * 0.62],
               fill=tuple(int(v * 0.8) for v in hc) + (255,), width=5)
    # drifting chunks near the gap
    if broken:
        for _ in range(4):
            a = math.tau * r.choice(list(skip)) / segs
            px = cx + math.cos(a) * (R + r.randint(18, 44))
            py = cy + math.sin(a) * (R + r.randint(18, 44)) * 0.62
            d.polygon([(px, py), (px + r.randint(4, 9), py + 2), (px + 3, py + r.randint(5, 9))], fill=hc + (255,))
    return _finish(im, em, glowA, glowB)

def lm_gate(r, hull, glowA, glowB):
    im, d, em, ed = _lm_canvas()
    hc = _hex(hull); cx = cy = C // 2
    R = 120
    n = 12
    for i in range(n):  # stone/metal ring segments
        a0, a1 = math.tau * i / n + 0.045, math.tau * (i + 1) / n - 0.045
        pts = [(cx + math.cos(a) * (R + 17), cy + math.sin(a) * (R + 17)) for a in (a0, a1)]
        pts += [(cx + math.cos(a) * (R - 15), cy + math.sin(a) * (R - 15)) for a in (a1, a0)]
        d.polygon(pts, fill=hc + (255,))
        ma = (a0 + a1) / 2  # rune tick per segment
        ed.line([cx + math.cos(ma) * (R - 7), cy + math.sin(ma) * (R - 7),
                 cx + math.cos(ma) * (R + 8), cy + math.sin(ma) * (R + 8)], fill=235, width=2)
    ed.ellipse([cx - R + 22, cy - R + 22, cx + R - 22, cy + R - 22], outline=190, width=3)
    # faint portal sheen
    port = Image.new("L", (C, C), 0)
    pd = ImageDraw.Draw(port)
    for rad, ga in ((R - 30, 26), (int(R * 0.55), 42), (int(R * 0.25), 60)):
        pd.ellipse([cx - rad, cy - rad, cx + rad, cy + rad], fill=ga)
    em.paste(Image.composite(port, em, port), (0, 0))
    # anchor spikes
    for a in (math.tau * 0.125, math.tau * 0.375, math.tau * 0.75):
        x0, y0 = cx + math.cos(a) * (R + 15), cy + math.sin(a) * (R + 15)
        x1, y1 = cx + math.cos(a) * (R + 42), cy + math.sin(a) * (R + 42)
        d.line([x0, y0, x1, y1], fill=hc + (255,), width=7)
        ed.point((x1, y1), fill=255)
    return _finish(im, em, glowA, glowB, halo=0.6)

def lm_monolith(r, hull, glowA, glowB):
    im, d, em, ed = _lm_canvas()
    hc = _hex(hull)
    xs = sorted(r.sample(range(60, C - 80, 20), r.randint(3, 5)))
    for x in xs:
        w = r.randint(18, 30); h = r.randint(90, 170)
        y0 = C // 2 - h // 2 + r.randint(-26, 26)
        sk = r.randint(-8, 8)  # slight lean
        pts = [(x + sk, y0), (x + w + sk, y0), (x + w, y0 + h), (x, y0 + h)]
        d.polygon(pts, fill=hc + (255,))
        d.line([pts[0], pts[3]], fill=tuple(min(255, int(v * 1.6)) for v in hc) + (255,), width=2)
        for gy in range(y0 + 12, y0 + h - 10, r.randint(16, 26)):  # glyph dashes
            gx = x + r.randint(4, max(5, w - 10))
            ed.line([gx, gy, gx + r.randint(4, 8), gy], fill=255, width=3)
    for _ in range(r.randint(4, 7)):  # floating rubble
        px, py = r.randint(40, C - 40), r.randint(60, C - 60)
        s = r.randint(3, 8)
        d.polygon([(px, py), (px + s, py + 1), (px + s - 1, py + s), (px - 1, py + s - 2)], fill=hc + (255,))
    return _finish(im, em, glowA, glowB, halo=0.45)

def lm_crystal(r, hull, glowA, glowB):
    im, d, em, ed = _lm_canvas()
    hc = _hex(hull); cx, cy = C // 2, C // 2 + 44
    ga_c, gb_c = _hex(glowA), _hex(glowB)
    light = tuple(min(255, int(v * 0.45 + g * 0.62)) for v, g in zip(hc, ga_c))
    mid_c = tuple(min(255, int(v * 0.7 + g * 0.35)) for v, g in zip(hc, ga_c))
    dark = tuple(int(v * 0.55 + g * 0.14) for v, g in zip(hc, ga_c))
    def shard(bx, by, ang, ln, wd):
        """Elongated hexagonal gem: body + tapered tip, 2 facets + glow core."""
        ca, sa = math.cos(ang), math.sin(ang)
        nx, ny = -sa, ca
        # six outline points: base-left, mid-left, tip, mid-right, base-right, base-center
        mLx, mLy = bx + ca * ln * 0.62 - nx * wd, by + sa * ln * 0.62 - ny * wd
        mRx, mRy = bx + ca * ln * 0.62 + nx * wd, by + sa * ln * 0.62 + ny * wd
        tx, ty = bx + ca * ln, by + sa * ln
        bLx, bLy = bx - nx * wd * 0.72, by - ny * wd * 0.72
        bRx, bRy = bx + nx * wd * 0.72, by + ny * wd * 0.72
        d.polygon([(bLx, bLy), (mLx, mLy), (tx, ty), (bx + ca * ln * 0.62, by + sa * ln * 0.62)],
                  fill=light + (255,))
        d.polygon([(bx + ca * ln * 0.62, by + sa * ln * 0.62), (tx, ty), (mRx, mRy), (bRx, bRy)],
                  fill=dark + (255,))
        d.line([(mLx, mLy), (tx, ty)], fill=mid_c + (255,), width=2)
        ed.line([bx + ca * 8, by + sa * 8, bx + ca * ln * 0.78, by + sa * ln * 0.78], fill=170, width=4)
        ed.ellipse([tx - 2, ty - 2, tx + 2, ty + 2], fill=255)
    # one dominant crystal + 3-4 companions at natural angles
    shard(cx - 8, cy + 8, -math.pi / 2 + r.gauss(0, 0.06), r.randint(140, 170), r.randint(24, 30))
    for i in range(r.randint(3, 4)):
        side = -1 if i % 2 == 0 else 1
        ang = -math.pi / 2 + side * r.uniform(0.35, 0.8)
        shard(cx + side * r.randint(30, 66), cy + r.randint(10, 22), ang,
              r.randint(60, 110), r.randint(13, 20))
    # rock base over shard roots
    pts = []
    bn = 11
    for i in range(bn):
        a = math.tau * i / bn
        rad = 84 * (0.8 + r.random() * 0.2)
        pts.append((cx + math.cos(a) * rad, cy + 26 + math.sin(a) * rad * 0.4))
    d.polygon(pts, fill=hc + (255,))
    for _ in range(5):  # embedded glints on the rock
        ed.point((int(cx + r.gauss(0, 44)), int(cy + 26 + r.gauss(0, 12))), fill=r.randint(140, 220))
    # small satellite crystals floating around
    for _ in range(r.randint(4, 6)):
        px, py = r.randint(46, C - 46), r.randint(46, C - 70)
        s = r.randint(6, 14)
        a = r.uniform(0, math.tau)
        tx2, ty2 = px + math.cos(a) * s, py + math.sin(a) * s
        d.polygon([(px - 3, py), (tx2, ty2), (px + 3, py)], fill=mid_c + (255,))
        ed.point((tx2, ty2), fill=200)
    return _finish(im, em, glowA, glowB, halo=0.7)

def lm_wreck(r, hull, glowA, glowB):
    im, d, em, ed = _lm_canvas()
    hc = _hex(hull); ga_c = _hex(glowA)
    cy = C // 2
    tilt = r.uniform(-0.16, 0.16)
    # main hull: long stacked blocks + nose
    x0, x1 = 46, C - 60
    d.polygon([(x0 + 26, cy - 24), (x1, cy - 30), (x1 + 16, cy - 8), (x1, cy + 22), (x0 + 26, cy + 26)], fill=hc + (255,))
    d.ellipse([x0, cy - 22, x0 + 58, cy + 24], fill=hc + (255,))
    d.rectangle([x1 - 66, cy - 44, x1 - 18, cy - 22], fill=hc + (255,))    # bridge
    d.rectangle([x1 - 46, cy - 56, x1 - 40, cy - 44], fill=hc + (255,))    # mast
    for k in range(3):  # engine nozzles
        ey = cy - 16 + k * 16
        d.polygon([(x1 + 12, ey - 5), (x1 + 34, ey - 8), (x1 + 34, ey + 8), (x1 + 12, ey + 5)], fill=hc + (255,))
        if r.random() < 0.85: ed.ellipse([x1 + 30, ey - 3, x1 + 36, ey + 3], fill=200)
    # torn bite in the mid hull
    bx = r.randint((x0 + x1) // 2 - 40, (x0 + x1) // 2 + 20)
    bite = [(bx, cy - 30)]
    for k in range(6):
        bite.append((bx + 12 + k * 9, cy - 26 + (k % 2) * 18 + r.randint(-6, 6)))
    bite += [(bx + 66, cy + 30), (bx + 8, cy + 30)]
    # punch transparent hole
    hole = Image.new("L", (C, C), 0)
    ImageDraw.Draw(hole).polygon(bite, fill=255)
    arr = np.asarray(im).copy(); arr[np.asarray(hole) > 0] = 0
    im = Image.fromarray(arr, "RGBA"); d = ImageDraw.Draw(im)
    # ember glow along the torn edge
    for k in range(16):
        exx = bx + r.randint(0, 66); eyy = cy + r.randint(-26, 28)
        if r.random() < 0.7: ed.point((exx, eyy), fill=r.randint(150, 255))
    # window rows (some rows dead)
    _windows(d, ed, x0 + 40, cy - 12, bx - 8, cy - 12, r, ga_c, every=6, p=0.45)
    _windows(d, ed, bx + 74, cy - 14, x1 - 24, cy - 14, r, ga_c, every=6, p=0.55)
    _windows(d, ed, x1 - 62, cy - 36, x1 - 24, cy - 36, r, ga_c, every=5, p=0.6)
    # floating fragments
    for _ in range(r.randint(5, 8)):
        px, py = r.randint(30, C - 30), r.randint(50, C - 50)
        s = r.randint(3, 9)
        d.polygon([(px, py), (px + s, py + 2), (px + s - 2, py + s), (px - 2, py + s - 3)], fill=hc + (255,))
    return _finish(im.rotate(math.degrees(tilt), resample=Image.NEAREST, center=(C/2, C/2)),
                   em.rotate(math.degrees(tilt), resample=Image.NEAREST, center=(C/2, C/2)), glowA, glowB, halo=0.5)

def lm_rig(r, hull, glowA, glowB):
    im, d, em, ed = _lm_canvas()
    hc = _hex(hull); ga_c = _hex(glowA)
    cx, cy = C // 2 - 20, C // 2 + 46
    # big asteroid
    pts = []
    n = 13
    for i in range(n):
        a = math.tau * i / n
        rad = 86 * (0.74 + r.random() * 0.26)
        pts.append((cx + math.cos(a) * rad, cy + math.sin(a) * rad * 0.8))
    rock = tuple(int(v * 1.15) for v in hc)
    d.polygon(pts, fill=rock + (255,))
    for _ in range(5):  # craters
        px, py = int(cx + r.gauss(0, 40)), int(cy + r.gauss(0, 30))
        rr2 = r.randint(4, 10)
        d.ellipse([px - rr2, py - rr2, px + rr2, py + rr2], fill=tuple(int(v * 0.7) for v in rock) + (255,))
    for _ in range(4):  # ore glints
        ed.point((int(cx + r.gauss(0, 44)), int(cy + r.gauss(0, 30))), fill=r.randint(160, 255))
    # gantry truss above
    gy = cy - 96
    d.line([cx - 90, gy, cx + 110, gy], fill=hc + (255,), width=5)
    d.line([cx - 90, gy + 14, cx + 110, gy + 14], fill=hc + (255,), width=4)
    for k in range(10):  # zigzag
        xz = cx - 90 + k * 20
        d.line([xz, gy if k % 2 == 0 else gy + 14, xz + 20, gy + 14 if k % 2 == 0 else gy], fill=hc + (255,), width=2)
    d.rectangle([cx + 64, gy - 26, cx + 108, gy - 2], fill=hc + (255,))  # cabin
    _windows(d, ed, cx + 68, gy - 14, cx + 104, gy - 14, r, ga_c, every=5, p=0.75)
    # drill arm down into rock
    d.line([cx + 8, gy + 14, cx + 2, cy - 30], fill=hc + (255,), width=6)
    d.polygon([(cx - 6, cy - 32), (cx + 10, cy - 32), (cx + 2, cy - 6)], fill=hc + (255,))
    ed.line([cx - 1, cy - 22, cx + 5, cy - 22], fill=255, width=2)
    # support legs + cables
    for lx in (-64, 44):
        d.line([cx + lx, gy + 14, cx + lx + 12, cy - 40], fill=hc + (255,), width=3)
    for k in range(3):  # floodlights
        fx = cx - 80 + k * 84
        ed.ellipse([fx - 2, gy - 4, fx + 2, gy], fill=255)
    return _finish(im, em, glowA, glowB, halo=0.5)

def lm_biomech(r, hull, glowA, glowB):
    im, d, em, ed = _lm_canvas()
    hc = _hex(hull)
    cx, cy = C // 2, C // 2
    lobes = []
    for _ in range(r.randint(4, 6)):
        lx, ly = int(cx + r.gauss(0, 42)), int(cy + r.gauss(0, 34))
        rx, ry = r.randint(34, 66), r.randint(26, 52)
        lobes.append((lx, ly, rx, ry))
        d.ellipse([lx - rx, ly - ry, lx + rx, ly + ry], fill=hc + (255,))
    # tendrils
    for _ in range(r.randint(4, 7)):
        lx, ly, rx, ry = r.choice(lobes)
        a = r.uniform(0, math.tau)
        x, y = lx + math.cos(a) * rx, ly + math.sin(a) * ry
        for k in range(r.randint(5, 9)):
            a += r.gauss(0, 0.35)
            nx2, ny2 = x + math.cos(a) * 14, y + math.sin(a) * 14
            d.line([x, y, nx2, ny2], fill=hc + (255,), width=max(1, 5 - k))
            x, y = nx2, ny2
    # vein network crawling over the mass
    for _ in range(r.randint(6, 9)):
        lx, ly, rx, ry = r.choice(lobes)
        a = r.uniform(0, math.tau)
        x, y = lx + math.cos(a) * rx * 0.5, ly + math.sin(a) * ry * 0.5
        for k in range(r.randint(6, 12)):
            a += r.gauss(0, 0.5)
            nx2, ny2 = x + math.cos(a) * 9, y + math.sin(a) * 9
            ed.line([x, y, nx2, ny2], fill=150, width=1)
            x, y = nx2, ny2
    # glowing pustules
    for _ in range(r.randint(6, 10)):
        lx, ly, rx, ry = r.choice(lobes)
        px = int(lx + r.gauss(0, rx * 0.5)); py = int(ly + r.gauss(0, ry * 0.5))
        ed.ellipse([px - 2, py - 2, px + 2, py + 2], fill=255)
    return _finish(im, em, glowA, glowB, halo=0.6)

def lm_citadel(r, hull, glowA, glowB):
    im, d, em, ed = _lm_canvas()
    hc = _hex(hull); ga_c = _hex(glowA)
    baseb = C - 92
    d.polygon([(52, baseb), (C - 52, baseb), (C - 76, baseb + 26), (76, baseb + 26)], fill=hc + (255,))
    n = r.randint(4, 5)
    xs = np.linspace(86, C - 86, n).astype(int)
    hts = sorted([r.randint(70, 120) for _ in range(n)])
    order = [n // 2] + [i for i in range(n) if i != n // 2]  # tallest center
    hts_by_x = {}
    for rank, idx in enumerate(order):
        hts_by_x[xs[idx]] = hts[-1 - rank] if rank < len(hts) else hts[0]
    for x in xs:
        h = hts_by_x[x]
        w = r.randint(14, 22)
        d.polygon([(x - w, baseb), (x - w // 3, baseb - h), (x + w // 3, baseb - h), (x + w, baseb)], fill=hc + (255,))
        for wy in range(baseb - h + 16, baseb - 8, 9):  # window columns
            if r.random() < 0.75:
                d.point((x - 2, wy), fill=ga_c + (255,)); ed.point((x - 2, wy), fill=190)
            if r.random() < 0.6:
                d.point((x + 2, wy), fill=ga_c + (255,)); ed.point((x + 2, wy), fill=190)
        ed.line([x - 1, baseb - h - 5, x + 1, baseb - h - 5], fill=235, width=2)  # crown
    # bridges between spires
    for i in range(len(xs) - 1):
        by = baseb - min(hts_by_x[xs[i]], hts_by_x[xs[i + 1]]) // 2 - r.randint(0, 18)
        d.line([xs[i], by, xs[i + 1], by], fill=hc + (255,), width=3)
    # crown halo at central tip
    cx = xs[order[0] if isinstance(order[0], int) else 0]
    cx = xs[n // 2]
    ed.ellipse([cx - 3, baseb - hts_by_x[cx] - 10, cx + 3, baseb - hts_by_x[cx] - 4], fill=255)
    return _finish(im, em, glowA, glowB, halo=0.5)

def lm_beacon(r, hull, glowA, glowB):
    im, d, em, ed = _lm_canvas()
    hc = _hex(hull)
    lift = tuple(min(255, int(v * 1.7 + 18)) for v in hc)
    cx = C // 2
    top, bot = 62, C - 72
    # obelisk shaft with a lit left facet
    d.polygon([(cx - 6, top), (cx + 6, top), (cx + 15, bot), (cx - 15, bot)], fill=hc + (255,))
    d.polygon([(cx - 6, top), (cx - 1, top), (cx - 4, bot), (cx - 15, bot)], fill=lift + (255,))
    # energy seam up the middle
    ed.line([cx, top + 8, cx, bot - 6], fill=140, width=2)
    # base station block + windows
    d.polygon([(cx - 34, bot), (cx + 34, bot), (cx + 24, bot + 22), (cx - 24, bot + 22)], fill=hc + (255,))
    _windows(d, ed, cx - 26, bot + 8, cx + 26, bot + 8, r, _hex(glowA), every=6, p=0.75)
    # stacked halo rings: dim back half, bright front half (reads as 3D hoops)
    for k, hy in enumerate(np.linspace(top + 46, bot - 34, 3).astype(int)):
        rw = 48 + k * 27
        rh = rw // 4
        ed.arc([cx - rw, hy - rh, cx + rw, hy + rh], 180, 360, fill=95 - k * 14, width=4)
        ed.arc([cx - rw, hy - rh, cx + rw, hy + rh], 0, 180, fill=235 - k * 22, width=5)
    # top star + flare
    ed.ellipse([cx - 5, top - 14, cx + 5, top - 4], fill=255)
    ed.line([cx - 18, top - 9, cx + 18, top - 9], fill=230, width=2)
    ed.line([cx, top - 24, cx, top + 6], fill=230, width=2)
    # small orbiting satellites
    for _ in range(3):
        a = r.uniform(0, math.tau); rr2 = r.randint(76, 122)
        px, py = cx + math.cos(a) * rr2, (top + bot) / 2 + math.sin(a) * rr2 * 0.4
        d.rectangle([px, py, px + 5, py + 4], fill=lift + (255,))
        ed.point((px + 2, py + 2), fill=220)
    return _finish(im, em, glowA, glowB, halo=0.8)

def lm_temple(r, hull, glowA, glowB):
    im, d, em, ed = _lm_canvas()
    hc = _hex(hull)
    baseb = C - 100
    d.polygon([(58, baseb), (C - 58, baseb), (C - 80, baseb + 24), (80, baseb + 24)], fill=hc + (255,))
    n = 5
    xs = np.linspace(92, C - 92, n).astype(int)
    ch = 92
    broken = set(r.sample(range(n), 2))
    for i, x in enumerate(xs):
        h = ch if i not in broken else r.randint(30, 54)
        d.rectangle([x - 8, baseb - h, x + 8, baseb], fill=hc + (255,))
        d.rectangle([x - 11, baseb - h - 6, x + 11, baseb - h], fill=hc + (255,))
        if i in broken:  # fallen capital drifting
            fx, fy = x + r.randint(-24, 24), baseb - ch - r.randint(10, 40)
            d.rectangle([fx - 9, fy - 5, fx + 9, fy + 3], fill=hc + (255,))
    # architrave + broken pediment
    d.rectangle([80, baseb - ch - 18, C - 80, baseb - ch - 4], fill=hc + (255,))
    d.polygon([(80, baseb - ch - 18), (C // 2 - 26, baseb - ch - 54), (C // 2 - 8, baseb - ch - 18)], fill=hc + (255,))
    d.polygon([(C // 2 + 22, baseb - ch - 26), (C - 80, baseb - ch - 18), (C // 2 + 4, baseb - ch - 18)], fill=hc + (255,))
    # glyph band along the architrave
    for gx in range(96, C - 96, 12):
        if r.random() < 0.75:
            ed.line([gx, baseb - ch - 11, gx + 6, baseb - ch - 11], fill=255, width=3)
    # floating fragments above the break
    for _ in range(4):
        px, py = C // 2 + r.randint(-30, 40), baseb - ch - r.randint(30, 64)
        s = r.randint(3, 7)
        d.polygon([(px, py), (px + s, py + 1), (px + s - 1, py + s), (px - 1, py + s - 1)], fill=hc + (255,))
    return _finish(im, em, glowA, glowB, halo=0.55)

LM = dict(ringstation=lm_ringstation, gate=lm_gate, monolith=lm_monolith,
          crystal=lm_crystal, wreck=lm_wreck, rig=lm_rig, biomech=lm_biomech,
          citadel=lm_citadel, beacon=lm_beacon, temple=lm_temple)

def make_landmark(label, b, out):
    r = rng_for(label, "landmark")
    c = b["lmc"]
    arr = LM[b["lm"]](r, c["hull"], c["glow"], c["glow2"])
    save_png(out, arr)

# ── asteroids (rotating foreground sprites) ─────────────────────────────────
# ansimuz "Warped Space Shooter" asteroid sprites (CC0) — authored pixel art
# with crater shading, dithering and a baked dark outline. Variety comes from
# pixel-perfect 90-degree rotations + mirroring; zone identity from a hue
# swap that keeps the original shading ramps intact.
AST_DIR = os.path.join(ROOT, "scripts", "asset_src", "ansimuz_asteroids")
AST_BIG = os.path.join(AST_DIR, "asteroid.png")
AST_SMALL = os.path.join(AST_DIR, "asteroid-small.png")

def _hue_shift(im, tint_hex, sat_blend=0.35):
    """Replace hue with the zone tint's hue, keep value (shading) untouched."""
    import colorsys
    tr, tg, tb = (float(v) / 255 for v in hex_rgb(tint_hex))
    th, ts, _tv = colorsys.rgb_to_hsv(tr, tg, tb)
    hsv = np.asarray(im.convert("RGBA")).astype(np.float32)
    a = hsv[..., 3:4]
    rgbf = hsv[..., :3] / 255.0
    mx = rgbf.max(axis=2); mn = rgbf.min(axis=2)
    v = mx
    sat = np.where(mx > 0, (mx - mn) / np.maximum(mx, 1e-6), 0)
    new_s = np.clip(sat * (1 - sat_blend) + ts * sat_blend, 0, 1)
    # HSV→RGB with constant hue th
    i = int(th * 6) % 6
    f = th * 6 - int(th * 6)
    p2 = v * (1 - new_s)
    q = v * (1 - f * new_s)
    t = v * (1 - (1 - f) * new_s)
    if   i == 0: r2, g2, b2 = v, t, p2
    elif i == 1: r2, g2, b2 = q, v, p2
    elif i == 2: r2, g2, b2 = p2, v, t
    elif i == 3: r2, g2, b2 = p2, q, v
    elif i == 4: r2, g2, b2 = t, p2, v
    else:        r2, g2, b2 = v, p2, q
    out = np.concatenate([np.stack([r2, g2, b2], axis=2) * 255, a], axis=2)
    return Image.fromarray(out.astype(np.uint8), "RGBA")

def make_asteroids(label, b, out_prefix):
    r = rng_for(label, "ast")
    big = Image.open(AST_BIG).convert("RGBA")
    small = Image.open(AST_SMALL).convert("RGBA")
    variants = []
    for k in range(4):
        v = big.rotate(k * 90, expand=True)
        variants.append(v)
        variants.append(v.transpose(Image.FLIP_LEFT_RIGHT))
    r.shuffle(variants)
    picks = variants[:3] + [small.rotate(r.choice([0, 90, 180, 270]), expand=True)]
    for idx, spr in enumerate(picks, start=1):
        tinted = _hue_shift(spr, b["dust"])
        out = tinted.resize((tinted.width * 2, tinted.height * 2), Image.NEAREST)
        out.save(f"{out_prefix}{idx}_{label}.png", optimize=True)
    print(f"  ast1-4_{label} done (ansimuz pixel-art set)")

# ── main ────────────────────────────────────────────────────────────────────
only = set(sys.argv[1:])
for label, b in THEMES.items():
    if only and label not in only:
        continue
    zdir = os.path.join(BG, label)
    os.makedirs(zdir, exist_ok=True)
    print(f"=== {label} · {b['name']} ===")
    if not b.get("extras_only"):
        make_stars(label, b, os.path.join(zdir, f"Layer1_{label}.png"))
        make_nebula(label, b, os.path.join(zdir, f"Layer2_{label}.png"))
        make_effect(label, b, os.path.join(zdir, f"Layer3_{label}.png"))
    make_dust(label, b, os.path.join(zdir, f"Layer5_{label}.png"))
    make_debris(label, b, os.path.join(zdir, f"Layer6_{label}.png"))
    make_galaxies(label, b, os.path.join(zdir, f"Layer7_{label}.png"))
    make_landmark(label, b, os.path.join(zdir, f"Layer8_{label}.png"))
    make_asteroids(label, b, os.path.join(zdir, "ast"))
print("ALL ZONES DONE")
