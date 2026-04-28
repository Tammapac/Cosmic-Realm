#!/usr/bin/env python3
"""Batch 2 Item 6: Mining improvements - mining lasers, asteroid belts, miningBonus stat."""

import re

# ══════════════════════════════════════════════════════════════════════════════
# 1. Add miningBonus to ModuleStats type (frontend types.ts)
# ══════════════════════════════════════════════════════════════════════════════
print("═══ Adding miningBonus stat ═══")

with open('frontend/src/game/types.ts', 'r') as f:
    code = f.read()

# Add miningBonus to ModuleStats
old_stats = '  ammoCapacity?: number;    // additive bonus to max ammo per rocket weapon\n};'
new_stats = '  ammoCapacity?: number;    // additive bonus to max ammo per rocket weapon\n  miningBonus?: number;     // multiplier bonus to mining DPS (0.5 = +50%)\n};'
if 'miningBonus' not in code:
    if old_stats in code:
        code = code.replace(old_stats, new_stats)
        print("  -> Added miningBonus to ModuleStats")
    else:
        print("  -> WARNING: Could not find ModuleStats closing")

# Add firingPattern to ModuleDef type if not present
if "firingPattern?: string;" not in code:
    old_moddef = '  weaponKind?: WeaponKind; // only for weapon slot modules\n};'
    new_moddef = '  weaponKind?: WeaponKind; // only for weapon slot modules\n  firingPattern?: string;\n};'
    # Find in the ModuleDef type definition (first occurrence)
    idx = code.find('export type ModuleDef = {')
    if idx >= 0:
        # Find the closing }; for ModuleDef
        end_idx = code.index('};', code.index('weaponKind?: WeaponKind', idx))
        block = code[idx:end_idx+2]
        if 'firingPattern' not in block:
            code = code[:end_idx] + '  firingPattern?: string;\n' + code[end_idx:]
            print("  -> Added firingPattern to ModuleDef type")

# Add mining laser MODULE_DEFS
mining_lasers = '''
  // ── Mining Lasers ──
  "wp-mining-1": { id: "wp-mining-1", slot: "weapon", weaponKind: "laser", firingPattern: "mining", name: "Mining Laser Mk-I",    description: "Basic mining beam. Doubles asteroid mining speed.",                rarity: "common",    color: "#e8a050", glyph: "⛏", tier: 1, price: 2000,   stats: { damage: 3,  fireRate: 1.0, miningBonus: 1.0 } },
  "wp-mining-2": { id: "wp-mining-2", slot: "weapon", weaponKind: "laser", firingPattern: "mining", name: "Mining Laser Mk-II",   description: "Improved mining beam with focused ore extraction.",                rarity: "uncommon",  color: "#ffcc44", glyph: "⛏", tier: 2, price: 15000,  stats: { damage: 5,  fireRate: 1.0, miningBonus: 2.0 } },
  "wp-mining-3": { id: "wp-mining-3", slot: "weapon", weaponKind: "laser", firingPattern: "mining", name: "Deep Core Drill",      description: "Industrial-grade mining beam. Chews through asteroids.",           rarity: "rare",      color: "#44ddff", glyph: "⛏", tier: 3, price: 50000,  stats: { damage: 8,  fireRate: 1.0, miningBonus: 3.5 } },
  "wp-mining-4": { id: "wp-mining-4", slot: "weapon", weaponKind: "laser", firingPattern: "mining", name: "Plasma Core Extractor", description: "Top-tier mining beam. Extracts ore at incredible speed.",           rarity: "epic",      color: "#ff8844", glyph: "⛏", tier: 4, price: 120000, stats: { damage: 12, fireRate: 1.0, miningBonus: 5.0 } },
'''

# Insert mining lasers before the closing of MODULE_DEFS
# Find the last entry before the closing };
if 'wp-mining-1' not in code:
    # Find MODULE_DEFS closing
    mod_defs_start = code.find('export const MODULE_DEFS')
    if mod_defs_start >= 0:
        # Find the }; that closes MODULE_DEFS
        # We need to be careful - find the right closing brace
        # Look for the last weapon entry and add after it
        last_weapon_idx = code.rfind('"wp-')
        if last_weapon_idx >= 0:
            # Find the end of that line (},)
            line_end = code.index('\n', last_weapon_idx)
            code = code[:line_end+1] + mining_lasers + code[line_end+1:]
            print("  -> Added 4 mining laser MODULE_DEFS")

