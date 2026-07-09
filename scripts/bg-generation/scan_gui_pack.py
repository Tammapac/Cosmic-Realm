# Alpha-segmentation scan of the PNG GUI pack (variant 3) — exact sprite bboxes.
import numpy as np
from pathlib import Path
from PIL import Image

ROOT = Path(r"E:\Program Files\Claude Code\Cosmic-Realm\PNG GUI")


def scan(rel, min_px=600, alpha_thr=12):
    img = Image.open(ROOT / rel).convert("RGBA")
    a = np.array(img)[:, :, 3] > alpha_thr
    h, w = a.shape
    seen = np.zeros_like(a, dtype=bool)
    boxes = []
    for sy in range(0, h, 2):          # stride 2 for speed; flood fills full res
        for sx in range(0, w, 2):
            if a[sy, sx] and not seen[sy, sx]:
                stack = [(sy, sx)]
                seen[sy, sx] = True
                n = 0
                y0 = y1 = sy; x0 = x1 = sx
                while stack:
                    y, x = stack.pop()
                    n += 1
                    if y < y0: y0 = y
                    if y > y1: y1 = y
                    if x < x0: x0 = x
                    if x > x1: x1 = x
                    for dy in (-1, 0, 1):
                        for dx in (-1, 0, 1):
                            ny, nx = y + dy, x + dx
                            if 0 <= ny < h and 0 <= nx < w and a[ny, nx] and not seen[ny, nx]:
                                seen[ny, nx] = True
                                stack.append((ny, nx))
                if n >= min_px:
                    boxes.append((x0, y0, x1 + 1, y1 + 1, n))
    boxes.sort(key=lambda b: (b[1] // 60, b[0]))
    print(f"\n== {rel} ==")
    for x0, y0, x1, y1, n in boxes:
        print(f"  ({x0:4d},{y0:4d})-({x1:4d},{y1:4d})  {x1-x0:4d}x{y1-y0:<4d} px={n}")


for sheet in ("Elements1/3.png", "Elements2/3.png", "Elements3/3.png", "Map/3.png", "SkillsLine/3.png", "Avatar/3.png"):
    scan(sheet)
