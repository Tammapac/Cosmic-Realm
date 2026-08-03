"""Preview: assemble the frame PARTS into a finished wide window, exactly as the
CosmicWindow component will at runtime, and save one PNG so the composed result
can be judged (not the isolated parts). Corners in corners, straight edges
stretched between, edge-centre segments centred on each side.
"""
from PIL import Image
import os

HERE = os.path.dirname(os.path.abspath(__file__))
T = os.path.normpath(os.path.join(HERE, "..", "..", "public", "assets", "ui", "cosmic", "textures"))

def load(n): return Image.open(os.path.join(T, n + ".png")).convert("RGBA")

corner = load("part-corner")            # 96x96 (top-left)
edge_h = load("part-edge-h")            # 32x96 straight (stretch X)
edge_v = load("part-edge-v")            # 96x32 straight (stretch Y)
seg_h  = load("part-seg-h")             # 140x40 centre segment
seg_v  = load("part-seg-v")             # 40x140

W, Hh = 760, 380                        # a wide window
img = Image.new("RGBA", (W, Hh), (10, 14, 24, 255))

CS = corner.width                       # 96
et = 32                                 # edge band thickness

# dark inner glass
inner = Image.new("RGBA", (W - 2 * et, Hh - 2 * et), (16, 22, 34, 255))
img.alpha_composite(inner, (et, et))

# straight edges (stretched)
top = edge_h.resize((W - 2 * CS, edge_h.height))
img.alpha_composite(top, (CS, 0))
bot = top.transpose(Image.FLIP_TOP_BOTTOM)
img.alpha_composite(bot, (CS, Hh - edge_h.height))
left = edge_v.resize((edge_v.width, Hh - 2 * CS))
img.alpha_composite(left, (0, CS))
right = left.transpose(Image.FLIP_LEFT_RIGHT)
img.alpha_composite(right, (W - edge_v.width, CS))

# corners (flip the top-left for the other three)
img.alpha_composite(corner, (0, 0))
img.alpha_composite(corner.transpose(Image.FLIP_LEFT_RIGHT), (W - CS, 0))
img.alpha_composite(corner.transpose(Image.FLIP_TOP_BOTTOM), (0, Hh - CS))
img.alpha_composite(corner.transpose(Image.FLIP_LEFT_RIGHT).transpose(Image.FLIP_TOP_BOTTOM), (W - CS, Hh - CS))

# centre segments
img.alpha_composite(seg_h, (W // 2 - seg_h.width // 2, -4))
img.alpha_composite(seg_h.transpose(Image.FLIP_TOP_BOTTOM), (W // 2 - seg_h.width // 2, Hh - seg_h.height + 4))
img.alpha_composite(seg_v, (-4, Hh // 2 - seg_v.height // 2))
img.alpha_composite(seg_v.transpose(Image.FLIP_LEFT_RIGHT), (W - seg_v.width + 4, Hh // 2 - seg_v.height // 2))

out = os.path.join(HERE, "assembled-preview.png")
img.save(out)
print("wrote", out)
