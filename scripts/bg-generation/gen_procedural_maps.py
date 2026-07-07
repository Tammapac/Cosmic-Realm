# Procedural 5-layer background generator — structurally unique per map, big tiles.
#
# Nebula/star/haze layers are original procedural art (seeded noise, project-owned).
# Asteroids (L6 scatter) and planets (L4, untouched) remain CC0 by ansimuz.
#
# Tile sizes: 512x512 art px -> 2048x2048 screen px (4x nearest).
# At nebula parallax 0.12 a 2048 tile repeats every ~17k world px (> map size).
import colorsys
import random
import numpy as np
from pathlib import Path
from PIL import Image, ImageEnhance

SP = Path(r"C:\Users\tamma\AppData\Local\Temp\claude\E--Program-Files-Claude-Code\d39092ba-0c5d-4f54-b0d7-5aae1687f5ce\scratchpad\assets")
WARPED = SP / "ansimuz-warped" / "Space Shooter files"
OUT_ROOT = Path(r"E:\Program Files\Claude Code\Cosmic-Realm\frontend\public\bg")
ART = 512
SCALE = 4

# label: (glow hex, structure, value mult, secondary-hue offset)
# structures: wisps=ridged filaments, clouds=big soft blobs, band=directional belt, patchy=scattered clumps
MAPS = {
    "1-2": ("#7722aa", "wisps",  1.00, +0.12),
    "1-3": ("#cc2233", "band",   1.00, -0.08),
    "1-4": ("#006655", "clouds", 0.95, +0.10),
    "1-5": ("#cc6600", "patchy", 1.00, -0.10),
    "2-1": ("#cc4400", "wisps",  1.00, +0.06),
    "2-2": ("#884422", "clouds", 0.95, -0.07),
    "2-3": ("#aa0033", "patchy", 1.00, +0.09),
    "2-4": ("#660066", "band",   0.95, +0.14),
    "2-5": ("#5500cc", "wisps",  1.00, -0.09),
    "3-1": ("#44aa22", "clouds", 1.00, +0.08),
    "3-2": ("#88cc00", "band",   0.95, -0.06),
    "3-3": ("#22cc44", "wisps",  1.00, +0.11),
    "3-4": ("#00aa66", "patchy", 0.95, -0.08),
    "3-5": ("#66dd00", "clouds", 1.00, +0.07),
    "4-1": ("#ff2244", "patchy", 0.85, -0.12),
    "4-2": ("#ff4400", "band",   0.85, +0.08),
    "4-3": ("#cc0066", "wisps",  0.85, +0.10),
    "4-4": ("#aa00cc", "clouds", 0.85, -0.10),
    "4-5": ("#6600ff", "band",   0.85, -0.14),
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
    """Periodic (seamless) value noise: lattice x lattice grid -> size x size."""
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
    """Sample field at (y+dy, x+dx) with torus wrap (nearest) — keeps seamlessness."""
    size = field.shape[0]
    ys, xs = np.meshgrid(np.arange(size), np.arange(size), indexing="ij")
    return field[np.round(ys + dy).astype(int) % size, np.round(xs + dx).astype(int) % size]


def smoothstep(e0, e1, x):
    t = np.clip((x - e0) / (e1 - e0), 0, 1)
    return t * t * (3 - 2 * t)


def density_field(rng, structure):
    """Structurally distinct, seamless density field in [0,1]."""
    base = fbm(rng, ART, base=rng.choice([3, 4, 5]), octaves=6)
    # domain warp for organic flow (strength varies per map)
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
        # dusty belt: a soft directional mask applied to cloud texture, never a smooth beam
        a, b = [(0, 1), (1, 0), (1, 1), (1, 2), (2, 1)][int(rng.integers(0, 5))]
        ys, xs = np.meshgrid(np.arange(ART), np.arange(ART), indexing="ij")
        phase = np.pi * (a * xs + b * ys) / ART
        band = np.exp(-(np.sin(phase) ** 2) / rng.uniform(0.18, 0.32))
        wobble = 0.55 + 0.45 * fbm(rng, ART, base=3, octaves=3)   # width/intensity varies along belt
        cloudtex = smoothstep(0.35, 0.80, warped)                  # belt is made of clouds
        d = np.clip(band * wobble * cloudtex * 1.1, 0, 0.82)       # cap below highlight range
        d += 0.10 * cloudtex * (1 - band)                          # faint clouds off-belt
    else:  # patchy
        clumps = smoothstep(0.52, 0.76, warped)
        detail = 1 - np.abs(2 * fbm(rng, ART, base=8, octaves=4) - 1)
        d = clumps * (0.4 + 0.6 * detail)
    return np.clip(d, 0, 1)


def colorize(d, hue_mix, fill_rgb, col_a, col_b, bright, q_levels=7):
    """Bayer-dither d, quantize, map through dark->colA/colB->bright ramp. Returns HxWx3 uint8."""
    tiles = ART // 8
    dq = np.floor(np.clip(d + (np.tile(BAYER8, (tiles, tiles)) - 0.5) / q_levels, 0, 1) * (q_levels - 1) + 0.5) / (q_levels - 1)
    m = np.floor(hue_mix * 3) / 3  # 4-step hue mix keeps the palette small
    col = col_a[None, None, :] * (1 - m[..., None]) + col_b[None, None, :] * m[..., None]
    out = fill_rgb[None, None, :] * (1 - dq[..., None]) + col * dq[..., None]
    hot = np.clip((dq - 0.75) * 4, 0, 1)[..., None]  # highlight the densest cores
    out = out * (1 - hot) + bright[None, None, :] * hot
    return out.astype(np.uint8)


def to_img(arr):
    return Image.fromarray(arr, "RGB").resize((ART * SCALE, ART * SCALE), Image.NEAREST)


def save_indexed(img, path):
    img.convert("P", palette=Image.ADAPTIVE, colors=96).save(path, optimize=True)


def gen_stars(rng, n_pts, clusters, tint, bright_frac=0.15, cross_frac=0.0):
    """Sparse seamless starfield on ART canvas -> RGBA (ART*SCALE)^2."""
    a = np.zeros((ART, ART, 4), dtype=np.uint8)
    pts = []
    for _ in range(clusters):
        cx, cy = rng.integers(0, ART, 2)
        for _ in range(n_pts // max(1, clusters * 2)):
            x = int(cx + rng.normal(0, 26)) % ART
            y = int(cy + rng.normal(0, 26)) % ART
            pts.append((x, y))
    while len(pts) < n_pts:
        pts.append(tuple(rng.integers(0, ART, 2)))
    for x, y in pts:
        r = rng.random()
        if r < bright_frac:
            c = np.array([235, 240, 255, 255])
        elif r < bright_frac + 0.25:
            c = np.append(tint * rng.uniform(0.75, 1.0), 255)
        else:
            v = rng.uniform(90, 160)
            c = np.array([v, v, min(255, v * 1.25), rng.uniform(140, 220)])
        a[y % ART, x % ART] = c.astype(np.uint8)
        if r < cross_frac:  # plus-shaped bright star
            for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                a[(y + dy) % ART, (x + dx) % ART] = (c * [1, 1, 1, 0.6]).astype(np.uint8)
    return Image.fromarray(a, "RGBA").resize((ART * SCALE, ART * SCALE), Image.NEAREST)


def wrap_paste(canvas, sprite, x, y):
    w, h = canvas.size
    for ox in (0, -w, w):
        for oy in (0, -h, h):
            if x + ox + sprite.width > 0 and x + ox < w and y + oy + sprite.height > 0 and y + oy < h:
                canvas.alpha_composite(sprite, (x + ox, y + oy))


ast_big = Image.open(WARPED / "asteroids" / "asteroid.png").convert("RGBA")
ast_small = Image.open(WARPED / "asteroids" / "asteroid-small.png").convert("RGBA")
FLIPS = [None, Image.FLIP_LEFT_RIGHT, Image.FLIP_TOP_BOTTOM, Image.ROTATE_90, Image.ROTATE_180, Image.ROTATE_270]


def gen_debris(pyrng, count):
    canvas = Image.new("RGBA", (ART, ART), (0, 0, 0, 0))
    placed = []
    for i in range(count):
        src = ast_big if i < max(4, count // 3) else ast_small
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


grand = 0
for label, (glow, structure, v_mul, hue_off) in MAPS.items():
    seed = abs(hash("cosmic-" + label)) % (2 ** 31)
    rng = np.random.default_rng(seed)
    pyrng = random.Random(seed)
    out = OUT_ROOT / label
    out.mkdir(parents=True, exist_ok=True)

    glow_rgb = hex_rgb(glow)
    col_a = shift_hue(glow_rgb, 0, v_mul=v_mul)
    col_b = shift_hue(glow_rgb, hue_off, s_mul=0.9, v_mul=v_mul)
    bright = shift_hue(glow_rgb, hue_off / 2, s_mul=0.45, v_mul=min(1.6, 1.25 / max(0.4, v_mul)))
    fill_rgb = np.clip(glow_rgb * 0.10, 4, 26)  # near-black tinted base

    # L2 nebula — unique structure, opaque, indexed PNG
    d = density_field(rng, structure)
    hue_mix = fbm(rng, ART, base=3, octaves=3)
    save_indexed(to_img(colorize(d, hue_mix, fill_rgb, col_a, col_b, bright)), out / f"Layer2_{label}.png")

    # L5 dust/haze — very low frequency soft veil, opaque (engine alpha 0.16)
    hz = smoothstep(0.30, 0.85, fbm(rng, ART, base=2, octaves=4)) * 0.8
    hz_col = colorize(hz, 1 - hue_mix, fill_rgb * 0.6, col_b, col_a, col_b, q_levels=5)
    save_indexed(to_img(hz_col), out / f"Layer5_{label}.png")

    # L1 distant stars (dim, clustered) / L3 mid stars (brighter, some crosses)
    gen_stars(rng, n_pts=int(rng.integers(150, 230)), clusters=int(rng.integers(2, 6)),
              tint=col_a).save(out / f"Layer1_{label}.png", optimize=True)
    gen_stars(rng, n_pts=int(rng.integers(45, 75)), clusters=int(rng.integers(0, 3)),
              tint=col_b, bright_frac=0.45, cross_frac=0.30).save(out / f"Layer3_{label}.png", optimize=True)

    # L6 debris — big unique scatter (danger zones denser)
    gen_debris(pyrng, 26 if label.startswith("4-") else pyrng.choice([16, 18, 20, 22])).save(
        out / f"Layer6_{label}.png", optimize=True)

    kb = sum(f.stat().st_size for f in out.glob("Layer*.png")) / 1024
    grand += kb
    print(f"{label}: {structure:6s} glow {glow}  total {kb:5.0f} KB")

print(f"\nGrand total (19 maps): {grand / 1024:.1f} MB")
