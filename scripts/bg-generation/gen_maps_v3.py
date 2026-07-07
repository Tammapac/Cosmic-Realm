# Background generator v3 — per-map unique planets, star styles, asteroid sets, cloud overlays.
# Sources (see ASSET_LICENSES.md):
#   procedural nebula/stars/haze  — original project art
#   planets                       — Master484 "Pixel Planets" (CC0), faction-themed per map
#   clouds overlay                — ansimuz space_shooter_pack clouds (CC0), tinted
#   asteroids                     — ansimuz (CC0) + procedural shapes, per-map sets
import colorsys
import random
import numpy as np
from pathlib import Path
from PIL import Image, ImageEnhance

SP = Path(r"C:\Users\tamma\AppData\Local\Temp\claude\E--Program-Files-Claude-Code\d39092ba-0c5d-4f54-b0d7-5aae1687f5ce\scratchpad\assets")
WARPED = SP / "ansimuz-warped" / "Space Shooter files"
CLOUDS = SP / "ansimuz-shooter" / "space_shooter_pack" / "backgrounds" / "clouds-transparent.png"
PLANETS = SP / "planets484"
OUT_ROOT = Path(r"E:\Program Files\Claude Code\Cosmic-Realm\frontend\public\bg")
ART = 512
SCALE = 4

# label: glow, structure, value-mult, hue-offset, star style, planet file, cloud overlay?
MAPS = {
    "1-2": ("#7722aa", "wisps",  1.00, +0.12, "clustered", "ocean-02.png",   True),
    "1-3": ("#cc2233", "band",   1.00, -0.08, "milkyway",  "arctic-03.png",  False),
    "1-4": ("#006655", "clouds", 0.95, +0.10, "sparse",    "terran-05.png",  True),
    "1-5": ("#cc6600", "patchy", 1.00, -0.10, "clustered", "gas-01.png",     False),
    "2-1": ("#cc4400", "wisps",  1.00, +0.06, "sparse",    "rock-04.png",    False),
    "2-2": ("#884422", "clouds", 0.95, -0.07, "milkyway",  "desert-02.png",  True),
    "2-3": ("#aa0033", "patchy", 1.00, +0.09, "clustered", "inferno-02.png", False),
    "2-4": ("#660066", "band",   0.95, +0.14, "sparse",    "gas-06.png",     False),
    "2-5": ("#5500cc", "wisps",  1.00, -0.09, "milkyway",  "extra-01.png",   True),
    "3-1": ("#44aa22", "clouds", 1.00, +0.08, "clustered", "jungle-03.png",  False),
    "3-2": ("#88cc00", "band",   0.95, -0.06, "sparse",    "toxic-01.png",   True),
    "3-3": ("#22cc44", "wisps",  1.00, +0.11, "milkyway",  "terran-02.png",  False),
    "3-4": ("#00aa66", "patchy", 0.95, -0.08, "clustered", "jungle-05.png",  False),
    "3-5": ("#66dd00", "clouds", 1.00, +0.07, "sparse",    "gas-05.png",     True),
    "4-1": ("#ff2244", "patchy", 0.85, -0.12, "sparse",    "inferno-04.png", False),
    "4-2": ("#ff4400", "band",   0.85, +0.08, "clustered", "extra-03.png",   True),
    "4-3": ("#cc0066", "wisps",  0.85, +0.10, "milkyway",  "extra-05.png",   False),
    "4-4": ("#aa00cc", "clouds", 0.85, -0.10, "sparse",    "toxic-04.png",   False),
    "4-5": ("#6600ff", "band",   0.85, -0.14, "clustered", "extra-02.png",   True),
}

BAYER8 = np.array([
    [0, 32, 8, 40, 2, 34, 10, 42], [48, 16, 56, 24, 50, 18, 58, 26],
    [12, 44, 4, 36, 14, 46, 6, 38], [60, 28, 52, 20, 62, 30, 54, 22],
    [3, 35, 11, 43, 1, 33, 9, 41], [51, 19, 59, 27, 49, 17, 57, 25],
    [15, 47, 7, 39, 13, 45, 5, 37], [63, 31, 55, 23, 61, 29, 53, 21],
]) / 64.0


def hex_rgb(h):
    n = int(h.lstrip("#"), 16)
    return np.array([(n >> 16) & 255, (n >> 8) & 255, n & 255], dtype=float)