# Add ASTEROID_BELTS - dense asteroid regions per zone
asteroid_belts = '''
// ── ASTEROID BELTS: dense mining regions per zone ─────────────────────────
export const ASTEROID_BELTS: Record<ZoneId, { cx: number; cy: number; rx: number; ry: number }[]> = {
  alpha:    [{ cx: -3000, cy: 1500, rx: 2000, ry: 800 }, { cx: 2500, cy: -2000, rx: 1500, ry: 1000 }],
  nebula:   [{ cx: 0, cy: 3500, rx: 2500, ry: 600 }, { cx: -3000, cy: -2000, rx: 1800, ry: 900 }],
  crimson:  [{ cx: 3500, cy: 0, rx: 800, ry: 2500 }, { cx: -2500, cy: 3000, rx: 1500, ry: 700 }],
  void:     [{ cx: -2000, cy: -3000, rx: 2200, ry: 700 }, { cx: 3000, cy: 2000, rx: 1200, ry: 1500 }],
  forge:    [{ cx: 0, cy: -3500, rx: 3000, ry: 600 }, { cx: -3500, cy: 1500, rx: 1000, ry: 2000 }],
  corona:   [{ cx: 3000, cy: -1500, rx: 2000, ry: 900 }, { cx: -2000, cy: 3500, rx: 1800, ry: 600 }],
  fracture: [{ cx: -3500, cy: -1000, rx: 1500, ry: 2000 }, { cx: 2500, cy: 2500, rx: 2000, ry: 800 }],
  abyss:    [{ cx: 0, cy: 0, rx: 3000, ry: 1000 }],
  marsdepth:[{ cx: -2500, cy: 2500, rx: 2000, ry: 900 }, { cx: 3000, cy: -1500, rx: 1500, ry: 1200 }],
  maelstrom:[{ cx: 2000, cy: 3000, rx: 1800, ry: 700 }, { cx: -3000, cy: -2500, rx: 1200, ry: 1800 }],
  venus1:   [{ cx: -2500, cy: -1500, rx: 2000, ry: 800 }, { cx: 3000, cy: 2000, rx: 1500, ry: 1000 }],
  venus2:   [{ cx: 0, cy: -3500, rx: 2500, ry: 700 }, { cx: -3500, cy: 1000, rx: 1200, ry: 1800 }],
  venus3:   [{ cx: 3500, cy: 1500, rx: 900, ry: 2500 }, { cx: -2000, cy: -3000, rx: 2000, ry: 600 }],
  venus4:   [{ cx: -3000, cy: 0, rx: 800, ry: 3000 }, { cx: 2500, cy: -2500, rx: 1800, ry: 800 }],
  venus5:   [{ cx: 0, cy: 3000, rx: 3000, ry: 800 }, { cx: -2500, cy: -2000, rx: 1500, ry: 1500 }],
  danger1:  [{ cx: 2000, cy: -2000, rx: 1500, ry: 1500 }],
  danger2:  [{ cx: -2500, cy: 2500, rx: 1800, ry: 800 }],
  danger3:  [{ cx: 3000, cy: 0, rx: 800, ry: 2000 }],
  danger4:  [{ cx: 0, cy: -3000, rx: 2000, ry: 700 }],
  danger5:  [{ cx: -2000, cy: 2000, rx: 1200, ry: 1200 }],
};
'''

if 'ASTEROID_BELTS' not in code:
    # Insert before STATIONS
    stations_idx = code.find('export const STATIONS:')
    if stations_idx >= 0:
        code = code[:stations_idx] + asteroid_belts + '\n' + code[stations_idx:]
        print("  -> Added ASTEROID_BELTS definitions for all 20 zones")

with open('frontend/src/game/types.ts', 'w') as f:
    f.write(code)

# ══════════════════════════════════════════════════════════════════════════════
# 2. Update makeAsteroids in store.ts to use asteroid belts
# ══════════════════════════════════════════════════════════════════════════════
print("\n═══ Updating makeAsteroids for asteroid belts ═══")

with open('frontend/src/game/store.ts', 'r') as f:
    scode = f.read()

# Add ASTEROID_BELTS to imports
if 'ASTEROID_BELTS' not in scode:
    old_import = 'pickAsteroidYield,'
    new_import = 'pickAsteroidYield, ASTEROID_BELTS,'
    if old_import in scode:
        scode = scode.replace(old_import, new_import, 1)
        print("  -> Added ASTEROID_BELTS import")

