"""Cosmic Realm — procedural multi-layer UI frame (v3).

Models the reference: a STACKED sci-fi frame, not a flat plate. Cross-section
from outside inward:

  outer deep plate (dark gunmetal, segment seams, corner blocks, bolts)
    → recessed channel (holds the cyan energy line)
      → inner RAISED plate (lighter, its own bevel)
        → deep inner edge → vignette into the recess

Lit from ABOVE (top edges bright, bottom in shadow) plus a bright grat on each
raised lip. Base layer + separately-tintable emissive channel. 9-slice safe:
all ornament stays inside the margins; the flat centre stretches.

Reproducible, Pillow only. Run:  python gen_frame.py
"""
from PIL import Image, ImageDraw, ImageFilter, ImageChops
import math, os

HERE = os.path.dirname(os.path.abspath(__file__))
UI = os.path.normpath(os.path.join(HERE, "..", "..", "public", "assets", "ui", "cosmic"))

SIZE = 320            # bigger canvas for the multi-layer detail
MARGIN = 54           # 9-slice margin (thick, stacked frame)
SS = 3                # supersample
C = 26                # symmetric corner chamfer (design px)

# ── gunmetal palette (brighter, with a strong specular top, per reference) ──
GM_HI = (198, 212, 234)     # bright top-lit steel highlight (glint)
GM = (120, 134, 158)        # mid gunmetal
GM_MID = (84, 96, 118)      # plate face
GM_LO = (52, 62, 82)        # lower plate / shadowed face
GM_DEEP = (28, 34, 48)      # channel / deep recess
NAVY_DEEP = (12, 16, 28)    # inner glass
BOLT = (58, 68, 88)
GOLD = (210, 162, 78)


def lerp(a, b, t):
    return tuple(int(a[i] + (b[i] - a[i]) * t) for i in range(len(a)))


def chamfer(x0, y0, x1, y1, c):
    return [
        (x0 + c, y0), (x1 - c, y0), (x1, y0 + c), (x1, y1 - c),
        (x1 - c, y1), (x0 + c, y1), (x0, y1 - c), (x0, y0 + c),
    ]


def ring_mask(W, out_poly, in_poly):
    m = Image.new("L", (W, W), 0)
    d = ImageDraw.Draw(m)
    d.polygon(out_poly, fill=255)
    d.polygon(in_poly, fill=0)
    return m


# ── real metal material tiles (sliced from the user's reference sheet) ──
_MAT_CACHE = {}
def load_material(name, W):
    """Load a metal tile, tiled to fill WxW. Cached."""
    key = (name, W)
    if key in _MAT_CACHE:
        return _MAT_CACHE[key]
    path = os.path.join(UI, "textures", name + ".png")
    tile = Image.open(path).convert("RGB")
    tw, th = tile.size
    canvas = Image.new("RGB", (W, W))
    for y in range(0, W, th):
        for x in range(0, W, tw):
            canvas.paste(tile, (x, y))
    _MAT_CACHE[key] = canvas
    return canvas


def top_lit(W, ring, lo, hi, base, material="metal-brushed", brightness=1.0):
    """Fill `ring` with REAL metal texture, shaded by a top-lit vertical light
    ramp (bright top → dark bottom). The texture carries the grain/scratches;
    the ramp carries the 3D lighting."""
    mat = load_material(material, W)
    # top-lit multiply ramp
    ramp = Image.new("L", (W, W))
    rp = ramp.load()
    for y in range(W):
        t = y / (W - 1)
        # map hi..lo luminance onto 150..70-ish, scaled by brightness
        v = int((175 - 95 * (t ** 0.9)) * brightness)
        v = max(20, min(255, v))
        for x in range(W):
            rp[x, y] = v
    shaded = ImageChops.multiply(mat, Image.merge("RGB", (ramp, ramp, ramp)))
    # lift toward the target tint slightly so palette stays cohesive
    shaded = ImageChops.screen(shaded, Image.new("RGB", (W, W), lerp((0, 0, 0), base, 0.15)))
    layer = Image.new("RGBA", (W, W), (0, 0, 0, 0))
    layer.paste(shaded, (0, 0), ring)
    return layer


