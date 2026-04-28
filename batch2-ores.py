#!/usr/bin/env python3
"""Batch 2 Part 1: Add new mineable ores + zone-specific asteroid yields."""

import re

# ══════════════════════════════════════════════════════════════════════════════
# 1. Add new ResourceId types to FRONTEND types.ts
# ══════════════════════════════════════════════════════════════════════════════
print("═══ Adding new ore ResourceIds to frontend types.ts ═══")

with open('frontend/src/game/types.ts', 'r') as f:
    code = f.read()

# Add new ore types to ResourceId union
old_rid = '''  | "plasma-coil"
  | "bio-crystal";'''

new_rid = '''  | "plasma-coil"
  | "bio-crystal"
  // mineable ores (zone-specific asteroid drops)
  | "copper"
  | "cobalt"
  | "crystal-shard"
  | "palladium"
  | "helium-3"
  | "iridium"
  | "sulfur"
  | "obsidian";'''

if old_rid in code:
    code = code.replace(old_rid, new_rid)
    print("  -> Added 8 new ResourceId types")
else:
    print("  -> WARNING: Could not find ResourceId end")

# Add new RESOURCES entries
old_res_end = '''  "bio-crystal":   { id: "bio-crystal", name: "Bio Crystal",     basePrice: 195, glyph: "◇", color: "#44ff88", description: "Living crystalline organisms. Medical and research value." },
};'''

new_res_end = '''  "bio-crystal":   { id: "bio-crystal", name: "Bio Crystal",     basePrice: 195, glyph: "◇", color: "#44ff88", description: "Living crystalline organisms. Medical and research value." },
  // mineable ores
  copper:          { id: "copper",          name: "Copper Ore",       basePrice: 22,  glyph: "▰", color: "#e8a050", description: "Common conductive ore. Used in wiring and circuitry." },
  cobalt:          { id: "cobalt",          name: "Cobalt Ore",       basePrice: 48,  glyph: "▰", color: "#4466cc", description: "Dense blue ore. Essential for high-strength alloys." },
  "crystal-shard": { id: "crystal-shard",   name: "Crystal Shard",    basePrice: 135, glyph: "◆", color: "#cc88ff", description: "Prismatic energy crystal. Powers advanced shield tech." },
  palladium:       { id: "palladium",       name: "Palladium",        basePrice: 210, glyph: "◈", color: "#d4e4f0", description: "Precious catalytic metal. Rare and highly sought." },
  "helium-3":      { id: "helium-3",        name: "Helium-3",         basePrice: 95,  glyph: "◎", color: "#88ddaa", description: "Fusion fuel isotope. Harvested from gas-rich nebulae." },
  iridium:         { id: "iridium",         name: "Iridium Ore",      basePrice: 380, glyph: "▣", color: "#f0e068", description: "Ultra-dense precious metal. Only found in danger zones." },
  sulfur:          { id: "sulfur",          name: "Sulfur Deposit",   basePrice: 30,  glyph: "▰", color: "#cccc44", description: "Volcanic mineral. Common near Venus cloud layers." },
  obsidian:        { id: "obsidian",        name: "Void Obsidian",    basePrice: 165, glyph: "▣", color: "#6644aa", description: "Dark glass forged in the void. Valued for hull reinforcement." },
};'''

if old_res_end in code:
    code = code.replace(old_res_end, new_res_end)
    print("  -> Added 8 new RESOURCES entries")
else:
    print("  -> WARNING: Could not find RESOURCES end")