# Replace makeAsteroids to spawn belt asteroids
old_make = '''function makeAsteroids(zone: ZoneId): Asteroid[] {
  const countMap: Partial<Record<ZoneId, number>> = {
    alpha: 80, nebula: 70, crimson: 60, void: 50, forge: 40,
    corona: 80, fracture: 70, abyss: 60, marsdepth: 50, maelstrom: 40,
    venus1: 80, venus2: 70, venus3: 60, venus4: 50, venus5: 40,
    danger1: 30, danger2: 30, danger3: 30, danger4: 25, danger5: 20,
  };
  const count = countMap[zone] ?? 20;
  const out: Asteroid[] = [];
  const mapR = MAP_RADIUS * 0.8;
  for (let i = 0; i < count; i++) {
    const x = (Math.random() - 0.5) * 2 * mapR;
    const y = (Math.random() - 0.5) * 2 * mapR;
    const size = 14 + Math.random() * 22;
    out.push({
      id: `ast-${i}-${Math.random().toString(36).slice(2, 6)}`,
      pos: { x, y },
      hp: size * 4,
      hpMax: size * 4,
      size,
      rotation: Math.random() * Math.PI * 2,
      rotSpeed: (Math.random() - 0.5) * 0.4,
      zone,
      yields: pickAsteroidYield(zone),
    });
  }
  return out;
}'''

new_make = '''function makeAsteroids(zone: ZoneId): Asteroid[] {
  const countMap: Partial<Record<ZoneId, number>> = {
    alpha: 100, nebula: 90, crimson: 80, void: 70, forge: 60,
    corona: 100, fracture: 90, abyss: 80, marsdepth: 70, maelstrom: 60,
    venus1: 100, venus2: 90, venus3: 80, venus4: 70, venus5: 60,
    danger1: 45, danger2: 45, danger3: 45, danger4: 40, danger5: 35,
  };
  const count = countMap[zone] ?? 30;
  const out: Asteroid[] = [];
  const mapR = MAP_RADIUS * 0.8;
  const belts = ASTEROID_BELTS[zone] ?? [];
  const beltCount = Math.floor(count * 0.4);
  const scatterCount = count - beltCount;
  for (let i = 0; i < scatterCount; i++) {
    const x = (Math.random() - 0.5) * 2 * mapR;
    const y = (Math.random() - 0.5) * 2 * mapR;
    const size = 14 + Math.random() * 22;
    out.push({
      id: `ast-${i}-${Math.random().toString(36).slice(2, 6)}`,
      pos: { x, y },
      hp: size * 4,
      hpMax: size * 4,
      size,
      rotation: Math.random() * Math.PI * 2,
      rotSpeed: (Math.random() - 0.5) * 0.4,
      zone,
      yields: pickAsteroidYield(zone),
    });
  }
  for (let i = 0; i < beltCount; i++) {
    const belt = belts[i % belts.length];
    const angle = Math.random() * Math.PI * 2;
    const r1 = Math.random();
    const r2 = Math.random();
    const x = belt.cx + Math.cos(angle) * belt.rx * r1;
    const y = belt.cy + Math.sin(angle) * belt.ry * r2;
    const size = 16 + Math.random() * 26;
    out.push({
      id: `ast-b${i}-${Math.random().toString(36).slice(2, 6)}`,
      pos: { x, y },
      hp: size * 4,
      hpMax: size * 4,
      size,
      rotation: Math.random() * Math.PI * 2,
      rotSpeed: (Math.random() - 0.5) * 0.3,
      zone,
      yields: pickAsteroidYield(zone),
    });
  }
  return out;
}'''

if old_make in scode:
    scode = scode.replace(old_make, new_make)
    print("  -> Updated makeAsteroids with asteroid belt spawning (+25% more asteroids)")
else:
    print("  -> WARNING: Could not find makeAsteroids function")

with open('frontend/src/game/store.ts', 'w') as f:
    f.write(scode)

# ══════════════════════════════════════════════════════════════════════════════
# 3. Update mining DPS to use miningBonus in loop.ts
# ══════════════════════════════════════════════════════════════════════════════
print("\n═══ Updating mining DPS calculation ═══")

with open('frontend/src/game/loop.ts', 'r') as f:
    lcode = f.read()

# Add miningBonus to sumEquippedStats accumulator
old_acc = '''  const acc: Required<ModuleStats> = {
    damage: 0, fireRate: 1, critChance: 0, shieldMax: 0, shieldRegen: 0,
    hullMax: 0, speed: 0, damageReduction: 0, shieldAbsorb: 0, cargoBonus: 0, lootBonus: 0, aoeRadius: 0,
    ammoCapacity: 0,
  };'''

new_acc = '''  const acc: Required<ModuleStats> = {
    damage: 0, fireRate: 1, critChance: 0, shieldMax: 0, shieldRegen: 0,
    hullMax: 0, speed: 0, damageReduction: 0, shieldAbsorb: 0, cargoBonus: 0, lootBonus: 0, aoeRadius: 0,
    ammoCapacity: 0, miningBonus: 0,
  };'''

