#!/usr/bin/env python3
"""Sync backend data.ts with frontend weapon definitions."""

with open('backend/src/game/data.ts', 'r') as f:
    dc = f.read()

# 1. Add firingPattern to the type definition
dc = dc.replace(
    "  weaponKind?: WeaponKind;\n}> = {",
    "  weaponKind?: WeaponKind;\n  firingPattern?: \"standard\" | \"sniper\" | \"scatter\" | \"rail\";\n}> = {"
)
print("Added firingPattern to MODULE_DEFS type")

# 2. Add firingPattern to existing weapons + update damage values
# Sniper pattern weapons
dc = dc.replace(
    '"wp-ion":        { id: "wp-ion",        slot: "weapon", weaponKind: "laser",  tier: 2, price: 34000,   stats: { damage: 16, fireRate: 0.95 } },',
    '"wp-ion":        { id: "wp-ion",        slot: "weapon", weaponKind: "laser",  firingPattern: "sniper", tier: 2, price: 34000,   stats: { damage: 16, fireRate: 0.95 } },'
)
dc = dc.replace(
    '"wp-sniper":     { id: "wp-sniper",     slot: "weapon", weaponKind: "laser",  tier: 4, price: 180000,  stats: { damage: 48, fireRate: 0.45, critChance: 0.18 } },',
    '"wp-sniper":     { id: "wp-sniper",     slot: "weapon", weaponKind: "laser",  firingPattern: "sniper", tier: 4, price: 180000,  stats: { damage: 48, fireRate: 0.45, critChance: 0.18 } },'
)

# Scatter pattern weapons + damage boost
dc = dc.replace(
    '"wp-scatter":    { id: "wp-scatter",    slot: "weapon", weaponKind: "laser",  tier: 2, price: 38000,   stats: { damage: 9,  fireRate: 1.4, aoeRadius: 8 } },',
    '"wp-scatter":    { id: "wp-scatter",    slot: "weapon", weaponKind: "laser",  firingPattern: "scatter", tier: 2, price: 38000,   stats: { damage: 18, fireRate: 1.4, aoeRadius: 8 } },'
)

# Rail pattern weapons
dc = dc.replace(
    '"wp-phase":      { id: "wp-phase",      slot: "weapon", weaponKind: "laser",  tier: 3, price: 90000,   stats: { damage: 14, fireRate: 1.5, critChance: 0.08 } },',
    '"wp-phase":      { id: "wp-phase",      slot: "weapon", weaponKind: "laser",  firingPattern: "rail", tier: 3, price: 90000,   stats: { damage: 14, fireRate: 1.5, critChance: 0.08 } },'
)
dc = dc.replace(
    '"wp-arc":        { id: "wp-arc",        slot: "weapon", weaponKind: "laser",  tier: 3, price: 110000,  stats: { damage: 18, fireRate: 1.1, aoeRadius: 14, critChance: 0.05 } },',
    '"wp-arc":        { id: "wp-arc",        slot: "weapon", weaponKind: "laser",  firingPattern: "rail", tier: 3, price: 110000,  stats: { damage: 18, fireRate: 1.1, aoeRadius: 14, critChance: 0.05 } },'
)
print("Tagged existing weapons with firingPattern")

# 3. Add ALL new weapons that are missing from backend
new_weapons = '''
  // ── NEW TIERED WEAPONS ──
  "wp-sniper-0":   { id: "wp-sniper-0",   slot: "weapon", weaponKind: "laser",  firingPattern: "sniper",  tier: 1, price: 4000,    stats: { damage: 8,  fireRate: 0.6 } },
  "wp-scatter-0":  { id: "wp-scatter-0",  slot: "weapon", weaponKind: "laser",  firingPattern: "scatter", tier: 1, price: 4500,    stats: { damage: 10, fireRate: 1.1, aoeRadius: 6 } },
  "wp-rail-0":     { id: "wp-rail-0",     slot: "weapon", weaponKind: "laser",  firingPattern: "rail",    tier: 1, price: 4200,    stats: { damage: 9,  fireRate: 0.95 } },
  "wp-sniper-1":   { id: "wp-sniper-1",   slot: "weapon", weaponKind: "laser",  firingPattern: "sniper",  tier: 2, price: 32000,   stats: { damage: 18, fireRate: 0.55, critChance: 0.08 } },
  "wp-sniper-2":   { id: "wp-sniper-2",   slot: "weapon", weaponKind: "laser",  firingPattern: "sniper",  tier: 3, price: 95000,   stats: { damage: 32, fireRate: 0.5, critChance: 0.12 } },
  "wp-scatter-2":  { id: "wp-scatter-2",  slot: "weapon", weaponKind: "laser",  firingPattern: "scatter", tier: 3, price: 82000,   stats: { damage: 28, fireRate: 1.2, aoeRadius: 10 } },
  "wp-scatter-3":  { id: "wp-scatter-3",  slot: "weapon", weaponKind: "laser",  firingPattern: "scatter", tier: 4, price: 200000,  stats: { damage: 40, fireRate: 1.1, aoeRadius: 14, critChance: 0.06 } },
  "wp-rail-1":     { id: "wp-rail-1",     slot: "weapon", weaponKind: "laser",  firingPattern: "rail",    tier: 2, price: 35000,   stats: { damage: 17, fireRate: 0.9 } },
  "wp-rail-2":     { id: "wp-rail-2",     slot: "weapon", weaponKind: "laser",  firingPattern: "rail",    tier: 3, price: 88000,   stats: { damage: 25, fireRate: 0.85, critChance: 0.04 } },
  "wp-rail-3":     { id: "wp-rail-3",     slot: "weapon", weaponKind: "laser",  firingPattern: "rail",    tier: 4, price: 220000,  stats: { damage: 42, fireRate: 0.8, critChance: 0.08 } },
'''

# Insert before rocket weapons
dc = dc.replace(
    '  // ── ROCKET WEAPONS',
    new_weapons + '\n  // ── ROCKET WEAPONS'
)
print("Added all new tiered weapons to backend")

with open('backend/src/game/data.ts', 'w') as f:
    f.write(dc)

print("\nBackend MODULE_DEFS now matches frontend!")
print("Server will now correctly use scatter/sniper/rail patterns.")