# Add ZONE_ASTEROID_YIELDS table after RESOURCES
zone_yields = '''

// Zone-specific asteroid yield pools (weighted)
export const ZONE_ASTEROID_YIELDS: Record<ZoneId, { resourceId: ResourceId; weight: number }[]> = {
  // Earth faction (tier 1-5)
  alpha:     [{ resourceId: "iron", weight: 45 }, { resourceId: "copper", weight: 35 }, { resourceId: "lumenite", weight: 15 }, { resourceId: "cobalt", weight: 5 }],
  nebula:    [{ resourceId: "iron", weight: 25 }, { resourceId: "copper", weight: 20 }, { resourceId: "lumenite", weight: 25 }, { resourceId: "helium-3", weight: 20 }, { resourceId: "cobalt", weight: 10 }],
  crimson:   [{ resourceId: "iron", weight: 15 }, { resourceId: "cobalt", weight: 30 }, { resourceId: "lumenite", weight: 20 }, { resourceId: "crystal-shard", weight: 25 }, { resourceId: "copper", weight: 10 }],
  void:      [{ resourceId: "cobalt", weight: 20 }, { resourceId: "lumenite", weight: 15 }, { resourceId: "crystal-shard", weight: 25 }, { resourceId: "obsidian", weight: 25 }, { resourceId: "palladium", weight: 15 }],
  forge:     [{ resourceId: "iron", weight: 10 }, { resourceId: "cobalt", weight: 15 }, { resourceId: "crystal-shard", weight: 20 }, { resourceId: "palladium", weight: 30 }, { resourceId: "iridium", weight: 15 }, { resourceId: "obsidian", weight: 10 }],
  // Mars faction (tier 1-5)
  corona:    [{ resourceId: "iron", weight: 40 }, { resourceId: "copper", weight: 25 }, { resourceId: "lumenite", weight: 20 }, { resourceId: "helium-3", weight: 10 }, { resourceId: "cobalt", weight: 5 }],
  fracture:  [{ resourceId: "iron", weight: 15 }, { resourceId: "copper", weight: 15 }, { resourceId: "cobalt", weight: 25 }, { resourceId: "lumenite", weight: 20 }, { resourceId: "helium-3", weight: 15 }, { resourceId: "crystal-shard", weight: 10 }],
  abyss:     [{ resourceId: "cobalt", weight: 20 }, { resourceId: "lumenite", weight: 10 }, { resourceId: "crystal-shard", weight: 25 }, { resourceId: "obsidian", weight: 20 }, { resourceId: "palladium", weight: 15 }, { resourceId: "helium-3", weight: 10 }],
  marsdepth: [{ resourceId: "cobalt", weight: 10 }, { resourceId: "crystal-shard", weight: 20 }, { resourceId: "obsidian", weight: 20 }, { resourceId: "palladium", weight: 25 }, { resourceId: "iridium", weight: 15 }, { resourceId: "helium-3", weight: 10 }],
  maelstrom: [{ resourceId: "crystal-shard", weight: 15 }, { resourceId: "obsidian", weight: 15 }, { resourceId: "palladium", weight: 25 }, { resourceId: "iridium", weight: 25 }, { resourceId: "cobalt", weight: 10 }, { resourceId: "helium-3", weight: 10 }],
  // Venus faction (tier 1-5)
  venus1:    [{ resourceId: "iron", weight: 35 }, { resourceId: "copper", weight: 20 }, { resourceId: "sulfur", weight: 30 }, { resourceId: "lumenite", weight: 10 }, { resourceId: "cobalt", weight: 5 }],
  venus2:    [{ resourceId: "iron", weight: 15 }, { resourceId: "sulfur", weight: 25 }, { resourceId: "copper", weight: 15 }, { resourceId: "cobalt", weight: 20 }, { resourceId: "lumenite", weight: 15 }, { resourceId: "helium-3", weight: 10 }],
  venus3:    [{ resourceId: "sulfur", weight: 15 }, { resourceId: "cobalt", weight: 20 }, { resourceId: "crystal-shard", weight: 25 }, { resourceId: "lumenite", weight: 15 }, { resourceId: "obsidian", weight: 15 }, { resourceId: "copper", weight: 10 }],
  venus4:    [{ resourceId: "crystal-shard", weight: 25 }, { resourceId: "obsidian", weight: 20 }, { resourceId: "palladium", weight: 20 }, { resourceId: "sulfur", weight: 10 }, { resourceId: "cobalt", weight: 15 }, { resourceId: "helium-3", weight: 10 }],
  venus5:    [{ resourceId: "obsidian", weight: 15 }, { resourceId: "palladium", weight: 25 }, { resourceId: "iridium", weight: 20 }, { resourceId: "crystal-shard", weight: 20 }, { resourceId: "cobalt", weight: 10 }, { resourceId: "sulfur", weight: 10 }],
  // Danger zones (tier 4-7) — premium ores
  danger1:   [{ resourceId: "crystal-shard", weight: 20 }, { resourceId: "palladium", weight: 25 }, { resourceId: "iridium", weight: 20 }, { resourceId: "obsidian", weight: 20 }, { resourceId: "cobalt", weight: 15 }],
  danger2:   [{ resourceId: "palladium", weight: 25 }, { resourceId: "iridium", weight: 25 }, { resourceId: "obsidian", weight: 20 }, { resourceId: "crystal-shard", weight: 15 }, { resourceId: "helium-3", weight: 15 }],
  danger3:   [{ resourceId: "iridium", weight: 30 }, { resourceId: "palladium", weight: 25 }, { resourceId: "obsidian", weight: 15 }, { resourceId: "crystal-shard", weight: 15 }, { resourceId: "cobalt", weight: 15 }],
  danger4:   [{ resourceId: "iridium", weight: 35 }, { resourceId: "palladium", weight: 25 }, { resourceId: "obsidian", weight: 20 }, { resourceId: "crystal-shard", weight: 10 }, { resourceId: "helium-3", weight: 10 }],
  danger5:   [{ resourceId: "iridium", weight: 40 }, { resourceId: "palladium", weight: 25 }, { resourceId: "obsidian", weight: 15 }, { resourceId: "crystal-shard", weight: 10 }, { resourceId: "helium-3", weight: 10 }],
};

export function pickAsteroidYield(zone: ZoneId): ResourceId {
  const pool = ZONE_ASTEROID_YIELDS[zone];
  if (!pool || pool.length === 0) return "iron";
  const totalW = pool.reduce((s, e) => s + e.weight, 0);
  let roll = Math.random() * totalW;
  for (const entry of pool) {
    roll -= entry.weight;
    if (roll <= 0) return entry.resourceId;
  }
  return pool[pool.length - 1].resourceId;
}'''