if 'miningBonus: 0' not in lcode:
    if old_acc in lcode:
        lcode = lcode.replace(old_acc, new_acc)
        print("  -> Added miningBonus to stat accumulator")

# Add miningBonus aggregation in the weapon loop
# After weaponAoe line, we need to add miningBonus accumulation
old_weapon_aoe = '    weaponAoe = Math.max(weaponAoe, def.stats.aoeRadius ?? 0);'
new_weapon_aoe = '''    weaponAoe = Math.max(weaponAoe, def.stats.aoeRadius ?? 0);
    acc.miningBonus += def.stats.miningBonus ?? 0;'''

if 'miningBonus' not in lcode.split('weaponAoe')[0] + lcode.split('weaponAoe')[1][:200] if 'weaponAoe' in lcode else '':
    if old_weapon_aoe in lcode:
        lcode = lcode.replace(old_weapon_aoe, new_weapon_aoe, 1)
        print("  -> Added miningBonus accumulation in weapon loop")

# Also add miningBonus aggregation in the generator/module loop
old_ammo_cap = '    acc.aoeRadius       = Math.max(acc.aoeRadius, s.aoeRadius ?? 0);\n  }'
new_ammo_cap = '    acc.aoeRadius       = Math.max(acc.aoeRadius, s.aoeRadius ?? 0);\n    acc.miningBonus     += s.miningBonus ?? 0;\n  }'

if old_ammo_cap in lcode and lcode.count('acc.miningBonus') < 2:
    lcode = lcode.replace(old_ammo_cap, new_ammo_cap, 1)
    print("  -> Added miningBonus aggregation in module loop")

# Update effectiveStats return type to include miningBonus
old_return_type = '''export function effectiveStats(): {
  damage: number; speed: number; hullMax: number; shieldMax: number;
  fireRate: number; critChance: number; aoeRadius: number; damageReduction: number; shieldAbsorb: number; shieldRegen: number; lootBonus: number;
}'''

new_return_type = '''export function effectiveStats(): {
  damage: number; speed: number; hullMax: number; shieldMax: number;
  fireRate: number; critChance: number; aoeRadius: number; damageReduction: number; shieldAbsorb: number; shieldRegen: number; lootBonus: number; miningBonus: number;
}'''

if old_return_type in lcode:
    lcode = lcode.replace(old_return_type, new_return_type)
    print("  -> Updated effectiveStats return type")

# Add miningBonus to the return object of effectiveStats
# Find the return statement in effectiveStats
old_return = '    lootBonus: lootB,'
if old_return in lcode:
    lcode = lcode.replace(old_return, '    lootBonus: lootB,\n    miningBonus: mod.miningBonus ?? 0,')
    print("  -> Added miningBonus to effectiveStats return")
else:
    # Try alternative
    old_ret2 = 'lootBonus: lootB'
    # Find the return in effectiveStats context
    es_idx = lcode.find('export function effectiveStats')
    if es_idx >= 0:
        ret_idx = lcode.find('return {', es_idx)
        if ret_idx >= 0:
            ret_end = lcode.find('};', ret_idx)
            ret_block = lcode[ret_idx:ret_end+2]
            if 'miningBonus' not in ret_block and 'lootBonus' in ret_block:
                lb_idx = ret_block.rfind('lootBonus')
                line_end = ret_block.index('\n', lb_idx) if '\n' in ret_block[lb_idx:] else ret_block.index(',', lb_idx)
                # Insert after lootBonus line
                insert_pos = ret_idx + ret_block.index(',', lb_idx) + 1
                lcode = lcode[:insert_pos] + '\n    miningBonus: mod.miningBonus ?? 0,' + lcode[insert_pos:]
                print("  -> Added miningBonus to effectiveStats return (alt)")

# Update mining DPS calculation to use miningBonus
old_mining_dps = '        const miningDps = stats.damage * 0.25;'
new_mining_dps = '        const miningDps = stats.damage * 0.25 * (1 + (stats.miningBonus ?? 0));'

if old_mining_dps in lcode:
    lcode = lcode.replace(old_mining_dps, new_mining_dps)
    print("  -> Updated mining DPS to use miningBonus multiplier")

with open('frontend/src/game/loop.ts', 'w') as f:
    f.write(lcode)

# ══════════════════════════════════════════════════════════════════════════════
# 4. Update backend data.ts with mining lasers + miningBonus
# ══════════════════════════════════════════════════════════════════════════════
print("\n═══ Updating backend ═══")

