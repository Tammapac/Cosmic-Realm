# Build 5-layer parallax map "1-2" from ansimuz CC0 packs (OpenGameArt).
# Sources:
#   Space Background (CC0)      https://opengameart.org/content/space-background-3
#   Warped Space Shooter (CC0)  https://opengameart.org/content/warped-space-shooter
import random
from pathlib import Path
from PIL import Image, ImageEnhance

random.seed(12)  # reproducible scatter

SP = Path(r"C:\Users\tamma\AppData\Local\Temp\claude\E--Program-Files-Claude-Code\d39092ba-0c5d-4f54-b0d7-5aae1687f5ce\scratchpad\assets")
BG_PACK = SP / "ansimuz-space-bg" / "space_background_pack" / "layers"
WARPED = SP / "ansimuz-warped" / "Space Shooter files"
OUT = Path(r"E:\Program Files\Claude Code\Cosmic-Realm\frontend\public\bg\1-2")
OUT.mkdir(parents=True, exist_ok=True)

SCALE = 4  # 272x160 -> 1088x640, 1 art pixel = 4 screen px (matches game's chunky pixel look)


def load(p):
    return Image.open(p).convert("RGBA")


def up(img, scale=SCALE):
    return img.resize((img.width * scale, img.height * scale), Image.NEAREST)


def edge_report(img, name):
    # sanity: how different are opposite edges (0 = perfectly tileable)
    px = img.load()
    w, h = img.size
    dh = sum(abs(px[0, y][c] - px[w - 1, y][c]) for y in range(h) for c in range(3)) / (h * 3)
    dv = sum(abs(px[x, 0][c] - px[x, h - 1][c]) for x in range(w) for c in range(3)) / (w * 3)
    print(f"{name}: edge diff horiz={dh:.1f} vert={dv:.1f} (0-255 scale)")


def wrap_paste(canvas, sprite, x, y):
    # paste with modulo wrapping so scattered content tiles seamlessly
    w, h = canvas.size
    sw, sh = sprite.size
    for ox in (0, -w, w):
        for oy in (0, -h, h):
            px, py = x + ox, y + oy
            if px + sw > 0 and px < w and py + sh > 0 and py < h:
                canvas.alpha_composite(sprite, (px, py))


def dim(img, alpha_mul):
    out = img.copy()
    a = out.getchannel("A").point(lambda v: int(v * alpha_mul))
    out.putalpha(a)
    return out


# ── Layer 1: distant stars (tiny dot clusters + far planets), very slow ──────
stars_small = load(BG_PACK / "parallax-space-stars.png")       # transparent dot clusters
far_planets = load(BG_PACK / "parallax-space-far-planets.png")  # tiny distant planets
l1 = Image.new("RGBA", stars_small.size, (0, 0, 0, 0))
l1.alpha_composite(stars_small)
l1.alpha_composite(far_planets)
l1 = dim(l1, 0.75)  # keep the deepest layer subtle
edge_report(l1, "L1 distant stars")
up(l1).save(OUT / "Layer1_1-2.png", optimize=True)

# ── Layer 2: nebula clouds (blue 'warped' nebula), medium, engine alpha 0.52 ─
nebula = load(WARPED / "background" / "layered" / "bg-back.png")
edge_report(nebula, "L2 nebula")
up(nebula).save(OUT / "Layer2_1-2.png", optimize=True)

# ── Layer 3: mid stars (bright crosses), slow ────────────────────────────────
stars_mid = load(WARPED / "background" / "layered" / "bg-stars.png")
edge_report(stars_mid, "L3 mid stars")
up(stars_mid).save(OUT / "Layer3_1-2.png", optimize=True)

# ── Layer 4: planet (single placed sprite, not tiled) ────────────────────────
planet = load(BG_PACK / "parallax-space-big-planet.png")
up(planet).save(OUT / "Layer4_1-2.png", optimize=True)  # 352x348

# ── Layer 5: space dust / haze (purple gradient), medium-fast, low alpha ─────
haze = load(BG_PACK / "parallax-space-backgound.png")
# mirror-tile vertically+horizontally so the diagonal gradient wraps seamlessly
w, h = haze.size
haze4 = Image.new("RGBA", (w * 2, h * 2))
haze4.paste(haze, (0, 0))
haze4.paste(haze.transpose(Image.FLIP_LEFT_RIGHT), (w, 0))
haze4.paste(haze.transpose(Image.FLIP_TOP_BOTTOM), (0, h))
haze4.paste(haze.transpose(Image.ROTATE_180), (w, h))
edge_report(haze4, "L5 dust/haze (mirrored)")
up(haze4, 2).save(OUT / "Layer5_1-2.png", optimize=True)  # 1088x640

# ── Layer 6: foreground debris / asteroids, fastest, sparse ──────────────────
ast_big = load(WARPED / "asteroids" / "asteroid.png")        # 35x37
ast_small = load(WARPED / "asteroids" / "asteroid-small.png")  # 14x13
canvas = Image.new("RGBA", (272 * 2, 160 * 2), (0, 0, 0, 0))  # 544x320 art px, sparser feel
placements = []
for i in range(11):
    src = ast_big if i < 4 else ast_small
    spr = src.transpose(random.choice([
        Image.FLIP_LEFT_RIGHT, Image.FLIP_TOP_BOTTOM, Image.ROTATE_90, Image.ROTATE_180, Image.ROTATE_270,
    ])) if random.random() < 0.8 else src.copy()
    # depth variety: dim + slightly darken some so the layer isn't distracting
    fade = random.uniform(0.45, 0.9)
    spr = dim(ImageEnhance.Brightness(spr).enhance(random.uniform(0.6, 0.95)), fade)
    # rejection-sample positions to keep them sparse (min distance apart)
    for _ in range(60):
        x, y = random.randrange(canvas.width), random.randrange(canvas.height)
        if all(min(abs(x - qx), canvas.width - abs(x - qx)) ** 2 +
               min(abs(y - qy), canvas.height - abs(y - qy)) ** 2 > 90 ** 2 for qx, qy in placements):
            break
    placements.append((x, y))
    wrap_paste(canvas, spr, x, y)
edge_report(canvas, "L6 debris")
up(canvas, 2).save(OUT / "Layer6_1-2.png", optimize=True)  # 1088x640

print("\nOutput files:")
for f in sorted(OUT.glob("*.png")):
    print(f"  {f.name}: {f.stat().st_size / 1024:.0f} KB")
