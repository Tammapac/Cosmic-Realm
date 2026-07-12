# ── Cosmic Realm environment generator ──────────────────────────────────────
# Builds per-zone background layers for all maps EXCEPT the preserved 1-1 art
# (1-1 only gains the new optional layers). Sources:
#   - NASA public-domain imagery (nebulae/galaxies), heavily processed:
#     duotone palette grading + alpha shaping + pixelation → original look
#   - procedural starfields / clusters / dust / asteroids (fully in-house)
# Existing planets (Layer4_*.png) are NEVER touched.
#
# Usage: py scripts/gen-environments.py [nasa_cache_dir]
import json, math, os, random, sys
import numpy as np
from PIL import Image, ImageDraw, ImageFilter

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BG = os.path.join(ROOT, "frontend", "public", "bg")
CACHE = sys.argv[1] if len(sys.argv) > 1 else os.path.join(ROOT, "scripts", "nasa_cache")

# ── per-zone biome definitions ──────────────────────────────────────────────
# neb: duotone lo/hi · wisp gamma · density 0..1 · streak axis (None/h)
# dust/star/cluster/galaxy tints · galaxy scale ("hero" = centerpiece)
BIOMES = {
    "1-2": dict(lo="#1a0f3f", hi="#a06cff", dust="#6a4bbf", star="#cdbcff", cluster="#b088ff", gal="#b9a0ff", density=0.85),
    "1-3": dict(lo="#2a0813", hi="#ff4455", dust="#99333f", star="#ffc9cc", cluster="#ff7788", gal="#dd8899", density=0.75),
    "1-4": dict(lo="#04201c", hi="#1fbf9f", dust="#0f5a4c", star="#bfeee2", cluster="#33ddb3", gal="#7fd4c0", density=0.30),
    "1-5": dict(lo="#2a1206", hi="#ff9633", dust="#b36a2a", star="#ffdcb0", cluster="#ffaa55", gal="#cc9977", density=0.80, streak="h"),
    "2-1": dict(lo="#2a0e04", hi="#ff7733", dust="#aa5522", star="#ffd9bb", cluster="#ff9955", gal="#cc9988", density=0.70, streak="h"),
    "2-2": dict(lo="#241004", hi="#cc8844", dust="#96652f", star="#eeddcc", cluster="#ddaa66", gal="#bb9977", density=0.85, streak="h"),
    "2-3": dict(lo="#250612", hi="#ff3355", dust="#8f2f44", star="#ffc4cc", cluster="#ff6688", gal="#cc7788", density=0.75),
    "2-4": dict(lo="#1d0526", hi="#bb44ff", dust="#5f2f80", star="#ddbbff", cluster="#cc77ff", gal="#aa88dd", density=0.65),
    "2-5": dict(lo="#140836", hi="#7a55ff", dust="#4a3aa0", star="#c9c0ff", cluster="#9977ff", gal="#a8a0ff", density=0.85, hero_gal=True),
    "3-1": dict(lo="#0c2408", hi="#66cc44", dust="#3f7a2f", star="#d6f0c9", cluster="#88dd66", gal="#99cc88", density=0.60),
    "3-2": dict(lo="#16240a", hi="#b8e022", dust="#7a8f2f", star="#eef6cc", cluster="#ccee44", gal="#aabb77", density=0.70, streak="h"),
    "3-3": dict(lo="#062a12", hi="#33ee77", dust="#1f8f4c", star="#c9f6dd", cluster="#55ff99", gal="#77cc99", density=0.90),
    "3-4": dict(lo="#032018", hi="#00cc88", dust="#0f6a4c", star="#bbeedd", cluster="#22ddaa", gal="#66bbaa", density=0.45),
    "3-5": dict(lo="#0d2a06", hi="#88ee22", dust="#4c8f1f", star="#e6f8c9", cluster="#aaff44", gal="#99cc66", density=0.85),
    "4-1": dict(lo="#260610", hi="#ff3355", dust="#8f2f3f", star="#ffc4c9", cluster="#ff5577", gal="#cc7788", density=0.70),
    "4-2": dict(lo="#260a04", hi="#ff6633", dust="#96422a", star="#ffd0bb", cluster="#ff8855", gal="#bb8877", density=0.75),
    "4-3": dict(lo="#22041a", hi="#ff2288", dust="#8f2266", star="#ffbbdd", cluster="#ff55aa", gal="#cc77aa", density=0.75),
    "4-4": dict(lo="#16031f", hi="#cc44ff", dust="#5f2a80", star="#e0bbff", cluster="#dd66ff", gal="#aa88cc", density=0.65, invert=True),
    "4-5": dict(lo="#0d0224", hi="#8844ff", dust="#452a8f", star="#cfbbff", cluster="#9955ff", gal="#a090ee", density=0.95),
    # 1-1 keeps its original art; it only gains subtle galaxies + dust
    "1-1": dict(lo="#060e2e", hi="#4477dd", dust="#3a5a8c", star="#cfe0ff", cluster="#88aaff", gal="#a9c4ff", density=0.5, extras_only=True),
}