with open('backend/src/game/data.ts', 'r') as f:
    bcode = f.read()

# Add miningBonus to ModuleStats type
if 'miningBonus' not in bcode:
    old_bstats = '  ammoCapacity?: number;'
    new_bstats = '  ammoCapacity?: number;\n  miningBonus?: number;'
    if old_bstats in bcode:
        bcode = bcode.replace(old_bstats, new_bstats, 1)
        print("  -> Added miningBonus to backend ModuleStats")

# Add mining laser MODULE_DEFS to backend
backend_mining_lasers = '''
  // Mining Lasers
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
# 5. Update backend engine.ts mining DPS to use miningBonus
# ══════════════════════════════════════════════════════════════════════════════
print("\n═══ Updating backend mining DPS ═══")

with open('backend/src/game/engine.ts', 'r') as f:
    ecode = f.read()

# Check current mining DPS line
old_be_mining = 'const miningDps = stats.damage * MINING_DPS_FACTOR;'
new_be_mining = 'const miningDps = stats.damage * MINING_DPS_FACTOR * (1 + (stats.miningBonus ?? 0));'

if old_be_mining in ecode:
    ecode = ecode.replace(old_be_mining, new_be_mining)
    print("  -> Updated backend mining DPS to use miningBonus")

# Add miningBonus to backend stats computation
# Find where stats are computed for players
if 'miningBonus' not in ecode:
    # Find computePlayerStats or similar
    idx = ecode.find('ammoCapacity')
    if idx >= 0:
        # Add miningBonus wherever ammoCapacity is accumulated
        ecode = ecode.replace(
            'ammoCapacity: 0,',
            'ammoCapacity: 0, miningBonus: 0,',
            1
        )
        # Also add accumulation
        old_ammo_accum = 'stats.ammoCapacity += s.ammoCapacity ?? 0;'
        if old_ammo_accum in ecode:
            ecode = ecode.replace(
                old_ammo_accum,
                old_ammo_accum + '\n        stats.miningBonus += s.miningBonus ?? 0;',
                1
            )
        # Also check weapon loop
        old_wep_ammo = 'weaponAmmo += def.stats.ammoCapacity ?? 0;'
        if old_wep_ammo in ecode:
            ecode = ecode.replace(
                old_wep_ammo,
                old_wep_ammo + '\n        stats.miningBonus += def.stats.miningBonus ?? 0;'
            )
        print("  -> Added miningBonus to backend stats computation")

with open('backend/src/game/engine.ts', 'w') as f:
    f.write(ecode)

# ══════════════════════════════════════════════════════════════════════════════
# 6. Add asteroid belt markers to minimap
# ══════════════════════════════════════════════════════════════════════════════
print("\n═══ Adding asteroid belt markers to full map ═══")

with open('frontend/src/components/MiniMap.tsx', 'r') as f:
    mcode = f.read()

# Add ASTEROID_BELTS import
if 'ASTEROID_BELTS' not in mcode:
    old_mm_import = 'RESOURCES, }'
    new_mm_import = 'RESOURCES, ASTEROID_BELTS, }'
    if old_mm_import in mcode:
        mcode = mcode.replace(old_mm_import, new_mm_import, 1)
    else:
        # Try without space
        old_mm_import2 = 'RESOURCES,}'
        if old_mm_import2 in mcode:
            mcode = mcode.replace(old_mm_import2, 'RESOURCES, ASTEROID_BELTS,}', 1)
    print("  -> Added ASTEROID_BELTS import to MiniMap")

# Add belt ellipses to the full zone map SVG, right after the dashed circle
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

if old_dash in mcode and 'ASTEROID_BELTS[player.zone]' not in mcode:
    mcode = mcode.replace(old_dash, belt_svg)
    print("  -> Added asteroid belt ellipses to full zone map")

with open('frontend/src/components/MiniMap.tsx', 'w') as f:
    f.write(mcode)

print("\n" + "=" * 60)
print("DONE! Mining improvements deployed")
print("=" * 60)
print("\n1. Mining Laser Mk-I through Mk-IV (2k-120k credits)")
print("   - Mk-I: +100% mining speed, Mk-IV: +500% mining speed")
print("   - Low combat damage but massive mining bonus")
print("2. Asteroid belts - dense mining regions in every zone")
print("   - 40% of asteroids spawn in belt areas")
print("   - Belts visible on full zone map as dashed ellipses")
print("3. +25% more asteroids overall across all zones")
print("4. Mining DPS now scales with miningBonus from equipment")
