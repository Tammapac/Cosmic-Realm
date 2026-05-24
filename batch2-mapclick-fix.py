#!/usr/bin/env python3
"""Fix minimap + full map click navigation using rect dimensions instead of hardcoded SIZE."""

print("═══ Fixing map click coordinate calculations ═══")

with open('frontend/src/components/MiniMap.tsx', 'r') as f:
    code = f.read()

# Fix 1: Mini radar click - use rect.width/height instead of SIZE
old_mini = '''  const handleClick = (e: React.MouseEvent<SVGSVGElement>) => {
    if (state.dockedAt) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const cx = e.clientX - rect.left;
    const cy = e.clientY - rect.top;
    const dx = (cx - SIZE / 2) / scale;
    const dy = (cy - SIZE / 2) / scale;
    state.cameraTarget = {
      x: state.player.pos.x + dx,
      y: state.player.pos.y + dy,
    };
    bump();
  };'''

new_mini = '''  const handleClick = (e: React.MouseEvent<SVGSVGElement>) => {
    if (state.dockedAt) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const rx = (e.clientX - rect.left) / rect.width;
    const ry = (e.clientY - rect.top) / rect.height;
    const dx = (rx - 0.5) * RANGE * 2;
    const dy = (ry - 0.5) * RANGE * 2;
    state.cameraTarget = {
      x: state.player.pos.x + dx,
      y: state.player.pos.y + dy,
    };
    bump();
  };'''

if old_mini in code:
    code = code.replace(old_mini, new_mini)
    print("  -> Fixed mini radar click (normalized coords)")
else:
    print("  -> WARNING: Could not find mini radar click handler")

# Fix 2: Full zone map click - use rect.width/height instead of fullSize
old_full = '''    const handleFullClick = (e: React.MouseEvent<SVGSVGElement>) => {
      const rect = e.currentTarget.getBoundingClientRect();
      const cx = e.clientX - rect.left;
      const cy = e.clientY - rect.top;
      const wx = (cx - fullSize / 2) / fullScale;
      const wy = (cy - fullSize / 2) / fullScale;
      state.cameraTarget = { x: wx, y: wy };
      bump();
    };'''

new_full = '''    const handleFullClick = (e: React.MouseEvent<SVGSVGElement>) => {
      const rect = e.currentTarget.getBoundingClientRect();
      const rx = (e.clientX - rect.left) / rect.width;
      const ry = (e.clientY - rect.top) / rect.height;
      const wx = (rx - 0.5) * zoneRadius * 2.2;
      const wy = (ry - 0.5) * zoneRadius * 2.2;
      state.cameraTarget = { x: wx, y: wy };
      bump();
    };'''

if old_full in code:
    code = code.replace(old_full, new_full)
    print("  -> Fixed full map click (normalized coords)")
else:
    print("  -> WARNING: Could not find full map click handler")

with open('frontend/src/components/MiniMap.tsx', 'w') as f:
    f.write(code)

print("\nDONE!")
print("Both click handlers now normalize against actual rendered dimensions")
print("instead of hardcoded SIZE/fullSize values")
