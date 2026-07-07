# v4: crispy pixelated Wisedawn planets (unique per map), L1 space details
# (galaxies + distant moons), per-map asteroid sprites for engine-side rotation.
# Only touches: Layer1, Layer4, ast1..4_<label>.png; deletes Layer6 (replaced by sprites).
import colorsys
import random
import numpy as np
from pathlib import Path
from PIL import Image, ImageEnhance

SP = Path(r"C:\Users\tamma\AppData\Local\Temp\claude\E--Program-Files-Claude-Code\d39092ba-0c5d-4f54-b0d7-5aae1687f5ce\scratchpad\assets")
WARPED = SP / "ansimuz-warped" / "Space Shooter files"
WISE = SP / "wisedawn"
P484 = SP / "planets484"
OUT_ROOT = Path(r"E:\Program Files\Claude Code\Cosmic-Realm\frontend\public\bg")
ART = 512
SCALE = 4

# label: glow, star style (kept from v3), wisedawn planet number, planet art px
MAPS = {
    "1-2": ("#7722aa", "clustered", 1,  150),
    "1-3": ("#cc2233", "milkyway",  19, 120),
    "1-4": ("#006655", "sparse",    4,  100),
    "1-5": ("#cc6600", "clustered", 9,  135),
    "2-1": ("#cc4400", "sparse",    17, 145),
    "2-2": ("#884422", "milkyway",  10, 110),
    "2-3": ("#aa0033", "clustered", 7,  130),
    "2-4": ("#660066", "sparse",    13, 120),
    "2-5": ("#5500cc", "milkyway",  16, 155),
    "3-1": ("#44aa22", "clustered", 5,  140),
    "3-2": ("#88cc00", "sparse",    12, 115),
    "3-3": ("#22cc44", "milkyway",  2,  150),
    "3-4": ("#00aa66", "clustered", 11, 105),
    "3-5": ("#66dd00", "sparse",    6,  130),
    "4-1": ("#ff2244", "sparse",    8,  145),
    "4-2": ("#ff4400", "clustered", 18, 125),
    "4-3": ("#cc0066", "milkyway",  3,  155),
    "4-4": ("#aa00cc", "sparse",    14, 115),
    "4-5": ("#6600ff", "clustered", 20, 140),
}

MOONS = sorted(P484.glob("*.png"))


def hex_rgb(h):
    n = int(h.lstrip("#"), 16)
    return np.array([(n >> 16) & 255, (n >> 8) & 255, n & 255], dtype=float)


def pnoise(rng, lattice, size):
    g = rng.random((lattice, lattice))
    coords = np.linspace(0, lattice, size, endpoint=False)
    yv, xv = np.meshgrid(coords, coords, indexing="ij")
    y0 = np.floor(yv).astype(int) % lattice
    x0 = np.floor(xv).astype(int) % lattice
    y1, x1 = (y0 + 1) % lattice, (x0 + 1) % lattice
    fy, fx = yv % 1.0, xv % 1.0
    fy, fx = fy * fy * (3 - 2 * fy), fx * fx * (3 - 2 * fx)
    return (g[y0, x0] * (1 - fx) * (1 - fy) + g[y0, x1] * fx * (1 - fy)
            + g[y1, x0] * (1 - fx) * fy + g[y1, x1] * fx * fy)


def wrap_paste(canvas, sprite, x, y):
    w, h = canvas.size
    for ox in (0, -w, w):
        for oy in (0, -h, h):
            if x + ox + sprite.width > 0 and x + ox < w and y + oy + sprite.height > 0 and y + oy < h:
                canvas.alpha_composite(sprite, (x + ox, y + oy))


# ── crispy planet: pixelate 1024px art down, quantize, re-upscale ────────────
def make_planet(num, art_px, danger):
    p = Image.open(WISE / f"{num}.png").convert("RGBA")
    p = p.resize((art_px, art_px), Image.BOX)          # clean pixelation
    p = ImageEnhance.Contrast(p).enhance(1.08)
    p = ImageEnhance.Brightness(p).enhance(0.68 if danger else 0.82)
    alpha = p.getchannel("A")
    q = p.convert("RGB").quantize(colors=28, dither=Image.FLOYDSTEINBERG).convert("RGB")
    out = q.convert("RGBA")
    out.putalpha(alpha)
    return out.resize((art_px * SCALE, art_px * SCALE), Image.NEAREST)