# Insert after RESOURCES closing brace, before STATIONS
old_stations_start = '\nexport const STATIONS: Station[] = ['
new_stations_start = zone_yields + '\n\nexport const STATIONS: Station[] = ['

if old_stations_start in code:
    code = code.replace(old_stations_start, new_stations_start, 1)
    print("  -> Added ZONE_ASTEROID_YIELDS table + pickAsteroidYield()")
else:
    print("  -> WARNING: Could not find STATIONS start")

# Add new ore prices to some key stations
# Mining stations should buy ores cheap
station_price_updates = {
    # Iron Belt Refinery (alpha, mining) - cheap ores
    '"iron-belt"': {'copper': 0.65, 'cobalt': 0.8},
    # Forge Gate Depot (forge, trade) - industrial ores
    '"forge-gate"': {'cobalt': 0.6, 'palladium': 0.8, 'copper': 0.7},
    # Forge Market
    '"forge-market"': {'cobalt': 0.55, 'copper': 0.6, 'palladium': 0.7},
    # Solar Haven (corona, outpost) - energy crystals
    '"solar-haven"': {'"crystal-shard"': 0.7, '"helium-3"': 0.6},
    # Corona Exchange
    '"corona-exchange"': {'"helium-3"': 0.55, '"crystal-shard"': 0.65},
    # Mist Dock (venus1, mining) - sulfur and copper
    '"mist-dock"': {'sulfur': 0.55, 'copper': 0.6},
    # Acid Exchange (venus3, mining)
    '"acid-exchange"': {'sulfur': 0.5, 'cobalt': 0.65, '"crystal-shard"': 0.8},
    # Void Heart (abyss) - obsidian
    '"void-heart"': {'obsidian': 0.5, 'palladium': 0.7},
    # Abyss Exchange
    '"abyss-exchange"': {'obsidian': 0.55, 'palladium': 0.6, 'iridium': 0.7},
    # Storm Bazaar (maelstrom) - rare ores
    '"storm-bazaar"': {'palladium': 0.6, 'iridium': 0.65, 'obsidian': 0.7},
    # Danger zone stations - premium ore prices
    '"danger1-trade"': {'iridium': 0.5, 'palladium': 0.6, 'obsidian': 0.65},
    '"danger5-trade"': {'iridium': 0.4, 'palladium': 0.5},
    # Trade hubs should sell ores at premium (buy from players at good prices)
    '"helix"': {'copper': 1.2, 'cobalt': 1.3},
    '"azure-port"': {'cobalt': 1.1, '"crystal-shard"': 1.3, '"helium-3"': 1.2},
    '"ember"': {'cobalt': 1.4, '"crystal-shard"': 1.5},
    '"scarlet-yard"': {'copper': 1.3, 'cobalt': 1.2},
    '"cloud-gate"': {'sulfur': 1.2, 'copper': 1.1},
    '"venus-bastion"': {'obsidian': 1.4, 'palladium': 1.3, 'iridium': 1.5},
    '"eye-bazaar"': {'palladium': 0.7, 'iridium': 0.8, 'obsidian': 0.6},
}

for station_id, prices in station_price_updates.items():
    # Find the station's prices block and add new entries
    # Look for the station id and its prices closing }
    pattern = f'id: {station_id},'
    if pattern in code:
        # Find the prices: { ... } for this station
        idx = code.index(pattern)
        # Find "prices: {" after this
        prices_start = code.index('prices: {', idx)
        prices_end = code.index('}', prices_start + 9)
        # Build new price entries
        extra = ', '.join(f'{k}: {v}' for k, v in prices.items())
        # Insert before closing brace
        code = code[:prices_end] + ', ' + extra + code[prices_end:]

print("  -> Added new ore prices to key stations")

with open('frontend/src/game/types.ts', 'w') as f:
    f.write(code)

# ══════════════════════════════════════════════════════════════════════════════
# 2. Add new ResourceId types to BACKEND data.ts
# ══════════════════════════════════════════════════════════════════════════════
print("\n═══ Adding new ore ResourceIds to backend data.ts ═══")

with open('backend/src/game/data.ts', 'r') as f:
    bcode = f.read()

# Add to ResourceId type
old_brid = '''  | "dark-matter" | "plasma-coil" | "bio-crystal";'''
new_brid = '''  | "dark-matter" | "plasma-coil" | "bio-crystal"
  | "copper" | "cobalt" | "crystal-shard" | "palladium"
  | "helium-3" | "iridium" | "sulfur" | "obsidian";'''

if old_brid in bcode:
    bcode = bcode.replace(old_brid, new_brid)
    print("  -> Added 8 new backend ResourceId types")
else:
    print("  -> WARNING: Could not find backend ResourceId end")

# Add to backend RESOURCES
old_bres_end = '''  "bio-crystal":   { id: "bio-crystal",     name: "Bio Crystal",      basePrice: 195 },
};'''