def shift_hue(rgb, dh, s_mul=1.0, v_mul=1.0):
    h, s, v = colorsys.rgb_to_hsv(*(rgb / 255))
    r, g, b = colorsys.hsv_to_rgb((h + dh) % 1.0, min(1, s * s_mul), min(1, v * v_mul))
    return np.array([r, g, b]) * 255


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


def fbm(rng, size, base=4, octaves=5, gain=0.5):
    total, amp, norm, lat = np.zeros((size, size)), 1.0, 0.0, base
    for _ in range(octaves):
        total += amp * pnoise(rng, lat, size)
        norm += amp
        amp *= gain
        lat *= 2
    return total / norm


def wrap_sample(field, dy, dx):
    size = field.shape[0]
    ys, xs = np.meshgrid(np.arange(size), np.arange(size), indexing="ij")
    return field[np.round(ys + dy).astype(int) % size, np.round(xs + dx).astype(int) % size]


def smoothstep(e0, e1, x):
    t = np.clip((x - e0) / (e1 - e0), 0, 1)
    return t * t * (3 - 2 * t)


def density_field(rng, structure):
    base = fbm(rng, ART, base=int(rng.choice([3, 4, 5])), octaves=6)
    k = rng.uniform(25, 60)
    wy = (fbm(rng, ART, base=3, octaves=4) - 0.5) * k
    wx = (fbm(rng, ART, base=3, octaves=4) - 0.5) * k
    warped = wrap_sample(base, wy, wx)
    if structure == "wisps":
        ridge = 1 - np.abs(2 * warped - 1)
        d = ridge ** rng.uniform(2.5, 4.0)
        mask = smoothstep(0.35, 0.75, fbm(rng, ART, base=2, octaves=3))
        d = d * (0.25 + 0.75 * mask)
    elif structure == "clouds":
        d = smoothstep(0.42, 0.85, warped) ** rng.uniform(1.2, 1.8)
    elif structure == "band":
        a, b = [(0, 1), (1, 0), (1, 1), (1, 2), (2, 1)][int(rng.integers(0, 5))]
        ys, xs = np.meshgrid(np.arange(ART), np.arange(ART), indexing="ij")
        phase = np.pi * (a * xs + b * ys) / ART
        band = np.exp(-(np.sin(phase) ** 2) / rng.uniform(0.18, 0.32))
        wobble = 0.55 + 0.45 * fbm(rng, ART, base=3, octaves=3)
        cloudtex = smoothstep(0.35, 0.80, warped)
        d = np.clip(band * wobble * cloudtex * 1.1, 0, 0.82)
        d += 0.10 * cloudtex * (1 - band)
    else:
        clumps = smoothstep(0.52, 0.76, warped)
        detail = 1 - np.abs(2 * fbm(rng, ART, base=8, octaves=4) - 1)
        d = clumps * (0.4 + 0.6 * detail)
    return np.clip(d, 0, 1)


def colorize(d, hue_mix, fill_rgb, col_a, col_b, bright, q_levels=7):
    tiles = ART // 8
    dq = np.floor(np.clip(d + (np.tile(BAYER8, (tiles, tiles)) - 0.5) / q_levels, 0, 1) * (q_levels - 1) + 0.5) / (q_levels - 1)
    m = np.floor(hue_mix * 3) / 3
    col = col_a[None, None, :] * (1 - m[..., None]) + col_b[None, None, :] * m[..., None]
    out = fill_rgb[None, None, :] * (1 - dq[..., None]) + col * dq[..., None]
    hot = np.clip((dq - 0.75) * 4, 0, 1)[..., None]
    out = out * (1 - hot) + bright[None, None, :] * hot
    return out.astype(np.uint8)


def to_img(arr):
    return Image.fromarray(arr, "RGB").resize((ART * SCALE, ART * SCALE), Image.NEAREST)


def save_indexed(img, path):
    img.convert("P", palette=Image.ADAPTIVE, colors=96).save(path, optimize=True)


def wrap_paste(canvas, sprite, x, y):
    w, h = canvas.size
    for ox in (0, -w, w):
        for oy in (0, -h, h):
            if x + ox + sprite.width > 0 and x + ox < w and y + oy + sprite.height > 0 and y + oy < h:
                canvas.alpha_composite(sprite, (x + ox, y + oy))