def hex_rgb(h):
    h = h.lstrip("#")
    return np.array([int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16)], dtype=np.float32)

def rng_for(label, salt):
    return random.Random(f"{label}:{salt}")

def np_rng(label, salt):
    return np.random.default_rng(abs(hash(f"{label}:{salt}")) % (2**32))

# ── NASA source pool ────────────────────────────────────────────────────────
with open(os.path.join(CACHE, "manifest.json")) as f:
    MANIFEST = json.load(f)
NEBULA_SRCS = [m["file"] for m in MANIFEST if m["q"] == "nebula"]
GALAXY_SRCS = [m["file"] for m in MANIFEST if "galaxy" in m["q"]]
print(f"sources: {len(NEBULA_SRCS)} nebulae, {len(GALAXY_SRCS)} galaxies")

def load_gray_square(path, size, crop_rng=None):
    im = Image.open(path).convert("L")
    # trim 8% margins — some NASA frames carry caption bars / hard borders
    # that otherwise leak hard edges into crops
    mw, mh = int(im.width * 0.08), int(im.height * 0.08)
    im = im.crop((mw, mh, im.width - mw, im.height - mh))
    w, h = im.size
    side = min(w, h)
    if crop_rng:
        # random square crop inside the image for variety between zones
        side = int(side * (0.6 + crop_rng.random() * 0.4))
        x0 = crop_rng.randint(0, w - side)
        y0 = crop_rng.randint(0, h - side)
    else:
        x0, y0 = (w - side) // 2, (h - side) // 2
    im = im.crop((x0, y0, x0 + side, y0 + side)).resize((size, size), Image.LANCZOS)
    a = np.asarray(im, dtype=np.float32) / 255.0
    lo, hi = np.percentile(a, 2), np.percentile(a, 98)
    return np.clip((a - lo) / max(1e-4, hi - lo), 0, 1)

def border_fade(size, margin):
    y, x = np.mgrid[0:size, 0:size].astype(np.float32)
    d = np.minimum(np.minimum(x, size - 1 - x), np.minimum(y, size - 1 - y))
    return np.clip(d / margin, 0, 1) ** 1.5

