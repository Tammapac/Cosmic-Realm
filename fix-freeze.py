#!/usr/bin/env python3
"""Fix canvas freeze: add ENEMY_NAMES for new types + update frontend tier formula."""

with open('frontend/src/game/types.ts', 'r') as f:
    code = f.read()

# 1. Add missing ENEMY_NAMES entries
old_names = '''export const ENEMY_NAMES: Record<EnemyType, string[]> = {
  scout:     ["Scout"],
  raider:    ["Raider"],
  destroyer: ["Destroyer"],
  voidling:  ["Voidling"],
  dread:     ["Dread"],
};'''

new_names = '''export const ENEMY_NAMES: Record<EnemyType, string[]> = {
  scout:     ["Scout", "Dart", "Interceptor", "Stinger", "Wasp"],
  raider:    ["Raider", "Marauder", "Bandit", "Outlaw", "Pirate"],
  destroyer: ["Destroyer", "Enforcer", "Warhammer", "Ravager", "Crusher"],
  voidling:  ["Voidling", "Anomaly", "Shifter", "Phaser", "Glitch"],
  dread:     ["Dread", "Leviathan", "Warship", "Juggernaut", "Capital"],
  sentinel:  ["Sentinel", "Warden", "Guardian", "Seraph", "Enforcer"],
  wraith:    ["Wraith", "Phantom", "Specter", "Shade", "Banshee"],
  titan:     ["Titan", "Colossus", "Goliath", "Monolith", "Fortress"],
  overlord:  ["Overlord", "Sovereign", "Emperor", "Archon", "Supreme"],
};'''

if 'sentinel:' not in code[code.find('ENEMY_NAMES'):code.find('ENEMY_NAMES')+500]:
    code = code.replace(old_names, new_names)
    print("  -> Added ENEMY_NAMES for sentinel, wraith, titan, overlord")

with open('frontend/src/game/types.ts', 'w') as f:
    f.write(code)

# 2. Update frontend loop.ts tier formula to match backend (doubling)
with open('frontend/src/game/loop.ts', 'r') as f:
    lcode = f.read()

old_formula = 'const tierMult = 1 + (z.enemyTier - 1) * 0.5;'
new_formula = 'const tierMult = Math.pow(2, z.enemyTier - 1);'
count = lcode.count(old_formula)
if count > 0:
    lcode = lcode.replace(old_formula, new_formula)
    print(f"  -> Updated frontend tier formula to doubling ({count} occurrences)")

# Also check for any other old formula variants
old_formula2 = '1 + (zoneDef.enemyTier - 1) * 0.5'
if old_formula2 in lcode:
    lcode = lcode.replace(old_formula2, 'Math.pow(2, zoneDef.enemyTier - 1)')
    print("  -> Updated alt tier formula")

with open('frontend/src/game/loop.ts', 'w') as f:
    f.write(lcode)

# 3. Also add a safety check in the spawn function for missing names
with open('frontend/src/game/loop.ts', 'r') as f:
    lcode = f.read()

old_name_lookup = 'const namePool = ENEMY_NAMES[type];\n  const eName = namePool[Math.floor(Math.random() * namePool.length)];'
new_name_lookup = 'const namePool = ENEMY_NAMES[type] ?? [type];\n  const eName = namePool[Math.floor(Math.random() * namePool.length)];'
if '?? [type]' not in lcode:
    lcode = lcode.replace(old_name_lookup, new_name_lookup)
    print("  -> Added fallback for missing ENEMY_NAMES entries")

with open('frontend/src/game/loop.ts', 'w') as f:
    f.write(lcode)

print("DONE!")
