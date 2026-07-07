# Extract individual 32x32 planets from Master484's CC0 PixelPlanets sheet
# (black background, white frames, white row labels) and save a montage to verify.
import numpy as np
from pathlib import Path
from PIL import Image

SP = Path(r"C:\Users\tamma\AppData\Local\Temp\claude\E--Program-Files-Claude-Code\d39092ba-0c5d-4f54-b0d7-5aae1687f5ce\scratchpad\assets")
OUT = SP / "planets484"
OUT.mkdir(exist_ok=True)

img = Image.open(SP / "PixelPlanets.png").convert("RGB")
a = np.array(img)
h, w, _ = a.shape

black = a.sum(axis=2) < 60
white = a.min(axis=2) > 200
interesting = ~black  # planets, frames, text

seen = np.zeros((h, w), dtype=bool)
comps = []
for sy in range(h):
    for sx in range(w):
        if interesting[sy, sx] and not seen[sy, sx]:
            stack = [(sy, sx)]
            seen[sy, sx] = True
            pix = []
            while stack:
                y, x = stack.pop()
                pix.append((y, x))
                for dy in (-1, 0, 1):
                    for dx in (-1, 0, 1):
                        ny, nx = y + dy, x + dx
                        if 0 <= ny < h and 0 <= nx < w and interesting[ny, nx] and not seen[ny, nx]:
                            seen[ny, nx] = True
                            stack.append((ny, nx))
            ys = [p[0] for p in pix]; xs = [p[1] for p in pix]
            comps.append((min(ys), min(xs), max(ys), max(xs), pix))

# classify: planets are ~25-40px, solid, not mostly white (frames/text are white)
planets = []
for y0, x0, y1, x1, pix in comps:
    bh, bw = y1 - y0 + 1, x1 - x0 + 1
    if not (20 <= bh <= 42 and 20 <= bw <= 42):
        continue
    fill = len(pix) / (bh * bw)
    n_white = sum(1 for y, x in pix if white[y, x])
    if fill < 0.5 or n_white / len(pix) > 0.85:
        continue  # hollow frame or white blob
    planets.append((y0, x0, y1, x1))

planets.sort(key=lambda b: (b[0] // 20, b[1]))
print(f"extracted {len(planets)} planets")

# theme by row y (from sheet labels)
def theme(y):
    if y < 45: return "base"
    if y < 105: return "terran"
    if y < 140: return "jungle"
    if y < 175: return "rock"
    if y < 210: return "ocean"
    if y < 245: return "desert"
    if y < 280: return "arctic"
    if y < 320: return "gas"
    if y < 355: return "inferno"
    if y < 395: return "toxic"
    return "extra"

counts = {}
for i, (y0, x0, y1, x1) in enumerate(planets):
    t = theme(y0)
    counts[t] = counts.get(t, 0) + 1
    cell = img.crop((x0, y0, x1 + 1, y1 + 1)).convert("RGBA")
    arr = np.array(cell)
    m = arr[:, :, :3].sum(axis=2) < 60  # black bg -> transparent
    arr[m, 3] = 0
    Image.fromarray(arr).save(OUT / f"{t}-{counts[t]:02d}.png")
print(counts)

# montage to verify
files = sorted(OUT.glob("*.png"))
cols = 12
mont = Image.new("RGBA", (cols * 36, ((len(files) + cols - 1) // cols) * 36), (20, 20, 30, 255))
for i, f in enumerate(files):
    mont.alpha_composite(Image.open(f).convert("RGBA"), ((i % cols) * 36 + 2, (i // cols) * 36 + 2))
mont.resize((mont.width * 3, mont.height * 3), Image.NEAREST).save(SP / "planet_montage.png")
print("montage saved")
