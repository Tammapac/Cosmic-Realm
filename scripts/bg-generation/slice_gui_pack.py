# Cut the user-provided "PNG GUI" pack (variant 3, orange/black) into named
# atlas pieces + generated state variants. Coordinates verified by alpha-scan.
import numpy as np
from pathlib import Path
from PIL import Image, ImageEnhance

ROOT = Path(r"E:\Program Files\Claude Code\Cosmic-Realm\PNG GUI")
OUT = Path(r"E:\Program Files\Claude Code\Cosmic-Realm\frontend\public\assets\ui\atlas")
OUT.mkdir(parents=True, exist_ok=True)

CUTS = [
    # (sheet, box, out name, scale)
    ("Elements1/3.png", (137, 36, 1269, 199), "title-glass.png", 0.5),
    ("Elements1/3.png", (33, 559, 525, 761), "hex-plate.png", 0.5),
    ("Elements1/3.png", (540, 544, 1030, 640), "header-strip.png", 0.5),
    ("Elements2/3.png", (43, 36, 497, 347), "oct-panel.png", 0.5),
    ("Elements2/3.png", (1034, 48, 1178, 150), "btn.png", 0.5),
    ("Elements2/3.png", (900, 48, 1013, 150), "btn-sq.png", 0.5),
    ("Elements2/3.png", (900, 191, 1368, 332), "bar-pill.png", 0.5),
    ("Elements2/3.png", (803, 561, 1410, 872), "popup.png", 0.5),
    ("Elements2/3.png", (21, 781, 592, 880), "row-strip.png", 0.5),
    ("Elements3/3.png", (23, 32, 473, 278), "glow-rect.png", 0.5),
    ("Elements3/3.png", (23, 904, 643, 946), "rail.png", 0.5),
    ("Map/3.png", (615, 143, 913, 449), "map-frame.png", 1.0),
    ("Inventory/3.png", (119, 215, 197, 293), "slot.png", 1.0),
    ("Quests/3.png", (0, 0, 675, 811), "window.png", 0.75),
    ("Chat/3.png", (0, 0, 270, 291), "chat-frame.png", 1.0),
]

for sheet, (x0, y0, x1, y1), name, scale in CUTS:
    img = Image.open(ROOT / sheet).convert("RGBA").crop((x0, y0, x1, y1))
    if scale != 1.0:
        img = img.resize((max(1, int(img.width * scale)), max(1, int(img.height * scale))), Image.LANCZOS)
    img.save(OUT / name, optimize=True)
    print(f"{name:ansi18s}" if False else f"{name:18s} {img.size}  {(OUT / name).stat().st_size // 1024} KB")

# ── state variants ───────────────────────────────────────────────────────────
def variant(src, dst, bright=1.0, color=1.0, glow=None, glow_alpha=0.5):
    img = Image.open(OUT / src).convert("RGBA")
    img = ImageEnhance.Color(ImageEnhance.Brightness(img).enhance(bright)).enhance(color)
    if glow:
        g = Image.open(OUT / glow).convert("RGBA").resize(img.size, Image.LANCZOS)
        ga = np.array(g, dtype=float)
        ga[:, :, 3] *= glow_alpha
        # only glow where the base sprite is opaque
        base_a = np.array(img)[:, :, 3]
        ga[:, :, 3] = np.minimum(ga[:, :, 3], base_a)
        img.alpha_composite(Image.fromarray(np.clip(ga, 0, 255).astype(np.uint8), "RGBA"))
    img.save(OUT / dst, optimize=True)
    print(f"{dst:18s} {img.size}  {(OUT / dst).stat().st_size // 1024} KB")

variant("btn.png", "btn-hover.png", bright=1.22, glow="glow-rect.png", glow_alpha=0.35)
variant("btn.png", "btn-active.png", bright=0.78)
variant("btn.png", "btn-disabled.png", bright=0.7, color=0.25)
variant("slot.png", "slot-hover.png", bright=1.35)
variant("slot.png", "slot-active.png", bright=1.1, glow="glow-rect.png", glow_alpha=0.45)
variant("row-strip.png", "row-strip-hover.png", bright=1.2)
variant("row-strip.png", "row-strip-sel.png", bright=1.35, glow="glow-rect.png", glow_alpha=0.3)
variant("bar-pill.png", "bar-trough.png", bright=0.32, color=0.35)

total = sum(f.stat().st_size for f in OUT.glob("*.png"))
print(f"\ntotal {total // 1024} KB in {len(list(OUT.glob('*.png')))} files")