# ── procedural spiral galaxy sprite (distant space detail) ───────────────────
def make_galaxy(pyrng, size, tint):
    a = np.zeros((size, size, 4), dtype=float)
    cx = cy = size / 2
    arms = pyrng.choice([2, 3])
    twist = pyrng.uniform(2.2, 3.4)
    for _ in range(size * 28):
        t = pyrng.random() ** 0.6
        arm = pyrng.randrange(arms)
        ang = t * twist * np.pi + arm * 2 * np.pi / arms + pyrng.gauss(0, 0.18 + 0.25 * t)
        r = t * size * 0.46
        x, y = cx + np.cos(ang) * r, cy + np.sin(ang) * r * pyrng.uniform(0.5, 0.62)
        if 0 <= x < size and 0 <= y < size:
            fade = (1 - t) * pyrng.uniform(0.5, 1.0)
            c = np.array([*(tint * (0.55 + 0.45 * fade)), 150 * fade])
            yi, xi = int(y), int(x)
            a[yi, xi] = np.maximum(a[yi, xi], c)
    # bright core
    for dy in range(-2, 3):
        for dx in range(-2, 3):
            if dx * dx + dy * dy <= 4:
                v = 235 - 28 * (abs(dx) + abs(dy))
                a[int(cy) + dy, int(cx) + dx] = [v, v, min(255, v * 1.1), 220]
    return Image.fromarray(a.astype(np.uint8), "RGBA")


# ── star layer (v3 styles) + new details: galaxies, distant moons ────────────
def gen_l1(rng, pyrng, style, tint_a, tint_b):
    a = np.zeros((ART, ART, 4), dtype=np.uint8)

    def put(x, y, c):
        a[int(y) % ART, int(x) % ART] = np.clip(c, 0, 255).astype(np.uint8)

    def star_color(dim=1.0):
        r = rng.random()
        if r < 0.15:
            return np.array([235, 240, 255, 255 * dim])
        if r < 0.55:
            return np.append(tint_a * rng.uniform(0.7, 1.0), 255 * dim)
        v = rng.uniform(90, 170)
        return np.array([v, v, min(255, v * 1.25), rng.uniform(140, 230) * dim])

    if style == "sparse":
        for _ in range(int(rng.integers(80, 130))):
            put(*rng.integers(0, ART, 2), star_color(0.8))
    elif style == "clustered":
        for _ in range(int(rng.integers(2, 6))):
            cx, cy = rng.integers(0, ART, 2)
            for _ in range(int(rng.integers(25, 55))):
                put(cx + rng.normal(0, 30), cy + rng.normal(0, 30), star_color(0.75))
        for _ in range(60):
            put(*rng.integers(0, ART, 2), star_color(0.7))
    else:  # milkyway
        aa, bb = [(0, 1), (1, 0), (1, 1)][int(rng.integers(0, 3))]
        for _ in range(int(rng.integers(600, 900))):
            x, y = rng.integers(0, ART, 2)
            band = np.exp(-np.sin(np.pi * (aa * x + bb * y) / ART) ** 2 / 0.25)
            if rng.random() < band:
                v = rng.uniform(60, 130)
                put(x, y, np.array([v, v, v * 1.2, rng.uniform(90, 170)]))
        for _ in range(70):
            put(*rng.integers(0, ART, 2), star_color(0.85))

    img = Image.fromarray(a, "RGBA")

    # space details: 1-2 spiral galaxies
    for _ in range(pyrng.choice([1, 1, 2])):
        g = make_galaxy(pyrng, pyrng.choice([56, 72, 88]), tint_b if pyrng.random() < 0.5 else np.array([200, 205, 230.0]))
        if pyrng.random() < 0.5:
            g = g.transpose(pyrng.choice([Image.FLIP_LEFT_RIGHT, Image.ROTATE_90, Image.ROTATE_180]))
        wrap_paste(img, g, pyrng.randrange(ART), pyrng.randrange(ART))
    # 1-2 tiny distant moons (Master484 planets, heavily dimmed)
    for _ in range(pyrng.choice([1, 2, 2])):
        m = Image.open(pyrng.choice(MOONS)).convert("RGBA")
        px = pyrng.choice([8, 10, 12, 14])
        m = m.resize((px, px), Image.BOX)
        m = ImageEnhance.Brightness(m).enhance(0.5)
        al = m.getchannel("A").point(lambda v: int(v * 0.85))
        m.putalpha(al)
        wrap_paste(img, m, pyrng.randrange(ART), pyrng.randrange(ART))

    return img.resize((ART * SCALE, ART * SCALE), Image.NEAREST)