new_bres_end = '''  "bio-crystal":   { id: "bio-crystal",     name: "Bio Crystal",      basePrice: 195 },
  // mineable ores
  copper:          { id: "copper",          name: "Copper Ore",       basePrice: 22 },
  cobalt:          { id: "cobalt",          name: "Cobalt Ore",       basePrice: 48 },
  "crystal-shard": { id: "crystal-shard",   name: "Crystal Shard",    basePrice: 135 },
  palladium:       { id: "palladium",       name: "Palladium",        basePrice: 210 },
  "helium-3":      { id: "helium-3",        name: "Helium-3",         basePrice: 95 },
  iridium:         { id: "iridium",         name: "Iridium Ore",      basePrice: 380 },
  sulfur:          { id: "sulfur",          name: "Sulfur Deposit",   basePrice: 30 },
  obsidian:        { id: "obsidian",        name: "Void Obsidian",    basePrice: 165 },
};'''

if old_bres_end in bcode:
    bcode = bcode.replace(old_bres_end, new_bres_end)
    print("  -> Added 8 new backend RESOURCES entries")
else:
    print("  -> WARNING: Could not find backend RESOURCES end")

# Add ZONE_ASTEROID_YIELDS to backend
zone_yields_backend = '''

// Zone-specific asteroid yield pools (weighted)
export const ZONE_ASTEROID_YIELDS: Record<string, { resourceId: ResourceId; weight: number }[]> = {
  alpha:     [{ resourceId: "iron", weight: 45 }, { resourceId: "copper", weight: 35 }, { resourceId: "lumenite", weight: 15 }, { resourceId: "cobalt", weight: 5 }],
  nebula:    [{ resourceId: "iron", weight: 25 }, { resourceId: "copper", weight: 20 }, { resourceId: "lumenite", weight: 25 }, { resourceId: "helium-3", weight: 20 }, { resourceId: "cobalt", weight: 10 }],
  crimson:   [{ resourceId: "iron", weight: 15 }, { resourceId: "cobalt", weight: 30 }, { resourceId: "lumenite", weight: 20 }, { resourceId: "crystal-shard", weight: 25 }, { resourceId: "copper", weight: 10 }],
  void:      [{ resourceId: "cobalt", weight: 20 }, { resourceId: "lumenite", weight: 15 }, { resourceId: "crystal-shard", weight: 25 }, { resourceId: "obsidian", weight: 25 }, { resourceId: "palladium", weight: 15 }],
  forge:     [{ resourceId: "iron", weight: 10 }, { resourceId: "cobalt", weight: 15 }, { resourceId: "crystal-shard", weight: 20 }, { resourceId: "palladium", weight: 30 }, { resourceId: "iridium", weight: 15 }, { resourceId: "obsidian", weight: 10 }],
  corona:    [{ resourceId: "iron", weight: 40 }, { resourceId: "copper", weight: 25 }, { resourceId: "lumenite", weight: 20 }, { resourceId: "helium-3", weight: 10 }, { resourceId: "cobalt", weight: 5 }],
  fracture:  [{ resourceId: "iron", weight: 15 }, { resourceId: "copper", weight: 15 }, { resourceId: "cobalt", weight: 25 }, { resourceId: "lumenite", weight: 20 }, { resourceId: "helium-3", weight: 15 }, { resourceId: "crystal-shard", weight: 10 }],
  abyss:     [{ resourceId: "cobalt", weight: 20 }, { resourceId: "lumenite", weight: 10 }, { resourceId: "crystal-shard", weight: 25 }, { resourceId: "obsidian", weight: 20 }, { resourceId: "palladium", weight: 15 }, { resourceId: "helium-3", weight: 10 }],
  marsdepth: [{ resourceId: "cobalt", weight: 10 }, { resourceId: "crystal-shard", weight: 20 }, { resourceId: "obsidian", weight: 20 }, { resourceId: "palladium", weight: 25 }, { resourceId: "iridium", weight: 15 }, { resourceId: "helium-3", weight: 10 }],
  maelstrom: [{ resourceId: "crystal-shard", weight: 15 }, { resourceId: "obsidian", weight: 15 }, { resourceId: "palladium", weight: 25 }, { resourceId: "iridium", weight: 25 }, { resourceId: "cobalt", weight: 10 }, { resourceId: "helium-3", weight: 10 }],
  venus1:    [{ resourceId: "iron", weight: 35 }, { resourceId: "copper", weight: 20 }, { resourceId: "sulfur", weight: 30 }, { resourceId: "lumenite", weight: 10 }, { resourceId: "cobalt", weight: 5 }],
  venus2:    [{ resourceId: "iron", weight: 15 }, { resourceId: "sulfur", weight: 25 }, { resourceId: "copper", weight: 15 }, { resourceId: "cobalt", weight: 20 }, { resourceId: "lumenite", weight: 15 }, { resourceId: "helium-3", weight: 10 }],
  venus3:    [{ resourceId: "sulfur", weight: 15 }, { resourceId: "cobalt", weight: 20 }, { resourceId: "crystal-shard", weight: 25 }, { resourceId: "lumenite", weight: 15 }, { resourceId: "obsidian", weight: 15 }, { resourceId: "copper", weight: 10 }],
  venus4:    [{ resourceId: "crystal-shard", weight: 25 }, { resourceId: "obsidian", weight: 20 }, { resourceId: "palladium", weight: 20 }, { resourceId: "sulfur", weight: 10 }, { resourceId: "cobalt", weight: 15 }, { resourceId: "helium-3", weight: 10 }],
  venus5:    [{ resourceId: "obsidian", weight: 15 }, { resourceId: "palladium", weight: 25 }, { resourceId: "iridium", weight: 20 }, { resourceId: "crystal-shard", weight: 20 }, { resourceId: "cobalt", weight: 10 }, { resourceId: "sulfur", weight: 10 }],
  danger1:   [{ resourceId: "crystal-shard", weight: 20 }, { resourceId: "palladium", weight: 25 }, { resourceId: "iridium", weight: 20 }, { resourceId: "obsidian", weight: 20 }, { resourceId: "cobalt", weight: 15 }],
  danger2:   [{ resourceId: "palladium", weight: 25 }, { resourceId: "iridium", weight: 25 }, { resourceId: "obsidian", weight: 20 }, { resourceId: "crystal-shard", weight: 15 }, { resourceId: "helium-3", weight: 15 }],
  danger3:   [{ resourceId: "iridium", weight: 30 }, { resourceId: "palladium", weight: 25 }, { resourceId: "obsidian", weight: 15 }, { resourceId: "crystal-shard", weight: 15 }, { resourceId: "cobalt", weight: 15 }],
  danger4:   [{ resourceId: "iridium", weight: 35 }, { resourceId: "palladium", weight: 25 }, { resourceId: "obsidian", weight: 20 }, { resourceId: "crystal-shard", weight: 10 }, { resourceId: "helium-3", weight: 10 }],
  danger5:   [{ resourceId: "iridium", weight: 40 }, { resourceId: "palladium", weight: 25 }, { resourceId: "obsidian", weight: 15 }, { resourceId: "crystal-shard", weight: 10 }, { resourceId: "helium-3", weight: 10 }],
};

export function pickAsteroidYield(zone: string): ResourceId {
  const pool = ZONE_ASTEROID_YIELDS[zone];
  if (!pool || pool.length === 0) return "iron" as ResourceId;
  const totalW = pool.reduce((s, e) => s + e.weight, 0);
  let roll = Math.random() * totalW;
  for (const entry of pool) {
    roll -= entry.weight;
    if (roll <= 0) return entry.resourceId;
  }
  return pool[pool.length - 1].resourceId;
}'''