# ── stars ────────────────────────────────────────────────────────────────────
def gen_stars(rng, style, tint, mid=False):
    a = np.zeros((ART, ART, 4), dtype=np.uint8)

    def put(x, y, c):
        a[int(y) % ART, int(x) % ART] = np.clip(c, 0, 255).astype(np.uint8)

    def star_color(dim=1.0):
        r = rng.random()
        if r < (0.45 if mid else 0.15):
            return np.array([235, 240, 255, 255 * dim])
        if r < 0.55:
            return np.append(tint * rng.uniform(0.7, 1.0), 255 * dim)
        v = rng.uniform(90, 170)
        return np.array([v, v, min(255, v * 1.25), rng.uniform(140, 230) * dim])

    if mid:  # L3: few bright stars, crosses
        for _ in range(int(rng.integers(40, 70))):
            x, y = rng.integers(0, ART, 2)
            c = star_color()
            put(x, y, c)
            if rng.random() < 0.30:
                for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                    put(x + dx, y + dy, c * [1, 1, 1, 0.6])
    elif style == "sparse":
        for _ in range(int(rng.integers(80, 130))):
            put(*rng.integers(0, ART, 2), star_color(0.8))
    elif style == "clustered":
        for _ in range(int(rng.integers(2, 6))):
            cx, cy = rng.integers(0, ART, 2)
            for _ in range(int(rng.integers(25, 55))):
                put(cx + rng.normal(0, 30), cy + rng.normal(0, 30), star_color(0.75))
        for _ in range(60):
            put(*rng.integers(0, ART, 2), star_color(0.7))
    elif style == "milkyway":  # dense faint band of micro-stars across the tile
        aa, bb = [(0, 1), (1, 0), (1, 1)][int(rng.integers(0, 3))]
        for _ in range(int(rng.integers(600, 900))):
            x, y = rng.integers(0, ART, 2)
            band = np.exp(-np.sin(np.pi * (aa * x + bb * y) / ART) ** 2 / 0.25)
            if rng.random() < band:
                v = rng.uniform(60, 130)
                put(x, y, np.array([v, v, v * 1.2, rng.uniform(90, 170)]))
        for _ in range(70):
            put(*rng.integers(0, ART, 2), star_color(0.85))
    return Image.fromarray(a, "RGBA").resize((ART * SCALE, ART * SCALE), Image.NEAREST)


# ── procedural pixel asteroid sprites ────────────────────────────────────────
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
    # craters
    for _ in range(int(rng.integers(1, 4))):
        cy, cx = rng.integers(size * 0.25, size * 0.75, 2)
        cr = rng.uniform(1.5, size * 0.14)
        crater = (yy - cy) ** 2 + (xx - cx) ** 2 < cr ** 2
        m = crater & shape
        out[m, :3] = (base_rgb * 0.45).astype(np.uint8)
    # dark edge outline
    edge = shape & ~(np.roll(shape, 1, 0) & np.roll(shape, -1, 0) & np.roll(shape, 1, 1) & np.roll(shape, -1, 1))
    out[edge, :3] = (base_rgb * 0.28).astype(np.uint8)
    return Image.fromarray(out, "RGBA")


ast_a = Image.open(WARPED / "asteroids" / "asteroid.png").convert("RGBA")
ast_b = Image.open(WARPED / "asteroids" / "asteroid-small.png").convert("RGBA")
clouds_img = Image.open(CLOUDS).convert("RGBA")
FLIPS = [None, Image.FLIP_LEFT_RIGHT, Image.FLIP_TOP_BOTTOM, Image.ROTATE_90, Image.ROTATE_180, Image.ROTATE_270]


def gen_debris(rng, pyrng, label, glow_rgb):
    canvas = Image.new("RGBA", (ART, ART), (0, 0, 0, 0))
    # per-map unique asteroid set: 3 procedural + the two ansimuz rocks
    grey = np.array([148, 132, 118]) * pyrng.uniform(0.85, 1.1)
    tinted = np.clip(grey * 0.8 + glow_rgb * 0.2, 0, 255)
    sprites = [gen_asteroid_sprite(rng, int(rng.integers(14, 30)), tinted) for _ in range(3)]
    sprites += [ast_a, ast_b]
    count = 26 if label.startswith("4-") else pyrng.choice([16, 18, 20, 22])
    placed = []
    for i in range(count):
        src = pyrng.choice(sprites)
        t = pyrng.choice(FLIPS)
        spr = src.transpose(t) if t else src.copy()
        spr = ImageEnhance.Brightness(spr).enhance(pyrng.uniform(0.55, 0.95))
        al = spr.getchannel("A").point(lambda v, f=pyrng.uniform(0.45, 0.9): int(v * f))
        spr.putalpha(al)
        for _ in range(80):
            x, y = pyrng.randrange(ART), pyrng.randrange(ART)
            if all(min(abs(x - qx), ART - abs(x - qx)) ** 2 + min(abs(y - qy), ART - abs(y - qy)) ** 2 > 68 ** 2
                   for qx, qy in placed):
                break
        placed.append((x, y))
        wrap_paste(canvas, spr, x, y)
    return canvas.resize((ART * SCALE, ART * SCALE), Image.NEAREST)


