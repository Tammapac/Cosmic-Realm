#!/usr/bin/env python3
"""Fix minimap click navigation + station-specific goods."""

# ══════════════════════════════════════════════════════════════════════════════
# 1. Fix minimap/map click using e.currentTarget instead of e.target
# ══════════════════════════════════════════════════════════════════════════════
print("═══ Fixing minimap click coordinates ═══")

with open('frontend/src/components/MiniMap.tsx', 'r') as f:
    code = f.read()

# Fix mini radar click
old_mini = '''  const handleClick = (e: React.MouseEvent<SVGSVGElement>) => {
    if (state.dockedAt) return;
    const rect = (e.target as SVGSVGElement).getBoundingClientRect();'''

new_mini = '''  const handleClick = (e: React.MouseEvent<SVGSVGElement>) => {
    if (state.dockedAt) return;
    const rect = e.currentTarget.getBoundingClientRect();'''

if old_mini in code:
    code = code.replace(old_mini, new_mini)
    print("  -> Fixed mini radar click (e.currentTarget)")
else:
    print("  -> WARNING: Could not find mini radar click handler")

# Fix full zone map click
old_full = '''    const handleFullClick = (e: React.MouseEvent<SVGSVGElement>) => {
      const rect = (e.target as SVGSVGElement).getBoundingClientRect();'''

new_full = '''    const handleFullClick = (e: React.MouseEvent<SVGSVGElement>) => {
      const rect = e.currentTarget.getBoundingClientRect();'''

if old_full in code:
    code = code.replace(old_full, new_full)
    print("  -> Fixed full map click (e.currentTarget)")
else:
    print("  -> WARNING: Could not find full map click handler")

with open('frontend/src/components/MiniMap.tsx', 'w') as f:
    f.write(code)

# ══════════════════════════════════════════════════════════════════════════════
# 2. Make stations only show goods they trade in
# ══════════════════════════════════════════════════════════════════════════════
print("\n═══ Making stations show only their goods ═══")

with open('frontend/src/components/Hangar.tsx', 'r') as f:
    hcode = f.read()

# Currently: const allRes = Object.values(RESOURCES);
# Change to: filter to only resources this station has price modifiers for
old_allres = '  const allRes = Object.values(RESOURCES);'
new_allres = '''  // Show resources this station trades + any the player is carrying
  const stationResIds = new Set(Object.keys(station.prices));
  const cargoResIds = new Set(player.cargo.map(c => c.resourceId));
  const allRes = Object.values(RESOURCES).filter(
    r => stationResIds.has(r.id) || cargoResIds.has(r.id)
  );'''

if old_allres in hcode:
    hcode = hcode.replace(old_allres, new_allres)
    print("  -> Stations now only show goods they trade in (+ player cargo)")
else:
    print("  -> WARNING: Could not find allRes line")

with open('frontend/src/components/Hangar.tsx', 'w') as f:
    f.write(hcode)

print("\nDONE!")
print("1. Minimap/map click now navigates to exact clicked position")
print("2. Each station only shows resources it has price modifiers for")
print("   (plus any resources the player is currently carrying)")
