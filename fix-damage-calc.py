#!/usr/bin/env python3
"""Fix scatter/rail damage to clearly outperform standard weapons."""

# ── FIX 1: Boost scatter multiplier and tighten spread ──
print("FIX 1: Boosting scatter/rail damage multipliers...")
with open('frontend/src/game/loop.ts', 'r') as f:
    lc = f.read()

# Scatter: 1.3x -> 1.6x total (big reward for close range)
lc = lc.replace(
    "const perPellet = Math.round(laserDmg * 1.3 / pellets);",
    "const perPellet = Math.round(laserDmg * 1.6 / pellets);"
)

# Tighten scatter spread from 0.22 to 0.13 so more pellets actually hit
lc = lc.replace(
    "const spread = 0.22;",
    "const spread = 0.13;"
)

# Rail: 1.15x -> 1.3x total
lc = lc.replace(
    "const perBurst = Math.round(laserDmg * 1.15 / 3);",
    "const perBurst = Math.round(laserDmg * 1.3 / 3);"
)
print("  -> Scatter 1.3x -> 1.6x, spread 0.22 -> 0.13 rad")
print("  -> Rail 1.15x -> 1.3x")

with open('frontend/src/game/loop.ts', 'w') as f:
    f.write(lc)

# Same on server
with open('backend/src/game/engine.ts', 'r') as f:
    ec = f.read()

ec = ec.replace(
    "const perPellet = Math.round(laserDmg * 1.3 / pellets);",
    "const perPellet = Math.round(laserDmg * 1.6 / pellets);"
)
ec = ec.replace(
    "const spread = 0.22;",
    "const spread = 0.13;"
)
ec = ec.replace(
    "const perBurst = Math.round(laserDmg * 1.15 / 3);",
    "const perBurst = Math.round(laserDmg * 1.3 / 3);"
)
print("  -> Server multipliers updated to match")

with open('backend/src/game/engine.ts', 'w') as f:
    f.write(ec)

# ── FIX 2: Significantly boost scatter/rail base weapon damage ──
print("\nFIX 2: Boosting scatter/rail weapon base damage stats...")
with open('frontend/src/game/types.ts', 'r') as f:
    tc = f.read()

# Each replacement: find the weapon line and swap damage value
replacements = [
    # Scatter - should have notably higher base damage than same-tier pulse
    ('"wp-scatter-0"', 'damage: 7', 'damage: 10'),
    ('"wp-scatter"', 'damage: 12', 'damage: 18'),
    ('"wp-scatter-2"', 'damage: 20', 'damage: 28'),
    ('"wp-scatter-3"', 'damage: 30', 'damage: 40'),
    # Rail - somewhat higher than pulse
    ('"wp-rail-0"', 'damage: 7', 'damage: 9'),
    ('"wp-rail-1"', 'damage: 13', 'damage: 17'),
    ('"wp-rail-2"', 'damage: 20', 'damage: 25'),
    ('"wp-rail-3"', 'damage: 34', 'damage: 42'),
]

for weapon_id, old_dmg, new_dmg in replacements:
    idx = tc.find(weapon_id)
    if idx >= 0:
        line_end = tc.find('\n', idx)
        line = tc[idx:line_end]
        if old_dmg in line:
            new_line = line.replace(old_dmg, new_dmg)
            tc = tc[:idx] + new_line + tc[line_end:]

print("  -> Scatter: 10/18/28/40 (was 7/12/20/30)")
print("  -> Rail: 9/17/25/42 (was 7/13/20/34)")

with open('frontend/src/game/types.ts', 'w') as f:
    f.write(tc)

print("\nDone! Scatter now deals 1.6x total with tighter spread, rail deals 1.3x total.")
print("Combined with higher base damage, 2 scatter weapons will clearly outdamage 1 pulse.")
