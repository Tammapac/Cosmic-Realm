"""Cosmic Realm — composable frame PARTS (v4), following the wide-format
reference: fixed corner pieces + fixed edge-centre armour segments + a
stretchable straight edge with the cyan conduit. The CosmicWindow component
assembles these at runtime (corners in corners, segments centred on each edge,
straight pieces stretched between).

Each part is drawn with the shared machined-metal look: real metal texture,
top-lit ramp, thin chamfer edges (bright top-left / dark bottom-right ledge),
drop shadows — but sized to its ROLE so nothing distorts on stretch.

Outputs (textures/):
  part-corner.png     one corner (top-left); other 3 are flips at runtime
  part-edge-h.png     horizontal straight edge (tileable/stretchable), + conduit
  part-edge-v.png     vertical straight edge
  part-seg-h.png      horizontal edge-centre armour segment (fixed)
  part-seg-v.png      vertical edge-centre armour segment (fixed)
manifests/frame-parts.json   sizes + anchor metrics for the assembler
"""
from PIL import Image, ImageDraw, ImageFilter, ImageChops
import os, math, json

HERE = os.path.dirname(os.path.abspath(__file__))
UI = os.path.normpath(os.path.join(HERE, "..", "..", "public", "assets", "ui", "cosmic"))
SS = 3

GM_HI = (198, 212, 234)
GM = (120, 134, 158)
GM_MID = (84, 96, 118)
GM_LO = (52, 62, 82)
GM_DEEP = (28, 34, 48)
NAVY_DEEP = (12, 16, 28)
BOLT = (58, 68, 88)
GOLD = (210, 162, 78)
CYAN = (90, 200, 255)

_MAT = {}
def material(name, W, H):
    key = (name, W, H)
    if key in _MAT:
        return _MAT[key]
    tile = Image.open(os.path.join(UI, "textures", name + ".png")).convert("RGB")
    tw, th = tile.size
    c = Image.new("RGB", (W, H))
    for y in range(0, H, th):
        for x in range(0, W, tw):
            c.paste(tile, (x, y))
    _MAT[key] = c
    return c


def lerp(a, b, t):
    return tuple(int(a[i] + (b[i] - a[i]) * t) for i in range(3))


def plate(W, H, poly, mat="metal-matte", bright=1.0, shadow=5):
    """A raised metal plate on a transparent canvas: drop shadow + top-lit
    metal fill + thin bright top-left / dark bottom-right chamfer edges."""
    img = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    ss = SS
    # drop shadow
    sh = Image.new("L", (W, H), 0)
    ImageDraw.Draw(sh).polygon(poly, fill=150)
    sh = sh.filter(ImageFilter.GaussianBlur(shadow * ss))
    sl = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    sl.putalpha(ImageChops.offset(sh, int(shadow * .6 * ss), int(shadow * .7 * ss)))
    img.alpha_composite(sl)
    # metal fill, top-lit
    bm = Image.new("L", (W, H), 0)
    ImageDraw.Draw(bm).polygon(poly, fill=255)
    ys = [p[1] for p in poly]; y0, y1 = min(ys), max(ys)
    ramp = Image.new("L", (W, H))
    rp = ramp.load()
    for y in range(H):
        t = max(0.0, min(1.0, (y - y0) / max(1, y1 - y0)))
        v = int((185 - 110 * (t ** .85)) * bright)
        for x in range(W):
            rp[x, y] = max(16, min(255, v))
    shaded = ImageChops.multiply(material(mat, W, H), Image.merge("RGB", (ramp, ramp, ramp)))
    blk = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    blk.paste(shaded, (0, 0), bm)
    img.alpha_composite(blk)
    # chamfer edges
    d = ImageDraw.Draw(img)
    n = len(poly)
    for i in range(n):
        x0, y0 = poly[i]; x1, y1 = poly[(i + 1) % n]
        ex, ey = x1 - x0, y1 - y0
        L = max(1.0, math.hypot(ex, ey))
        nx, ny = ey / L, -ex / L
        lb = -(nx * .5 + ny * .85)
        if lb > 0:
            d.line([(x0, y0), (x1, y1)], fill=(230, 242, 255, 255), width=max(1, ss))
        else:
            off = 2 * ss
            d.line([(x0 + off, y0 + off), (x1 + off, y1 + off)], fill=(0, 0, 0, 140), width=2 * ss)
            d.line([(x0, y0), (x1, y1)], fill=(0, 0, 0, 200), width=max(1, ss))
    return img