# ── individual asteroid sprites (engine rotates these) ───────────────────────
def gen_asteroid_sprite(rng, size, base_rgb):
    r = size / 2
    yy, xx = np.meshgrid(np.arange(size), np.arange(size), indexing="ij")
    dist = np.sqrt((yy - r + 0.5) ** 2 + (xx - r + 0.5) ** 2) / r
    n = pnoise(rng, 4, size)
    shape = dist + (n - 0.5) * 0.7 < 0.85
    light = ((r - yy) + (r - xx)) / (2 * r) + (pnoise(rng, 5, size) - 0.5) * 0.7
    shades = [base_rgb * 0.35, base_rgb * 0.6, base_rgb * 0.85, np.clip(base_rgb * 1.15, 0, 255)]
    idx = np.digitize(light, [-0.18, 0.10, 0.38])
    out = np.zeros((size, size, 4), dtype=np.uint8)
    for i, sh in enumerate(shades):
        m = shape & (idx == i)
        out[m, :3] = sh.astype(np.uint8)
        out[m, 3] = 255
    for _ in range(int(rng.integers(1, 4))):
        cy, cx = rng.integers(size * 0.25, size * 0.75, 2)
        cr = rng.uniform(1.5, size * 0.14)
        m = ((yy - cy) ** 2 + (xx - cx) ** 2 < cr ** 2) & shape
        out[m, :3] = (base_rgb * 0.45).astype(np.uint8)
    edge = shape & ~(np.roll(shape, 1, 0) & np.roll(shape, -1, 0) & np.roll(shape, 1, 1) & np.roll(shape, -1, 1))
    out[edge, :3] = (base_rgb * 0.28).astype(np.uint8)
    return Image.fromarray(out, "RGBA")


ast_a = Image.open(WARPED / "asteroids" / "asteroid.png").convert("RGBA")

grand = 0
for label, (glow, style, wnum, art_px) in MAPS.items():
    seed = abs(hash("cosmic-v4-" + label)) % (2 ** 31)
    rng = np.random.default_rng(seed)
    pyrng = random.Random(seed)
    out = OUT_ROOT / label
    glow_rgb = hex_rgb(glow)

    def sh(dh, s=1.0, v=1.0):
        hh, ss, vv = colorsys.rgb_to_hsv(*(glow_rgb / 255))
        rr, gg, bb = colorsys.hsv_to_rgb((hh + dh) % 1, min(1, ss * s), min(1, vv * v))
        return np.array([rr, gg, bb]) * 255

    danger = label.startswith("4-")

    # L4: unique crispy planet
    make_planet(wnum, art_px, danger).save(out / f"Layer4_{label}.png", optimize=True)

    # L1: stars + galaxies + moons
    gen_l1(rng, pyrng, style, sh(0), sh(0.08, 0.6, 1.2)).save(out / f"Layer1_{label}.png", optimize=True)

    # ast sprites: 3 procedural + 1 ansimuz (engine spins them)
    grey = np.array([148, 132, 118]) * pyrng.uniform(0.85, 1.1)
    tinted = np.clip(grey * 0.8 + glow_rgb * 0.2, 0, 255)
    for i in range(3):
        s = gen_asteroid_sprite(rng, int(rng.integers(16, 30)), tinted)
        s.resize((s.width * SCALE, s.height * SCALE), Image.NEAREST).save(out / f"ast{i + 1}_{label}.png", optimize=True)
    ast_a.resize((ast_a.width * SCALE, ast_a.height * SCALE), Image.NEAREST).save(out / f"ast4_{label}.png", optimize=True)

    # Layer6 replaced by rotating sprites
    l6 = out / f"Layer6_{label}.png"
    if l6.exists():
        l6.unlink()

    kb = sum(f.stat().st_size for f in out.glob("*.png")) / 1024
    grand += kb
    print(f"{label}: planet #{wnum:2d} @{art_px}px  folder now {kb:5.0f} KB")

print(f"\nGrand total: {grand / 1024:.1f} MB")