# Insert before QUEST_POOL
old_quest_start = '\n// ── QUEST POOL'
new_quest_start = zone_yields_backend + '\n\n// ── QUEST POOL'

if old_quest_start in bcode:
    bcode = bcode.replace(old_quest_start, new_quest_start, 1)
    print("  -> Added backend ZONE_ASTEROID_YIELDS + pickAsteroidYield()")
else:
    print("  -> WARNING: Could not find QUEST_POOL start")

with open('backend/src/game/data.ts', 'w') as f:
    f.write(bcode)

# ══════════════════════════════════════════════════════════════════════════════
# 3. Update BACKEND engine.ts to use zone-specific yields
# ══════════════════════════════════════════════════════════════════════════════
print("\n═══ Updating backend asteroid spawning ═══")

with open('backend/src/game/engine.ts', 'r') as f:
    ecode = f.read()

# Add pickAsteroidYield import
if 'pickAsteroidYield' not in ecode:
    old_import = 'import { ZONES,'
    if old_import in ecode:
        ecode = ecode.replace(old_import, 'import { ZONES, pickAsteroidYield,')
        print("  -> Added pickAsteroidYield import")
    else:
        # Try alternate import pattern
        old_import2 = 'import {\n  ZONES,'
        if old_import2 in ecode:
            ecode = ecode.replace(old_import2, 'import {\n  ZONES, pickAsteroidYield,')
            print("  -> Added pickAsteroidYield import (alt)")
        else:
            print("  -> WARNING: Could not find ZONES import")

# Update initial asteroid creation
old_ast_create = '''        yields: isLumenite ? "lumenite" as ResourceId : "iron" as ResourceId,'''
new_ast_create = '''        yields: pickAsteroidYield(zoneId),'''

if old_ast_create in ecode:
    ecode = ecode.replace(old_ast_create, new_ast_create)
    print("  -> Updated initial asteroid creation to use zone yields")
else:
    print("  -> WARNING: Could not find initial asteroid creation")

# Remove the unused isLumenite variable for initial creation
old_islum = '''      const isLumenite = Math.random() < 0.18;
      const ast: ServerAsteroid = {'''
new_islum = '''      const ast: ServerAsteroid = {'''
if old_islum in ecode:
    ecode = ecode.replace(old_islum, new_islum)
    print("  -> Removed unused isLumenite variable")

# Update asteroid respawn
old_respawn = '''        ast.yields = (Math.random() < 0.18 ? "lumenite" : "iron") as ResourceId;'''
new_respawn = '''        ast.yields = pickAsteroidYield(zoneId);'''