def pixelate(arr, factor=2):
    im = Image.fromarray(arr)
    small = im.resize((im.width // factor, im.height // factor), Image.BILINEAR)
    return np.asarray(small.resize(im.size, Image.NEAREST))

def save_png(path, rgba):
    Image.fromarray(rgba, "RGBA").save(path, optimize=True)
    print(" ", os.path.relpath(path, ROOT), f"{os.path.getsize(path)//1024}KB")

# ── layer builders ──────────────────────────────────────────────────────────
def make_nebula(label, b, out, size=2048, wisp=False):
    r = rng_for(label, "wisp" if wisp else "nebula")
    src = NEBULA_SRCS[(abs(hash(label)) + (7 if wisp else 0)) % len(NEBULA_SRCS)]
    lum = load_gray_square(src, size, r)
    if b.get("invert") and wisp:
        lum = 1.0 - lum
    if wisp:
        # keep filaments: subtract blurred base
        blur = np.asarray(Image.fromarray((lum * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(30)), dtype=np.float32) / 255
        lum = np.clip((lum - blur) * 2.2 + 0.08, 0, 1)
    if b.get("streak"):
        im = Image.fromarray((lum * 255).astype(np.uint8))
        im = im.resize((size, size // 6), Image.LANCZOS).resize((size, size), Image.LANCZOS)
        lum = np.asarray(im, dtype=np.float32) / 255
    lo, hi = hex_rgb(b["lo"]), hex_rgb(b["hi"])
    t = (lum[..., None] ** 1.3)
    rgb = lo[None, None] * (1 - t) + hi[None, None] * t
    alpha = (lum ** (2.4 if wisp else 1.6)) * (0.7 if wisp else 0.9) * b["density"]
    alpha *= border_fade(size, 300)
    alpha[alpha < 0.02] = 0
    rgba = np.concatenate([rgb, alpha[..., None] * 255], axis=2).astype(np.uint8)
    rgba = pixelate(rgba, 2)
    save_png(out, rgba)

def make_galaxies(label, b, out, size=2048):
    r = rng_for(label, "galaxy")
    canvas = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    hero = b.get("hero_gal", False)
    count = 1 + (1 if r.random() < 0.6 else 0)
    tint = hex_rgb(b["gal"])
    placed = []
    for gi in range(count + (1 if hero else 0)):
        src = GALAXY_SRCS[r.randrange(len(GALAXY_SRCS))]
        gsize = (480 if hero and gi == 0 else r.randint(170, 300))
        lum = load_gray_square(src, gsize)
        # radial falloff so the galaxy floats free of its crop
        y, x = np.mgrid[0:gsize, 0:gsize].astype(np.float32)
        cx = (gsize - 1) / 2
        dist = np.sqrt((x - cx) ** 2 + (y - cx) ** 2) / cx
        mask = np.clip(1.2 - dist * 1.25, 0, 1) ** 1.6
        lum = np.clip(lum * mask, 0, 1)
        t = lum[..., None] ** 1.1
        white = np.array([235, 240, 255], dtype=np.float32)
        rgb = tint[None, None] * (1 - t * 0.7) * 0.9 + white[None, None] * (t * 0.7)
        rgb = np.clip(rgb * (0.35 + lum[..., None] * 0.85), 0, 255)
        alpha = (lum ** 1.35) * (0.95 if hero and gi == 0 else 0.8)
        spr = Image.fromarray(np.concatenate([rgb, alpha[..., None] * 255], axis=2).astype(np.uint8), "RGBA")
        spr = spr.rotate(r.uniform(0, 360), expand=True, resample=Image.BICUBIC)
        # place away from edges + away from other galaxies
        for _ in range(20):
            px = r.randint(200, size - 200 - spr.width)
            py = r.randint(200, size - 200 - spr.height)
            if all(abs(px - ox) + abs(py - oy) > 600 for ox, oy in placed):
                break
        placed.append((px, py))
        canvas.alpha_composite(spr, (px, py))
    arr = pixelate(np.asarray(canvas), 2)
    save_png(out, arr)

def make_stars(label, b, out, size=1024):
    r = rng_for(label, "stars")
    canvas = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    d = ImageDraw.Draw(canvas)
    star_tint = tuple(hex_rgb(b["star"]).astype(int))
    n = int(300 + 260 * b["density"])
    for _ in range(n):
        x, y = r.randint(4, size - 5), r.randint(4, size - 5)
        roll = r.random()
        if r.random() < 0.82:
            col = (255, 255, 255)
        else:
            col = star_tint
        a = r.randint(90, 255)
        if roll < 0.65:
            d.point((x, y), fill=col + (a,))
        elif roll < 0.90:
            d.rectangle([x, y, x + 1, y + 1], fill=col + (a,))
        elif roll < 0.97:
            d.line([x - 2, y, x + 2, y], fill=col + (min(255, a),))
            d.line([x, y - 2, x, y + 2], fill=col + (min(255, a),))
        else:
            # glow star
            for rad, ga in ((5, 40), (3, 90), (1, 220)):
                d.ellipse([x - rad, y - rad, x + rad, y + rad], fill=col + (ga,))
    # 1-2 luminous star clusters
    ccol = tuple(hex_rgb(b["cluster"]).astype(int))
    for _ in range(1 + (1 if r.random() < 0.7 else 0)):
        cx, cy = r.randint(200, size - 200), r.randint(200, size - 200)
        halo = Image.new("RGBA", (size, size), (0, 0, 0, 0))
        hd = ImageDraw.Draw(halo)
        hr = r.randint(70, 120)
        for rad, ga in ((hr, 14), (int(hr * 0.6), 22), (int(hr * 0.3), 30)):
            hd.ellipse([cx - rad, cy - rad, cx + rad, cy + rad], fill=ccol + (ga,))
        halo = halo.filter(ImageFilter.GaussianBlur(24))
        canvas.alpha_composite(halo)
        for _ in range(r.randint(55, 85)):
            ang = r.uniform(0, math.tau)
            rad = abs(r.gauss(0, hr * 0.45))
            sx, sy = int(cx + math.cos(ang) * rad), int(cy + math.sin(ang) * rad)
            if 2 <= sx < size - 2 and 2 <= sy < size - 2:
                a = r.randint(120, 255)
                if r.random() < 0.75:
                    d.point((sx, sy), fill=(255, 255, 255, a))
                else:
                    d.rectangle([sx, sy, sx + 1, sy + 1], fill=ccol + (a,))
    save_png(out, np.asarray(canvas))

def make_dust(label, b, out, size=1024):
    g = np_rng(label, "dust")
    # seamless: mirror-tile a half-size fBm
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
    rgb = np.broadcast_to(col[None, None], (size, size, 3))
    alpha = (lum ** 1.6) * 0.45
    rgba = np.concatenate([rgb, alpha[..., None] * 255], axis=2).astype(np.uint8)
    save_png(out, pixelate(rgba, 2))

def make_asteroids(label, b, out_prefix):
    r = rng_for(label, "ast")
    base = hex_rgb(b["dust"]) * 0.55 + np.array([70, 66, 62], dtype=np.float32) * 0.45
    for idx in range(1, 5):
        sz = r.randint(56, 78)  # drawn small, scaled 2x NEAREST for pixel look
        im = Image.new("RGBA", (sz, sz), (0, 0, 0, 0))
        d = ImageDraw.Draw(im)
        cx = sz / 2
        pts = []
        n = r.randint(9, 13)
        for i in range(n):
            ang = math.tau * i / n
            rad = (sz / 2 - 3) * (0.72 + r.random() * 0.28)
            pts.append((cx + math.cos(ang) * rad, cx + math.sin(ang) * rad))
        rock = tuple((base * (0.9 + r.random() * 0.2)).astype(int))
        d.polygon(pts, fill=rock + (255,))
        # shading: darken lower-right, lighten upper-left
        arr = np.asarray(im).astype(np.float32)
        y, x = np.mgrid[0:sz, 0:sz].astype(np.float32)
        shade = 1.15 - ((x + y) / (2 * sz)) * 0.55
        arr[..., :3] = np.clip(arr[..., :3] * shade[..., None], 0, 255)
        im = Image.fromarray(arr.astype(np.uint8), "RGBA")
        d = ImageDraw.Draw(im)
        for _ in range(r.randint(3, 6)):
            crx, cry = r.randint(8, sz - 8), r.randint(8, sz - 8)
            crr = r.randint(2, 5)
            if im.getpixel((crx, cry))[3] > 0:
                dark = tuple((base * 0.55).astype(int))
                d.ellipse([crx - crr, cry - crr, crx + crr, cry + crr], fill=dark + (255,))
                d.arc([crx - crr, cry - crr, crx + crr, cry + crr], 200, 340, fill=tuple((base * 1.35).clip(0, 255).astype(int)) + (255,))
        # outline
        a = np.asarray(im)
        edge = (a[..., 3] > 0)
        er = np.zeros_like(edge)
        er[1:-1, 1:-1] = edge[1:-1, 1:-1] & ~(edge[:-2, 1:-1] & edge[2:, 1:-1] & edge[1:-1, :-2] & edge[1:-1, 2:])
        a = a.copy()
        a[er] = [10, 8, 8, 255]
        im = Image.fromarray(a, "RGBA").resize((sz * 2, sz * 2), Image.NEAREST)
        im.save(f"{out_prefix}{idx}_{label}.png", optimize=True)
    print(f"  ast1-4_{label} done")

# ── main ────────────────────────────────────────────────────────────────────
for label, b in BIOMES.items():
    zdir = os.path.join(BG, label)
    os.makedirs(zdir, exist_ok=True)
    print(f"=== {label} ===")
    if b.get("extras_only"):
        make_galaxies(label, b, os.path.join(zdir, f"Layer7_{label}.png"))
        make_dust(label, b, os.path.join(zdir, f"Layer5_{label}.png"))
        continue
    make_stars(label, b, os.path.join(zdir, f"Layer1_{label}.png"))
    make_nebula(label, b, os.path.join(zdir, f"Layer2_{label}.png"))
    make_nebula(label, b, os.path.join(zdir, f"Layer3_{label}.png"), wisp=True)
    make_dust(label, b, os.path.join(zdir, f"Layer5_{label}.png"))
    make_galaxies(label, b, os.path.join(zdir, f"Layer7_{label}.png"))
    make_asteroids(label, b, os.path.join(zdir, "ast"))
print("ALL ZONES DONE")
