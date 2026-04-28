#!/usr/bin/env python3
"""Fix remaining items from batch2-mining.py that didn't apply due to crash."""

import re

# ══════════════════════════════════════════════════════════════════════════════
# 1. Add mining lasers to backend data.ts
# ══════════════════════════════════════════════════════════════════════════════
print("═══ Adding mining lasers to backend ═══")

with open('backend/src/game/data.ts', 'r') as f:
    bcode = f.read()

# Add miningBonus to ModuleStats type
if 'miningBonus' not in bcode:
    old_bstats = '  ammoCapacity?: number;'
    new_bstats = '  ammoCapacity?: number;\n  miningBonus?: number;'
    if old_bstats in bcode:
        bcode = bcode.replace(old_bstats, new_bstats, 1)
        print("  -> Added miningBonus to backend ModuleStats")

backend_mining_lasers = '''  // Mining Lasers
  "wp-mining-1": { id: "wp-mining-1", slot: "weapon", weaponKind: "laser", firingPattern: "mining", name: "Mining Laser Mk-I",    description: "Basic mining beam.", rarity: "common",   color: "#e8a050", glyph: "M", tier: 1, price: 2000,   stats: { damage: 3,  fireRate: 1.0, miningBonus: 1.0 } },
  "wp-mining-2": { id: "wp-mining-2", slot: "weapon", weaponKind: "laser", firingPattern: "mining", name: "Mining Laser Mk-II",   description: "Improved mining beam.", rarity: "uncommon", color: "#ffcc44", glyph: "M", tier: 2, price: 15000,  stats: { damage: 5,  fireRate: 1.0, miningBonus: 2.0 } },
  "wp-mining-3": { id: "wp-mining-3", slot: "weapon", weaponKind: "laser", firingPattern: "mining", name: "Deep Core Drill",      description: "Industrial mining beam.", rarity: "rare",    color: "#44ddff", glyph: "M", tier: 3, price: 50000,  stats: { damage: 8,  fireRate: 1.0, miningBonus: 3.5 } },
  "wp-mining-4": { id: "wp-mining-4", slot: "weapon", weaponKind: "laser", firingPattern: "mining", name: "Plasma Core Extractor", description: "Top-tier mining beam.", rarity: "epic",     color: "#ff8844", glyph: "M", tier: 4, price: 120000, stats: { damage: 12, fireRate: 1.0, miningBonus: 5.0 } },
'''

if 'wp-mining-1' not in bcode:
    last_wp = bcode.rfind('"wp-')
    if last_wp >= 0:
        line_end = bcode.index('\n', last_wp)
        bcode = bcode[:line_end+1] + backend_mining_lasers + bcode[line_end+1:]
        print("  -> Added 4 mining laser MODULE_DEFS to backend")

with open('backend/src/game/data.ts', 'w') as f:
    f.write(bcode)

# ══════════════════════════════════════════════════════════════════════════════
# 2. Update backend engine.ts mining DPS + miningBonus stat computation
# ══════════════════════════════════════════════════════════════════════════════
print("\n═══ Updating backend engine.ts ═══")

with open('backend/src/game/engine.ts', 'r') as f:
    ecode = f.read()

# Fix mining DPS formulas to use miningBonus
ecode = ecode.replace(
    'const miningDps = stats.damage * MINING_DPS_FACTOR;',
    'const miningDps = stats.damage * MINING_DPS_FACTOR * (1 + (stats.miningBonus ?? 0));'
)
ecode = ecode.replace(
    'const miningDps = stats.damage * 0.25;',
    'const miningDps = stats.damage * 0.25 * (1 + (stats.miningBonus ?? 0));'
)
print("  -> Updated mining DPS formulas")

# Add miningBonus to stats initialization
if 'miningBonus: 0' not in ecode:
    ecode = ecode.replace(
        'ammoCapacity: 0,',
        'ammoCapacity: 0, miningBonus: 0,',
        1
    )
    print("  -> Added miningBonus to stats init")

# Add miningBonus accumulation
# In weapon stats aggregation
if 'stats.miningBonus' not in ecode:
    # Find weapon loop accumulator (near ammoCapacity or aoeRadius)
    # After weaponAmmo line
    old_wammo = 'weaponAmmo += def.stats.ammoCapacity ?? 0;'
    if old_wammo in ecode:
        ecode = ecode.replace(
            old_wammo,
            old_wammo + '\n        stats.miningBonus += def.stats.miningBonus ?? 0;'
        )
        print("  -> Added miningBonus accumulation in weapon loop")

    # Also in generator/module loop
    old_gammo = 'stats.ammoCapacity += s.ammoCapacity ?? 0;'
    if old_gammo in ecode:
        ecode = ecode.replace(
            old_gammo,
            old_gammo + '\n        stats.miningBonus += s.miningBonus ?? 0;',
            1
        )
        print("  -> Added miningBonus accumulation in module loop")

with open('backend/src/game/engine.ts', 'w') as f:
    f.write(ecode)

# ══════════════════════════════════════════════════════════════════════════════
# 3. Add asteroid belt markers to full zone map
# ══════════════════════════════════════════════════════════════════════════════
print("\n═══ Adding asteroid belt markers to minimap ═══")

with open('frontend/src/components/MiniMap.tsx', 'r') as f:
    mcode = f.read()

# Add ASTEROID_BELTS import
if 'ASTEROID_BELTS' not in mcode:
    old_import = 'RESOURCES, }'
    if old_import in mcode:
        mcode = mcode.replace(old_import, 'RESOURCES, ASTEROID_BELTS, }', 1)
        print("  -> Added ASTEROID_BELTS import")
    else:
        # Try comma-only
        old_import2 = 'RESOURCES,}'
        if old_import2 in mcode:
            mcode = mcode.replace(old_import2, 'RESOURCES, ASTEROID_BELTS,}', 1)
            print("  -> Added ASTEROID_BELTS import (alt)")
        else:
            # Try adding after last import item
            old_import3 = 'RESOURCES,'
            if old_import3 in mcode:
                mcode = mcode.replace('RESOURCES,', 'RESOURCES, ASTEROID_BELTS,', 1)
                print("  -> Added ASTEROID_BELTS import (v3)")

# Add belt ellipses to the full zone map SVG
old_dash = '            <circle cx={fullSize / 2} cy={fullSize / 2} r={zoneRadius * fullScale} fill="none" stroke="#1a234866" strokeDasharray="4 6" />'
belt_svg = '''            <circle cx={fullSize / 2} cy={fullSize / 2} r={zoneRadius * fullScale} fill="none" stroke="#1a234866" strokeDasharray="4 6" />

            {(ASTEROID_BELTS[player.zone] ?? []).map((belt, i) => (
              <ellipse key={`belt-${i}`}
                cx={fullSize / 2 + belt.cx * fullScale}
                cy={fullSize / 2 + belt.cy * fullScale}
                rx={belt.rx * fullScale}
                ry={belt.ry * fullScale}
                fill="#a8784a11" stroke="#a8784a33" strokeDasharray="3 5" strokeWidth={1}
              />
            ))}'''

if 'ASTEROID_BELTS[player.zone]' not in mcode:
    if old_dash in mcode:
        mcode = mcode.replace(old_dash, belt_svg)
        print("  -> Added asteroid belt ellipses to full zone map")
    else:
        print("  -> WARNING: Could not find dashed circle marker")

with open('frontend/src/components/MiniMap.tsx', 'w') as f:
    f.write(mcode)

print("\nDONE! All remaining fixes applied.")