if old_respawn in ecode:
    ecode = ecode.replace(old_respawn, new_respawn)
    print("  -> Updated asteroid respawn to use zone yields")
else:
    print("  -> WARNING: Could not find asteroid respawn yield")

with open('backend/src/game/engine.ts', 'w') as f:
    f.write(ecode)

# ══════════════════════════════════════════════════════════════════════════════
# 4. Update FRONTEND store.ts makeAsteroids to use zone-specific yields
# ══════════════════════════════════════════════════════════════════════════════
print("\n═══ Updating frontend asteroid spawning ═══")

with open('frontend/src/game/store.ts', 'r') as f:
    scode = f.read()

# Add pickAsteroidYield import
if 'pickAsteroidYield' not in scode:
    old_simport = 'import { SHIP_CLASSES'
    if old_simport in scode:
        # Find the full import line
        idx = scode.index(old_simport)
        end = scode.index('\n', idx)
        old_line = scode[idx:end]
        if 'pickAsteroidYield' not in old_line:
            new_line = old_line.rstrip().rstrip(';').rstrip('"').rstrip("'")
            # Just add to the import from types
            scode = scode.replace(
                'from "./types";',
                'pickAsteroidYield, } from "./types";',
                1
            ) if 'from "./types";' in scode else scode
            if 'from "./types"' in scode and 'pickAsteroidYield' not in scode:
                # Try different pattern
                import_match = re.search(r'(} from "./types")', scode)
                if import_match:
                    scode = scode[:import_match.start()] + 'pickAsteroidYield, ' + scode[import_match.start():]
            print("  -> Added pickAsteroidYield import to store.ts")

# Update makeAsteroids
old_make = '''    const yieldsLumenite = Math.random() < 0.18;
    out.push({
      id: `ast-${i}-${Math.random().toString(36).slice(2, 6)}`,
      pos: { x, y },
      hp: size * 4,
      hpMax: size * 4,
      size,
      rotation: Math.random() * Math.PI * 2,
      rotSpeed: (Math.random() - 0.5) * 0.4,
      zone,
      yields: yieldsLumenite ? "lumenite" : "iron",
    });'''

new_make = '''    out.push({
      id: `ast-${i}-${Math.random().toString(36).slice(2, 6)}`,
      pos: { x, y },
      hp: size * 4,
      hpMax: size * 4,
      size,
      rotation: Math.random() * Math.PI * 2,
      rotSpeed: (Math.random() - 0.5) * 0.4,
      zone,
      yields: pickAsteroidYield(zone),
    });'''

if old_make in scode:
    scode = scode.replace(old_make, new_make)
    print("  -> Updated makeAsteroids to use zone yields")
else:
    print("  -> WARNING: Could not find makeAsteroids yield code")

with open('frontend/src/game/store.ts', 'w') as f:
    f.write(scode)

# ══════════════════════════════════════════════════════════════════════════════
# 5. Update FRONTEND render.ts to use resource colors for asteroids
# ══════════════════════════════════════════════════════════════════════════════
print("\n═══ Updating asteroid rendering ═══")

with open('frontend/src/game/render.ts', 'r') as f:
    rcode = f.read()

# Add RESOURCES import if not present
if 'RESOURCES' not in rcode.split('from "./types"')[0]:
    old_rimport = 'from "./types"'
    if old_rimport in rcode:
        # Find the import block
        idx = rcode.index(old_rimport)
        # Go back to find the start of this import
        line_start = rcode.rfind('\n', 0, idx) + 1
        old_import_line = rcode[line_start:rcode.index('\n', idx)]
        if 'RESOURCES' not in old_import_line:
            # Add RESOURCES to the import
            import_match = re.search(r'(}\s*from\s*"./types")', rcode)
            if import_match:
                rcode = rcode[:import_match.start()] + 'RESOURCES, ' + rcode[import_match.start():]
                print("  -> Added RESOURCES import to render.ts")

# Replace hardcoded asteroid colors with dynamic resource colors
old_draw_ast = '''  const isLumen = a.yields === "lumenite";
  const c = isLumen ? "#7ad8ff" : "#a8784a";
  const dk = isLumen ? "#3a78a8" : "#604028";
  const lt = isLumen ? "#cdeaff" : "#d8a888";'''

new_draw_ast = '''  const res = RESOURCES[a.yields];
  const c = res ? res.color : "#a8784a";
  const dk = shadeHex(c, -0.4);
  const lt = shadeHex(c, 0.4);
  const isGlowing = ["lumenite", "crystal-shard", "helium-3", "palladium", "iridium"].includes(a.yields);'''

if old_draw_ast in rcode:
    rcode = rcode.replace(old_draw_ast, new_draw_ast)
    print("  -> Updated drawAsteroid to use dynamic resource colors")
else:
    print("  -> WARNING: Could not find drawAsteroid color code")

# Update the glow pixel logic
old_glow = '''  if (isLumen) {
    px(ctx, -2*s, -2*s, 2*s, 2*s, "#ffffff");
    px(ctx, 2*s, 2*s, 2*s, 2*s, "#ffffff");
  } else {
    px(ctx, -2*s, -2*s, 2*s, 2*s, dk);
    px(ctx, 4*s, 2*s, 2*s, 2*s, dk);
  }'''