def tint_clouds(cloud, rgb, alpha=0.45):
    arr = np.array(cloud, dtype=float)
    lum = arr[:, :, :3].mean(axis=2, keepdims=True) / 255
    arr[:, :, :3] = lum * rgb[None, None, :]
    arr[:, :, 3] *= alpha
    return Image.fromarray(np.clip(arr, 0, 255).astype(np.uint8), "RGBA")


grand = 0
for label, (glow, structure, v_mul, hue_off, star_style, planet_file, use_clouds) in MAPS.items():
    seed = abs(hash("cosmic-" + label)) % (2 ** 31)
    rng = np.random.default_rng(seed)
    pyrng = random.Random(seed)
    out = OUT_ROOT / label
    out.mkdir(parents=True, exist_ok=True)

    glow_rgb = hex_rgb(glow)
    col_a = shift_hue(glow_rgb, 0, v_mul=v_mul)
    col_b = shift_hue(glow_rgb, hue_off, s_mul=0.9, v_mul=v_mul)
    bright = shift_hue(glow_rgb, hue_off / 2, s_mul=0.45, v_mul=min(1.6, 1.25 / max(0.4, v_mul)))
    fill_rgb = np.clip(glow_rgb * 0.10, 4, 26)

    # L2 nebula (+ optional ansimuz cloud texture, tinted to faction color)
    d = density_field(rng, structure)
    hue_mix = fbm(rng, ART, base=3, octaves=3)
    neb_rgb = colorize(d, hue_mix, fill_rgb, col_a, col_b, bright)
    neb = Image.fromarray(neb_rgb, "RGB").convert("RGBA")
    if use_clouds:
        tc = tint_clouds(clouds_img, np.clip(col_a * 0.9, 0, 255))
        for _ in range(pyrng.choice([2, 3])):
            t = pyrng.choice(FLIPS)
            spr = tc.transpose(t) if t else tc
            wrap_paste(neb, spr, pyrng.randrange(ART), pyrng.randrange(ART))
    save_indexed(neb.convert("RGB").resize((ART * SCALE, ART * SCALE), Image.NEAREST), out / f"Layer2_{label}.png")

    # L5 dust/haze
    hz = smoothstep(0.30, 0.85, fbm(rng, ART, base=2, octaves=4)) * 0.8
    hz_col = colorize(hz, 1 - hue_mix, fill_rgb * 0.6, col_b, col_a, col_b, q_levels=5)
    save_indexed(to_img(hz_col), out / f"Layer5_{label}.png")

    # L1 / L3 stars — per-map style
    gen_stars(rng, star_style, col_a).save(out / f"Layer1_{label}.png", optimize=True)
    gen_stars(rng, star_style, col_b, mid=True).save(out / f"Layer3_{label}.png", optimize=True)

    # L4 planet — unique per map (Master484, CC0), moody-fied to match game style
    p = Image.open(PLANETS / planet_file).convert("RGBA")
    p = ImageEnhance.Color(ImageEnhance.Brightness(p).enhance(0.72 if label.startswith("4-") else 0.82)).enhance(0.85)
    side = max(p.size)
    sq = Image.new("RGBA", (side, side), (0, 0, 0, 0))
    sq.paste(p, ((side - p.width) // 2, (side - p.height) // 2))
    sq.resize((side * 8, side * 8), Image.NEAREST).save(out / f"Layer4_{label}.png", optimize=True)

    # L6 debris — per-map asteroid set
    gen_debris(rng, pyrng, label, glow_rgb).save(out / f"Layer6_{label}.png", optimize=True)

    kb = sum(f.stat().st_size for f in out.glob("Layer*.png")) / 1024
    grand += kb
    print(f"{label}: {structure:6s}/{star_style:9s} planet={planet_file:15s} clouds={use_clouds}  {kb:5.0f} KB")

print(f"\nGrand total: {grand / 1024:.1f} MB")
