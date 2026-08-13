"""Slice the four dark-metal tiles from the user's material reference sheet into
seamless-ish 256px material textures for the Cosmic UI frame layers.

The sheet is a 2x2 grid; we crop the CENTRE of each quadrant (away from the
seams) and make each tile edge-wrap-friendly by blending opposite edges.
Output: textures/metal-{brushed,matte,carbon,grid}.png
"""
from PIL import Image
import os, sys

SRC = sys.argv[1]
HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.normpath(os.path.join(HERE, "..", "..", "public", "assets", "ui", "cosmic", "textures"))
os.makedirs(OUT, exist_ok=True)

im = Image.open(SRC).convert("RGB")
W, H = im.size
half = W // 2
TILE = 256
# crop a centred square from each quadrant, a bit smaller than the half to dodge
# the centre seams, then resize to TILE
pad = int(half * 0.12)

def quad(cx, cy):
    x0 = cx - half // 2 + pad
    y0 = cy - half // 2 + pad
    x1 = cx + half // 2 - pad
    y1 = cy + half // 2 - pad
    return im.crop((x0, y0, x1, y1)).resize((TILE, TILE), Image.LANCZOS)

def make_seamless(tile):
    """Offset by half and blend the visible cross-seam with a feather, so the
    tile repeats without a hard join."""
    import PIL.ImageChops as C
    t = tile
    off = C.offset(t, TILE // 2, TILE // 2)
    # feather blend a central cross using a mask
    from PIL import ImageDraw, ImageFilter
    mask = Image.new("L", (TILE, TILE), 0)
    d = ImageDraw.Draw(mask)
    fw = 24
    d.rectangle([TILE // 2 - fw, 0, TILE // 2 + fw, TILE], fill=255)
    d.rectangle([0, TILE // 2 - fw, TILE, TILE // 2 + fw], fill=255)
    mask = mask.filter(ImageFilter.GaussianBlur(fw // 2))
    return Image.composite(off, t, mask)

tiles = {
    "metal-brushed": quad(half // 2, half // 2),          # TL brushed titanium
    "metal-matte":   quad(half + half // 2, half // 2),   # TR matte scratched
    "metal-carbon":  quad(half // 2, half + half // 2),   # BL carbon weave
    "metal-grid":    quad(half + half // 2, half + half // 2),  # BR micro grid
}
for name, t in tiles.items():
    make_seamless(t).save(os.path.join(OUT, name + ".png"))
    print("wrote", name + ".png")