new_glow = '''  if (isGlowing) {
    px(ctx, -2*s, -2*s, 2*s, 2*s, "#ffffff");
    px(ctx, 2*s, 2*s, 2*s, 2*s, "#ffffff");
  } else {
    px(ctx, -2*s, -2*s, 2*s, 2*s, dk);
    px(ctx, 4*s, 2*s, 2*s, 2*s, dk);
  }'''

if old_glow in rcode:
    rcode = rcode.replace(old_glow, new_glow)
    print("  -> Updated asteroid glow pixels for new ore types")
else:
    print("  -> WARNING: Could not find asteroid glow pixel code")

with open('frontend/src/game/render.ts', 'w') as f:
    f.write(rcode)

# ══════════════════════════════════════════════════════════════════════════════
# 6. Update FRONTEND MiniMap.tsx asteroid colors
# ══════════════════════════════════════════════════════════════════════════════
print("\n═══ Updating minimap asteroid colors ═══")

with open('frontend/src/components/MiniMap.tsx', 'r') as f:
    mcode = f.read()

# Add RESOURCES import
if 'RESOURCES' not in mcode:
    old_mimport = 'from "../game/types"'
    if old_mimport in mcode:
        import_match = re.search(r'(}\s*from\s*"../game/types")', mcode)
        if import_match:
            mcode = mcode[:import_match.start()] + 'RESOURCES, ' + mcode[import_match.start():]
            print("  -> Added RESOURCES import to MiniMap.tsx")

# Replace hardcoded minimap asteroid colors (full map)
old_mcolor1 = 'fill={a.yields === "lumenite" ? "#7ad8ff" : "#a8784a"} opacity={0.6}'
new_mcolor1 = 'fill={RESOURCES[a.yields]?.color ?? "#a8784a"} opacity={0.6}'
if old_mcolor1 in mcode:
    mcode = mcode.replace(old_mcolor1, new_mcolor1)
    print("  -> Updated full minimap asteroid colors")

# Replace hardcoded minimap asteroid colors (mini map)
old_mcolor2 = 'fill={a.yields === "lumenite" ? "#7ad8ff" : "#a8784a"}'
new_mcolor2 = 'fill={RESOURCES[a.yields]?.color ?? "#a8784a"}'
if old_mcolor2 in mcode:
    mcode = mcode.replace(old_mcolor2, new_mcolor2)
    print("  -> Updated mini minimap asteroid colors")

with open('frontend/src/components/MiniMap.tsx', 'w') as f:
    f.write(mcode)

# ══════════════════════════════════════════════════════════════════════════════
# 7. Update FRONTEND App.tsx asteroid target display
# ══════════════════════════════════════════════════════════════════════════════
print("\n═══ Updating asteroid target display ═══")

with open('frontend/src/App.tsx', 'r') as f:
    acode = f.read()

# Add RESOURCES import
if 'RESOURCES' not in acode:
    old_aimport = 'DUNGEONS, STATIONS, PORTALS, ZONES, MODULE_DEFS'
    new_aimport = 'DUNGEONS, STATIONS, PORTALS, ZONES, MODULE_DEFS, RESOURCES'
    if old_aimport in acode:
        acode = acode.replace(old_aimport, new_aimport)
        print("  -> Added RESOURCES import to App.tsx")

# Update asteroid name display
old_aname = '''        name: asteroid.yields === "lumenite" ? "LUMENITE ROCK" : "ORE ROCK",
        detail: `${asteroid.yields.toUpperCase()} · ${Math.round(asteroid.hp)}/${Math.round(asteroid.hpMax)} HP`,'''

new_aname = '''        name: `${(RESOURCES[asteroid.yields]?.name ?? "Ore").toUpperCase()} ROCK`,
        detail: `${Math.round(asteroid.hp)}/${Math.round(asteroid.hpMax)} HP`,'''

if old_aname in acode:
    acode = acode.replace(old_aname, new_aname)
    print("  -> Updated asteroid target name display")
else:
    print("  -> WARNING: Could not find asteroid name display")

with open('frontend/src/App.tsx', 'w') as f:
    f.write(acode)

# ══════════════════════════════════════════════════════════════════════════════
# 8. Update FRONTEND loop.ts asteroid destroy floater + respawn
# ══════════════════════════════════════════════════════════════════════════════
print("\n═══ Updating asteroid floater text ═══")

with open('frontend/src/game/loop.ts', 'r') as f:
    lcode = f.read()

# Add RESOURCES import if needed
if 'RESOURCES' not in lcode.split('from "./types"')[0]:
    import_match = re.search(r'(}\s*from\s*"./types")', lcode)
    if import_match:
        if 'RESOURCES' not in lcode[:import_match.start() + 200]:
            lcode = lcode[:import_match.start()] + 'RESOURCES, ' + lcode[import_match.start():]
            print("  -> Added RESOURCES import to loop.ts")