def paste_block(img, poly, material, brightness, W, shadow=6, bevel=True, hole=None):
    """Composite a RAISED metal block onto img:
        1. a soft blurred DROP SHADOW offset down-right (the block sits above)
        2. the metal-textured, top-lit block itself
        3. a bright grat on its top/left edge + dark shade on bottom/right
    `hole` optionally punches a concentric opening (for ring terraces).
    This is the per-segment stacking primitive — each call adds one physical
    plate above whatever is below it."""
    ss = SS
    # 1. drop shadow
    sh = Image.new("L", (W, W), 0)
    ImageDraw.Draw(sh).polygon(poly, fill=150)
    if hole is not None:
        ImageDraw.Draw(sh).polygon(hole, fill=0)
    sh = sh.filter(ImageFilter.GaussianBlur(shadow * ss))
    shadow_layer = Image.new("RGBA", (W, W), (0, 0, 0, 0))
    shadow_layer.paste((0, 0, 0), (int(shadow * 0.6 * ss), int(shadow * 0.7 * ss)), sh)
    shadow_layer.putalpha(ImageChops.offset(sh, int(shadow * 0.6 * ss), int(shadow * 0.7 * ss)))
    img.alpha_composite(shadow_layer)

    # 2. metal block, top-lit
    bm = Image.new("L", (W, W), 0)
    ImageDraw.Draw(bm).polygon(poly, fill=255)
    if hole is not None:
        ImageDraw.Draw(bm).polygon(hole, fill=0)
    mat = load_material(material, W)
    ys = [p[1] for p in poly]; y0, y1 = min(ys), max(ys)
    ramp = Image.new("L", (W, W))
    rp = ramp.load()
    for y in range(W):
        t = (y - y0) / max(1, (y1 - y0))
        t = max(0.0, min(1.0, t))
        v = int((180 - 105 * (t ** 0.85)) * brightness)
        for x in range(W):
            rp[x, y] = max(18, min(255, v))
    shaded = ImageChops.multiply(mat, Image.merge("RGB", (ramp, ramp, ramp)))
    block = Image.new("RGBA", (W, W), (0, 0, 0, 0))
    block.paste(shaded, (0, 0), bm)
    img.alpha_composite(block)

    # 3. THIN edges — a crisp bright glint on the top/left, and a defined dark
    #    SHADOW LEDGE on the bottom/right so the plate seats into the layer
    #    below it (the fix requested: only the lower edges get the seating
    #    shadow; no thick all-round bevel).
    if bevel:
        d = ImageDraw.Draw(img)
        tr = poly_top_run(poly)
        brun = poly_bottom_run(poly)
        # bottom/right: a short dark ledge that ties the plate to what's below —
        # a 2px shadow just OUTSIDE the edge (offset down-right) + the edge line
        if len(brun) >= 2:
            off = 2 * ss
            ledge = [(x + off, y + off) for (x, y) in brun]
            d.line(ledge, fill=(0, 0, 0, 150), width=2 * ss)     # cast ledge shadow
            d.line(brun, fill=(0, 0, 0, 200), width=max(1, ss))  # crisp dark edge
        # top/left: thin bright specular glint
        if len(tr) >= 2:
            d.line(tr, fill=(230, 242, 255, 255), width=max(1, ss))


def poly_top_run(p):
    """The upper half of a chamfer poly's edge (for top-lit highlights)."""
    ys = [q[1] for q in p]
    mid = min(ys) + (max(ys) - min(ys)) * 0.5
    return [q for q in p if q[1] <= mid]


def poly_bottom_run(p):
    ys = [q[1] for q in p]
    mid = min(ys) + (max(ys) - min(ys)) * 0.5
    return [q for q in p if q[1] >= mid]


def inset_poly(p, d):
    """Shrink a polygon toward its centroid by ~d px (approx; fine for the
    near-rectangular block shapes used here)."""
    cx = sum(q[0] for q in p) / len(p)
    cy = sum(q[1] for q in p) / len(p)
    out = []
    for (x, y) in p:
        vx, vy = x - cx, y - cy
        L = max(1.0, (vx * vx + vy * vy) ** 0.5)
        out.append((x - vx / L * d, y - vy / L * d))
    return out


