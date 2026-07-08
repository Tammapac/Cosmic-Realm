# STEELWORK v2 — denser engineered look: double rails with segmented notches
# (designed for border-image-repeat: round), corner braces, vent greebles,
# richer metal. All original procedural art. Overwrites the v1 filenames.
import numpy as np
from pathlib import Path
from PIL import Image

OUT = Path(r"E:\Program Files\Claude Code\Cosmic-Realm\frontend\public\assets\ui\skin")
OUT.mkdir(parents=True, exist_ok=True)

PLATE1 = (21, 31, 52)
PLATE2 = (11, 17, 30)
STRIP = (14, 21, 38)
STEEL = (108, 126, 152)
STEEL_L = (162, 180, 206)
STEEL_D = (58, 70, 90)
OUTLINE = (10, 14, 24)
CYAN = (56, 214, 245)
GOLD = (232, 178, 60)
RED = (242, 70, 74)


def octagon(h, w, ch):
    yy, xx = np.meshgrid(np.arange(h), np.arange(w), indexing="ij")
    return ((xx + yy >= ch) & ((w - 1 - xx) + yy >= ch)
            & (xx + (h - 1 - yy) >= ch) & ((w - 1 - xx) + (h - 1 - yy) >= ch))


def erode(m, n=1):
    e = m.copy()
    for _ in range(n):
        s = e.copy()
        for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1), (1, 1), (1, -1), (-1, 1), (-1, -1)):
            s &= np.roll(np.roll(e, dy, 0), dx, 1)
        e = s
    return e


def ring(m):
    return m & ~erode(m)


def body_tex(h, w, top, bottom, seed=0):
    r = np.random.default_rng(seed)
    t = np.linspace(0, 1, h)[:, None, None]
    body = (1 - t) * np.array(top)[None, None, :] + t * np.array(bottom)[None, None, :]
    rows = r.uniform(-4, 4, (h, 1, 1))
    scan = (np.arange(h) % 4 == 0)[:, None, None] * -5
    out = np.clip(np.broadcast_to(body + rows + scan, (h, w, 3)).copy(), 0, 255)
    # faint vertical seams every 24px for plated-armor feel
    seams = (np.arange(w) % 24 == 0)[None, :, None]
    return np.clip(out - seams * 7, 0, 255)


def bevel(yy, xx, h, w):
    d = (xx / max(1, w - 1) + yy / max(1, h - 1)) / 2
    return 1.4 - 0.85 * d


def notch_mask(h, w, ch, period=12, width=3):
    """Rectangular seams crossing the rails on the straight edge runs."""
    yy, xx = np.meshgrid(np.arange(h), np.arange(w), indexing="ij")
    on_x = (xx % period) < width
    on_y = (yy % period) < width
    horiz = (yy < ch + 6) | (yy > h - 1 - ch - 6)
    vert = (xx < ch + 6) | (xx > w - 1 - ch - 6)
    straight_h = (xx > ch + 5) & (xx < w - ch - 6)
    straight_v = (yy > ch + 5) & (yy < h - ch - 6)
    return (horiz & straight_h & on_x) | (vert & straight_v & on_y)


def make_plate(h, w, ch, accent, title_h=0, seed=1):
    m = octagon(h, w, ch)
    yy, xx = np.meshgrid(np.arange(h), np.arange(w), indexing="ij")
    out = np.zeros((h, w, 4), dtype=float)
    out[m, :3] = body_tex(h, w, PLATE1, PLATE2, seed)[m]
    out[m, 3] = 250

    if title_h:
        strip = m & (yy < title_h)
        t = (yy / max(1, title_h))[:, :, None]
        grad = (1 - t) * (np.array(STRIP) + 12)[None, None, :] + t * np.array(STRIP)[None, None, :]
        out[strip, :3] = grad[strip]
        under = m & (yy == title_h)
        out[under, :3] = np.array(accent) * 0.8
        out[under, 3] = 255
        under2 = m & (yy == title_h + 1)
        out[under2, :3] = OUTLINE
        out[under2, 3] = 255

    # ring structure: outline / steel rail x2 / dark channel x2 / accent strip
    rings = []
    cur = m
    for _ in range(7):
        rings.append(ring(cur))
        cur = erode(cur)
    bev = bevel(yy, xx, h, w)
    notches = notch_mask(h, w, ch)

    out[rings[0], :3] = OUTLINE; out[rings[0], 3] = 255
    for rr in (rings[1], rings[2]):  # steel rail
        col = np.clip(np.array(STEEL)[None, :] * bev[rr][:, None], 0, 255)
        out[rr, :3] = col; out[rr, 3] = 255
    for rr in (rings[3],):           # dark channel
        out[rr, :3] = np.array(OUTLINE) + 4; out[rr, 3] = 255
    out[rings[4], :3] = np.array(accent); out[rings[4], 3] = 135   # light strip
    out[rings[5], :3] = np.array(OUTLINE) + 8; out[rings[5], 3] = 255

    # segmented rail: notch seams cut across the steel rails
    railzone = rings[1] | rings[2]
    cut = railzone & notches
    out[cut, :3] = np.array(STEEL_D) * 0.7
    # tiny accent tick at each notch on the outer rail
    tick = rings[1] & notches & (~np.roll(notches, 1, 1) | ~np.roll(notches, 1, 0))
    out[tick, :3] = np.array(accent) * 0.55

    # corner braces: bright diagonal bands across the chamfers
    diag = np.abs((xx + yy) - ch)
    for corner, mask in (
        ((xx + yy), (xx < ch + 8) & (yy < ch + 8)),
        (((w - 1 - xx) + yy), (xx > w - ch - 9) & (yy < ch + 8)),
        ((xx + (h - 1 - yy)), (xx < ch + 8) & (yy > h - ch - 9)),
        (((w - 1 - xx) + (h - 1 - yy)), (xx > w - ch - 9) & (yy > h - ch - 9)),
    ):
        band = m & mask & (np.abs(corner - ch - 2) <= 1)
        out[band, :3] = np.clip(np.array(STEEL_L) * 1.0, 0, 255)
        out[band, 3] = 255

    # rivets inside corners
    ins = ch + 6
    for cy in (ins, h - 2 - ins):
        for cx in (ins, w - 2 - ins):
            if title_h and cy < title_h:  # keep strip clean
                continue
            out[cy:cy + 2, cx:cx + 2, :3] = STEEL_L
            out[cy:cy + 2, cx:cx + 2, 3] = 255
            out[cy + 2, cx:cx + 2, :3] = OUTLINE
            out[cy + 2, cx:cx + 2, 3] = 255

    # vent greebles: 3 embossed slits, bottom-left + top-right interior
    for (gy, gx) in ((h - ins - 10, ins + 4), (ins + 6 if not title_h else title_h + 6, w - ins - 12)):
        for i in range(3):
            y = gy + i * 3
            out[y, gx:gx + 8, :3] = np.array(PLATE2) * 0.55
            out[y, gx:gx + 8, 3] = 255
            out[y + 1, gx:gx + 8, :3] = np.clip(np.array(PLATE1) * 1.35, 0, 255)
            out[y + 1, gx:gx + 8, 3] = 255
    return out