def bolt(d, x, y, r):
    d.ellipse([x - r, y - r, x + r, y + r], fill=NAVY_DEEP + (255,))
    d.ellipse([x - r + SS, y - r + SS, x + r - SS, y + r - SS], fill=BOLT + (255,))
    d.ellipse([x - r // 2, y - r // 2, x, y], fill=GM_HI + (255,))


# ── PART: corner (top-left) ──────────────────────────────────────────────────
def build_corner():
    S = 96 * SS
    img = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    cut = 22 * SS
    # base L-plate hugging the corner (outer chamfer, inner right-angle)
    base = [(cut, 0), (S, 0), (S, 30 * SS), (34 * SS, 30 * SS),
            (30 * SS, 34 * SS), (30 * SS, S), (0, S), (0, cut)]
    img.alpha_composite(plate(S, S, base, "metal-brushed", 0.85, shadow=6))
    # a raised inner step following the same L
    step = [(cut + 6 * SS, 8 * SS), (S, 8 * SS), (S, 22 * SS), (26 * SS, 22 * SS),
            (22 * SS, 26 * SS), (22 * SS, S), (8 * SS, S), (8 * SS, cut + 6 * SS)]
    img.alpha_composite(plate(S, S, step, "metal-matte", 1.15, shadow=4))
    d = ImageDraw.Draw(img)
    bolt(d, 14 * SS, 14 * SS, 4 * SS)
    # cyan conduit hugging the inner L
    cd = [(30 * SS, S), (30 * SS, 34 * SS), (34 * SS, 30 * SS), (S, 30 * SS)]
    glow = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    ImageDraw.Draw(glow).line(cd, fill=CYAN + (255,), width=2 * SS)
    glow = glow.filter(ImageFilter.GaussianBlur(SS))
    ImageDraw.Draw(glow).line(cd, fill=(210, 245, 255, 255), width=max(1, SS))
    img.alpha_composite(glow)
    return img.resize((96, 96), Image.LANCZOS)


# ── PART: horizontal straight edge (stretchable) ─────────────────────────────
def build_edge_h():
    W, H = 32 * SS, 96 * SS   # narrow, will stretch horizontally
    img = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    # a flat top plate band + the cyan conduit line below it
    band = [(0, 0), (W, 0), (W, 30 * SS), (0, 30 * SS)]
    img.alpha_composite(plate(W, H, band, "metal-brushed", 0.9, shadow=4))
    # conduit
    glow = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    ImageDraw.Draw(glow).line([(0, 33 * SS), (W, 33 * SS)], fill=CYAN + (255,), width=2 * SS)
    glow = glow.filter(ImageFilter.GaussianBlur(SS))
    ImageDraw.Draw(glow).line([(0, 33 * SS), (W, 33 * SS)], fill=(210, 245, 255, 255), width=max(1, SS))
    img.alpha_composite(glow)
    return img.resize((32, 96), Image.LANCZOS)


def build_edge_v():
    return build_edge_h().transpose(Image.ROTATE_270)


# ── PART: horizontal edge-centre armour segment (fixed) ──────────────────────
def build_seg_h():
    W, H = 140 * SS, 40 * SS
    img = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    # trapezoid: slanted ends (the reference's angled segment)
    sl = 20 * SS
    body = [(sl, 4 * SS), (W - sl, 4 * SS), (W - sl + 12 * SS, 20 * SS),
            (W - sl, 34 * SS), (sl, 34 * SS), (sl - 12 * SS, 20 * SS)]
    img.alpha_composite(plate(W, H, body, "metal-matte", 1.1, shadow=5))
    # inner raised strip
    inner = [(sl + 10 * SS, 12 * SS), (W - sl - 10 * SS, 12 * SS),
             (W - sl - 4 * SS, 20 * SS), (W - sl - 10 * SS, 28 * SS),
             (sl + 10 * SS, 28 * SS), (sl + 4 * SS, 20 * SS)]
    img.alpha_composite(plate(W, H, inner, "metal-matte", 1.25, shadow=2))
    d = ImageDraw.Draw(img)
    # two small gold capsules
    for gx in (W // 2 - 26 * SS, W // 2 + 26 * SS):
        d.rounded_rectangle([gx - 10 * SS, 17 * SS, gx + 10 * SS, 23 * SS], radius=3 * SS, fill=GM_DEEP + (255,))
        d.rounded_rectangle([gx - 8 * SS, 18 * SS, gx + 8 * SS, 22 * SS], radius=2 * SS, fill=GOLD + (255,))
    return img.resize((140, 40), Image.LANCZOS)


def build_seg_v():
    W, H = 40 * SS, 140 * SS
    img = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    sl = 20 * SS
    body = [(4 * SS, sl), (4 * SS, H - sl), (20 * SS, H - sl + 12 * SS),
            (34 * SS, H - sl), (34 * SS, sl), (20 * SS, sl - 12 * SS)]
    img.alpha_composite(plate(W, H, body, "metal-matte", 1.05, shadow=5))
    d = ImageDraw.Draw(img)
    # vent slots
    for k in range(4):
        vy = H // 2 - 24 * SS + k * 16 * SS
        d.line([(14 * SS, vy), (26 * SS, vy - 8 * SS)], fill=NAVY_DEEP + (210,), width=2 * SS)
    return img.resize((40, 140), Image.LANCZOS)


def main():
    os.makedirs(os.path.join(UI, "textures"), exist_ok=True)
    os.makedirs(os.path.join(UI, "manifests"), exist_ok=True)
    parts = {
        "part-corner": build_corner(),
        "part-edge-h": build_edge_h(),
        "part-edge-v": build_edge_v(),
        "part-seg-h": build_seg_h(),
        "part-seg-v": build_seg_v(),
    }
    for name, im in parts.items():
        im.save(os.path.join(UI, "textures", name + ".png"))
    manifest = {name: {"w": im.width, "h": im.height} for name, im in parts.items()}
    manifest["_meta"] = {"corner": 96, "edgeThickness": 32, "segH": [140, 40], "segV": [40, 140]}
    with open(os.path.join(UI, "manifests", "frame-parts.json"), "w") as f:
        json.dump(manifest, f, indent=2)
    print("wrote parts:", ", ".join(parts.keys()))


if __name__ == "__main__":
    main()