# Add pickAsteroidYield import
if 'pickAsteroidYield' not in lcode:
    import_match = re.search(r'(}\s*from\s*"./types")', lcode)
    if import_match:
        lcode = lcode[:import_match.start()] + 'pickAsteroidYield, ' + lcode[import_match.start():]
        print("  -> Added pickAsteroidYield import to loop.ts")

# Update floater text
old_floater = '''    pushFloater({ text: `+${got} ${a.yields === "iron" ? "Iron" : "Lumenite"}`, color: "#5cff8a", x: a.pos.x, y: a.pos.y - 12, scale: 1, ttl: 0.9 });'''
new_floater = '''    const res = RESOURCES[a.yields];
    pushFloater({ text: `+${got} ${res?.name ?? a.yields}`, color: res?.color ?? "#5cff8a", x: a.pos.x, y: a.pos.y - 12, scale: 1, ttl: 0.9 });'''

if old_floater in lcode:
    lcode = lcode.replace(old_floater, new_floater)
    print("  -> Updated asteroid destroy floater text")
else:
    print("  -> WARNING: Could not find asteroid floater text")

# Update local asteroid respawn (in destroyAsteroid)
old_local_respawn = '''      yields: yieldsLumenite ? "lumenite" : "iron",'''
new_local_respawn = '''      yields: pickAsteroidYield(state.player.zone),'''

if old_local_respawn in lcode:
    lcode = lcode.replace(old_local_respawn, new_local_respawn)
    print("  -> Updated local asteroid respawn to use zone yields")
    # Remove unused yieldsLumenite
    lcode = lcode.replace('    const yieldsLumenite = Math.random() < 0.18;\n', '')
    print("  -> Removed unused yieldsLumenite")

with open('frontend/src/game/loop.ts', 'w') as f:
    f.write(lcode)

# ══════════════════════════════════════════════════════════════════════════════
# 9. Update mining spark colors to match ore type
# ══════════════════════════════════════════════════════════════════════════════
print("\n═══ Updating mining spark colors ═══")

with open('frontend/src/game/loop.ts', 'r') as f:
    lcode = f.read()

# Update mining debris color to match ore
old_spark = '          emitSpark(rx, ry, "#c69060", 2, 40, 1);'
new_spark = '          const oreColor = RESOURCES[mAst.yields]?.color ?? "#c69060";\n          emitSpark(rx, ry, oreColor, 2, 40, 1);'

if old_spark in lcode:
    lcode = lcode.replace(old_spark, new_spark)
    print("  -> Updated mining spark color to match ore type")

# Update debris particle color
old_debris_color = '''            color: Math.random() > 0.5 ? "#c0a070" : "#8a7050",'''
new_debris_color = '''            color: Math.random() > 0.5 ? (RESOURCES[mAst.yields]?.color ?? "#c0a070") : shadeHex(RESOURCES[mAst.yields]?.color ?? "#8a7050", -0.3),'''

if old_debris_color in lcode:
    lcode = lcode.replace(old_debris_color, new_debris_color)
    print("  -> Updated mining debris color to match ore type")
    # Need shadeHex in loop.ts
    if 'function shadeHex' not in lcode and 'shadeHex' in lcode:
        # Add a simple shadeHex helper at the top of the file after imports
        shade_fn = '''
function shadeHex(hex: string, factor: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const f = factor > 0 ? factor : factor;
  const nr = factor > 0 ? Math.min(255, r + (255 - r) * f) : Math.max(0, r + r * f);
  const ng = factor > 0 ? Math.min(255, g + (255 - g) * f) : Math.max(0, g + g * f);
  const nb = factor > 0 ? Math.min(255, b + (255 - b) * f) : Math.max(0, b + b * f);
  return `#${Math.round(nr).toString(16).padStart(2, "0")}${Math.round(ng).toString(16).padStart(2, "0")}${Math.round(nb).toString(16).padStart(2, "0")}`;
}
'''
        # Insert after imports, before first export
        first_export = lcode.index('\nexport ')
        lcode = lcode[:first_export] + shade_fn + lcode[first_export:]
        print("  -> Added shadeHex helper to loop.ts")

with open('frontend/src/game/loop.ts', 'w') as f:
    f.write(lcode)

print("\n" + "=" * 60)
print("DONE! Batch 2 Part 1: New Ores + Zone-Specific Asteroids")
print("=" * 60)
print("\nNew mineable ores added:")
print("  - Copper Ore (22cr) - Common, tier 1-2 zones")
print("  - Cobalt Ore (48cr) - Medium, tier 2-3 zones")
print("  - Helium-3 (95cr) - Gas nebulae zones")
print("  - Crystal Shard (135cr) - Rare, tier 3-4 zones")
print("  - Void Obsidian (165cr) - Medium-rare, void/abyss")
print("  - Palladium (210cr) - Precious, tier 4-5 zones")
print("  - Iridium Ore (380cr) - Ultra-rare, danger zones")
print("  - Sulfur Deposit (30cr) - Venus zones")
print("\nEach zone now has a unique weighted ore table.")
print("Asteroid colors dynamically match the ore type.")