def save2x(arr, name):
    img = Image.fromarray(np.clip(arr, 0, 255).astype(np.uint8), "RGBA")
    img.resize((img.width * 2, img.height * 2), Image.NEAREST).save(OUT / name, optimize=True)
    print(name, (img.width * 2, img.height * 2), (OUT / name).stat().st_size // 1024, "KB")


save2x(make_plate(96, 96, 10, CYAN), "plate.png")
save2x(make_plate(96, 96, 10, CYAN, title_h=20), "plate-title.png")
save2x(make_plate(96, 96, 10, GOLD, title_h=20, seed=2), "plate-gold.png")
save2x(make_plate(96, 96, 10, RED, seed=3), "plate-red.png")


def make_btn(state):
    h, w, ch = 18, 48, 3
    m = octagon(h, w, ch)
    yy, xx = np.meshgrid(np.arange(h), np.arange(w), indexing="ij")
    out = np.zeros((h, w, 4), dtype=float)
    grads = {
        "normal": ((36, 54, 84), (18, 28, 48)),
        "hover": ((48, 72, 110), (24, 36, 64)),
        "active": ((16, 24, 40), (30, 44, 70)),
        "disabled": ((24, 28, 38), (15, 18, 26)),
    }
    top, bot = grads[state]
    out[m, :3] = body_tex(h, w, top, bot, 5)[m]
    out[m, 3] = 255
    r0 = ring(m); m1 = erode(m); r1 = ring(m1)
    bev = bevel(yy, xx, h, w)
    rim = {"normal": STEEL, "hover": CYAN, "active": (34, 130, 150), "disabled": STEEL_D}[state]
    out[r1, :3] = np.clip(np.array(rim)[None, :] * (bev[r1][:, None] * 0.8 + 0.2), 0, 255)
    out[r1, 3] = 255
    out[r0, :3] = OUTLINE; out[r0, 3] = 255
    # side vents (2 short vertical seams near the ends)
    for gx in (6, w - 8):
        out[5:h - 5, gx, :3] = np.array(OUTLINE) + 10
    hl = m1 & (yy == 2)
    out[hl, :3] = np.clip(out[hl, :3] + (30 if state != "disabled" else 8), 0, 255)
    if state == "active":
        out[hl, :3] = np.array(CYAN) * 0.75
    return out


for s in ("normal", "hover", "active", "disabled"):
    save2x(make_btn(s), f"btn-{s}.png")


def make_slot(state):
    h = w = 28
    ch = 3
    m = octagon(h, w, ch)
    yy, xx = np.meshgrid(np.arange(h), np.arange(w), indexing="ij")
    out = np.zeros((h, w, 4), dtype=float)
    t = (yy / (h - 1))[:, :, None]
    well = (1 - t) * np.array((9, 14, 25))[None, None, :] + t * np.array((20, 29, 48))[None, None, :]
    out[m, :3] = well[m]
    out[m, 3] = 252
    r0 = ring(m); m1 = erode(m); r1 = ring(m1); m2 = erode(m1); r2 = ring(m2)
    bev = bevel(yy, xx, h, w)
    rim = {"normal": STEEL_D, "hover": STEEL, "active": CYAN}[state]
    out[r1, :3] = np.clip(np.array(rim)[None, :] * (0.4 + 0.6 * bev[r1][:, None]), 0, 255)
    out[r1, 3] = 255
    out[r2, :3] = np.array(OUTLINE) + 6; out[r2, 3] = 255
    out[r0, :3] = OUTLINE; out[r0, 3] = 255
    inner_shadow = erode(m2) & ~erode(m2, 2) & (yy < h / 2)
    out[inner_shadow, :3] *= 0.5
    # corner screws
    for cy, cx in ((4, 4), (4, w - 6), (h - 6, 4), (h - 6, w - 6)):
        out[cy, cx, :3] = STEEL_L
        out[cy, cx, 3] = 255
    return out


for s in ("normal", "hover", "active"):
    save2x(make_slot(s), f"slot-{s}.png")

print(f"\ntotal {sum(f.stat().st_size for f in OUT.glob('*.png')) // 1024} KB")