def bevel_edges(img, out_poly, in_poly, light=GM_HI, dark=GM_DEEP, lw=1):
    """Seat a raised plate the way a 3D bevel reads:
       - a SHARP bright specular line on the top + left outer edge
       - a soft dark shade on the bottom + right outer edge
       - a hard AO contact shadow dropping at the inner edge."""
    d = ImageDraw.Draw(img)
    # bottom/right outer edge: soft shade
    br = poly_bottom_run(out_poly)
    if len(br) >= 2:
        d.line(br, fill=lerp(dark, (0, 0, 0), 0.3) + (200,), width=(lw + 1) * SS)
    # top/left outer edge: crisp bright specular
    tr = poly_top_run(out_poly)
    if len(tr) >= 2:
        d.line(tr, fill=light + (255,), width=lw * SS)
        # a second thinner pure-white glint on top of it
        d.line(tr, fill=lerp(light, (255, 255, 255), 0.6) + (200,), width=max(1, lw * SS // 2))
    # inner edge: hard AO drop shadow into the next-lower layer
    d.line(in_poly + [in_poly[0]], fill=(0, 0, 0, 235), width=(lw + 1) * SS)


def brushed(W):
    img = Image.new("L", (W, W), 128)
    px = img.load()
    for y in range(W):
        base = 128 + int(10 * math.sin(y * 0.6))
        for x in range(W):
            n = ((x * 131 + y * 977) % 17) - 8
            px[x, y] = max(0, min(255, base + n))
    return img


def build_base():
    W = SIZE * SS
    m = MARGIN * SS
    c = C * SS
    img = Image.new("RGBA", (W, W), (0, 0, 0, 0))

    # layer insets (design px * SS) — the STACK, outer→inner:
    o0 = 0                       # outer plate outer edge
    o1 = int(m * 0.42)           # outer plate inner edge  (= start of channel)
    ch = int(m * 0.58)           # channel inner edge      (raised plate outer)
    i1 = m                       # raised plate inner edge (= recess)

    def poly(inset):
        return chamfer(inset, inset, W - inset, W - inset, max(3, c - inset))

    # ── 0. inner recessed GLASS surface (dark, not white) filling the opening.
    #    A soft top→bottom navy with an inner vignette so the recess reads deep.
    inner_op = poly(i1)
    glass = Image.new("RGBA", (W, W), (0, 0, 0, 0))
    gp = Image.new("RGB", (W, W))
    gpx = gp.load()
    for y in range(W):
        t = y / (W - 1)
        col = lerp((16, 22, 36), (9, 13, 22), t)
        for x in range(W):
            gpx[x, y] = col
    gm = Image.new("L", (W, W), 0)
    ImageDraw.Draw(gm).polygon(inner_op, fill=255)
    glass.paste(gp, (0, 0), gm)
    img = Image.alpha_composite(img, glass)

    # ═══ TERRACED STACK ═══════════════════════════════════════════════════
    # Three concentric plate terraces stepping DOWN from the outer edge to the
    # channel, each pasted as a raised block (own shadow + bevel) on the one
    # below → real height steps, not one flat ring.
    #  t0 outer (lowest, darkest brushed)  → t1 mid  → t2 inner-lip (brightest)
    t_a, t_b, t_c = int(m * 0.30), int(m * 0.52), ch   # terrace inner edges
    # base terrace fills the whole frame ring first (dark)
    base_ring = ring_mask(W, poly(o0), poly(i1))
    base = top_lit(W, base_ring, GM_LO, GM_LO, GM_DEEP, material="metal-brushed", brightness=0.7)
    img = Image.alpha_composite(img, base)
    # terrace 1: a raised ring block from outer edge in-to t_a
    paste_block(img, poly(o0), "metal-brushed", 0.9, W, shadow=5, hole=poly(t_a))
    # terrace 2: stepped up, inset
    paste_block(img, poly(int(m * 0.16)), "metal-matte", 1.0, W, shadow=6, hole=poly(t_b))
    # terrace 3: the inner lip (brightest) that borders the channel
    paste_block(img, poly(int(m * 0.34)), "metal-matte", 1.15, W, shadow=6, hole=poly(t_c))

    # ── recessed channel (holds the cyan line) between lip and inner opening ──
    ch_ring = ring_mask(W, poly(ch), poly(i1))
    ch_fill = Image.new("RGBA", (W, W), (0, 0, 0, 0))
    ch_fill.paste(Image.new("RGB", (W, W), GM_DEEP), (0, 0), ch_ring)
    img = Image.alpha_composite(img, ch_fill)
    d = ImageDraw.Draw(img)
    d.line(poly(ch) + [poly(ch)[0]], fill=(0, 0, 0, 220), width=2 * SS)   # AO on outer channel wall
    d.line(poly(i1) + [poly(i1)[0]], fill=NAVY_DEEP + (255,), width=2 * SS)  # inner drop

    # ═══ INDIVIDUAL RAISED EDGE BLOCKS (segments) on top of the terraces ═════
    # centred rectangular armour segments on each edge, each its own raised
    # block — the "assembled from parts" read.
    seg_h = int(m * 0.44)          # flatter (was 0.6) — less overhang
    seg_len = int(W * 0.17)        # shorter (was 0.22) — more mechanical
    cc = 5 * SS                    # smaller chamfer (was 8) — crisper corners
    off = int(m * 0.16)            # seat the segment further onto the terrace
    mid = W // 2
    def rect_poly(x0, y0, x1, y1, r):
        return chamfer(x0, y0, x1, y1, r)
    # top + bottom centre segments
    paste_block(img, rect_poly(mid - seg_len, off, mid + seg_len, off + seg_h, cc),
                "metal-matte", 1.15, W, shadow=4)
    paste_block(img, rect_poly(mid - seg_len, W - off - seg_h, mid + seg_len, W - off, cc),
                "metal-matte", 1.0, W, shadow=4)
    # left + right centre segments
    paste_block(img, rect_poly(off, mid - seg_len, off + seg_h, mid + seg_len, cc),
                "metal-matte", 1.08, W, shadow=4)
    paste_block(img, rect_poly(W - off - seg_h, mid - seg_len, W - off, mid + seg_len, cc),
                "metal-matte", 1.0, W, shadow=4)

    # ═══ CORNER BLOCKS (crisper, slightly smaller, own bolt) ════════════════
    blk = int(m * 0.82)            # a touch smaller (was 0.92)
    for (cx, cy) in [(0, 0), (W, 0), (0, W), (W, W)]:
        bx0 = cx - blk if cx else 0
        by0 = cy - blk if cy else 0
        bx1 = cx if cx else blk
        by1 = cy if cy else blk
        cpoly = chamfer(bx0 + 4 * SS, by0 + 4 * SS, bx1 - 4 * SS, by1 - 4 * SS, int(c * 0.6))
        paste_block(img, cpoly, "metal-matte", 1.2, W, shadow=6)
        # a small inner step on the corner block for extra mechanical detail
        step = chamfer(bx0 + int(blk * 0.32), by0 + int(blk * 0.32),
                       bx1 - int(blk * 0.32), by1 - int(blk * 0.32), int(c * 0.4))
        paste_block(img, step, "metal-matte", 1.32, W, shadow=3)
        d = ImageDraw.Draw(img)
        bxc = bx0 + blk // 2 if cx == 0 else bx1 - blk // 2
        byc = by0 + blk // 2 if cy == 0 else by1 - blk // 2
        r = 3 * SS
        d.ellipse([bxc - r, byc - r, bxc + r, byc + r], fill=NAVY_DEEP + (255,))
        d.ellipse([bxc - r + SS, byc - r + SS, bxc + r - SS, byc + r - SS], fill=BOLT + (255,))
        d.ellipse([bxc - r // 2, byc - r // 2, bxc, byc], fill=GM_HI + (255,))

    # ── 7. EDGE ORNAMENTS: smaller gold capsules on the mid segments ──
    d = ImageDraw.Draw(img)
    midx = W // 2
    cap_w, cap_h = 15 * SS, 6 * SS          # smaller (was 22×8)
    seat = off + seg_h // 2                 # sit on the mid segment's face
    for (ox, oy) in [(midx, seat), (midx, W - seat)]:
        x0, y0 = ox - cap_w, oy - cap_h // 2
        d.rounded_rectangle([x0, y0, ox + cap_w, oy + cap_h // 2], radius=cap_h // 2, fill=GM_DEEP + (255,))
        d.rounded_rectangle([x0 + SS, y0 + SS, ox + cap_w - SS, oy + cap_h // 2 - SS], radius=cap_h // 3, fill=GOLD + (255,))
        d.rounded_rectangle([x0 + 2 * SS, y0 + 2 * SS, ox + cap_w - 2 * SS, oy], radius=max(1, cap_h // 4), fill=lerp(GOLD, (255, 255, 255), 0.45) + (220,))
    # fine vent slots on the side segments (tighter hatch)
    for side_x in [seat, W - seat]:
        for k in range(5):
            vy = W // 2 - 18 * SS + k * 8 * SS
            d.line([(side_x - 6 * SS, vy), (side_x + 6 * SS, vy - 4 * SS)], fill=NAVY_DEEP + (200,), width=max(1, SS - 1))

    img = img.resize((SIZE, SIZE), Image.LANCZOS)
    return img


def build_emissive():
    """Cyan channel: a continuous line running IN the recessed channel between
    the two plates (per the reference — the glow is in the gap, not on the
    face). Nine-slice safe: it hugs the channel at a fixed inset."""
    W = SIZE * SS
    m = MARGIN * SS
    c = C * SS
    # Cyan glow intentionally OFF for now (will be re-added form-fitted later).
    # Emit a fully-transparent layer so the frame shows metal only.
    return Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))


def main():
    for sub in ("textures", "emissive", "manifests"):
        os.makedirs(os.path.join(UI, sub), exist_ok=True)
    build_base().save(os.path.join(UI, "textures", "frame-base.png"))
    build_emissive().save(os.path.join(UI, "emissive", "frame-glow.png"))
    import json
    with open(os.path.join(UI, "manifests", "frame.json"), "w") as f:
        json.dump({"frame": {
            "base": "textures/frame-base.png",
            "emissive": "emissive/frame-glow.png",
            "size": SIZE,
            "nineSlice": {"left": MARGIN, "top": MARGIN, "right": MARGIN, "bottom": MARGIN},
        }}, f, indent=2)
    print("wrote v3 multi-layer frame (size=%d margin=%d)" % (SIZE, MARGIN))


if __name__ == "__main__":
    main()
